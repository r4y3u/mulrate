#!/usr/bin/env node
'use strict';

const SET_SIZE = 10;
const MAX_RATE = 99999999;
const PATTERNS = [
  { id: 'A', center: 10, recent: 0, base: 0, challenge: 0 },
  { id: 'B', center: 9, recent: 0, base: 0, challenge: 1 },
  { id: 'C', center: 8, recent: 0, base: 0, challenge: 2 },
  { id: 'D', center: 5, recent: 3, base: 2, challenge: 0 },
  { id: 'E', center: 7, recent: 2, base: 1, challenge: 0 },
  { id: 'F', center: 9, recent: 1, base: 0, challenge: 0 }
];

const CURRICULUM = [
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

const LEARNERS = [
  { name: '初学者', accuracy: 0.70, speed: 1.55, learning: 0.018, carelessness: 0.03 },
  { name: '標準', accuracy: 0.82, speed: 1.18, learning: 0.026, carelessness: 0.025 },
  { name: '得意', accuracy: 0.92, speed: 0.88, learning: 0.033, carelessness: 0.018 },
  { name: 'ケアレス型', accuracy: 0.86, speed: 0.78, learning: 0.024, carelessness: 0.085 },
  { name: '慎重型', accuracy: 0.91, speed: 1.42, learning: 0.022, carelessness: 0.012 }
];

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function avg(values) { return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length); }
function formatRate(value) {
  const digits = String(Math.max(0, Math.round(value)));
  const parts = [];
  for (let end = digits.length; end > 0; end -= 4) parts.unshift(digits.slice(Math.max(0, end - 4), end));
  return parts.join(' ');
}

function speedFactor(seconds, target) {
  if (seconds <= target * 0.65) return 1.25;
  if (seconds <= target) return 1.08;
  if (seconds <= target * 1.35) return 0.92;
  if (seconds <= target * 1.75) return 0.72;
  return 0.52;
}

function planTypes(typeIndex, patternIndex) {
  const p = PATTERNS[patternIndex];
  const ids = [];
  const push = (idx, n) => { for (let i = 0; i < n; i++) ids.push(clamp(idx, 0, CURRICULUM.length - 1)); };
  push(typeIndex, p.center);
  push(typeIndex - 1, p.recent);
  push(typeIndex - 2, p.base);
  push(typeIndex + 1, p.challenge);
  while (ids.length < SET_SIZE) ids.push(typeIndex);
  return ids.slice(0, SET_SIZE);
}

function judge(summary) {
  const excellent = summary.firstCorrect === SET_SIZE && summary.avgTime <= summary.targetTime;
  const strong = summary.firstCorrect === SET_SIZE && summary.avgTime <= summary.targetTime * 1.15;
  const good = summary.finalCorrect >= 9 && summary.firstCorrect >= 8 && summary.avgTime <= summary.targetTime * 1.45;
  const poor = summary.finalCorrect <= 5 || summary.firstCorrect <= 4 || summary.avgTime > summary.targetTime * 2.0;
  if (excellent) return 'skip';
  if (strong || good) return 'advance';
  if (poor) return 'regress';
  return 'stay';
}

function delta(summary, state, outcome) {
  const possible = summary.items.reduce((sum, item) => sum + 1.25 * item.type.difficulty, 0);
  const achieved = summary.items.reduce((sum, item) => {
    const result = item.correct ? 1 : item.retryCorrect ? 0.45 : 0;
    return sum + result * speedFactor(item.time, item.type.targetSeconds) * item.type.difficulty;
  }, 0);
  const ratio = possible ? achieved / possible : 0;
  const avgDifficulty = avg(summary.items.map((i) => i.type.difficulty));
  const expected = clamp(0.27 + Math.log10(state.rating + 100) / 22, 0.30, 0.78);
  const inflation = 260 * Math.pow(avgDifficulty, 1.35) * (1 + Math.log2(avgDifficulty + 1));
  const suppression = 1 / (1 + Math.log10(state.rating + 10) / 5);
  let d = (ratio - expected) * inflation;
  if (summary.firstCorrect === SET_SIZE && summary.avgTime <= summary.targetTime * 1.15) d += 0.12 * inflation;
  if (summary.finalCorrect === SET_SIZE && summary.firstCorrect < SET_SIZE) d += 0.04 * inflation;
  if (summary.finalCorrect <= 6) d -= 0.08 * inflation;
  if (outcome === 'skip') d += 0.1 * inflation;
  d *= suppression;
  if (outcome === 'stay' && d > 0) d *= Math.pow(0.5, state.patternStayCount + 1);
  const cap = Math.max(80, 1200 * Math.pow(avgDifficulty, 1.1));
  return Math.round(clamp(d, -cap * 0.45, cap * (outcome === 'skip' ? 1.35 : 1)));
}

