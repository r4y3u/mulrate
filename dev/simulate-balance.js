#!/usr/bin/env node
'use strict';

// MulRate v1.0.0 balance simulator.
// This is not used by the browser app. It is a developer aid for checking
// whether the rating curve feels plausible before manual playtesting.

const MAX_RATE = 99999999;
const SET_SIZE = 10;

const patterns = [
  { id: 'A', center: 10, recent: 0, base: 0, challenge: 0 },
  { id: 'B', center: 9, recent: 0, base: 0, challenge: 1 },
  { id: 'C', center: 8, recent: 0, base: 0, challenge: 2 },
  { id: 'D', center: 5, recent: 3, base: 2, challenge: 0 },
  { id: 'E', center: 7, recent: 2, base: 1, challenge: 0 },
  { id: 'F', center: 9, recent: 1, base: 0, challenge: 0 }
];

const curriculum = [
  { id: 'KUKU_5_2', label: '九九 5・2の段', difficulty: 1.0, targetSeconds: 2.8 },
  { id: 'KUKU_3_4', label: '九九 3・4の段', difficulty: 1.12, targetSeconds: 3.0 },
  { id: 'KUKU_6', label: '九九 6の段', difficulty: 1.24, targetSeconds: 3.1 },
  { id: 'KUKU_7_8', label: '九九 7・8の段', difficulty: 1.38, targetSeconds: 3.25 },
  { id: 'KUKU_9_1', label: '九九 9・1の段', difficulty: 1.30, targetSeconds: 3.15 },
  { id: 'KUKU_MIX', label: '九九 混合', difficulty: 1.52, targetSeconds: 3.3 },
  { id: 'M2D1_NC', label: '2けた×1けた 繰り上がりなし', difficulty: 1.9, targetSeconds: 4.8 },
  { id: 'M2D1_C_ONES', label: '2けた×1けた 一の位で繰り上がり', difficulty: 2.18, targetSeconds: 5.4 },
  { id: 'M2D1_C_TENS', label: '2けた×1けた 十の位で繰り上がり', difficulty: 2.32, targetSeconds: 5.8 },
  { id: 'M2D1_C_BOTH', label: '2けた×1けた 複数回の繰り上がり', difficulty: 2.55, targetSeconds: 6.2 },
  { id: 'M2D1_ZERO_ONES', label: '2けた×1けた 被乗数の一の位が0', difficulty: 2.05, targetSeconds: 5.0 },
  { id: 'M3D1_NC', label: '3けた×1けた 繰り上がりなし', difficulty: 2.85, targetSeconds: 7.2 },
  { id: 'M3D1_C_BASIC', label: '3けた×1けた 繰り上がりあり', difficulty: 3.18, targetSeconds: 8.0 },
  { id: 'M3D1_C_CHAIN', label: '3けた×1けた 連続した繰り上がり', difficulty: 3.55, targetSeconds: 8.8 },
  { id: 'M3D1_ZERO_INSIDE', label: '3けた×1けた 被乗数に0を含む', difficulty: 3.08, targetSeconds: 8.2 },
  { id: 'M2D2_TEN', label: '2けた×2けた 10台をかける', difficulty: 4.05, targetSeconds: 11.5 },
  { id: 'M2D2_NO_CARRY', label: '2けた×2けた 繰り上がり少なめ', difficulty: 4.35, targetSeconds: 12.4 },
  { id: 'M2D2_CARRY', label: '2けた×2けた 繰り上がりあり', difficulty: 4.78, targetSeconds: 13.8 },
  { id: 'M2D2_ZERO_PRODUCT', label: '2けた×2けた 0を含む計算', difficulty: 4.25, targetSeconds: 12.6 },
  { id: 'M2D2_MIX', label: '2けた×2けた 混合', difficulty: 5.05, targetSeconds: 15.0 }
];

const profiles = {
  beginner: { label: '初学者', accuracy: 0.72, speed: 1.28, growth: 0.010 },
  steady: { label: '標準', accuracy: 0.84, speed: 1.05, growth: 0.014 },
  quick: { label: '速く正確', accuracy: 0.94, speed: 0.78, growth: 0.010 }
};

