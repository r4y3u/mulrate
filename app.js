(() => {
  'use strict';

  const STORAGE_KEY = 'mulrate_v1_0_0_state';
  const MAX_RATE = 99999999;
  const SET_SIZE = 10;

  const PATTERNS = [
    { id: 'A', center: 10, recent: 0, base: 0, challenge: 0 },
    { id: 'B', center: 9, recent: 0, base: 0, challenge: 1 },
    { id: 'C', center: 8, recent: 0, base: 0, challenge: 2 },
    { id: 'D', center: 5, recent: 3, base: 2, challenge: 0 },
    { id: 'E', center: 7, recent: 2, base: 1, challenge: 0 },
    { id: 'F', center: 9, recent: 1, base: 0, challenge: 0 }
  ];

  const DEFAULT_STATE = {
    player: {
      rating: 300,
      highestRating: 300
    },
    settings: {
      keypadLayout: 'normal',
      inputSide: 'right',
      handwritingPad: true,
      formulaFont: 'readable',
      sound: false
    },
    progress: {
      typeIndex: 0,
      patternIndex: 0,
      patternStayCount: 0,
      completedSets: 0
    },
    mastery: {},
    recentProblems: [],
    history: []
  };

  const els = {
    app: document.getElementById('app'),
    homeButton: document.getElementById('homeButton'),
    pauseButton: document.getElementById('pauseButton'),
    statusText: document.getElementById('statusText'),
    homeScreen: document.getElementById('homeScreen'),
    gameScreen: document.getElementById('gameScreen'),
    pauseScreen: document.getElementById('pauseScreen'),
    settingsScreen: document.getElementById('settingsScreen'),
    homeRate: document.getElementById('homeRate'),
    homePoint: document.getElementById('homePoint'),
    homeDetail: document.getElementById('homeDetail'),
    startButton: document.getElementById('startButton'),
    settingsButton: document.getElementById('settingsButton'),
    questionCounter: document.getElementById('questionCounter'),
    gamePoint: document.getElementById('gamePoint'),
    messageArea: document.getElementById('messageArea'),
    formula: document.getElementById('formula'),
    answerDisplay: document.getElementById('answerDisplay'),
    subInfo: document.getElementById('subInfo'),
    inlineActions: document.getElementById('inlineActions'),
    resumeButton: document.getElementById('resumeButton'),
    pauseHomeButton: document.getElementById('pauseHomeButton'),
    saveSettingsButton: document.getElementById('saveSettingsButton'),
    resetDataButton: document.getElementById('resetDataButton'),
    inputZone: document.getElementById('inputZone'),
    padPanel: document.getElementById('padPanel'),
    clearPadButton: document.getElementById('clearPadButton'),
    scratchPad: document.getElementById('scratchPad'),
    keypadPanel: document.getElementById('keypadPanel'),
    keypad: document.getElementById('keypad'),
    keyHint: document.getElementById('keyHint')
  };

  const CURRICULUM = [
    {
      id: 'KUKU_5_2', label: '九九 5・2の段', point: '5×2', example: [5, 2], difficulty: 1.0, targetSeconds: 2.8,
      generate: () => kukuProblem([5, 2], [1, 2, 3, 4, 5, 6, 7, 8, 9])
    },
    {
      id: 'KUKU_3_4', label: '九九 3・4の段', point: '3×4', example: [3, 4], difficulty: 1.12, targetSeconds: 3.0,
      generate: () => kukuProblem([3, 4], [1, 2, 3, 4, 5, 6, 7, 8, 9])
    },
    {
      id: 'KUKU_6', label: '九九 6の段', point: '6×7', example: [6, 7], difficulty: 1.24, targetSeconds: 3.1,
      generate: () => kukuProblem([6], [2, 3, 4, 5, 6, 7, 8, 9])
    },
    {
      id: 'KUKU_7_8', label: '九九 7・8の段', point: '7×8', example: [7, 8], difficulty: 1.38, targetSeconds: 3.25,
      generate: () => kukuProblem([7, 8], [2, 3, 4, 5, 6, 7, 8, 9])
    },
    {
      id: 'KUKU_9_1', label: '九九 9・1の段', point: '9×1', example: [9, 1], difficulty: 1.30, targetSeconds: 3.15,
      generate: () => kukuProblem([9, 1], [1, 2, 3, 4, 5, 6, 7, 8, 9])
    },
    {
      id: 'KUKU_MIX', label: '九九 混合', point: '8×9', example: [8, 9], difficulty: 1.52, targetSeconds: 3.3,
      generate: () => kukuProblem([1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 5, 6, 7, 8, 9])
    },
    {
      id: 'M2D1_NC', label: '2けた×1けた 繰り上がりなし', point: '21×3', example: [21, 3], difficulty: 1.9, targetSeconds: 4.8,
      generate: () => generateByCondition('M2D1_NC', () => [randInt(11, 99), randInt(2, 9)], ([a, b]) => countCarriesByDigit(a, b) === 0)
    },
    {
      id: 'M2D1_C_ONES', label: '2けた×1けた 一の位で繰り上がり', point: '27×3', example: [27, 3], difficulty: 2.18, targetSeconds: 5.4,
      generate: () => generateByCondition('M2D1_C_ONES', () => [randInt(11, 99), randInt(2, 9)], ([a, b]) => {
        const ones = a % 10;
        const tens = Math.floor(a / 10);
        const carry = Math.floor((ones * b) / 10);
        return ones !== 0 && ones * b >= 10 && tens * b + carry < 10;
      })
    },
    {
      id: 'M2D1_C_TENS', label: '2けた×1けた 十の位で繰り上がり', point: '43×8', example: [43, 8], difficulty: 2.32, targetSeconds: 5.8,
      generate: () => generateByCondition('M2D1_C_TENS', () => [randInt(11, 99), randInt(2, 9)], ([a, b]) => {
        const ones = a % 10;
        const tens = Math.floor(a / 10);
        return ones * b < 10 && tens * b >= 10;
      })
    },
    {
      id: 'M2D1_C_BOTH', label: '2けた×1けた 複数回の繰り上がり', point: '78×6', example: [78, 6], difficulty: 2.55, targetSeconds: 6.2,
      generate: () => generateByCondition('M2D1_C_BOTH', () => [randInt(11, 99), randInt(2, 9)], ([a, b]) => countCarriesByDigit(a, b) >= 2)
    },
    {
      id: 'M2D1_ZERO_ONES', label: '2けた×1けた 被乗数の一の位が0', point: '40×7', example: [40, 7], difficulty: 2.05, targetSeconds: 5.0,
      generate: () => {
        const a = randInt(1, 9) * 10;
        const b = randInt(2, 9);
        return makeProblem('M2D1_ZERO_ONES', a, b);
      }
    },
    {
      id: 'M3D1_NC', label: '3けた×1けた 繰り上がりなし', point: '213×2', example: [213, 2], difficulty: 2.85, targetSeconds: 7.2,
      generate: () => generateByCondition('M3D1_NC', () => [randInt(111, 999), randInt(2, 9)], ([a, b]) => countCarriesByDigit(a, b) === 0 && !String(a).includes('0'))
    },
    {
      id: 'M3D1_C_BASIC', label: '3けた×1けた 繰り上がりあり', point: '126×4', example: [126, 4], difficulty: 3.18, targetSeconds: 8.0,
      generate: () => generateByCondition('M3D1_C_BASIC', () => [randInt(111, 999), randInt(2, 9)], ([a, b]) => {
        const c = countCarriesByDigit(a, b);
        return c >= 1 && c <= 2 && !String(a).includes('0');
      })
    },
    {
      id: 'M3D1_C_CHAIN', label: '3けた×1けた 連続した繰り上がり', point: '678×7', example: [678, 7], difficulty: 3.55, targetSeconds: 8.8,
      generate: () => generateByCondition('M3D1_C_CHAIN', () => [randInt(111, 999), randInt(2, 9)], ([a, b]) => countCarriesByDigit(a, b) >= 3)
    },
    {
      id: 'M3D1_ZERO_INSIDE', label: '3けた×1けた 被乗数に0を含む', point: '304×6', example: [304, 6], difficulty: 3.08, targetSeconds: 8.2,
      generate: () => generateByCondition('M3D1_ZERO_INSIDE', () => [randInt(101, 909), randInt(2, 9)], ([a]) => String(a).includes('0') && a % 100 !== 0)
    },
    {
      id: 'M2D2_TEN', label: '2けた×2けた 10台をかける', point: '23×12', example: [23, 12], difficulty: 4.05, targetSeconds: 11.5,
      generate: () => makeProblem('M2D2_TEN', randInt(12, 99), randInt(10, 19))
    },
    {
      id: 'M2D2_NO_CARRY', label: '2けた×2けた 繰り上がり少なめ', point: '21×13', example: [21, 13], difficulty: 4.35, targetSeconds: 12.4,
      generate: () => generateByCondition('M2D2_NO_CARRY', () => [randInt(11, 49), randInt(11, 39)], ([a, b]) => a * b < 1600 && countCarriesTwoDigit(a, b) <= 1)
    },
    {
      id: 'M2D2_CARRY', label: '2けた×2けた 繰り上がりあり', point: '48×27', example: [48, 27], difficulty: 4.78, targetSeconds: 13.8,
      generate: () => generateByCondition('M2D2_CARRY', () => [randInt(22, 99), randInt(22, 99)], ([a, b]) => countCarriesTwoDigit(a, b) >= 2)
    },
    {
      id: 'M2D2_ZERO_PRODUCT', label: '2けた×2けた 0を含む計算', point: '40×23', example: [40, 23], difficulty: 4.25, targetSeconds: 12.6,
      generate: () => {
        const useZeroLeft = Math.random() < 0.5;
        const a = useZeroLeft ? randInt(2, 9) * 10 : randInt(12, 99);
        const b = useZeroLeft ? randInt(12, 99) : randInt(2, 9) * 10;
        return makeProblem('M2D2_ZERO_PRODUCT', a, b);
      }
    },
    {
      id: 'M2D2_MIX', label: '2けた×2けた 混合', point: '76×34', example: [76, 34], difficulty: 5.05, targetSeconds: 15.0,
      generate: () => makeProblem('M2D2_MIX', randInt(12, 99), randInt(12, 99))
    }
  ];

  let state = loadState();
  let session = createEmptySession();
  let audioContext = null;
  let isDrawing = false;
  let lastPoint = null;

  function createEmptySession() {
    return {
      phase: 'idle',
      questions: [],
      currentIndex: 0,
      retryQueue: [],
      retryIndex: 0,
      input: '',
      locked: false,
      startedAt: 0,
      questionStartedAt: 0,
      pauseStartedAt: 0,
      ratingApplied: false,
      lastDelta: 0,
      lastOutcome: 'stay'
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredCloneSafe(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return migrateState(parsed);
    } catch (error) {
      console.warn('Failed to load state:', error);
      return structuredCloneSafe(DEFAULT_STATE);
    }
  }

  function migrateState(value) {
    const next = structuredCloneSafe(DEFAULT_STATE);
    next.player = { ...next.player, ...(value.player || {}) };
    next.settings = { ...next.settings, ...(value.settings || {}) };
    next.progress = { ...next.progress, ...(value.progress || {}) };
    next.mastery = value.mastery || {};
    next.recentProblems = Array.isArray(value.recentProblems) ? value.recentProblems.slice(-80) : [];
    next.history = Array.isArray(value.history) ? value.history.slice(-50) : [];
    next.progress.typeIndex = clamp(Math.trunc(next.progress.typeIndex || 0), 0, CURRICULUM.length - 1);
    next.progress.patternIndex = clamp(Math.trunc(next.progress.patternIndex || 0), 0, PATTERNS.length - 1);
    next.progress.patternStayCount = Math.max(0, Math.trunc(next.progress.patternStayCount || 0));
    next.player.rating = clamp(Math.round(next.player.rating || 300), 0, MAX_RATE);
    next.player.highestRating = clamp(Math.round(next.player.highestRating || next.player.rating), 0, MAX_RATE);
    return next;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function structuredCloneSafe(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function choice(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function kukuProblem(leftCandidates, rightCandidates) {
    let a = choice(leftCandidates);
    let b = choice(rightCandidates);
    if (Math.random() < 0.35) [a, b] = [b, a];
    return makeProblem('', a, b);
  }

  function makeProblem(typeId, left, right) {
    const type = typeId ? findType(typeId) : null;
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      typeId,
      typeLabel: type ? type.label : '',
      point: `${left}×${right}`,
      left,
      right,
      answer: left * right,
      firstAnswer: null,
      retryAnswer: null,
      firstTime: null,
      retryTime: null,
      initialCorrect: false,
      retryCorrect: false,
      finalCorrect: false
    };
  }

  function findType(typeId) {
    return CURRICULUM.find((type) => type.id === typeId);
  }

  function generateByCondition(typeId, pairGenerator, predicate) {
    for (let i = 0; i < 400; i++) {
      const pair = pairGenerator();
      if (predicate(pair)) return makeProblem(typeId, pair[0], pair[1]);
    }
    const fallback = findType(typeId)?.example || [2, 2];
    return makeProblem(typeId, fallback[0], fallback[1]);
  }

  function countCarriesByDigit(number, digit) {
    const digits = String(number).split('').reverse().map(Number);
    let carry = 0;
    let count = 0;
    for (const n of digits) {
      const product = n * digit + carry;
      if (product >= 10) count += 1;
      carry = Math.floor(product / 10);
    }
    return count;
  }

  function countCarriesTwoDigit(a, b) {
    const ones = b % 10;
    const tens = Math.floor(b / 10);
    return countCarriesByDigit(a, ones) + countCarriesByDigit(a, tens);
  }

  function createProblemByType(typeId, usedKeys = new Set()) {
    const type = findType(typeId) || CURRICULUM[0];
    for (let i = 0; i < 120; i++) {
      const problem = type.generate();
      problem.typeId = type.id;
      problem.typeLabel = type.label;
      const key = problemKey(problem);
      if (!state.recentProblems.includes(key) && !usedKeys.has(key)) {
        usedKeys.add(key);
        return problem;
      }
    }
    const fallback = type.generate();
    fallback.typeId = type.id;
    fallback.typeLabel = type.label;
    usedKeys.add(problemKey(fallback));
    return fallback;
  }

  function problemKey(problem) {
    return `${problem.left}x${problem.right}`;
  }

  function buildQuestionPlan() {
    const pattern = PATTERNS[state.progress.patternIndex] || PATTERNS[0];
    const current = state.progress.typeIndex;
    const recent = Math.max(0, current - 1);
    const base = Math.max(0, current - 2);
    const challenge = Math.min(CURRICULUM.length - 1, current + 1);
    const ids = [];

    pushRepeated(ids, CURRICULUM[current].id, pattern.center);
    pushRepeated(ids, CURRICULUM[recent].id, pattern.recent);
    pushRepeated(ids, CURRICULUM[base].id, pattern.base);
    pushRepeated(ids, CURRICULUM[challenge].id, pattern.challenge);

    while (ids.length < SET_SIZE) ids.push(CURRICULUM[current].id);
    return shuffle(ids.slice(0, SET_SIZE));
  }

  function pushRepeated(target, value, count) {
    for (let i = 0; i < count; i++) target.push(value);
  }

  function shuffle(items) {
    const next = items.slice();
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  }

  function startSet() {
    const used = new Set();
    const typeIds = buildQuestionPlan();
    session = createEmptySession();
    session.phase = 'playing';
    session.questions = typeIds.map((typeId) => createProblemByType(typeId, used));
    session.currentIndex = 0;
    session.input = '';
    session.startedAt = performance.now();
    session.questionStartedAt = performance.now();
    session.locked = false;
    clearPad();
    showScreen('game');
    renderCurrentQuestion();
  }

  function renderCurrentQuestion() {
    const problem = session.questions[session.currentIndex];
    if (!problem) {
      renderReviewIntro();
      return;
    }
    session.phase = 'playing';
    session.input = '';
    session.locked = false;
    session.questionStartedAt = performance.now();
    els.questionCounter.textContent = `${session.currentIndex + 1} / ${SET_SIZE}`;
    els.gamePoint.textContent = `ポイント：${problem.point}`;
    setMessage('', '');
    setFormula(problem.point, 'problem');
    setAnswerDisplay('');
    els.subInfo.textContent = '答えを入力してください';
    els.inlineActions.innerHTML = '';
    clearPad();
  }

  function submitAnswer() {
    if (session.locked) return;
    if (!['playing', 'retry'].includes(session.phase)) return;
    if (!session.input) {
      setMessage('数字を入力してください', 'warning');
      return;
    }

    if (session.phase === 'playing') {
      submitFirstAnswer();
    } else {
      submitRetryAnswer();
    }
  }

  function submitFirstAnswer() {
    const problem = session.questions[session.currentIndex];
    const elapsed = elapsedSeconds(session.questionStartedAt);
    const numericAnswer = Number(session.input);
    const correct = numericAnswer === problem.answer;
    problem.firstAnswer = numericAnswer;
    problem.firstTime = elapsed;
    problem.initialCorrect = correct;
    problem.finalCorrect = correct;

    session.locked = true;
    beep(correct ? 'ok' : 'ng');
    setMessage(correct ? '正解' : `不正解　正しくは ${problem.answer}`, correct ? 'success' : 'danger');
    els.subInfo.textContent = correct ? `${formatSeconds(elapsed)}秒` : 'あとで答え直しできます';

    window.setTimeout(() => {
      session.currentIndex += 1;
      renderCurrentQuestion();
    }, correct ? 360 : 620);
  }

  function renderReviewIntro() {
    session.phase = 'reviewIntro';
    session.retryQueue = session.questions.filter((q) => !q.initialCorrect);
    session.retryIndex = 0;
    session.input = '';
    session.locked = false;
    const summary = summarizeSession(false);
    els.questionCounter.textContent = '結果';
    els.gamePoint.textContent = `ポイント：${currentType().point}`;
    setMessage('1セット終了', '');
    setFormula(resultHtml([
      ['初回正解', `${summary.firstCorrect} / ${SET_SIZE}`],
      ['平均時間', `${formatSeconds(summary.avgFirstTime)}秒`],
      ['答え直し', session.retryQueue.length ? `${session.retryQueue.length}問` : 'なし']
    ]), 'result');
    setAnswerDisplay('');
    els.subInfo.textContent = session.retryQueue.length ? '答え直しでレート減少を抑えられます' : 'レートを確定できます';
    els.inlineActions.innerHTML = '';

    if (session.retryQueue.length) {
      addInlineButton('答え直しへ', 'primary', () => renderRetryQuestion());
      addInlineButton('答え直しせず確定', 'secondary', () => finalizeResult());
    } else {
      addInlineButton('レート確定', 'primary', () => finalizeResult());
    }
  }

  function renderRetryQuestion() {
    const problem = session.retryQueue[session.retryIndex];
    if (!problem) {
      finalizeResult();
      return;
    }
    session.phase = 'retry';
    session.input = '';
    session.locked = false;
    session.questionStartedAt = performance.now();
    els.questionCounter.textContent = `答え直し ${session.retryIndex + 1} / ${session.retryQueue.length}`;
    els.gamePoint.textContent = `ポイント：${problem.point}`;
    setMessage('もう一度解きます', 'warning');
    setFormula(`
      <div class="review-problem">
        <div class="review-formula">${escapeHtml(problem.point)}</div>
        <div class="review-detail">あなたの答え：${escapeHtml(String(problem.firstAnswer))}</div>
      </div>
    `, 'result');
    setAnswerDisplay('');
    els.subInfo.textContent = '答えを入力してください';
    els.inlineActions.innerHTML = '';
    clearPad();
  }

  function submitRetryAnswer() {
    const problem = session.retryQueue[session.retryIndex];
    if (!problem) return;
    const elapsed = elapsedSeconds(session.questionStartedAt);
    const numericAnswer = Number(session.input);
    const correct = numericAnswer === problem.answer;
    problem.retryAnswer = numericAnswer;
    problem.retryTime = elapsed;
    problem.retryCorrect = correct;
    problem.finalCorrect = correct;
    session.locked = true;
    beep(correct ? 'ok' : 'ng');
    setMessage(correct ? '答え直し成功' : `まだ違います　正しくは ${problem.answer}`, correct ? 'success' : 'danger');
    els.subInfo.textContent = correct ? '減点を一部回復しました' : 'この問題は最終不正解です';

    window.setTimeout(() => {
      session.retryIndex += 1;
      renderRetryQuestion();
    }, correct ? 520 : 780);
  }

  function finalizeResult() {
    if (session.ratingApplied) return renderFinalResult();
    const summary = summarizeSession(true);
    const outcome = judgeProgress(summary);
    const delta = calculateRateDelta(summary, outcome);
    const before = state.player.rating;
    const after = clamp(before + delta, 0, MAX_RATE);
    state.player.rating = after;
    state.player.highestRating = Math.max(state.player.highestRating, after);
    session.lastDelta = after - before;
    session.lastOutcome = outcome;
    session.ratingApplied = true;

    updateMastery(summary);
    updateProgress(outcome);
    rememberRecentProblems(session.questions);
    state.history.push({
      date: new Date().toISOString(),
      before,
      after,
      delta: after - before,
      firstCorrect: summary.firstCorrect,
      finalCorrect: summary.finalCorrect,
      avgFirstTime: summary.avgFirstTime,
      avgFinalTime: summary.avgFinalTime,
      typeId: currentType().id,
      pattern: PATTERNS[state.progress.patternIndex]?.id || 'A',
      outcome
    });
    state.history = state.history.slice(-50);
    state.progress.completedSets += 1;
    saveState();
    renderFinalResult();
  }

  function renderFinalResult() {
    const summary = summarizeSession(true);
    const delta = session.lastDelta;
    const sign = delta > 0 ? '+' : '';
    els.questionCounter.textContent = 'リザルト';
    els.gamePoint.textContent = `次：${currentType().point}`;
    setMessage(resultMessage(session.lastOutcome), delta >= 0 ? 'success' : 'danger');
    setFormula(resultHtml([
      ['初回正解', `${summary.firstCorrect} / ${SET_SIZE}`],
      ['最終正解', `${summary.finalCorrect} / ${SET_SIZE}`],
      ['平均時間', `${formatSeconds(summary.avgFirstTime)}秒`],
      ['レート', `${formatRate(summary.ratingBefore)} → ${formatRate(state.player.rating)}`],
      ['変動', `${sign}${formatRate(Math.abs(delta))}`]
    ]), 'result');
    setAnswerDisplay('');
    els.subInfo.textContent = session.lastOutcome === 'advance' ? '次のパターンへ進みました' : session.lastOutcome === 'regress' ? '前のパターンへ戻りました' : '同じパターンで確認を続けます';
    els.inlineActions.innerHTML = '';
    addInlineButton('もう一度', 'primary', () => startSet());
    addInlineButton('初期画面へ', 'secondary', () => goHome());
    updateTopInfo();
  }

  function summarizeSession(includeRetry) {
    const qs = session.questions;
    const firstCorrect = qs.filter((q) => q.initialCorrect).length;
    const finalCorrect = qs.filter((q) => q.finalCorrect).length;
    const avgFirstTime = average(qs.map((q) => q.firstTime).filter((v) => Number.isFinite(v)));
    const retryTimes = qs.map((q) => q.retryTime).filter((v) => Number.isFinite(v));
    const avgFinalTime = includeRetry && retryTimes.length ? average(qs.map((q) => (q.firstTime || 0) + (q.retryTime || 0))) : avgFirstTime;
    const targetTime = average(qs.map((q) => findType(q.typeId)?.targetSeconds || 5));
    const ratingBefore = state.player.rating;
    return { questions: qs, firstCorrect, finalCorrect, avgFirstTime, avgFinalTime, targetTime, ratingBefore };
  }

  function average(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function judgeProgress(summary) {
    const excellent = summary.firstCorrect === SET_SIZE && summary.avgFirstTime <= summary.targetTime * 1.15;
    const poor = summary.finalCorrect <= 5 || summary.firstCorrect <= 4 || summary.avgFirstTime > summary.targetTime * 2.0;
    if (excellent) return 'advance';
    if (poor) return 'regress';
    return 'stay';
  }

  function calculateRateDelta(summary, outcome) {
    const possible = summary.questions.reduce((sum, q) => {
      const type = findType(q.typeId);
      return sum + 1.25 * (type?.difficulty || 1);
    }, 0);

    const achieved = summary.questions.reduce((sum, q) => {
      const type = findType(q.typeId);
      const resultFactor = q.initialCorrect ? 1 : q.retryCorrect ? 0.45 : 0;
      const time = q.firstTime || type?.targetSeconds || 5;
      const speedFactor = getSpeedFactor(time, type?.targetSeconds || 5);
      return sum + resultFactor * speedFactor * (type?.difficulty || 1);
    }, 0);

    const performanceRatio = possible ? achieved / possible : 0;
    const avgDifficulty = average(summary.questions.map((q) => findType(q.typeId)?.difficulty || 1));
    const expectedRatio = clamp(0.27 + Math.log10(summary.ratingBefore + 100) / 22, 0.30, 0.78);
    const inflation = 260 * Math.pow(avgDifficulty, 1.35) * (1 + Math.log2(avgDifficulty + 1));
    const suppression = 1 / (1 + Math.log10(summary.ratingBefore + 10) / 5);

    let delta = (performanceRatio - expectedRatio) * inflation;
    if (summary.firstCorrect === SET_SIZE && summary.avgFirstTime <= summary.targetTime * 1.15) delta += 0.12 * inflation;
    if (summary.finalCorrect === SET_SIZE && summary.firstCorrect < SET_SIZE) delta += 0.04 * inflation;
    if (summary.finalCorrect <= 6) delta -= 0.08 * inflation;

    delta *= suppression;

    if (outcome === 'stay' && delta > 0) {
      delta *= Math.pow(0.5, state.progress.patternStayCount + 1);
    }

    const cap = Math.max(80, 1200 * Math.pow(avgDifficulty, 1.1));
    delta = clamp(delta, -cap * 0.45, cap);
    return Math.round(delta);
  }

  function getSpeedFactor(seconds, targetSeconds) {
    if (seconds <= targetSeconds * 0.65) return 1.25;
    if (seconds <= targetSeconds) return 1.08;
    if (seconds <= targetSeconds * 1.35) return 0.92;
    if (seconds <= targetSeconds * 1.75) return 0.72;
    return 0.52;
  }

  function updateProgress(outcome) {
    if (outcome === 'advance') {
      advancePattern();
      state.progress.patternStayCount = 0;
      return;
    }

    if (outcome === 'regress') {
      regressPattern();
      state.progress.patternStayCount = 0;
      return;
    }

    state.progress.patternStayCount += 1;
  }

  function advancePattern() {
    const p = state.progress.patternIndex;
    if (p === 2) {
      state.progress.typeIndex = Math.min(CURRICULUM.length - 1, state.progress.typeIndex + 1);
      state.progress.patternIndex = state.progress.typeIndex === CURRICULUM.length - 1 ? 3 : 3;
      return;
    }
    if (p === 5) {
      state.progress.patternIndex = 0;
      return;
    }
    state.progress.patternIndex = Math.min(PATTERNS.length - 1, p + 1);
  }

  function regressPattern() {
    state.progress.patternIndex = Math.max(0, state.progress.patternIndex - 1);
  }

  function updateMastery(summary) {
    for (const q of summary.questions) {
      if (!state.mastery[q.typeId]) {
        state.mastery[q.typeId] = { attempts: 0, firstCorrect: 0, finalCorrect: 0, avgTime: null, mastery: 0 };
      }
      const m = state.mastery[q.typeId];
      m.attempts += 1;
      if (q.initialCorrect) m.firstCorrect += 1;
      if (q.finalCorrect) m.finalCorrect += 1;
      m.avgTime = m.avgTime == null ? q.firstTime : m.avgTime * 0.85 + q.firstTime * 0.15;
      const firstRate = m.firstCorrect / Math.max(1, m.attempts);
      const finalRate = m.finalCorrect / Math.max(1, m.attempts);
      const type = findType(q.typeId);
      const speed = type ? clamp(type.targetSeconds / Math.max(type.targetSeconds, m.avgTime || type.targetSeconds), 0.35, 1) : 0.5;
      m.mastery = clamp(firstRate * 0.62 + finalRate * 0.25 + speed * 0.13, 0, 1);
    }
  }

  function rememberRecentProblems(questions) {
    const keys = questions.map(problemKey);
    state.recentProblems = state.recentProblems.concat(keys).slice(-80);
  }

  function currentType() {
    return CURRICULUM[state.progress.typeIndex] || CURRICULUM[0];
  }

  function resultMessage(outcome) {
    if (outcome === 'advance') return '安定して解けています';
    if (outcome === 'regress') return '復習を強めます';
    return 'もう少し確認します';
  }

  function resultHtml(rows) {
    return `<div class="result-table">${rows.map(([label, value]) => `
      <div class="result-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
    `).join('')}</div>`;
  }

  function setMessage(text, type) {
    els.messageArea.textContent = text;
    els.messageArea.className = `message-area${type ? ` ${type}` : ''}`;
  }

  function setFormula(content, mode) {
    els.formula.className = `formula formula-${state.settings.formulaFont}${mode === 'result' ? ' result-content' : ''}`;
    if (mode === 'result') {
      els.formula.innerHTML = content;
    } else {
      els.formula.textContent = content;
    }
  }

  function setAnswerDisplay(value) {
    els.answerDisplay.textContent = value || '\u00a0';
  }

  function addInlineButton(text, kind, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = kind === 'primary' ? 'primary-button' : 'secondary-button';
    button.textContent = text;
    button.addEventListener('click', handler);
    els.inlineActions.appendChild(button);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function handleInput(action) {
    if (!['playing', 'retry'].includes(session.phase)) return;
    if (session.locked) return;

    if (/^\d$/.test(action)) {
      if (session.input.length >= 8) return;
      session.input += action;
      setAnswerDisplay(session.input);
      setMessage('', '');
      return;
    }

    if (action === 'clear') {
      session.input = '';
      setAnswerDisplay('');
      return;
    }

    if (action === 'backspace') {
      session.input = session.input.slice(0, -1);
      setAnswerDisplay(session.input);
      return;
    }

    if (action === 'submit') submitAnswer();
  }

  function renderKeypad() {
    const layout = state.settings.keypadLayout;
    els.keypad.className = `keypad ${layout}`;
    els.keypad.innerHTML = '';

    const keys = getKeypadKeys(layout);
    for (const key of keys) {
      if (key.blank) {
        const spacer = document.createElement('div');
        spacer.className = `key-spacer ${key.className || ''}`;
        els.keypad.appendChild(spacer);
        continue;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `key ${key.kind || ''} ${key.className || ''}`.trim();
      button.textContent = key.label;
      button.setAttribute('aria-label', key.aria || key.label);
      button.addEventListener('click', () => handleInput(key.action));
      els.keypad.appendChild(button);
    }

    if (layout === 'normal') {
      els.keyHint.textContent = '数字キー：入力　Enter：決定　Backspace：消す';
    } else if (layout === 'topLeft') {
      els.keyHint.textContent = '1 2 3 / Q W E / A S D F　Space：決定';
    } else {
      els.keyHint.textContent = '7 8 9 0 / U I O / J K L +　;：決定';
    }
  }

  function getKeypadKeys(layout) {
    if (layout === 'topLeft') {
      return [
        digitKey('1'), digitKey('2'), digitKey('3'), controlKey('消', 'backspace'),
        digitKey('4'), digitKey('5'), digitKey('6'), controlKey('C', 'clear'),
        digitKey('7'), digitKey('8'), digitKey('9'), digitKey('0'),
        okKey('OK', 'wide-4')
      ];
    }
    if (layout === 'pseudo') {
      return [
        digitKey('7'), digitKey('8'), digitKey('9'), digitKey('0'),
        digitKey('4'), digitKey('5'), digitKey('6'), controlKey('C', 'clear'),
        digitKey('1'), digitKey('2'), digitKey('3'), okKey('OK')
      ];
    }
    return [
      digitKey('7'), digitKey('8'), digitKey('9'),
      digitKey('4'), digitKey('5'), digitKey('6'),
      digitKey('1'), digitKey('2'), digitKey('3'),
      controlKey('C', 'clear'), digitKey('0'), okKey('OK')
    ];
  }

  function digitKey(n) {
    return { label: n, action: n, aria: `${n}を入力` };
  }

  function controlKey(label, action) {
    return { label, action, kind: 'control' };
  }

  function okKey(label, className = '') {
    return { label, action: 'submit', kind: 'ok', className };
  }

  function handleKeyboard(event) {
    if (event.isComposing) return;
    const key = event.key;
    const layout = state.settings.keypadLayout;
    const mapped = mapPhysicalKey(key, layout);
    if (!mapped) return;
    event.preventDefault();
    handleInput(mapped);
  }

  function mapPhysicalKey(key, layout) {
    if (/^\d$/.test(key)) return key;
    if (key === 'Enter') return 'submit';
    if (key === 'Backspace') return 'backspace';
    if (key === 'Delete' || key === 'Escape') return 'clear';

    if (layout === 'topLeft') {
      const map = { q: '4', w: '5', e: '6', a: '7', s: '8', d: '9', f: '0', ' ': 'submit' };
      return map[key.toLowerCase()] || null;
    }

    if (layout === 'pseudo') {
      const map = { u: '4', i: '5', o: '6', j: '1', k: '2', l: '3', '+': 'clear', ';': 'submit', ':': 'submit' };
      return map[key.toLowerCase()] || null;
    }

    return null;
  }

  function showScreen(name) {
    for (const screen of [els.homeScreen, els.gameScreen, els.pauseScreen, els.settingsScreen]) {
      screen.classList.remove('active');
    }
    const active = {
      home: els.homeScreen,
      game: els.gameScreen,
      pause: els.pauseScreen,
      settings: els.settingsScreen
    }[name];
    active?.classList.add('active');

    const showInput = name === 'game';
    els.inputZone.style.display = showInput ? 'grid' : 'none';
    els.pauseButton.classList.toggle('hidden', !(name === 'game' && session.phase === 'playing'));
    els.homeButton.classList.toggle('hidden', name === 'home');
    updateTopInfo();
  }

  function updateTopInfo() {
    const rate = formatRate(state.player.rating);
    els.statusText.textContent = `レート：${rate}`;
    els.homeRate.textContent = rate;
    els.homePoint.textContent = currentType().point;
    els.homeDetail.textContent = `${currentType().label}を中心に出題`;
    els.formula.className = `formula formula-${state.settings.formulaFont}`;
  }

  function openSettings() {
    setRadioValue('keypadLayout', state.settings.keypadLayout);
    setRadioValue('inputSide', state.settings.inputSide);
    setRadioValue('handwritingPad', state.settings.handwritingPad ? 'on' : 'off');
    setRadioValue('formulaFont', state.settings.formulaFont);
    setRadioValue('sound', state.settings.sound ? 'on' : 'off');
    showScreen('settings');
  }

  function saveSettingsFromForm() {
    state.settings.keypadLayout = getRadioValue('keypadLayout') || 'normal';
    state.settings.inputSide = getRadioValue('inputSide') || 'right';
    state.settings.handwritingPad = getRadioValue('handwritingPad') !== 'off';
    state.settings.formulaFont = getRadioValue('formulaFont') || 'readable';
    state.settings.sound = getRadioValue('sound') === 'on';
    saveState();
    applySettings();
    goHome();
  }

  function setRadioValue(name, value) {
    const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
  }

  function getRadioValue(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value;
  }

  function applySettings() {
    els.padPanel.classList.toggle('off', !state.settings.handwritingPad);
    els.inputZone.classList.toggle('left', state.settings.inputSide === 'left');
    renderKeypad();
    updateTopInfo();
  }

  function resetData() {
    const ok = window.confirm('レートと学習データをリセットします。よろしいですか。');
    if (!ok) return;
    const settings = structuredCloneSafe(state.settings);
    state = structuredCloneSafe(DEFAULT_STATE);
    state.settings = settings;
    saveState();
    applySettings();
    goHome();
  }

  function goHome() {
    session = createEmptySession();
    clearPad();
    showScreen('home');
  }

  function pauseGame() {
    if (session.phase !== 'playing') return;
    session.pauseStartedAt = performance.now();
    showScreen('pause');
  }

  function resumeGame() {
    if (session.phase !== 'playing') return;
    const pausedMs = performance.now() - session.pauseStartedAt;
    session.questionStartedAt += pausedMs;
    showScreen('game');
  }

  function elapsedSeconds(start) {
    return Math.max(0, (performance.now() - start) / 1000);
  }

  function formatSeconds(seconds) {
    if (!Number.isFinite(seconds)) return '0.0';
    return seconds.toFixed(1);
  }

  function formatRate(value) {
    const digits = String(Math.max(0, Math.round(value)));
    const parts = [];
    for (let end = digits.length; end > 0; end -= 4) {
      const start = Math.max(0, end - 4);
      parts.unshift(digits.slice(start, end));
    }
    return parts.join('\u2009');
  }

  function beep(type) {
    if (!state.settings.sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = type === 'ok' ? 880 : 180;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.06, audioContext.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.09);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.warn('Sound failed:', error);
    }
  }

  function setupCanvas() {
    const canvas = els.scratchPad;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#18202b';

    const getPoint = (event) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
      };
    };

    canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      isDrawing = true;
      lastPoint = getPoint(event);
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!isDrawing || !lastPoint) return;
      event.preventDefault();
      const next = getPoint(event);
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      lastPoint = next;
    });

    const end = (event) => {
      if (event.pointerId && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      isDrawing = false;
      lastPoint = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  function clearPad() {
    const canvas = els.scratchPad;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function attachEvents() {
    els.startButton.addEventListener('click', startSet);
    els.settingsButton.addEventListener('click', openSettings);
    els.homeButton.addEventListener('click', goHome);
    els.pauseButton.addEventListener('click', pauseGame);
    els.resumeButton.addEventListener('click', resumeGame);
    els.pauseHomeButton.addEventListener('click', goHome);
    els.saveSettingsButton.addEventListener('click', saveSettingsFromForm);
    els.resetDataButton.addEventListener('click', resetData);
    els.clearPadButton.addEventListener('click', clearPad);
    window.addEventListener('keydown', handleKeyboard);
  }

  function init() {
    attachEvents();
    setupCanvas();
    applySettings();
    showScreen('home');
  }

  init();

  window.MulRateDebug = {
    getState: () => structuredCloneSafe(state),
    reset: () => {
      localStorage.removeItem(STORAGE_KEY);
      state = loadState();
      applySettings();
      goHome();
    },
    curriculum: CURRICULUM.map(({ id, label, point, difficulty, targetSeconds }) => ({ id, label, point, difficulty, targetSeconds })),
    patterns: PATTERNS
  };
})();
