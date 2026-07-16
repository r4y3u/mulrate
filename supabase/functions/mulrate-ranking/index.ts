import { createClient } from 'npm:@supabase/supabase-js@2';
import { isAllowedNickname } from '../_shared/name-filter.ts';
import { verifyAndCalculateRate } from '../_shared/rate-engine.ts';
import { analyzeSessionRisk } from '../_shared/ranking-trust.ts';
import {
  CERTIFICATION_EXPIRES_MINUTES,
  CERTIFICATION_QUESTION_COUNT,
  CERTIFICATION_RETRY_HOURS,
  CERTIFICATION_VERSION,
  certificationTierForTypeIndex,
  createCertificationQuestions,
  evaluateCertification,
  type CertificationAnswer,
  type CertificationQuestion
} from '../_shared/certification.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/;
const MAX_RATE = 99_999_999;
const RANKING_API_VERSION = 'ranking-api-v3';
const RANKING_SCHEMA_VERSION = 6;

type DbClient = ReturnType<typeof createClient>;

function allowedOrigins(): string[] {
  return String(Deno.env.get('MULRATE_ALLOWED_ORIGINS') || '')
    .split(',').map((value) => value.trim()).filter(Boolean);
}

function originState(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowed = allowedOrigins();
  const accepted = !origin || !allowed.length || allowed.includes(origin);
  return {
    origin,
    allowed,
    accepted,
    policy: allowed.length ? 'restricted' : 'unrestricted'
  };
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = originState(req);
  const allowOrigin = !origin.allowed.length ? '*' : (origin.accepted && origin.origin ? origin.origin : 'null');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, x-mulrate-client, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function response(req: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8' } });
}

function parseKeyDictionary(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    return Object.values(parsed).map((value) => String(value || '')).filter(Boolean);
  } catch {
    return [];
  }
}