function advance(state, outcome) {
  const p = state.patternIndex;
  if (outcome === 'stay') { state.patternStayCount += 1; return; }
  state.patternStayCount = 0;
  if (outcome === 'regress') {
    if (p === 3 && state.typeIndex > 0) { state.typeIndex -= 1; state.patternIndex = 2; return; }
    state.patternIndex = Math.max(0, p - 1); return;
  }
  if (outcome === 'skip') {
    if (p === 0 || p === 1) { state.patternIndex = 2; return; }
    if (p === 2) { state.typeIndex = Math.min(CURRICULUM.length - 1, state.typeIndex + 1); state.patternIndex = 3; return; }
    if (p === 3) { state.patternIndex = 5; return; }
    if (p === 4 || p === 5) { state.patternIndex = 0; return; }
  }
  if (p === 2) { state.typeIndex = Math.min(CURRICULUM.length - 1, state.typeIndex + 1); state.patternIndex = 3; return; }
  if (p === 5) { state.patternIndex = 0; return; }
  state.patternIndex = Math.min(PATTERNS.length - 1, p + 1);
}

function runLearner(model, minutes) {
  const state = { rating: 300, typeIndex: 0, patternIndex: 0, patternStayCount: 0, skill: 0, learned: new Set(), skips: 0, stays: 0 };
  let elapsedMinutes = 0;
  let sets = 0;
  while (elapsedMinutes < minutes) {
    const typeIndexes = planTypes(state.typeIndex, state.patternIndex);
    const items = typeIndexes.map((idx) => {
      const type = CURRICULUM[idx];
      const difficultyPenalty = (type.difficulty - 1) * 0.065;
      const pCorrect = clamp(model.accuracy + state.skill - difficultyPenalty - model.carelessness, 0.18, 0.995);
      const correct = Math.random() < pCorrect;
      const retryCorrect = !correct && Math.random() < clamp(pCorrect + 0.12, 0, 0.98);
      const timeNoise = 0.82 + Math.random() * 0.42;
      const time = type.targetSeconds * model.speed * Math.max(0.45, 1.05 - state.skill * 0.7) * timeNoise;
      return { type, correct, retryCorrect, time };
    });
    const summary = {
      items,
      firstCorrect: items.filter((i) => i.correct).length,
      finalCorrect: items.filter((i) => i.correct || i.retryCorrect).length,
      avgTime: avg(items.map((i) => i.time)),
      targetTime: avg(items.map((i) => i.type.targetSeconds))
    };
    const outcome = judge(summary);
    if (outcome === 'skip') state.skips += 1;
    if (outcome === 'stay') state.stays += 1;
    if (PATTERNS[state.patternIndex].id === 'A' && outcome === 'skip') state.learned.add(CURRICULUM[state.typeIndex].id);
    state.rating = clamp(state.rating + delta(summary, state, outcome), 0, MAX_RATE);
    advance(state, outcome);
    state.skill = clamp(state.skill + model.learning * (0.5 + summary.finalCorrect / SET_SIZE), 0, 0.55);
    elapsedMinutes += avg(items.map((i) => i.time)) * SET_SIZE / 60 + 0.45;
    sets += 1;
  }
  return { model: model.name, minutes, sets, rating: state.rating, type: CURRICULUM[state.typeIndex].label, pattern: PATTERNS[state.patternIndex].id, skips: state.skips, stays: state.stays, learned: state.learned.size };
}

for (const minutes of [30, 60, 300, 600]) {
  console.log(`\n=== ${minutes}分 ===`);
  for (const learner of LEARNERS) {
    const runs = Array.from({ length: 40 }, () => runLearner(learner, minutes));
    const rating = Math.round(avg(runs.map((r) => r.rating)));
    const sets = Math.round(avg(runs.map((r) => r.sets)));
    const skips = Math.round(avg(runs.map((r) => r.skips)));
    const learned = Math.round(avg(runs.map((r) => r.learned)));
    const typical = runs[Math.floor(runs.length / 2)];
    console.log(`${learner.name.padEnd(5)} rate=${formatRate(rating).padStart(9)} sets=${String(sets).padStart(3)} skips=${String(skips).padStart(2)} learned=${learned} type=${typical.type} pattern=${typical.pattern}`);
  }
}
