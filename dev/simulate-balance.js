#!/usr/bin/env node
'use strict';

const SET_SIZE = 10;
const MAX_RATE = 99999999;
const RATE_INFLATION_BASE = 5200;
const RATE_CAP_BASE = 26000;
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
function buildKukuTypes(mode, rows) {
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
  ...buildKukuTypes('base', [5, 2, 3, 4, 6, 7, 8, 9, 1, 0, 10]),
  mixType('KUKU_MIX_1_9', '九九 1〜9混合', 1.42, 3.2),
  mixType('KUKU_MIX_0_10', '0〜10の段 混合', 1.55, 3.6),
  mixType('PLACE_10X_100X', '10倍・100倍', 1.55, 4.4),
  mixType('TENS_X_1D', '何十×1けた', 1.72, 4.5),
  mixType('M2D1_NC_P2', '2けた×1けた 繰り上がりなし・積2けた', 1.95, 4.9),
  mixType('M2D1_C1_P2', '2けた×1けた 繰り上がり1回・積2けた', 2.14, 5.3),
  mixType('M2D1_C1_P3', '2けた×1けた 繰り上がり1回・積3けた', 2.30, 5.8),
  mixType('M2D1_CM_P3', '2けた×1けた 繰り上がり複数・積3けた', 2.55, 6.2),
  mixType('M2D1_MIX', '2けた×1けた 積の桁数混合', 2.70, 6.6),
  mixType('HUNDREDS_X_1D', '何百×1けた', 2.35, 5.8),
  mixType('M3D1_NC_P3', '3けた×1けた 繰り上がりなし・積3けた', 2.85, 7.2),
  mixType('M3D1_C_P3', '3けた×1けた 繰り上がりあり・積3けた', 3.05, 7.8),
  mixType('M3D1_C1_P4', '3けた×1けた 繰り上がり1〜2回・積4けた', 3.25, 8.3),
  mixType('M3D1_CM_P4', '3けた×1けた 連続繰り上がり・積4けた', 3.58, 8.9),
  mixType('M3D1_ZERO', '3けた×1けた 0を含む', 3.15, 8.3),
  mixType('M3D1_MIX', '3けた×1けた 積の桁数混合', 3.68, 9.3),
  ...buildKukuTypes('base', range(11, 20)),
  mixType('KUKU_MIX_11_20', '11〜20の段 混合', 1.86, 4.8),
  mixType('KUKU_MIX_0_20', '0〜20の段 混合', 1.94, 5.0),
  mixType('TENS_X_TENS', '何十×何十', 3.25, 7.6),
  mixType('HUNDREDS_X_TENS', '何百×何十', 3.45, 8.2),
  mixType('M2D_X10', '2けた×10', 3.55, 8.8),
  mixType('M2D_X_TENS', '2けた×何十', 3.75, 9.8),
  mixType('M3D_X10', '3けた×10', 3.90, 10.2),
  mixType('M3D_X_TENS', '3けた×何十', 4.15, 11.5),
  mixType('M2D2_LC_P3', '2けた×2けた 繰り上がり少なめ・積3けた', 4.25, 12.2),
  mixType('M2D2_MC_P3', '2けた×2けた 繰り上がり複数・積3けた', 4.55, 13.2),
  mixType('M2D2_LC_P4', '2けた×2けた 繰り上がり少なめ・積4けた', 4.72, 13.8),
  mixType('M2D2_MC_P4', '2けた×2けた 繰り上がり複数・積4けた', 5.02, 15.0),
  mixType('M2D2_MIX', '2けた×2けた 積の桁数混合', 5.18, 15.8),
  mixType('M3D2_LC_P4', '3けた×2けた 繰り上がり少なめ・積4けた', 5.48, 18.5),
  mixType('M3D2_MC_P4', '3けた×2けた 繰り上がり複数・積4けた', 5.82, 20.0),
  mixType('M3D2_LC_P5', '3けた×2けた 繰り上がり少なめ・積5けた', 6.02, 21.2),
  mixType('M3D2_MC_P5', '3けた×2けた 繰り上がり複数・積5けた', 6.35, 23.0),
  mixType('M3D2_MIX', '3けた×2けた 積の桁数混合', 6.52, 24.0),
  ...buildKukuTypes('extended', [5, 2, 3, 4, 6, 7, 8, 9, 1, 0, 10, ...range(11, 20)]),
  mixType('KUKU_EXT_MIX_0_20_X11_20', '0〜20×11〜20 混合', 3.95, 10.8),
  mixType('DEC_TENTHS_LT1_X_1D', '0.?×1けた', 4.65, 11.5),
  mixType('DEC_TENTHS_X_1D', '小数第一位×1けた', 4.95, 12.8),
  mixType('DEC_HUNDREDTHS_LT1_X_1D', '0.??×1けた', 5.18, 14.0),
  mixType('DEC_HUNDREDTHS_X_1D', '小数第二位×1けた', 5.35, 14.8),
  mixType('DEC_X_WHOLE_2D', '小数×2けた整数', 5.85, 18.5),
  mixType('DEC_X_10_100', '小数×10・100', 4.35, 9.6),
  mixType('WHOLE_X_DEC_TENTHS', '整数×0.?', 5.45, 14.5),
  mixType('DEC_TENTHS_X_TENTHS', '小数第一位×小数第一位', 6.25, 21.0),
  mixType('DEC_HUNDREDTHS_X_TENTHS', '小数第二位×小数第一位', 6.65, 24.0),
  mixType('DECIMAL_MUL_MIX', '小数のかけ算 混合', 7.10, 27.0),
  mixType('M4D1_P4', '4けた×1けた・積4けた', 7.35, 28.0),
  mixType('M4D1_P5', '4けた×1けた・積5けた', 7.65, 30.0),
  mixType('M4D2_P5', '4けた×2けた・積5けた', 7.95, 34.0),
  mixType('M4D2_P6', '4けた×2けた・積6けた', 8.25, 38.0),
  mixType('M2D3_P4', '2けた×3けた・積4けた', 8.05, 34.0),
  mixType('M2D3_P5', '2けた×3けた・積5けた', 8.30, 38.0),
  mixType('M3D3_P5', '3けた×3けた・積5けた', 8.55, 42.0),
  mixType('M3D3_P6', '3けた×3けた・積6けた', 8.85, 47.0),
  mixType('M4D3_P6', '4けた×3けた・積6けた', 9.10, 52.0),
  mixType('M4D3_P7', '4けた×3けた・積7けた', 9.40, 58.0),
  mixType('DEC_X_HUNDREDTHS', '小数×小数第二位', 9.25, 48.0),
  mixType('M4D4_MIX', '4けた×4けた 積7〜8けた', 9.65, 68.0),
  mixType('MASTER_MUL_MIX', '乗法 熟達者総合', 9.80, 60.0)
];