function simulate(profile, sets = 120) {
  let rating = 300;
  let typeIndex = 0;
  let patternIndex = 0;
  let patternStayCount = 0;
  const snapshots = [];
  let skill = 0;

  for (let set = 1; set <= sets; set++) {
    const qs = plan(typeIndex, patternIndex).map((idx) => curriculum[idx]);
    const answers = qs.map((type) => {
      const diffGap = Math.max(0, type.difficulty - (1 + skill * 4.4));
      const pCorrect = clamp(profile.accuracy + skill * 0.16 - diffGap * 0.08, 0.05, 0.995);
      const initialCorrect = Math.random() < pCorrect;
      const retryCorrect = !initialCorrect && Math.random() < clamp(pCorrect * 0.62, 0.05, 0.88);
      const seconds = type.targetSeconds * clamp(randomNormal(profile.speed - skill * 0.18, 0.12), 0.45, 2.4);
      return { type, initialCorrect, retryCorrect, finalCorrect: initialCorrect || retryCorrect, firstTime: seconds };
    });

    const summary = summarize(answers, rating);
    const outcome = judge(summary);
    const delta = calculateRateDelta(summary, outcome, patternStayCount);
    rating = clamp(Math.round(rating + delta), 0, MAX_RATE);

    if (outcome === 'advance') {
      if (patternIndex === 2) {
        typeIndex = Math.min(curriculum.length - 1, typeIndex + 1);
        patternIndex = 3;
      } else if (patternIndex === 5) {
        patternIndex = 0;
      } else {
        patternIndex = Math.min(patterns.length - 1, patternIndex + 1);
      }
      patternStayCount = 0;
    } else if (outcome === 'regress') {
      patternIndex = Math.max(0, patternIndex - 1);
      patternStayCount = 0;
    } else {
      patternStayCount += 1;
    }

    skill = clamp(skill + profile.growth + (outcome === 'advance' ? 0.006 : outcome === 'regress' ? -0.004 : 0.001), 0, 1);

    if ([10, 20, 40, 80, 120].includes(set)) {
      snapshots.push({ set, rating, point: curriculum[typeIndex].label, pattern: patterns[patternIndex].id, skill: skill.toFixed(2) });
    }
  }

  return snapshots;
}

function plan(typeIndex, patternIndex) {
  const pattern = patterns[patternIndex];
  const current = typeIndex;
  const recent = Math.max(0, current - 1);
  const base = Math.max(0, current - 2);
  const challenge = Math.min(curriculum.length - 1, current + 1);
  return [
    ...Array(pattern.center).fill(current),
    ...Array(pattern.recent).fill(recent),
    ...Array(pattern.base).fill(base),
    ...Array(pattern.challenge).fill(challenge)
  ].slice(0, SET_SIZE);
}

function summarize(answers, ratingBefore) {
  const firstCorrect = answers.filter((q) => q.initialCorrect).length;
  const finalCorrect = answers.filter((q) => q.finalCorrect).length;
  const avgFirstTime = average(answers.map((q) => q.firstTime));
  const targetTime = average(answers.map((q) => q.type.targetSeconds));
  return { questions: answers, firstCorrect, finalCorrect, avgFirstTime, targetTime, ratingBefore };
}

function judge(summary) {
  const excellent = summary.firstCorrect === SET_SIZE && summary.avgFirstTime <= summary.targetTime * 1.15;
  const poor = summary.finalCorrect <= 5 || summary.firstCorrect <= 4 || summary.avgFirstTime > summary.targetTime * 2.0;
  if (excellent) return 'advance';
  if (poor) return 'regress';
  return 'stay';
}

function calculateRateDelta(summary, outcome, patternStayCount) {
  const possible = summary.questions.reduce((sum, q) => sum + 1.25 * q.type.difficulty, 0);
  const achieved = summary.questions.reduce((sum, q) => {
    const resultFactor = q.initialCorrect ? 1 : q.retryCorrect ? 0.45 : 0;
    const speedFactor = getSpeedFactor(q.firstTime, q.type.targetSeconds);
    return sum + resultFactor * speedFactor * q.type.difficulty;
  }, 0);
  const performanceRatio = possible ? achieved / possible : 0;
  const avgDifficulty = average(summary.questions.map((q) => q.type.difficulty));
  const expectedRatio = clamp(0.27 + Math.log10(summary.ratingBefore + 100) / 22, 0.30, 0.78);
  const inflation = 260 * Math.pow(avgDifficulty, 1.35) * (1 + Math.log2(avgDifficulty + 1));
  const suppression = 1 / (1 + Math.log10(summary.ratingBefore + 10) / 5);
  let delta = (performanceRatio - expectedRatio) * inflation;
  if (summary.firstCorrect === SET_SIZE && summary.avgFirstTime <= summary.targetTime * 1.15) delta += 0.12 * inflation;
  if (summary.finalCorrect === SET_SIZE && summary.firstCorrect < SET_SIZE) delta += 0.04 * inflation;
  if (summary.finalCorrect <= 6) delta -= 0.08 * inflation;
  delta *= suppression;
  if (outcome === 'stay' && delta > 0) delta *= Math.pow(0.5, patternStayCount + 1);
  const cap = Math.max(80, 1200 * Math.pow(avgDifficulty, 1.1));
  return Math.round(clamp(delta, -cap * 0.45, cap));
}

function getSpeedFactor(seconds, targetSeconds) {
  if (seconds <= targetSeconds * 0.65) return 1.25;
  if (seconds <= targetSeconds) return 1.08;
  if (seconds <= targetSeconds * 1.35) return 0.92;
  if (seconds <= targetSeconds * 1.75) return 0.72;
  return 0.52;
}

function average(values) {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomNormal(mean, sd) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function formatRate(value) {
  const digits = String(Math.max(0, Math.round(value)));
  const parts = [];
  for (let end = digits.length; end > 0; end -= 4) parts.unshift(digits.slice(Math.max(0, end - 4), end));
  return parts.join(' ');
}

for (const key of Object.keys(profiles)) {
  const rows = simulate(profiles[key], 120);
  console.log(`\n${profiles[key].label}`);
  console.table(rows.map((r) => ({ ...r, rating: formatRate(r.rating) })));
}
