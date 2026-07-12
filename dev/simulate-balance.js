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
const KUKU_PATTERNS = [
  { id: 'A-1', label: 'のぼり' },
  { id: 'A-2', label: 'くだり' },
  { id: 'A-3', label: 'ばらばら' }
];

function range(min, max) { return Array.from({ length: max - min + 1 }, (_, i) => min + i); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function avg(values) { return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length); }
function formatRate(value) {
  const digits = String(Math.max(0, Math.round(value)));
  const parts = [];
  for (let end = digits.length; end > 0; end -= 4) parts.unshift(digits.slice(Math.max(0, end - 4), end));
  return parts.join(' ');
}
function shuffle(items) {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function kukuBaseDifficulty(row) {
  if (row === 0 || row === 1) return 0.55;
  if (row === 2 || row === 5 || row === 10) return 0.82;
  if (row === 3 || row === 4) return 1.00;
  if (row >= 6 && row <= 9) return 1.18 + (row - 6) * 0.04;
  return 1.32 + Math.min(9, row - 11) * 0.035;
}
function kukuBaseTarget(row) {
  if (row === 0 || row === 1 || row === 10) return 1.6;
  if (row === 2 || row === 5) return 1.9;
  if (row === 3 || row === 4) return 2.15;
  if (row >= 6 && row <= 9) return 2.35;
  return 3.05 + Math.min(9, row - 11) * 0.08;
}
function kukuExtendedTarget(row) {
  if (row === 0 || row === 1 || row === 10) return 3.4;
  if (row === 2 || row === 5) return 3.8;
  if (row >= 11) return 4.9 + Math.min(9, row - 11) * 0.08;
  return 4.25;
}
function buildKukuTypes(mode) {
  const rows = [0, 1, 2, 5, 10, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const expanded = mode === 'extended';
  return rows.map((row) => ({
    id: `KUKU_${row}_${expanded ? '11_20' : '1_10'}`,
    label: expanded ? `拡張九九 ${row}の段（11〜20）` : `九九 ${row}の段（1〜10）`,
    difficulty: expanded ? kukuBaseDifficulty(row) + 0.78 : kukuBaseDifficulty(row),
    targetSeconds: expanded ? kukuExtendedTarget(row) : kukuBaseTarget(row),
    family: 'kuku',
    kukuMode: mode,
    row
  }));
}

function mixType(id, label, difficulty, targetSeconds) {
  return { id, label, difficulty, targetSeconds, family: 'mix' };
}


const CURRICULUM = [
  ...buildKukuTypes('base'),
  mixType('PLACE_10X_100X', '10倍・100倍', 1.55, 4.4),
  mixType('TENS_X_1D', '何十×1けた', 1.72, 4.5),
  mixType('KUKU_MIX_11_20', '11〜20の段 混合', 1.86, 4.8),
  mixType('KUKU_MIX_0_20', '0〜20の段 混合', 1.94, 5.0),
  mixType('M2D1_NC', '2けた×1けた 繰り上がりなし', 1.95, 4.9),
  mixType('M2D1_C_ONES', '2けた×1けた 一の位で繰り上がり', 2.18, 5.4),
  mixType('M2D1_C_TENS', '2けた×1けた 十の位で繰り上がり', 2.32, 5.8),
  mixType('M2D1_C_BOTH', '2けた×1けた 複数回の繰り上がり', 2.55, 6.2),
  mixType('M2D1_MIX', '2けた×1けた 混合', 2.68, 6.5),
  mixType('HUNDREDS_X_1D', '何百×1けた', 2.35, 5.8),
  mixType('M3D1_NC', '3けた×1けた 繰り上がりなし', 2.85, 7.2),
  mixType('M3D1_C_ONES', '3けた×1けた 一の位で繰り上がり', 3.05, 7.8),
  mixType('M3D1_C_TENS', '3けた×1けた 十の位で繰り上がり', 3.18, 8.0),
  mixType('M3D1_C_CHAIN', '3けた×1けた 連続した繰り上がり', 3.55, 8.8),
  mixType('M3D1_ZERO_INSIDE', '3けた×1けた 0を含む', 3.08, 8.2),
  mixType('M3D1_MIX', '3けた×1けた 混合', 3.65, 9.2),
  mixType('TENS_X_TENS', '何十×何十', 3.25, 7.6),
  mixType('HUNDREDS_X_TENS', '何百×何十', 3.45, 8.2),
  mixType('M2D_X10', '2けた×10', 3.55, 8.8),
  mixType('M2D_X_TENS', '2けた×何十', 3.75, 9.8),
  mixType('M3D_X10', '3けた×10', 3.90, 10.2),
  mixType('M3D_X_TENS', '3けた×何十', 4.15, 11.5),
  ...buildKukuTypes('extended'),
  mixType('KUKU_EXT_MIX_0_20_X11_20', '0〜20×11〜20 混合', 3.95, 10.8),
  mixType('M2D2_TEN', '2けた×10台', 4.10, 12.0),
  mixType('M2D2_NO_CARRY', '2けた×2けた 繰り上がり少なめ', 4.35, 12.4),
  mixType('M2D2_CARRY', '2けた×2けた 繰り上がりあり', 4.78, 13.8),
  mixType('M2D2_ZERO_PRODUCT', '2けた×2けた 0を含む計算', 4.25, 12.6),
  mixType('M2D2_MIX', '2けた×2けた 混合', 5.05, 15.0),
  mixType('M3D2_TEN', '3けた×10台', 5.28, 17.5),
  mixType('M3D2_NO_CARRY', '3けた×2けた 繰り上がり少なめ', 5.55, 18.8),
  mixType('M3D2_CARRY', '3けた×2けた 繰り上がりあり', 6.05, 21.5),
  mixType('M3D2_ZERO_PRODUCT', '3けた×2けた 0を含む計算', 5.72, 20.0),
  mixType('M3D2_MIX', '3けた×2けた 混合', 6.35, 23.0),
  mixType('DEC_TENTHS_LT1_X_1D', '0.?×1けた', 4.65, 11.5),
  mixType('DEC_TENTHS_X_1D', '小数第一位×1けた', 4.95, 12.8),
  mixType('DEC_HUNDREDTHS_LT1_X_1D', '0.??×1けた', 5.18, 14.0),
  mixType('DEC_HUNDREDTHS_X_1D', '小数第二位×1けた', 5.35, 14.8),
  mixType('DEC_X_WHOLE_2D', '小数×2けた整数', 5.85, 18.5),
  mixType('DEC_X_10_100', '小数×10・100', 4.35, 9.6),
  mixType('WHOLE_X_DEC_TENTHS', '整数×0.?', 5.45, 14.5),
  mixType('DEC_TENTHS_X_TENTHS', '小数第一位×小数第一位', 6.25, 21.0),
  mixType('DEC_HUNDREDTHS_X_TENTHS', '小数第二位×小数第一位', 6.65, 24.0),
  mixType('DECIMAL_MUL_MIX', '小数のかけ算 混合', 7.10, 27.0)
];

const LEARNERS = [
  { name: 'A 初学者・ゆっくり型', accuracy: 0.70, speed: 1.58, learning: 0.018, carelessness: 0.030 },
  { name: 'B 標準型', accuracy: 0.83, speed: 1.16, learning: 0.026, carelessness: 0.025 },
  { name: 'C 九九先行・筆算で失速', accuracy: 0.88, speed: 0.96, learning: 0.018, carelessness: 0.025, writtenPenalty: 0.08, kukuBonus: 0.08 },
  { name: 'D 高速・ケアレス型', accuracy: 0.90, speed: 0.72, learning: 0.025, carelessness: 0.115 },
  { name: 'E 慎重・高正答型', accuracy: 0.965, speed: 1.34, learning: 0.024, carelessness: 0.010 },
  { name: 'F 得意・高速安定型', accuracy: 0.955, speed: 0.78, learning: 0.034, carelessness: 0.010 },
  { name: 'G 不安定・集中波型', accuracy: 0.84, speed: 1.03, learning: 0.027, carelessness: 0.040, wave: true }
];

function isKuku(type) { return type.family === 'kuku'; }
function maxPatternIndex(typeIndex) { return isKuku(CURRICULUM[typeIndex]) ? 2 : 5; }
function currentPatternId(state) { const idx = clamp(state.patternIndex, 0, maxPatternIndex(state.typeIndex)); return isKuku(CURRICULUM[state.typeIndex]) ? KUKU_PATTERNS[idx].id : PATTERNS[idx].id; }
function isSkipOutcome(outcome) { return ['skip', 'kuku_skip_to_random', 'kuku_skip_row'].includes(outcome); }

function speedFactor(seconds, target) {
  if (seconds <= target * 0.65) return 1.25;
  if (seconds <= target) return 1.08;
  if (seconds <= target * 1.35) return 0.92;
  if (seconds <= target * 1.75) return 0.72;
  return 0.52;
}

function planTypes(state) {
  const type = CURRICULUM[state.typeIndex];
  if (isKuku(type)) return Array(SET_SIZE).fill(state.typeIndex);
  const p = PATTERNS[state.patternIndex];
  const ids = [];
  const push = (idx, n) => { for (let i = 0; i < n; i++) ids.push(clamp(idx, 0, CURRICULUM.length - 1)); };
  push(state.typeIndex, p.center);
  push(state.typeIndex - 1, p.recent);
  push(state.typeIndex - 2, p.base);
  push(state.typeIndex + 1, p.challenge);
  while (ids.length < SET_SIZE) ids.push(state.typeIndex);
  return shuffle(ids).slice(0, SET_SIZE);
}

function judgeKuku(summary, state) {
  const type = CURRICULUM[state.typeIndex];
  const phase = state.patternIndex;
  const maxTime = Math.max(...summary.items.map((i) => i.time));
  const strict = type.kukuMode === 'base' && type.row <= 10;
  const limit = strict ? 4.0 : 6.2;
  const randomLimit = strict ? 5.0 : 7.2;
  const skipToRandom = strict ? 3.0 : 4.6;
  const skipRow = strict ? 2.0 : 3.2;
  const allInitialCorrect = summary.firstCorrect === SET_SIZE;

  if (summary.finalCorrect <= 5 || summary.firstCorrect <= 4 || summary.avgTime > randomLimit * 2.0) return 'regress';
  if (!allInitialCorrect) return summary.finalCorrect >= 8 ? 'stay' : 'regress';
  if (phase === 0) {
    if (maxTime < skipRow) return 'kuku_skip_row';
    if (maxTime < skipToRandom) return 'kuku_skip_to_random';
    if (maxTime < limit) return 'advance';
    return 'stay';
  }
  if (phase === 1) {
    if (maxTime < skipRow) return 'kuku_skip_row';
    if (maxTime < limit) return 'advance';
    return 'stay';
  }
  return maxTime < randomLimit ? 'advance' : 'stay';
}

function judge(summary, state) {
  if (isKuku(CURRICULUM[state.typeIndex])) return judgeKuku(summary, state);
  const excellent = summary.firstCorrect === SET_SIZE && summary.avgTime <= summary.targetTime;
  const strong = summary.firstCorrect === SET_SIZE && summary.avgTime <= summary.targetTime * 1.15;
  const good = summary.finalCorrect >= 9 && summary.firstCorrect >= 8 && summary.avgTime <= summary.targetTime * 1.45;
  const poor = summary.finalCorrect <= 5 || summary.firstCorrect <= 4 || summary.avgTime > summary.targetTime * 2.0;
  if (excellent) return 'skip';
  if (strong || good) return 'advance';
  if (poor) return 'regress';
  return 'stay';
}

function initialAccuracyFactor(summary) {
  const rate = summary.firstCorrect / SET_SIZE;
  if (summary.firstCorrect === SET_SIZE) return 1;
  if (summary.firstCorrect >= 9) return 0.90;
  if (summary.firstCorrect >= 8) return 0.74;
  if (summary.firstCorrect >= 7) return 0.60;
  return clamp(0.40 + rate * 0.22, 0.40, 0.56);
}

function delta(summary, state, outcome) {
  const possible = summary.items.reduce((sum, item) => sum + 1.25 * item.type.difficulty, 0);
  const achievedRaw = summary.items.reduce((sum, item) => {
    const result = item.correct ? 1 : item.retryCorrect ? 0.45 : 0;
    return sum + result * speedFactor(item.time, item.type.targetSeconds) * item.type.difficulty;
  }, 0);
  const achieved = achievedRaw * initialAccuracyFactor(summary);
  const ratio = possible ? achieved / possible : 0;
  const avgDifficulty = avg(summary.items.map((i) => i.type.difficulty));
  const expected = clamp(0.25 + Math.log10(state.rating + 100) / 24, 0.28, 0.76);
  const inflation = 360 * Math.pow(avgDifficulty, 1.38) * (1 + Math.log2(avgDifficulty + 1));
  const suppression = 1 / (1 + Math.log10(state.rating + 10) / 6.2);
  let d = (ratio - expected) * inflation;
  if (summary.firstCorrect === SET_SIZE) {
    d += 0.10 * inflation;
    if (summary.avgTime <= summary.targetTime * 1.15) d += 0.11 * inflation;
  } else if (summary.firstCorrect >= 9 && summary.finalCorrect === SET_SIZE) {
    d += 0.06 * inflation;
  } else if (summary.firstCorrect <= 8) {
    d -= (9 - summary.firstCorrect) * 0.035 * inflation;
  }
  if (summary.finalCorrect === SET_SIZE && summary.firstCorrect < SET_SIZE) d += 0.035 * inflation;
  if (summary.finalCorrect <= 6) d -= 0.10 * inflation;
  if (isSkipOutcome(outcome)) d += 0.11 * inflation;
  d *= suppression;
  if (isSkipOutcome(outcome)) d *= 1.28;
  if (outcome === 'stay' && d > 0) d *= Math.pow(0.5, state.patternStayCount + 1);
  if (isKuku(CURRICULUM[state.typeIndex]) && outcome === 'stay' && summary.firstCorrect === SET_SIZE) d = Math.max(0, d);
  const cap = Math.max(120, 1900 * Math.pow(avgDifficulty, 1.12));
  return Math.round(clamp(d, -cap * 0.32, cap * (isSkipOutcome(outcome) ? 1.42 : 1.08)));
}

function advance(state, outcome) {
  const type = CURRICULUM[state.typeIndex];
  const p = state.patternIndex;
  if (outcome === 'stay') { state.patternStayCount += 1; return; }
  state.patternStayCount = 0;
  if (isKuku(type)) {
    if (outcome === 'regress') {
      if (p > 0) { state.patternIndex = p - 1; return; }
      if (state.typeIndex > 0) { state.typeIndex -= 1; state.patternIndex = maxPatternIndex(state.typeIndex); }
      return;
    }
    if (outcome === 'kuku_skip_to_random') { state.patternIndex = 2; return; }
    if (outcome === 'kuku_skip_row' || (outcome === 'advance' && p >= 2) || (outcome === 'skip' && p >= 1)) {
      state.typeIndex = Math.min(CURRICULUM.length - 1, state.typeIndex + 1);
      state.patternIndex = 0;
      return;
    }
    if (outcome === 'advance' || outcome === 'skip') { state.patternIndex = Math.min(2, p + 1); return; }
    return;
  }
  if (outcome === 'regress') {
    if (p === 3 && state.typeIndex > 0) { state.typeIndex -= 1; state.patternIndex = maxPatternIndex(state.typeIndex); return; }
    state.patternIndex = Math.max(0, p - 1); return;
  }
  if (isSkipOutcome(outcome)) {
    if (p === 0 || p === 1) { state.patternIndex = 2; return; }
    if (p === 2) { state.typeIndex = Math.min(CURRICULUM.length - 1, state.typeIndex + 1); state.patternIndex = isKuku(CURRICULUM[state.typeIndex]) ? 0 : 3; return; }
    if (p === 3) { state.patternIndex = 5; return; }
    if (p === 4 || p === 5) { state.patternIndex = 0; return; }
  }
  if (p === 2) { state.typeIndex = Math.min(CURRICULUM.length - 1, state.typeIndex + 1); state.patternIndex = isKuku(CURRICULUM[state.typeIndex]) ? 0 : 3; return; }
  if (p === 5) { state.patternIndex = 0; return; }
  state.patternIndex = Math.min(5, p + 1);
}

function runLearner(model, minutes) {
  const state = { rating: 300, typeIndex: 0, patternIndex: 0, patternStayCount: 0, skill: 0, learned: new Set(), skips: 0, stays: 0, regress: 0 };
  let elapsedMinutes = 0;
  let sets = 0;
  while (elapsedMinutes < minutes) {
    const typeIndexes = planTypes(state);
    const items = typeIndexes.map((idx) => {
      const type = CURRICULUM[idx];
      const writtenPenalty = model.writtenPenalty && type.difficulty >= 3.5 ? model.writtenPenalty : 0;
      const wavePenalty = model.wave ? (Math.sin((sets + 1) * 0.72) * 0.055) : 0;
      const difficultyPenalty = (type.difficulty - 1) * 0.060;
      const kukuBonus = isKuku(type) ? (model.kukuBonus || 0) : 0;
      const pCorrect = clamp(model.accuracy + kukuBonus + state.skill * 0.72 - difficultyPenalty - model.carelessness - writtenPenalty + wavePenalty, 0.15, 0.996);
      const correct = Math.random() < pCorrect;
      const retryCorrect = !correct && Math.random() < clamp(pCorrect + 0.12, 0, 0.98);
      const timeNoise = 0.82 + Math.random() * 0.42;
      const phasePenalty = isKuku(type) && state.patternIndex === 2 ? 1.08 : 1.0;
      const time = type.targetSeconds * model.speed * Math.max(0.45, 1.05 - state.skill * 0.7) * timeNoise * phasePenalty;
      return { type, correct, retryCorrect, time };
    });
    const summary = {
      items,
      firstCorrect: items.filter((i) => i.correct).length,
      finalCorrect: items.filter((i) => i.correct || i.retryCorrect).length,
      avgTime: avg(items.map((i) => i.time)),
      targetTime: avg(items.map((i) => i.type.targetSeconds))
    };
    const outcome = judge(summary, state);
    if (isSkipOutcome(outcome)) state.skips += 1;
    if (outcome === 'stay') state.stays += 1;
    if (outcome === 'regress') state.regress += 1;
    const patternId = currentPatternId(state);
    const centerType = CURRICULUM[state.typeIndex];
    const typeQuestions = items.filter((i) => i.type === centerType);
    const typeInitialRate = typeQuestions.filter((i) => i.correct).length / Math.max(1, typeQuestions.length);
    const typeAllFinal = typeQuestions.every((i) => i.correct || i.retryCorrect);
    const typeAvgTime = avg(typeQuestions.map((i) => i.time));
    const maxTime = Math.max(...typeQuestions.map((i) => i.time));
    if (isKuku(centerType)) {
      const limit = centerType.kukuMode === 'extended' ? 7.2 : 5.0;
      if (typeQuestions.every((i) => i.correct) && maxTime < limit && (patternId === 'A-3' || outcome === 'kuku_skip_row')) state.learned.add(centerType.id);
    } else if (patternId === 'A' && typeQuestions.every((i) => i.correct) && typeAvgTime <= centerType.targetSeconds * 1.20) {
      state.learned.add(centerType.id);
    } else if (patternId === 'C' && (outcome === 'advance' || isSkipOutcome(outcome)) && typeAllFinal && summary.finalCorrect >= 9 && summary.firstCorrect >= 9 && typeInitialRate >= 0.9 && typeAvgTime <= centerType.targetSeconds * 1.55) {
      state.learned.add(centerType.id);
    }
    state.rating = clamp(state.rating + delta(summary, state, outcome), 0, MAX_RATE);
    advance(state, outcome);
    state.skill = clamp(state.skill + model.learning * (0.46 + summary.finalCorrect / SET_SIZE), 0, 0.38);
    elapsedMinutes += avg(items.map((i) => i.time)) * SET_SIZE / 60 + 0.45;
    sets += 1;
    if (sets > 20000) break;
  }
  return {
    model: model.name,
    minutes,
    sets,
    rating: state.rating,
    type: CURRICULUM[state.typeIndex].label,
    pattern: currentPatternId(state),
    skips: state.skips,
    stays: state.stays,
    regress: state.regress,
    learned: state.learned.size
  };
}

for (const minutes of [30, 60, 300, 600, 1800, 6000]) {
  console.log(`\n=== ${minutes}分 ===`);
  for (const learner of LEARNERS) {
    const runs = Array.from({ length: minutes >= 1800 ? 80 : 140 }, () => runLearner(learner, minutes));
    const rating = Math.round(avg(runs.map((r) => r.rating)));
    const sets = Math.round(avg(runs.map((r) => r.sets)));
    const skips = Math.round(avg(runs.map((r) => r.skips)));
    const stays = Math.round(avg(runs.map((r) => r.stays)));
    const learned = Math.round(avg(runs.map((r) => r.learned)));
    const typical = runs[Math.floor(runs.length / 2)];
    console.log(`${learner.name.padEnd(14)} rate=${formatRate(rating).padStart(11)} sets=${String(sets).padStart(4)} skips=${String(skips).padStart(3)} stays=${String(stays).padStart(3)} learned=${String(learned).padStart(2)} type=${typical.type} pattern=${typical.pattern}`);
  }
}
