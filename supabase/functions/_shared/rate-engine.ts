import { RATE_CATALOG, RATE_CATALOG_BY_ID, type RateType } from './rate-catalog.ts';

export const RATE_FORMULA_VERSION = 'rate-v1';
const MAX_RATE = 99_999_999;
const SET_SIZE = 10;
const RATE_INFLATION_BASE = 5200;
const RATE_CAP_BASE = 26000;

const PATTERNS = [
  { id: 'A', center: 10, recent: 0, base: 0, challenge: 0 },
  { id: 'B', center: 9, recent: 0, base: 0, challenge: 1 },
  { id: 'C', center: 8, recent: 0, base: 0, challenge: 2 },
  { id: 'D', center: 5, recent: 3, base: 2, challenge: 0 },
  { id: 'E', center: 7, recent: 2, base: 1, challenge: 0 },
  { id: 'F', center: 9, recent: 1, base: 0, challenge: 0 }
] as const;
const KUKU_PATTERNS = [
  { id: 'A-1', order: 'asc' },
  { id: 'A-2', order: 'desc' },
  { id: 'A-3', order: 'random' }
] as const;

export type RateProofItem = {
  typeId: string;
  left: number;
  right: number;
  firstTime: number;
  initialCorrect: boolean;
  finalCorrect: boolean;
};

export type RateContext = {
  formulaVersion: string;
  typeIndex: number;
  typeId: string;
  patternIndex: number;
  patternId: string;
  patternStayCount: number;
  practiceMode: boolean;
  practiceTypeId: string | null;
};