function acceptedPublishableKeys(): string[] {
  return [...parseKeyDictionary(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')), String(Deno.env.get('SUPABASE_ANON_KEY') || '')].filter(Boolean);
}

function requestApiKeyAccepted(req: Request): boolean {
  const supplied = String(req.headers.get('apikey') || '');
  if (!supplied) return false;
  return acceptedPublishableKeys().some((key) => key === supplied);
}

function adminApiKey(): string {
  const secretKeys = parseKeyDictionary(Deno.env.get('SUPABASE_SECRET_KEYS'));
  return secretKeys[0] || String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function finite(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function closeEnough(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9;
}

function fnv1a(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizeIdentity(payload: any) {
  const playerId = String(payload?.player?.playerId ?? '');
  const playerSecret = String(payload?.player?.playerSecret ?? '');
  const nickname = String(payload?.player?.nickname ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (payload?.consent !== true) return { ok: false as const, code: 'CONSENT_REQUIRED', message: '公開への同意が必要です。' };
  if (!UUID_RE.test(playerId)) return { ok: false as const, code: 'INVALID_PLAYER_ID', message: 'プレイヤーIDが不正です。' };
  if (!SECRET_RE.test(playerSecret)) return { ok: false as const, code: 'INVALID_PLAYER_SECRET', message: '端末認証情報が不正です。' };
  if (!isAllowedNickname(nickname)) return { ok: false as const, code: 'INVALID_NICKNAME', message: 'この表示名は使用できません。' };
  return { ok: true as const, playerId, playerSecret, nickname };
}

async function loadAuthenticatedPlayer(db: DbClient, payload: any) {
  const identity = normalizeIdentity(payload);
  if (!identity.ok) return identity;
  const authTokenHash = await sha256Hex(identity.playerSecret);
  const { data: player, error } = await db.from('mulrate_players')
    .select('id,nickname,auth_token_hash,current_rating,highest_rating,current_type_index,current_pattern_index,current_pattern_stay_count,ranking_status,certification_status,certification_level,certification_next_eligible_at')
    .eq('id', identity.playerId)
    .maybeSingle();
  if (error) throw error;
  if (!player) return { ok: false as const, code: 'PLAYER_NOT_FOUND', message: '先にオンライン成績を1セット送信してください。' };
  if (String(player.nickname) !== identity.nickname) return { ok: false as const, code: 'NICKNAME_IMMUTABLE', message: '保存済みのニックネームと一致しません。' };
  if (!player.auth_token_hash || String(player.auth_token_hash) !== authTokenHash) {
    return { ok: false as const, code: 'PLAYER_AUTH_FAILED', message: 'この端末IDの認証に失敗しました。' };
  }
  return { ok: true as const, ...identity, authTokenHash, player };
}

function verifyPayload(payload: any): { ok: true; data: any } | { ok: false; code: string; message: string } {
  const identity = normalizeIdentity(payload);
  if (!identity.ok) return identity;
  const { playerId, playerSecret, nickname } = identity;

  const metrics = payload?.metrics ?? {};
  const currentRating = finite(metrics.currentRating);
  const highestRating = finite(metrics.highestRating);
  const learnedCount = finite(metrics.learnedCount);
  const completedSets = finite(metrics.completedSets);
  if ([currentRating, highestRating, learnedCount, completedSets].some((v) => v === null)) {
    return { ok: false, code: 'INVALID_METRICS', message: '成績データが不正です。' };
  }
  if (currentRating! < 0 || currentRating! > MAX_RATE || highestRating! < currentRating! || highestRating! > MAX_RATE || learnedCount! < 0 || learnedCount! > 100 || completedSets! < 1) {
    return { ok: false, code: 'INVALID_METRICS', message: '成績データが範囲外です。' };
  }

  const latest = payload?.latestSession;
  const proof = latest?.verification;
  const sessionId = String(proof?.sessionId ?? '');
  if (!UUID_RE.test(sessionId)) return { ok: false, code: 'INVALID_SESSION_ID', message: 'セッションIDが不正です。' };
  if (!Array.isArray(proof?.items) || proof.items.length !== 10) return { ok: false, code: 'INVALID_ITEMS', message: '問題記録が不足しています。' };
  const startedAt = new Date(proof.startedAt);
  const finishedAt = new Date(proof.finishedAt);
  const durationMs = finite(proof.durationMs);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(finishedAt.getTime()) || durationMs === null || durationMs < 300 || durationMs > 7_200_000 || finishedAt <= startedAt) {
    return { ok: false, code: 'INVALID_DURATION', message: '所要時間が不正です。' };
  }

  let firstCorrect = 0;
  let finalCorrect = 0;
  let firstTimeSum = 0;
  const digestParts: string[] = [];
  const rateItems: Array<{ typeId: string; left: number; right: number; firstTime: number; initialCorrect: boolean; finalCorrect: boolean }> = [];
  for (const item of proof.items) {
    const left = finite(item.left);
    const right = finite(item.right);
    const firstAnswer = item.firstAnswer === null ? null : finite(item.firstAnswer);
    const retryAnswer = item.retryAnswer === null ? null : finite(item.retryAnswer);
    const firstTime = finite(item.firstTime);
    const retryTime = item.retryTime === null ? null : finite(item.retryTime);
    if (left === null || right === null || firstAnswer === null || firstTime === null || firstTime < 0.05 || firstTime > 900 || (retryTime !== null && (retryTime < 0.05 || retryTime > 900))) {
      return { ok: false, code: 'INVALID_PROBLEM', message: '問題記録が不正です。' };
    }
    const expected = Math.round((left * right + Number.EPSILON) * 1_000_000) / 1_000_000;
    const initial = closeEnough(firstAnswer, expected);
    const final = initial || (retryAnswer !== null && closeEnough(retryAnswer, expected));
    if (Boolean(item.initialCorrect) !== initial || Boolean(item.finalCorrect) !== final) {
      return { ok: false, code: 'CORRECTNESS_MISMATCH', message: '正誤記録が一致しません。' };
    }
    if (initial) firstCorrect += 1;
    if (final) finalCorrect += 1;
    firstTimeSum += firstTime;
    rateItems.push({ typeId: String(item.typeId || ''), left, right, firstTime, initialCorrect: initial, finalCorrect: final });
    digestParts.push([item.typeId, item.left, item.right, item.firstAnswer, item.retryAnswer, item.firstTime, item.retryTime].join(':'));
  }
  if (firstTimeSum * 1000 > durationMs! + 10_000) return { ok: false, code: 'TIME_MISMATCH', message: '回答時間が一致しません。' };
  if (fnv1a(digestParts.join('|')) !== String(proof.problemDigest ?? '')) return { ok: false, code: 'DIGEST_MISMATCH', message: '問題記録のダイジェストが一致しません。' };
  if (firstCorrect !== Number(latest.firstCorrect) || finalCorrect !== Number(latest.finalCorrect)) return { ok: false, code: 'SUMMARY_MISMATCH', message: '集計結果が一致しません。' };

  const before = finite(latest.before);
  const after = finite(latest.after);
  const delta = finite(latest.delta);
  if (before === null || after === null || delta === null || after !== before + delta || after !== currentRating) {
    return { ok: false, code: 'RATING_MISMATCH', message: 'レート記録が一致しません。' };
  }

  const serverRate = verifyAndCalculateRate(rateItems, before, proof.rateContext);
  if (!serverRate.ok) return serverRate;
  if (serverRate.summary.firstCorrect !== firstCorrect || serverRate.summary.finalCorrect !== finalCorrect) {
    return { ok: false, code: 'RATE_SUMMARY_MISMATCH', message: 'レート計算用の集計が一致しません。' };
  }
  if (String(latest.typeId || '') !== String(proof.rateContext?.typeId || '')
    || String(latest.pattern || '') !== String(proof.rateContext?.patternId || '')
    || String(latest.outcome || '') !== serverRate.outcome) {
    return { ok: false, code: 'PROGRESS_MISMATCH', message: '進行判定がサーバー計算と一致しません。' };
  }
  if (delta !== serverRate.appliedDelta || after !== serverRate.ratingAfter) {
    return { ok: false, code: 'SERVER_RATE_MISMATCH', message: 'レート増減がサーバー計算と一致しません。' };
  }
  const risk = analyzeSessionRisk(rateItems);
  return { ok: true, data: { playerId, playerSecret, nickname, metrics: { currentRating, highestRating, learnedCount, completedSets }, latest, proof, firstCorrect, finalCorrect, before, after, delta, serverRate, risk } };
}

async function fetchRankingState(db: DbClient, playerId: string | null) {
  const { data, error } = await db.rpc('mulrate_get_player_ranking_state', { p_player_id: playerId }).single();
  if (error) throw error;
  return data;
}

function rankingStateBody(rankingState: any) {
  return {
    currentRank: Number.isFinite(Number(rankingState?.current_rank)) ? Number(rankingState.current_rank) : null,
    totalPlayers: Number(rankingState?.total_players || 0),
    rankingStatus: String(rankingState?.ranking_status || 'not_joined'),
    verifiedSessionCount: Number(rankingState?.verified_session_count || 0),
    ratingBaselineVerified: Boolean(rankingState?.rating_baseline_verified),
    progressBaselineVerified: Boolean(rankingState?.progress_baseline_verified),
    reviewMessage: String(rankingState?.review_message || ''),
    certificationStatus: String(rankingState?.certification_status || 'not_started'),
    certificationLevel: rankingState?.certification_level === null || rankingState?.certification_level === undefined ? null : Number(rankingState.certification_level),
    certificationNextEligibleAt: rankingState?.certification_next_eligible_at || null
  };
}

async function startCertification(req: Request, db: DbClient, payload: any): Promise<Response> {
  const authenticated = await loadAuthenticatedPlayer(db, payload);
  if (!authenticated.ok) return response(req, { ok: false, code: authenticated.code, message: authenticated.message }, 400);
  const { player, playerId } = authenticated;
  if (String(player.ranking_status) !== 'provisional') {
    return response(req, { ok: false, code: 'CERTIFICATION_NOT_ELIGIBLE', message: '現在の公開状態では認定テストを受けられません。' }, 409);
  }
  const nextEligibleAt = player.certification_next_eligible_at ? new Date(player.certification_next_eligible_at) : null;
  if (nextEligibleAt && nextEligibleAt > new Date()) {
    return response(req, { ok: false, code: 'CERTIFICATION_COOLDOWN', message: '認定テストは再受験待ちです。', nextEligibleAt: nextEligibleAt.toISOString() }, 409);
  }

  const { data: activeAttempt, error: activeError } = await db.from('mulrate_certification_attempts')
    .select('attempt_id,version,question_set,started_at,expires_at,claimed_type_index')
    .eq('player_id', playerId).eq('status', 'active').maybeSingle();
  if (activeError) throw activeError;
  if (activeAttempt) {
    const expiresAt = new Date(activeAttempt.expires_at);
    if (expiresAt > new Date()) {
      return response(req, {
        action: 'certification_start',
        resumed: true,
        attemptId: activeAttempt.attempt_id,
        version: activeAttempt.version,
        startedAt: activeAttempt.started_at,
        expiresAt: activeAttempt.expires_at,
        claimedTypeIndex: activeAttempt.claimed_type_index,
        certificationTier: certificationTierForTypeIndex(activeAttempt.claimed_type_index),
        questions: activeAttempt.question_set
      });
    }
    await db.from('mulrate_certification_attempts').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('attempt_id', activeAttempt.attempt_id);
    await db.from('mulrate_players').update({ certification_status: 'not_started', certification_attempt_id: null, updated_at: new Date().toISOString() }).eq('id', playerId);
  }

  const attemptId = crypto.randomUUID();
  const claimedTypeIndex = Math.max(0, Math.min(99, Math.trunc(Number(player.current_type_index) || 0)));
  const questions = createCertificationQuestions(attemptId, claimedTypeIndex);
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + CERTIFICATION_EXPIRES_MINUTES * 60_000);
  const { error: insertError } = await db.from('mulrate_certification_attempts').insert({
    attempt_id: attemptId,
    player_id: playerId,
    version: CERTIFICATION_VERSION,
    claimed_type_index: claimedTypeIndex,
    claimed_rating: Number(player.current_rating || 300),
    question_set: questions,
    status: 'active',
    started_at: startedAt.toISOString(),
    expires_at: expiresAt.toISOString()
  });
  if (insertError) throw insertError;
  const { error: playerUpdateError } = await db.from('mulrate_players').update({
    certification_status: 'active', certification_attempt_id: attemptId, updated_at: new Date().toISOString()
  }).eq('id', playerId);
  if (playerUpdateError) throw playerUpdateError;

  return response(req, {
    action: 'certification_start',
    resumed: false,
    attemptId,
    version: CERTIFICATION_VERSION,
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    claimedTypeIndex,
    certificationTier: certificationTierForTypeIndex(claimedTypeIndex),
    questions
  });
}

function validateCertificationSubmission(attempt: any, payload: any) {
  const questions = Array.isArray(attempt?.question_set) ? attempt.question_set as CertificationQuestion[] : [];
  const answers = Array.isArray(payload?.certification?.answers) ? payload.certification.answers as CertificationAnswer[] : [];
  if (questions.length !== CERTIFICATION_QUESTION_COUNT || answers.length !== CERTIFICATION_QUESTION_COUNT) {
    return { ok: false as const, code: 'CERTIFICATION_ANSWERS_INCOMPLETE', message: '認定問題の回答記録が不足しています。' };
  }
  const expectedIds = new Set(questions.map((question) => question.id));
  const submittedIds = new Set<string>();
  let timeSum = 0;
  for (const answer of answers) {
    const id = String(answer?.questionId || '');
    const firstTime = finite(answer?.firstTime);
    const value = answer?.answer === null ? null : finite(answer?.answer);
    if (!expectedIds.has(id) || submittedIds.has(id) || firstTime === null || firstTime < 0.05 || firstTime > 900 || value === null) {
      return { ok: false as const, code: 'INVALID_CERTIFICATION_ANSWER', message: '認定問題の回答記録が不正です。' };
    }
    submittedIds.add(id);
    timeSum += firstTime;
  }
  const startedAt = new Date(payload?.certification?.startedAt);
  const finishedAt = new Date(payload?.certification?.finishedAt);
  const durationMs = finite(payload?.certification?.durationMs);
  const attemptStarted = new Date(attempt.started_at);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(finishedAt.getTime()) || durationMs === null
    || durationMs < 1_000 || durationMs > CERTIFICATION_EXPIRES_MINUTES * 60_000 + 60_000
    || finishedAt <= startedAt || startedAt < new Date(attemptStarted.getTime() - 5_000)
    || timeSum * 1000 > durationMs + 10_000) {
    return { ok: false as const, code: 'INVALID_CERTIFICATION_DURATION', message: '認定テストの所要時間が不正です。' };
  }
  return { ok: true as const, questions, answers, startedAt, finishedAt, durationMs };
}

async function replayVerifiedRating(db: DbClient, playerId: string) {
  const { data: sessions, error } = await db.from('mulrate_sessions')
    .select('session_id,verification_payload,created_at')
    .eq('player_id', playerId)
    .eq('review_status', 'accepted')
    .order('created_at', { ascending: true })
    .order('session_id', { ascending: true });
  if (error) throw error;
  let rating = 300;
  let highest = 300;
  let replayed = 0;
  for (const row of sessions ?? []) {
    const proof: any = row.verification_payload;
    if (!proof || !Array.isArray(proof.items) || proof.items.length !== 10) {
      return { ok: false as const, code: 'CERTIFICATION_REPLAY_FAILED', message: '保存済みセッションを再計算できませんでした。' };
    }
    const items = proof.items.map((item: any) => ({
      typeId: String(item.typeId || ''),
      left: Number(item.left),
      right: Number(item.right),
      firstTime: Number(item.firstTime),
      initialCorrect: Boolean(item.initialCorrect),
      finalCorrect: Boolean(item.finalCorrect)
    }));
    const result = verifyAndCalculateRate(items, rating, proof.rateContext);
    if (!result.ok) return { ok: false as const, code: result.code, message: '保存済みセッションを再計算できませんでした。' };
    rating = result.ratingAfter;
    highest = Math.max(highest, rating);
    replayed += 1;
  }
  return { ok: true as const, rating, highest, replayed };
}

async function submitCertification(req: Request, db: DbClient, payload: any): Promise<Response> {
  const authenticated = await loadAuthenticatedPlayer(db, payload);
  if (!authenticated.ok) return response(req, { ok: false, code: authenticated.code, message: authenticated.message }, 400);
  const { player, playerId } = authenticated;
  if (String(player.ranking_status) !== 'provisional') {
    return response(req, { ok: false, code: 'CERTIFICATION_NOT_ELIGIBLE', message: '現在の公開状態では認定結果を登録できません。' }, 409);
  }
  const attemptId = String(payload?.certification?.attemptId || '');
  if (!UUID_RE.test(attemptId)) return response(req, { ok: false, code: 'INVALID_CERTIFICATION_ATTEMPT', message: '認定テストIDが不正です。' }, 400);
  const { data: attempt, error: attemptError } = await db.from('mulrate_certification_attempts')
    .select('*').eq('attempt_id', attemptId).eq('player_id', playerId).maybeSingle();
  if (attemptError) throw attemptError;
  if (!attempt) return response(req, { ok: false, code: 'CERTIFICATION_ATTEMPT_NOT_FOUND', message: '認定テストを確認できませんでした。' }, 404);
  if (String(attempt.status) !== 'active') return response(req, { ok: false, code: 'CERTIFICATION_ATTEMPT_CLOSED', message: 'この認定テストはすでに終了しています。' }, 409);
  if (new Date(attempt.expires_at) <= new Date()) {
    await db.from('mulrate_certification_attempts').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('attempt_id', attemptId);
    await db.from('mulrate_players').update({ certification_status: 'not_started', certification_attempt_id: null, updated_at: new Date().toISOString() }).eq('id', playerId);
    return response(req, { ok: false, code: 'CERTIFICATION_EXPIRED', message: '認定テストの有効時間を過ぎました。', certificationStatus: 'not_started' }, 409);
  }

  const checked = validateCertificationSubmission(attempt, payload);
  if (!checked.ok) return response(req, { ok: false, code: checked.code, message: checked.message }, 400);
  const evaluation = evaluateCertification(checked.questions, checked.answers);
  const replay = await replayVerifiedRating(db, playerId);
  if (!replay.ok) return response(req, { ok: false, code: replay.code, message: replay.message }, 409);
  const certificationLevel = certificationTierForTypeIndex(Number(attempt.claimed_type_index || 0));
  const nextEligibleAt = new Date(Date.now() + CERTIFICATION_RETRY_HOURS * 60 * 60_000);
  const resultPayload = {
    version: CERTIFICATION_VERSION,
    startedAt: checked.startedAt.toISOString(),
    finishedAt: checked.finishedAt.toISOString(),
    durationMs: Math.round(checked.durationMs),
    evaluation,
    replayedSessions: replay.replayed
  };
  const { error: completeError } = await db.rpc('mulrate_complete_certification_v1', {
    p_attempt_id: attemptId,
    p_player_id: playerId,
    p_passed: evaluation.passed,
    p_certification_level: certificationLevel,
    p_authoritative_rating: replay.rating,
    p_authoritative_highest_rating: replay.highest,
    p_score: evaluation.overallCorrect,
    p_result_payload: resultPayload,
    p_next_eligible_at: nextEligibleAt.toISOString()
  });
  if (completeError) {
    const raw = String(completeError.message || 'CERTIFICATION_COMMIT_FAILED');
    const code = raw.includes('CERTIFICATION_EXPIRED') ? 'CERTIFICATION_EXPIRED'
      : raw.includes('CERTIFICATION_ATTEMPT_CLOSED') ? 'CERTIFICATION_ATTEMPT_CLOSED'
        : raw.includes('CERTIFICATION_NOT_ELIGIBLE') ? 'CERTIFICATION_NOT_ELIGIBLE'
          : 'CERTIFICATION_COMMIT_FAILED';
    return response(req, { ok: false, code, message: '認定結果を確定できませんでした。' }, 409);
  }

  const rankingState = await fetchRankingState(db, playerId);
  return response(req, {
    action: 'certification_submit',
    passed: evaluation.passed,
    score: evaluation.overallCorrect,
    foundationCorrect: evaluation.foundationCorrect,
    coreCorrect: evaluation.coreCorrect,
    challengeCorrect: evaluation.challengeCorrect,
    speedIndex: evaluation.speedIndex,
    authoritativeRating: replay.rating,
    authoritativeHighestRating: replay.highest,
    replayedSessions: replay.replayed,
    nextEligibleAt: evaluation.passed ? null : nextEligibleAt.toISOString(),
    ...rankingStateBody(rankingState)
  });
}

Deno.serve(async (req: Request) => {
  const requestOrigin = originState(req);
  if (!requestOrigin.accepted) {
    return response(req, { ok: false, code: 'ORIGIN_NOT_ALLOWED', message: 'この公開元からの接続は許可されていません。' }, 403);
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (!requestApiKeyAccepted(req)) {
    return response(req, { ok: false, code: 'INVALID_API_KEY', message: '接続用APIキーを確認できませんでした。' }, 401);
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const adminKey = adminApiKey();
  if (!supabaseUrl || !adminKey) return response(req, { ok: false, code: 'SERVER_CONFIG', message: 'サーバー設定が不足しています。' }, 500);
  const db = createClient(supabaseUrl, adminKey, { auth: { persistSession: false } });

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      if (url.searchParams.get('action') === 'health') {
        const { data: healthRows, error: healthError } = await db.rpc('mulrate_health_v1');
        if (healthError) {
          console.error('health check failed', healthError);
          return response(req, {
            ok: false,
            code: 'SCHEMA_NOT_READY',
            message: 'データベースの接続またはマイグレーションを確認してください。',
            service: 'mulrate-ranking',
            apiVersion: RANKING_API_VERSION,
            expectedSchemaVersion: RANKING_SCHEMA_VERSION,
            database: 'error',
            originPolicy: requestOrigin.policy,
            originAccepted: requestOrigin.accepted
          }, 503);
        }
        const health = Array.isArray(healthRows) ? healthRows[0] : healthRows;
        const schemaVersion = Number(health?.schema_version || 0);
        return response(req, {
          service: 'mulrate-ranking',
          apiVersion: String(health?.api_version || RANKING_API_VERSION),
          schemaVersion,
          expectedSchemaVersion: RANKING_SCHEMA_VERSION,
          database: schemaVersion >= RANKING_SCHEMA_VERSION ? 'ok' : 'migration_required',
          databaseTime: health?.database_time || null,
          serverTime: new Date().toISOString(),
          originPolicy: requestOrigin.policy,
          originAccepted: requestOrigin.accepted
        }, schemaVersion >= RANKING_SCHEMA_VERSION ? 200 : 503);
      }
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 200));
      const playerId = url.searchParams.get('playerId') || '';
      const { data, error, count } = await db.from('mulrate_players')
        .select('id,nickname,current_rating,updated_at', { count: 'exact' })
        .eq('ranking_status', 'verified')
        .order('current_rating', { ascending: false })
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit);
      if (error) throw error;

      const rankingState = await fetchRankingState(db, UUID_RE.test(playerId) ? playerId : null);
      const entries = (data ?? []).map((row, index) => ({
        rank: index + 1,
        nickname: row.nickname,
        rating: row.current_rating,
        isCurrentPlayer: row.id === playerId
      }));
      return response(req, {
        entries,
        totalPlayers: Number(rankingState?.total_players ?? count ?? entries.length),
        ...rankingStateBody(rankingState)
      });
    }

    if (req.method === 'POST') {
      const payload = await req.json().catch(() => null);
      if (payload?.action === 'certification_start') return startCertification(req, db, payload);
      if (payload?.action === 'certification_submit') return submitCertification(req, db, payload);

      const checked = verifyPayload(payload);
      if (!checked.ok) return response(req, { ok: false, code: checked.code, message: checked.message }, 400);
      const d = checked.data;
      const authTokenHash = await sha256Hex(d.playerSecret);
      const { error } = await db.rpc('mulrate_commit_session_v4', {
        p_player_id: d.playerId,
        p_nickname: d.nickname,
        p_auth_token_hash: authTokenHash,
        p_current_rating: d.serverRate.ratingAfter,
        p_learned_count: d.metrics.learnedCount,
        p_completed_sets: d.metrics.completedSets,
        p_session_id: d.proof.sessionId,
        p_app_version: String(payload.appVersion || d.proof.appVersion || 'unknown'),
        p_started_at: d.proof.startedAt,
        p_finished_at: d.proof.finishedAt,
        p_duration_ms: Math.round(d.proof.durationMs),
        p_problem_digest: d.proof.problemDigest,
        p_rating_before: d.before,
        p_rating_after: d.serverRate.ratingAfter,
        p_rating_delta: d.serverRate.appliedDelta,
        p_first_correct: d.firstCorrect,
        p_final_correct: d.finalCorrect,
        p_rate_formula_version: d.serverRate.formulaVersion,
        p_type_index_before: d.proof.rateContext.typeIndex,
        p_pattern_index_before: d.proof.rateContext.patternIndex,
        p_pattern_stay_before: d.proof.rateContext.patternStayCount,
        p_type_index_after: d.serverRate.nextProgress.typeIndex,
        p_pattern_index_after: d.serverRate.nextProgress.patternIndex,
        p_pattern_stay_after: d.serverRate.nextProgress.patternStayCount,
        p_verification_payload: d.proof,
        p_risk_flags: d.risk.flags,
        p_should_quarantine: d.risk.shouldQuarantine
      });
      if (error) {
        const raw = String(error.message || 'COMMIT_FAILED');
        const code = raw.includes('duplicate key') ? 'DUPLICATE_SESSION'
          : raw.includes('PLAYER_AUTH_FAILED') ? 'PLAYER_AUTH_FAILED'
            : raw.includes('RATE_LIMITED') ? 'RATE_LIMITED'
              : raw.includes('STALE_RATING') ? 'STALE_RATING'
                : raw.includes('STALE_PROGRESS') ? 'STALE_PROGRESS'
                  : raw.includes('NICKNAME_IMMUTABLE') ? 'NICKNAME_IMMUTABLE'
                    : 'COMMIT_FAILED';
        const message = code === 'PLAYER_AUTH_FAILED' ? 'この端末IDの認証に失敗しました。'
          : code === 'RATE_LIMITED' ? '短時間の送信回数が多すぎます。しばらくしてから再送します。'
            : code === 'STALE_RATING' ? 'サーバー上のレートと連続していません。同期状態を確認してください。'
              : code === 'STALE_PROGRESS' ? 'サーバー上の進行記録と連続していません。同期状態を確認してください。'
                : 'ランキング記録を確定できませんでした。';
        return response(req, { ok: false, code, message }, 409);
      }
      const rankingState = await fetchRankingState(db, d.playerId);
      return response(req, {
        ...rankingStateBody(rankingState),
        authoritativeRating: d.serverRate.ratingAfter,
        authoritativeDelta: d.serverRate.appliedDelta,
        rateFormulaVersion: d.serverRate.formulaVersion
      });
    }

    if (req.method === 'DELETE') {
      const body = await req.json().catch(() => ({}));
      const playerId = String(body.playerId ?? '');
      const playerSecret = String(body.playerSecret ?? '');
      if (!UUID_RE.test(playerId)) return response(req, { ok: false, code: 'INVALID_PLAYER_ID', message: 'プレイヤーIDが不正です。' }, 400);
      if (!SECRET_RE.test(playerSecret)) return response(req, { ok: false, code: 'INVALID_PLAYER_SECRET', message: '端末認証情報が不正です。' }, 400);
      const authTokenHash = await sha256Hex(playerSecret);
      const { data: deleted, error } = await db.rpc('mulrate_delete_player', { p_player_id: playerId, p_auth_token_hash: authTokenHash });
      if (error) throw error;
      if (!deleted) return response(req, { ok: false, code: 'PLAYER_AUTH_FAILED', message: 'オンラインデータを削除する権限を確認できませんでした。' }, 403);
      return response(req, { deleted: true });
    }

    return response(req, { ok: false, code: 'METHOD_NOT_ALLOWED', message: '対応していない操作です。' }, 405);
  } catch (error) {
    console.error(error);
    return response(req, { ok: false, code: 'SERVER_ERROR', message: 'ランキングサーバーでエラーが発生しました。' }, 500);
  }
});