const LEARNERS = [
  { name: 'A 初学者・ゆっくり型', accuracy: 0.70, speed: 1.58, learning: 0.018, carelessness: 0.030 },
  { name: 'B 標準型', accuracy: 0.83, speed: 1.16, learning: 0.026, carelessness: 0.025 },
  { name: 'C 九九先行・筆算で失速', accuracy: 0.88, speed: 0.96, learning: 0.018, carelessness: 0.025, writtenPenalty: 0.08, kukuBonus: 0.08 },
  { name: 'D 高速・ケアレス型', accuracy: 0.90, speed: 0.72, learning: 0.025, carelessness: 0.115 },
  { name: 'E 慎重・高正答型', accuracy: 0.965, speed: 1.34, learning: 0.024, carelessness: 0.010 },
  { name: 'F 得意・高速安定型', accuracy: 0.955, speed: 0.72, learning: 0.034, carelessness: 0.010 },
  { name: 'G 不安定・集中波型', accuracy: 0.84, speed: 1.03, learning: 0.027, carelessness: 0.040, wave: true }
];

function isKuku(type) { return type.family === 'kuku'; }

function writtenGraceForType(type) {
  if (!type || isKuku(type)) return 1;
  const id = type.id || '';
  if (id.startsWith('M2D2') || id.startsWith('M3D2')) return 1.18;
  if (id.startsWith('M4D') || id.startsWith('M2D3') || id.startsWith('M3D3') || id === 'M4D4_MIX' || id === 'MASTER_MUL_MIX') return 1.28;
  if (id.startsWith('DEC_') || id.startsWith('WHOLE_X_DEC') || id === 'DECIMAL_MUL_MIX') return type.difficulty >= 6 ? 1.18 : 1.12;
  if (type.difficulty >= 4.0) return 1.12;
  return 1;
}
function effectiveTarget(type) { return (type?.targetSeconds || 5) * writtenGraceForType(type); }

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


function getEndgameRateBoost(avgDifficulty) {
  const x = Math.max(0, avgDifficulty - 6.4);
  return 1 + Math.pow(x, 1.35) * 0.38;
}