export type RateVerificationResult = {
  ok: true;
  formulaVersion: string;
  outcome: string;
  rawDelta: number;
  appliedDelta: number;
  ratingAfter: number;
  summary: {
    firstCorrect: number;
    finalCorrect: number;
    avgFirstTime: number;
    targetTime: number;
  };
  nextProgress: { typeIndex: number; patternIndex: number; patternStayCount: number };
} | {
  ok: false;
  code: string;
  message: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function isKukuType(type?: RateType): boolean {
  return type?.family === 'kuku';
}
function isSkipOutcome(outcome: string): boolean {
  return ['skip', 'kuku_skip_to_random', 'kuku_skip_row'].includes(outcome);
}
function writtenGraceForType(type: RateType): number {
  if (isKukuType(type)) return 1;
  const id = type.id;
  if (id.startsWith('M2D2') || id.startsWith('M3D2')) return 1.18;
  if (id.startsWith('M4D') || id.startsWith('M2D3') || id.startsWith('M3D3') || id === 'M4D4_MIX' || id === 'MASTER_MUL_MIX') return 1.28;
  if (id.startsWith('DEC_') || id.startsWith('WHOLE_X_DEC') || id === 'DECIMAL_MUL_MIX') return type.difficulty >= 6 ? 1.18 : 1.12;
  if (type.difficulty >= 4.0) return 1.12;
  return 1;
}
function effectiveTargetSeconds(type: RateType): number {
  return type.targetSeconds * writtenGraceForType(type);
}
function getSpeedFactor(seconds: number, targetSeconds: number): number {
  if (seconds <= targetSeconds * 0.65) return 1.25;
  if (seconds <= targetSeconds) return 1.08;
  if (seconds <= targetSeconds * 1.35) return 0.92;
  if (seconds <= targetSeconds * 1.75) return 0.72;
  return 0.52;
}
function getInitialAccuracyFactor(firstCorrect: number): number {
  const rate = firstCorrect / SET_SIZE;
  if (firstCorrect === SET_SIZE) return 1;
  if (firstCorrect >= 9) return 0.90;
  if (firstCorrect >= 8) return 0.74;
  if (firstCorrect >= 7) return 0.60;
  return clamp(0.40 + rate * 0.22, 0.40, 0.56);
}
function getEndgameRateBoost(avgDifficulty: number): number {
  const x = Math.max(0, avgDifficulty - 6.4);
  return 1 + Math.pow(x, 1.35) * 0.38;
}

function expectedPattern(context: RateContext, currentType: RateType): string | null {
  if (isKukuType(currentType)) return KUKU_PATTERNS[context.patternIndex]?.id ?? null;
  return PATTERNS[context.patternIndex]?.id ?? null;
}

function validateQuestionPlan(items: RateProofItem[], context: RateContext, currentType: RateType): RateVerificationResult | null {
  if (context.practiceMode) {
    const practiceType = RATE_CATALOG_BY_ID.get(String(context.practiceTypeId || ''));
    if (!practiceType) return { ok: false, code: 'INVALID_PRACTICE_TYPE', message: '反復学習の類型が不正です。' };
    if (practiceType.index > context.typeIndex) {
      return { ok: false, code: 'INVALID_PRACTICE_TYPE', message: '未到達の類型は反復学習として送信できません。' };
    }
    if (!items.every((item) => item.typeId === practiceType.id)) {
      return { ok: false, code: 'QUESTION_PLAN_MISMATCH', message: '反復学習の問題構成が一致しません。' };
    }
    return null;
  }

  if (isKukuType(currentType)) {
    const rights = items.map((item) => Number(item.right)).sort((a, b) => a - b);
    const expectedRights = currentType.kukuMode === 'extended'
      ? Array.from({ length: 10 }, (_, index) => index + 11)
      : Array.from({ length: 10 }, (_, index) => index + 1);
    const valid = items.every((item) => item.typeId === currentType.id && Number(item.left) === currentType.row)
      && rights.every((value, index) => value === expectedRights[index]);
    if (!valid) return { ok: false, code: 'QUESTION_PLAN_MISMATCH', message: '九九の問題構成が進行段階と一致しません。' };
    return null;
  }

  const pattern = PATTERNS[context.patternIndex];
  if (!pattern) return { ok: false, code: 'INVALID_RATE_CONTEXT', message: '出題パターンが不正です。' };
  const current = context.typeIndex;
  const ids: string[] = [];
  const push = (id: string, count: number) => { for (let i = 0; i < count; i += 1) ids.push(id); };
  push(RATE_CATALOG[current].id, pattern.center);
  push(RATE_CATALOG[Math.max(0, current - 1)].id, pattern.recent);
  push(RATE_CATALOG[Math.max(0, current - 2)].id, pattern.base);
  push(RATE_CATALOG[Math.min(RATE_CATALOG.length - 1, current + 1)].id, pattern.challenge);
  while (ids.length < SET_SIZE) ids.push(RATE_CATALOG[current].id);

  const count = (values: string[]) => values.reduce<Record<string, number>>((map, id) => {
    map[id] = (map[id] || 0) + 1;
    return map;
  }, {});
  const expectedCounts = count(ids.slice(0, SET_SIZE));
  const actualCounts = count(items.map((item) => item.typeId));
  const keys = new Set([...Object.keys(expectedCounts), ...Object.keys(actualCounts)]);
  if ([...keys].some((key) => expectedCounts[key] !== actualCounts[key])) {
    return { ok: false, code: 'QUESTION_PLAN_MISMATCH', message: '問題構成が進行段階と一致しません。' };
  }
  return null;
}

function judgeKukuProgress(items: RateProofItem[], currentType: RateType, patternIndex: number, firstCorrect: number, finalCorrect: number, avgFirstTime: number): string {
  const times = items.map((item) => item.firstTime).filter(Number.isFinite);
  const maxTime = times.length ? Math.max(...times) : Infinity;
  const strict = currentType.kukuMode === 'base' && Number(currentType.row) <= 10;
  const limit = strict ? 4.0 : 8.0;
  const randomLimit = strict ? 5.0 : 9.0;
  const skipToRandom = strict ? 3.0 : 5.5;
  const skipRow = strict ? 2.0 : 4.0;
  const allInitialCorrect = firstCorrect === SET_SIZE;

  if (finalCorrect <= 5 || firstCorrect <= 4 || avgFirstTime > randomLimit * 2.0) return 'regress';
  if (!allInitialCorrect) return finalCorrect >= 8 ? 'stay' : 'regress';
  if (patternIndex === 0) {
    if (maxTime < skipRow) return 'kuku_skip_row';
    if (maxTime < skipToRandom) return 'kuku_skip_to_random';
    if (maxTime < limit) return 'advance';
    return 'stay';
  }
  if (patternIndex === 1) {
    if (maxTime < skipRow) return 'kuku_skip_row';
    if (maxTime < limit) return 'advance';
    return 'stay';
  }
  if (maxTime < randomLimit) return 'advance';
  return 'stay';
}

function judgeProgress(items: RateProofItem[], currentType: RateType, context: RateContext, firstCorrect: number, finalCorrect: number, avgFirstTime: number, targetTime: number): string {
  if (isKukuType(currentType)) return judgeKukuProgress(items, currentType, context.patternIndex, firstCorrect, finalCorrect, avgFirstTime);
  const excellent = firstCorrect === SET_SIZE && avgFirstTime <= targetTime;
  const strong = firstCorrect === SET_SIZE && avgFirstTime <= targetTime * 1.15;
  const good = finalCorrect >= 9 && firstCorrect >= 8 && avgFirstTime <= targetTime * 1.45;
  const poor = finalCorrect <= 5 || firstCorrect <= 4 || avgFirstTime > targetTime * 2.0;
  if (excellent) return 'skip';
  if (strong || good) return 'advance';
  if (poor) return 'regress';
  return 'stay';
}

function deltaFromPerformance(items: RateProofItem[], ratingBefore: number, firstCorrect: number, finalCorrect: number, avgFirstTime: number, targetTime: number, achieved: number, possible: number, outcome: string): number {
  const performanceRatio = possible ? achieved / possible : 0;
  const avgDifficulty = average(items.map((item) => RATE_CATALOG_BY_ID.get(item.typeId)!.difficulty));
  const expectedRatio = clamp(0.25 + Math.log10(ratingBefore + 100) / 24, 0.28, 0.76);
  const endgameBoost = getEndgameRateBoost(avgDifficulty);
  const inflation = RATE_INFLATION_BASE * Math.pow(avgDifficulty, 1.42) * (1 + Math.log2(avgDifficulty + 1)) * endgameBoost;
  const suppression = 1 / (1 + Math.log10(ratingBefore + 10) / (6.2 + Math.max(0, avgDifficulty - 6.2) * 1.8));

  let delta = (performanceRatio - expectedRatio) * inflation;
  if (firstCorrect === SET_SIZE) {
    delta += 0.10 * inflation;
    if (avgFirstTime <= targetTime * 1.15) delta += 0.11 * inflation;
  } else if (firstCorrect >= 9 && finalCorrect === SET_SIZE) {
    delta += 0.06 * inflation;
  } else if (firstCorrect <= 8) {
    delta -= (9 - firstCorrect) * 0.035 * inflation;
  }
  if (finalCorrect === SET_SIZE && firstCorrect < SET_SIZE) delta += 0.035 * inflation;
  if (finalCorrect <= 6) delta -= 0.1 * inflation;
  if (isSkipOutcome(outcome)) delta += 0.11 * inflation;
  if (delta > 0 && firstCorrect <= 7) delta *= 0.68;
  else if (delta > 0 && firstCorrect <= 8) delta *= 0.82;
  return delta * suppression;
}

function maxPatternIndexForType(typeIndex: number): number {
  return isKukuType(RATE_CATALOG[typeIndex]) ? KUKU_PATTERNS.length - 1 : PATTERNS.length - 1;
}

function nextProgress(context: RateContext, outcome: string): { typeIndex: number; patternIndex: number; patternStayCount: number } {
  if (context.practiceMode) {
    return { typeIndex: context.typeIndex, patternIndex: context.patternIndex, patternStayCount: context.patternStayCount };
  }
  let typeIndex = context.typeIndex;
  let patternIndex = context.patternIndex;
  let patternStayCount = context.patternStayCount;
  const currentType = RATE_CATALOG[typeIndex];

  if (isKukuType(currentType)) {
    const phaseIndex = clamp(patternIndex, 0, KUKU_PATTERNS.length - 1);
    if (outcome === 'stay') return { typeIndex, patternIndex: phaseIndex, patternStayCount: patternStayCount + 1 };
    patternStayCount = 0;
    if (outcome === 'regress') {
      if (phaseIndex > 0) return { typeIndex, patternIndex: phaseIndex - 1, patternStayCount };
      if (typeIndex > 0) {
        typeIndex -= 1;
        patternIndex = maxPatternIndexForType(typeIndex);
      }
      return { typeIndex, patternIndex, patternStayCount };
    }
    if (outcome === 'kuku_skip_to_random') return { typeIndex, patternIndex: 2, patternStayCount };
    if (outcome === 'kuku_skip_row' || (outcome === 'advance' && phaseIndex >= 2) || (outcome === 'skip' && phaseIndex >= 1)) {
      typeIndex = Math.min(RATE_CATALOG.length - 1, typeIndex + 1);
      return { typeIndex, patternIndex: 0, patternStayCount };
    }
    if (outcome === 'advance' || outcome === 'skip') return { typeIndex, patternIndex: Math.min(2, phaseIndex + 1), patternStayCount };
    return { typeIndex, patternIndex: phaseIndex, patternStayCount };
  }

  patternStayCount = 0;
  if (isSkipOutcome(outcome)) {
    if (patternIndex === 0 || patternIndex === 1) patternIndex = 2;
    else if (patternIndex === 2) {
      typeIndex = Math.min(RATE_CATALOG.length - 1, typeIndex + 1);
      patternIndex = isKukuType(RATE_CATALOG[typeIndex]) ? 0 : 3;
    } else if (patternIndex === 3) patternIndex = 5;
    else if (patternIndex === 4 || patternIndex === 5) patternIndex = 0;
    else patternIndex = Math.min(PATTERNS.length - 1, patternIndex + 1);
    return { typeIndex, patternIndex, patternStayCount };
  }
  if (outcome === 'advance') {
    if (patternIndex === 2) {
      typeIndex = Math.min(RATE_CATALOG.length - 1, typeIndex + 1);
      patternIndex = isKukuType(RATE_CATALOG[typeIndex]) ? 0 : 3;
    } else if (patternIndex === 5) patternIndex = 0;
    else patternIndex = Math.min(PATTERNS.length - 1, patternIndex + 1);
    return { typeIndex, patternIndex, patternStayCount };
  }
  if (outcome === 'regress') {
    if (patternIndex === 3 && typeIndex > 0) {
      typeIndex -= 1;
      patternIndex = maxPatternIndexForType(typeIndex);
    } else patternIndex = Math.max(0, patternIndex - 1);
    return { typeIndex, patternIndex, patternStayCount };
  }
  return { typeIndex, patternIndex, patternStayCount: context.patternStayCount + 1 };
}

export function verifyAndCalculateRate(items: RateProofItem[], ratingBefore: number, rawContext: unknown): RateVerificationResult {
  const context = rawContext as RateContext;
  if (!context || context.formulaVersion !== RATE_FORMULA_VERSION) {
    return { ok: false, code: 'UNSUPPORTED_RATE_FORMULA', message: 'レート計算方式の版が対応していません。' };
  }
  if (!Number.isInteger(context.typeIndex) || context.typeIndex < 0 || context.typeIndex >= RATE_CATALOG.length
    || !Number.isInteger(context.patternIndex) || !Number.isInteger(context.patternStayCount) || context.patternStayCount < 0) {
    return { ok: false, code: 'INVALID_RATE_CONTEXT', message: 'レート計算用の進行情報が不正です。' };
  }
  const currentType = RATE_CATALOG[context.typeIndex];
  const patternId = expectedPattern(context, currentType);
  if (context.typeId !== currentType.id || !patternId || context.patternId !== patternId) {
    return { ok: false, code: 'INVALID_RATE_CONTEXT', message: '進行段階と類型・パターンが一致しません。' };
  }
  if (!Number.isFinite(ratingBefore) || ratingBefore < 0 || ratingBefore > MAX_RATE || items.length !== SET_SIZE) {
    return { ok: false, code: 'INVALID_RATE_CONTEXT', message: 'レート計算の前提値が不正です。' };
  }
  for (const item of items) {
    if (!RATE_CATALOG_BY_ID.has(item.typeId) || !Number.isFinite(item.firstTime) || item.firstTime <= 0) {
      return { ok: false, code: 'UNKNOWN_PROBLEM_TYPE', message: '未登録の問題類型が含まれています。' };
    }
  }
  const planError = validateQuestionPlan(items, context, currentType);
  if (planError) return planError;

  const firstCorrect = items.filter((item) => item.initialCorrect).length;
  const finalCorrect = items.filter((item) => item.finalCorrect).length;
  const avgFirstTime = average(items.map((item) => item.firstTime));
  const targetTime = average(items.map((item) => effectiveTargetSeconds(RATE_CATALOG_BY_ID.get(item.typeId)!)));
  const outcome = context.practiceMode ? 'practice' : judgeProgress(items, currentType, context, firstCorrect, finalCorrect, avgFirstTime, targetTime);

  const possible = items.reduce((sum, item) => sum + 1.25 * RATE_CATALOG_BY_ID.get(item.typeId)!.difficulty, 0);
  const achievedRaw = items.reduce((sum, item) => {
    const type = RATE_CATALOG_BY_ID.get(item.typeId)!;
    const retryCorrect = !item.initialCorrect && item.finalCorrect;
    const resultFactor = item.initialCorrect ? 1 : retryCorrect ? 0.45 : 0;
    return sum + resultFactor * getSpeedFactor(item.firstTime, effectiveTargetSeconds(type)) * type.difficulty;
  }, 0);
  const achieved = achievedRaw * getInitialAccuracyFactor(firstCorrect);
  let delta = deltaFromPerformance(items, ratingBefore, firstCorrect, finalCorrect, avgFirstTime, targetTime, achieved, possible, outcome);
  if (isSkipOutcome(outcome)) delta *= 1.28;
  if (context.practiceMode && delta > 0) delta *= 0.3;

  const avgDifficulty = average(items.map((item) => RATE_CATALOG_BY_ID.get(item.typeId)!.difficulty));
  if (outcome === 'stay' && delta > 0) {
    const highStage = avgDifficulty >= 8.0;
    delta *= Math.max(highStage ? 0.78 : 0.35, Math.pow(highStage ? 0.88 : 0.68, context.patternStayCount + 1));
  }
  if (isKukuType(currentType) && outcome === 'stay' && firstCorrect === SET_SIZE) delta = Math.max(0, delta);

  const cap = Math.max(360, RATE_CAP_BASE * Math.pow(avgDifficulty, 1.20));
  if (finalCorrect >= 8 && delta < 0) delta = 0;
  if (outcome === 'stay' && finalCorrect === SET_SIZE && avgFirstTime <= targetTime * 1.75) {
    const highAccuracy = firstCorrect >= 8;
    const masteryFloor = avgDifficulty >= 8.0 ? (highAccuracy ? 0.30 : 0.18) : 0.04;
    delta = Math.max(delta, cap * masteryFloor);
  }
  if (context.typeIndex === RATE_CATALOG.length - 1 && ratingBefore >= 90_000_000 && finalCorrect === SET_SIZE && firstCorrect >= 9 && avgFirstTime <= targetTime * 1.15) {
    delta = Math.max(delta, (MAX_RATE - ratingBefore) * 0.50);
  }
  delta = clamp(delta, -cap * 0.20, Math.max(cap * (isSkipOutcome(outcome) ? 1.46 : 1.12), delta));
  const rawDelta = Math.round(delta);
  const ratingAfter = clamp(ratingBefore + rawDelta, 0, MAX_RATE);
  const appliedDelta = ratingAfter - ratingBefore;

  return {
    ok: true,
    formulaVersion: RATE_FORMULA_VERSION,
    outcome,
    rawDelta,
    appliedDelta,
    ratingAfter,
    summary: { firstCorrect, finalCorrect, avgFirstTime, targetTime },
    nextProgress: nextProgress(context, outcome)
  };
}
