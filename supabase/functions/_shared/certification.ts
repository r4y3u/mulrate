import { RATE_CATALOG } from './rate-catalog.ts';

export const CERTIFICATION_VERSION = 'cert-v1';
export const CERTIFICATION_QUESTION_COUNT = 30;
export const CERTIFICATION_EXPIRES_MINUTES = 45;
export const CERTIFICATION_RETRY_HOURS = 6;

export type CertificationQuestion = {
  id: string;
  typeId: string;
  left: number;
  right: number;
  tier: number;
  band: 'foundation' | 'core' | 'challenge';
  targetSeconds: number;
};

export type CertificationAnswer = {
  questionId: string;
  answer: number | null;
  firstTime: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeNumber(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function choice<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)]!;
}

function shuffle<T>(rng: () => number, values: T[]): T[] {
  const next = values.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

export function certificationTierForTypeIndex(typeIndex: number): number {
  const index = clamp(Math.trunc(typeIndex), 0, RATE_CATALOG.length - 1);
  if (index <= 14) return 0;
  if (index <= 26) return 1;
  if (index <= 55) return 2;
  if (index <= 87) return 3;
  return 4;
}

function makeTierProblem(tier: number, rng: () => number, variant: number): Omit<CertificationQuestion, 'id' | 'band'> {
  const normalizedTier = clamp(Math.trunc(tier), 0, 4);
  const mode = variant % 5;

  if (normalizedTier === 0) {
    const left = randInt(rng, 0, 10);
    const right = randInt(rng, 1, 10);
    return { typeId: 'KUKU_MIX_0_10', left, right, tier: 0, targetSeconds: 4.5 };
  }

  if (normalizedTier === 1) {
    if (mode === 0) return { typeId: 'TENS_X_1D', left: randInt(rng, 2, 9) * 10, right: randInt(rng, 2, 9), tier: 1, targetSeconds: 9 };
    if (mode === 1) return { typeId: 'PLACE_10X_100X', left: randInt(rng, 11, 99), right: choice(rng, [10, 100]), tier: 1, targetSeconds: 10 };
    if (mode <= 3) return { typeId: 'M2D1_MIX', left: randInt(rng, 12, 99), right: randInt(rng, 2, 9), tier: 1, targetSeconds: 12 };
    return { typeId: 'M3D1_MIX', left: randInt(rng, 101, 999), right: randInt(rng, 2, 9), tier: 1, targetSeconds: 16 };
  }

  if (normalizedTier === 2) {
    if (mode === 0) return { typeId: 'KUKU_EXT_MIX_0_20_X11_20', left: randInt(rng, 0, 20), right: randInt(rng, 11, 20), tier: 2, targetSeconds: 12 };
    if (mode === 1) return { typeId: 'M3D_X_TENS', left: randInt(rng, 101, 999), right: randInt(rng, 1, 9) * 10, tier: 2, targetSeconds: 22 };
    if (mode <= 3) return { typeId: 'M2D2_MIX', left: randInt(rng, 12, 99), right: randInt(rng, 11, 99), tier: 2, targetSeconds: 28 };
    return { typeId: 'M3D2_MIX', left: randInt(rng, 101, 999), right: randInt(rng, 11, 99), tier: 2, targetSeconds: 40 };
  }

  if (normalizedTier === 3) {
    if (mode === 0) {
      const left = normalizeNumber(randInt(rng, 1, 99) / 10);
      const right = normalizeNumber(randInt(rng, 1, 99) / 10);
      return { typeId: 'DEC_TENTHS_X_TENTHS', left, right, tier: 3, targetSeconds: 34 };
    }
    if (mode === 1) {
      const left = normalizeNumber(randInt(rng, 1, 999) / 100);
      const right = normalizeNumber(randInt(rng, 1, 99) / 10);
      return { typeId: 'DEC_HUNDREDTHS_X_TENTHS', left, right, tier: 3, targetSeconds: 42 };
    }
    if (mode <= 3) return { typeId: 'M4D1_P5', left: randInt(rng, 1000, 9999), right: randInt(rng, 2, 9), tier: 3, targetSeconds: 46 };
    return { typeId: 'M4D2_P6', left: randInt(rng, 1000, 9999), right: randInt(rng, 11, 99), tier: 3, targetSeconds: 72 };
  }

  if (mode === 0) return { typeId: 'M2D3_P5', left: randInt(rng, 12, 99), right: randInt(rng, 101, 999), tier: 4, targetSeconds: 58 };
  if (mode === 1) return { typeId: 'M3D3_P6', left: randInt(rng, 101, 999), right: randInt(rng, 101, 999), tier: 4, targetSeconds: 82 };
  if (mode === 2) return { typeId: 'M4D3_P7', left: randInt(rng, 1000, 9999), right: randInt(rng, 101, 999), tier: 4, targetSeconds: 105 };
  if (mode === 3) return { typeId: 'M4D4_MIX', left: randInt(rng, 1000, 9999), right: randInt(rng, 1000, 9999), tier: 4, targetSeconds: 135 };
  return {
    typeId: 'DEC_X_HUNDREDTHS',
    left: normalizeNumber(randInt(rng, 101, 9999) / 100),
    right: normalizeNumber(randInt(rng, 1, 99) / 100),
    tier: 4,
    targetSeconds: 88
  };
}

export function createCertificationQuestions(attemptId: string, claimedTypeIndex: number): CertificationQuestion[] {
  const rng = mulberry32(hashSeed(`${CERTIFICATION_VERSION}:${attemptId}:${claimedTypeIndex}`));
  const claimedTier = certificationTierForTypeIndex(claimedTypeIndex);
  const foundationTier = Math.max(0, claimedTier - 1);
  const challengeTier = Math.min(4, claimedTier + 1);
  const blueprint: Array<{ tier: number; band: CertificationQuestion['band'] }> = [];
  for (let i = 0; i < 8; i += 1) blueprint.push({ tier: foundationTier, band: 'foundation' });
  for (let i = 0; i < 16; i += 1) blueprint.push({ tier: claimedTier, band: 'core' });
  for (let i = 0; i < 6; i += 1) blueprint.push({ tier: challengeTier, band: 'challenge' });

  const questions = blueprint.map((item, index) => ({
    id: `${attemptId}:${String(index + 1).padStart(2, '0')}`,
    band: item.band,
    ...makeTierProblem(item.tier, rng, index + randInt(rng, 0, 1000))
  }));
  return shuffle(rng, questions).map((question, index) => ({ ...question, id: `${attemptId}:${String(index + 1).padStart(2, '0')}` }));
}

export function evaluateCertification(questions: CertificationQuestion[], answers: CertificationAnswer[]) {
  const byId = new Map(answers.map((answer) => [String(answer.questionId), answer]));
  let overallCorrect = 0;
  let foundationCorrect = 0;
  let coreCorrect = 0;
  let challengeCorrect = 0;
  let normalizedSpeedSum = 0;
  let impossibleFastCount = 0;
  const details = questions.map((question) => {
    const submitted = byId.get(question.id);
    const time = Number(submitted?.firstTime);
    const answer = submitted?.answer === null ? null : Number(submitted?.answer);
    const expected = normalizeNumber(question.left * question.right);
    const correct = Number.isFinite(answer) && Math.abs(normalizeNumber(answer!) - expected) <= 1e-9;
    if (correct) overallCorrect += 1;
    if (correct && question.band === 'foundation') foundationCorrect += 1;
    if (correct && question.band === 'core') coreCorrect += 1;
    if (correct && question.band === 'challenge') challengeCorrect += 1;
    if (Number.isFinite(time)) {
      normalizedSpeedSum += clamp(time / question.targetSeconds, 0, 8);
      if (time < 0.25) impossibleFastCount += 1;
    } else {
      normalizedSpeedSum += 8;
    }
    return { questionId: question.id, expected, answer, firstTime: time, correct, band: question.band, tier: question.tier };
  });
  const speedIndex = normalizedSpeedSum / Math.max(1, questions.length);
  const correctnessPass = overallCorrect >= 24 && foundationCorrect >= 6 && coreCorrect >= 13;
  const speedPass = speedIndex <= 2.75;
  const riskPass = impossibleFastCount < 8;
  return {
    passed: correctnessPass && speedPass && riskPass,
    overallCorrect,
    foundationCorrect,
    coreCorrect,
    challengeCorrect,
    speedIndex: Math.round(speedIndex * 100) / 100,
    impossibleFastCount,
    correctnessPass,
    speedPass,
    riskPass,
    details
  };
}
