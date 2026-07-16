import { createClient } from 'npm:@supabase/supabase-js@2';
import { isAllowedNickname } from '../_shared/name-filter.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/;
const MAX_RATE = 99_999_999;

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed = String(Deno.env.get('MULRATE_ALLOWED_ORIGINS') || '')
    .split(',').map((value) => value.trim()).filter(Boolean);
  const allowOrigin = !allowed.length ? '*' : (allowed.includes(origin) ? origin : 'null');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Vary': 'Origin'
  };
}

function response(req: Request, body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8' } });
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
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function verifyPayload(payload: any): { ok: true; data: any } | { ok: false; code: string; message: string } {
  const playerId = String(payload?.player?.playerId ?? '');
  const playerSecret = String(payload?.player?.playerSecret ?? '');
  const nickname = String(payload?.player?.nickname ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (payload?.consent !== true) return { ok: false, code: 'CONSENT_REQUIRED', message: '公開への同意が必要です。' };
  if (!UUID_RE.test(playerId)) return { ok: false, code: 'INVALID_PLAYER_ID', message: 'プレイヤーIDが不正です。' };
  if (!SECRET_RE.test(playerSecret)) return { ok: false, code: 'INVALID_PLAYER_SECRET', message: '端末認証情報が不正です。' };
  if (!isAllowedNickname(nickname)) return { ok: false, code: 'INVALID_NICKNAME', message: 'この表示名は使用できません。' };

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
  return { ok: true, data: { playerId, playerSecret, nickname, metrics: { currentRating, highestRating, learnedCount, completedSets }, latest, proof, firstCorrect, finalCorrect, before, after, delta } };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return response(req, { ok: false, code: 'SERVER_CONFIG', message: 'サーバー設定が不足しています。' }, 500);
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 200));
      const playerId = url.searchParams.get('playerId') || '';
      const { data, error, count } = await db.from('mulrate_players')
        .select('id,nickname,current_rating,updated_at', { count: 'exact' })
        .order('current_rating', { ascending: false })
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit);
      if (error) throw error;

      let currentRank: number | null = null;
      if (UUID_RE.test(playerId)) {
        const { data: current } = await db.from('mulrate_players').select('id,current_rating,updated_at').eq('id', playerId).maybeSingle();
        if (current) {
          const { count: greater } = await db.from('mulrate_players').select('id', { count: 'exact', head: true }).gt('current_rating', current.current_rating);
          const { count: earlierTie } = await db.from('mulrate_players').select('id', { count: 'exact', head: true })
            .eq('current_rating', current.current_rating).lt('updated_at', current.updated_at);
          currentRank = 1 + (greater ?? 0) + (earlierTie ?? 0);
        }
      }
      const entries = (data ?? []).map((row, index) => ({
        rank: index + 1,
        nickname: row.nickname,
        rating: row.current_rating,
        isCurrentPlayer: row.id === playerId
      }));
      return response(req, { currentRank, totalPlayers: count ?? entries.length, entries });
    }

    if (req.method === 'POST') {
      const payload = await req.json().catch(() => null);
      const checked = verifyPayload(payload);
      if (!checked.ok) return response(req, { ok: false, code: checked.code, message: checked.message }, 400);
      const d = checked.data;
      const authTokenHash = await sha256Hex(d.playerSecret);
      const { error } = await db.rpc('mulrate_commit_session_v2', {
        p_player_id: d.playerId,
        p_nickname: d.nickname,
        p_auth_token_hash: authTokenHash,
        p_current_rating: d.metrics.currentRating,
        p_highest_rating: d.metrics.highestRating,
        p_learned_count: d.metrics.learnedCount,
        p_completed_sets: d.metrics.completedSets,
        p_session_id: d.proof.sessionId,
        p_app_version: String(payload.appVersion || d.proof.appVersion || 'unknown'),
        p_started_at: d.proof.startedAt,
        p_finished_at: d.proof.finishedAt,
        p_duration_ms: Math.round(d.proof.durationMs),
        p_problem_digest: d.proof.problemDigest,
        p_rating_before: d.before,
        p_rating_after: d.after,
        p_rating_delta: d.delta,
        p_first_correct: d.firstCorrect,
        p_final_correct: d.finalCorrect,
        p_verification_payload: d.proof
      });
      if (error) {
        const raw = String(error.message || 'COMMIT_FAILED');
        const code = raw.includes('duplicate key') ? 'DUPLICATE_SESSION'
          : raw.includes('PLAYER_AUTH_FAILED') ? 'PLAYER_AUTH_FAILED'
            : raw.includes('RATE_LIMITED') ? 'RATE_LIMITED'
              : raw.includes('STALE_RATING') ? 'STALE_RATING'
                : raw.includes('NICKNAME_IMMUTABLE') ? 'NICKNAME_IMMUTABLE'
                  : 'COMMIT_FAILED';
        const message = code === 'PLAYER_AUTH_FAILED' ? 'この端末IDの認証に失敗しました。'
          : code === 'RATE_LIMITED' ? '短時間の送信回数が多すぎます。しばらくしてから再送します。'
            : code === 'STALE_RATING' ? 'サーバー上の記録と連続していません。同期状態を確認してください。'
              : 'ランキング記録を確定できませんでした。';
        return response(req, { ok: false, code, message }, 409);
      }
      const { data: current } = await db.from('mulrate_players').select('updated_at').eq('id', d.playerId).single();
      const { count: greater } = await db.from('mulrate_players').select('id', { count: 'exact', head: true }).gt('current_rating', d.after);
      const { count: earlierTie } = await db.from('mulrate_players').select('id', { count: 'exact', head: true })
        .eq('current_rating', d.after).lt('updated_at', current?.updated_at ?? new Date().toISOString());
      const { count: total } = await db.from('mulrate_players').select('id', { count: 'exact', head: true });
      return response(req, { currentRank: 1 + (greater ?? 0) + (earlierTie ?? 0), totalPlayers: total ?? 1 });
    }

    if (req.method === 'DELETE') {
      const body = await req.json().catch(() => ({}));
      const playerId = String(body.playerId ?? '');
      const playerSecret = String(body.playerSecret ?? '');
      if (!UUID_RE.test(playerId)) return response(req, { ok: false, code: 'INVALID_PLAYER_ID', message: 'プレイヤーIDが不正です。' }, 400);
      if (!SECRET_RE.test(playerSecret)) return response(req, { ok: false, code: 'INVALID_PLAYER_SECRET', message: '端末認証情報が不正です。' }, 400);
      const authTokenHash = await sha256Hex(playerSecret);
      const { data: deleted, error } = await db.rpc('mulrate_delete_player', {
        p_player_id: playerId,
        p_auth_token_hash: authTokenHash
      });
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