function delta(summary, state, outcome) {
  const possible = summary.items.reduce((sum, item) => sum + 1.25 * item.type.difficulty, 0);
  const achievedRaw = summary.items.reduce((sum, item) => {
    const result = item.correct ? 1 : item.retryCorrect ? 0.45 : 0;
    return sum + result * speedFactor(item.time, effectiveTarget(item.type)) * item.type.difficulty;
  }, 0);
  const achieved = achievedRaw * initialAccuracyFactor(summary);
  const ratio = possible ? achieved / possible : 0;
  const avgDifficulty = avg(summary.items.map((i) => i.type.difficulty));
  const expected = clamp(0.25 + Math.log10(state.rating + 100) / 24, 0.28, 0.76);
  const endgameBoost = getEndgameRateBoost(avgDifficulty);
  const inflation = RATE_INFLATION_BASE * Math.pow(avgDifficulty, 1.42) * (1 + Math.log2(avgDifficulty + 1)) * endgameBoost;
  const suppression = 1 / (1 + Math.log10(state.rating + 10) / (6.2 + Math.max(0, avgDifficulty - 6.2) * 1.8));
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
  if (d > 0 && summary.firstCorrect <= 7) d *= 0.68;
  else if (d > 0 && summary.firstCorrect <= 8) d *= 0.82;
  d *= suppression;
  if (isSkipOutcome(outcome)) d *= 1.28;
  if (outcome === 'stay' && d > 0) {
    const high = avgDifficulty >= 8.0;
    d *= Math.max(high ? 0.78 : 0.35, Math.pow(high ? 0.88 : 0.68, state.patternStayCount + 1));
  }
  if (isKuku(CURRICULUM[state.typeIndex]) && outcome === 'stay' && summary.firstCorrect === SET_SIZE) d = Math.max(0, d);
  const cap = Math.max(360, RATE_CAP_BASE * Math.pow(avgDifficulty, 1.20));
  if (summary.finalCorrect >= 8 && d < 0) {
    d = 0;
  }
  if (outcome === 'stay' && summary.finalCorrect === SET_SIZE && summary.avgTime <= summary.targetTime * 1.75) {
    const highAccuracy = summary.firstCorrect >= 8;
    const masteryFloor = avgDifficulty >= 8.0 ? (highAccuracy ? 0.30 : 0.18) : 0.04;
    d = Math.max(d, cap * masteryFloor);
  }
  if (state.typeIndex === CURRICULUM.length - 1 && state.rating >= 90000000 && summary.finalCorrect === SET_SIZE && summary.firstCorrect >= 9 && summary.avgTime <= summary.targetTime * 1.15) {
    d = Math.max(d, (MAX_RATE - state.rating) * 0.50);
  }
  return Math.round(clamp(d, -cap * 0.20, Math.max(cap * (isSkipOutcome(outcome) ? 1.46 : 1.12), d)));
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
      targetTime: avg(items.map((i) => effectiveTarget(i.type)))
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
    } else {
      const highStage = centerType.difficulty >= 7.0;
      const stableHighStage = highStage && typeAllFinal && summary.finalCorrect >= 9 && summary.firstCorrect >= 8 && typeInitialRate >= 0.75 && typeAvgTime <= effectiveTarget(centerType) * 1.75;
      if (patternId === 'A' && ((typeQuestions.every((i) => i.correct) && typeAvgTime <= effectiveTarget(centerType) * 1.20) || stableHighStage)) {
        state.learned.add(centerType.id);
      } else if ((patternId === 'C' || highStage) && (outcome === 'advance' || isSkipOutcome(outcome) || outcome === 'stay') && (stableHighStage || (typeAllFinal && summary.finalCorrect >= 9 && summary.firstCorrect >= 9 && typeInitialRate >= 0.9 && typeAvgTime <= effectiveTarget(centerType) * 1.55))) {
        state.learned.add(centerType.id);
      }
    }
    state.rating = clamp(state.rating + delta(summary, state, outcome), 0, MAX_RATE);
    advance(state, outcome);
    for (let i = 0; i < state.typeIndex; i++) state.learned.add(CURRICULUM[i].id);
    if (state.typeIndex === CURRICULUM.length - 1 && summary.finalCorrect >= 9 && summary.firstCorrect >= 7) state.learned.add(CURRICULUM[state.typeIndex].id);
    state.skill = clamp(state.skill + model.learning * (0.46 + summary.finalCorrect / SET_SIZE), 0, 0.46);
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
