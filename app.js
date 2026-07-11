(() => {
  'use strict';

  const STORAGE_KEY = 'mulrate_v1_0_0_beta2_state';
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
      handwritingMode: 'layout',
      operationOrder: 'padFirst',
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
    learnedTypes: [],
    recentProblems: [],
    history: []
  };

  const els = {
    app: document.getElementById('app'),
    navWindow: document.getElementById('navWindow'),
    effectLayer: document.getElementById('effectLayer'),
    homeButton: document.getElementById('homeButton'),
    pauseButton: document.getElementById('pauseButton'),
    statusText: document.getElementById('statusText'),
    homeScreen: document.getElementById('homeScreen'),
    gameScreen: document.getElementById('gameScreen'),
    pauseScreen: document.getElementById('pauseScreen'),
    settingsScreen: document.getElementById('settingsScreen'),
    learnedScreen: document.getElementById('learnedScreen'),
    homeRate: document.getElementById('homeRate'),
    homePoint: document.getElementById('homePoint'),
    homeDetail: document.getElementById('homeDetail'),
    learnedSummary: document.getElementById('learnedSummary'),
    startButton: document.getElementById('startButton'),
    learnedButton: document.getElementById('learnedButton'),
    learnedList: document.getElementById('learnedList'),
    learnedBackButton: document.getElementById('learnedBackButton'),
    settingsButton: document.getElementById('settingsButton'),
    questionCounter: document.getElementById('questionCounter'),
    gamePoint: document.getElementById('gamePoint'),
    messageArea: document.getElementById('messageArea'),
    formula: document.getElementById('formula'),
    answerLine: document.getElementById('answerLine'),
    answerDisplay: document.getElementById('answerDisplay'),
    subInfo: document.getElementById('subInfo'),
    inlineActions: document.getElementById('inlineActions'),
    resumeButton: document.getElementById('resumeButton'),
    pauseHomeButton: document.getElementById('pauseHomeButton'),
    saveSettingsButton: document.getElementById('saveSettingsButton'),
    resetDataButton: document.getElementById('resetDataButton'),
    inputZone: document.getElementById('inputZone'),
    operationStatus: document.getElementById('operationStatus'),
    togglePadButton: document.getElementById('togglePadButton'),
    padPanel: document.getElementById('padPanel'),
    clearPadButton: document.getElementById('clearPadButton'),
    closePadButton: document.getElementById('closePadButton'),
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
      practiceMode: false,
      practiceTypeId: null,
      padCollapsed: true,
      lastDelta: 0,
      lastOutcome: 'stay',
      result: null
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
    next.learnedTypes = Array.isArray(value.learnedTypes) ? value.learnedTypes.filter((id) => CURRICULUM.some((t) => t.id === id)) : [];
    next.recentProblems = Array.isArray(value.recentProblems) ? value.recentProblems.slice(-80) : [];
    next.history = Array.isArray(value.history) ? value.history.slice(-50) : [];
    next.progress.typeIndex = clamp(Math.trunc(next.progress.typeIndex || 0), 0, CURRICULUM.length - 1);
    next.progress.patternIndex = clamp(Math.trunc(next.progress.patternIndex || 0), 0, PATTERNS.length - 1);
    next.progress.patternStayCount = Math.max(0, Math.trunc(next.progress.patternStayCount || 0));
    next.player.rating = clamp(Math.round(next.player.rating || 300), 0, MAX_RATE);
    next.player.highestRating = clamp(Math.round(next.player.highestRating || next.player.rating), 0, MAX_RATE);
    next.learnedTypes = repairLearnedTypes(next);
    return next;
  }

  function repairLearnedTypes(value) {
    const learned = new Set(Array.isArray(value.learnedTypes) ? value.learnedTypes : []);

    // 既存データの救済：すでに次の類型へ進んでいる場合、通過済みの類型は学習済みとして扱う。
    const completedBeforeCurrent = clamp(Math.trunc(value.progress?.typeIndex || 0) - 1, -1, CURRICULUM.length - 1);
    for (let i = 0; i <= completedBeforeCurrent; i++) {
      learned.add(CURRICULUM[i].id);
    }

    // 履歴からも復元する。beta.4以前で解放条件が厳しすぎた場合の補正。
    for (const item of Array.isArray(value.history) ? value.history : []) {
      const type = findType(item.typeId);
      if (!type) continue;
      const firstCorrect = Number(item.firstCorrect || 0);
      const finalCorrect = Number(item.finalCorrect || 0);
      const avgFirstTime = Number(item.avgFirstTime || Infinity);
      const pattern = item.pattern || '';
      const outcome = item.outcome || '';
      const basicCleared = pattern === 'A' && firstCorrect === SET_SIZE && avgFirstTime <= type.targetSeconds * 1.25;
      const typeCleared = pattern === 'C' && ['advance', 'skip'].includes(outcome) && finalCorrect >= 9 && firstCorrect >= 8;
      if (basicCleared || typeCleared) learned.add(type.id);
    }

    return Array.from(learned).filter((id) => CURRICULUM.some((type) => type.id === id));
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
    for (const allowRecent of [false, true]) {
      for (let i = 0; i < 160; i++) {
        const problem = type.generate();
        problem.typeId = type.id;
        problem.typeLabel = type.label;
        const key = problemKey(problem);
        if (usedKeys.has(key)) continue;
        if (!allowRecent && state.recentProblems.includes(key)) continue;
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
    const a = Number(problem.left);
    const b = Number(problem.right);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const low = Math.min(a, b);
      const high = Math.max(a, b);
      return `${low}x${high}`;
    }
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

  function startSet(options = {}) {
    const used = new Set();
    const practiceTypeId = options.practiceTypeId || null;
    const typeIds = practiceTypeId ? Array(SET_SIZE).fill(practiceTypeId) : buildQuestionPlan();
    session = createEmptySession();
    session.phase = 'playing';
    session.practiceMode = Boolean(practiceTypeId);
    session.practiceTypeId = practiceTypeId;
    session.padCollapsed = state.settings.handwritingMode === 'overlay';
    session.questions = typeIds.map((typeId) => createProblemByType(typeId, used));
    session.currentIndex = 0;
    session.input = '';
    session.startedAt = performance.now();
    session.questionStartedAt = performance.now();
    session.locked = false;
    applyPadVisibility();
    clearPad();
    showScreen('game');
    renderCurrentQuestion();
  }

  function renderCurrentQuestion() {
    const problem = session.questions[session.currentIndex];
    if (!problem) {
      completeSet();
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
    setAnswerVisible(true);
    setAnswerDisplay('');
    els.subInfo.textContent = '答えを入力してください';
    els.inlineActions.innerHTML = '';
    clearPad();
    updateOperationState();
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

    problem.firstImpact = estimateQuestionImpact(problem, correct, elapsed, false);
    problem.lostPotential = Math.max(0, estimateQuestionPotential(problem) - Math.max(0, problem.firstImpact));

    session.locked = true;
    updateOperationState();
    beep(correct ? 'ok' : 'ng');
    triggerAnswerEffect(correct);
    setMessage(correct ? `正　${formatSeconds(elapsed)}秒　+${formatRate(Math.max(0, problem.firstImpact))}` : `誤　${formatSeconds(elapsed)}秒　ロス ${formatRate(problem.lostPotential)}`, correct ? 'success' : 'danger');
    els.subInfo.textContent = correct ? '次へ進みます' : 'あとで答え直しできます';

    window.setTimeout(() => {
      session.currentIndex += 1;
      renderCurrentQuestion();
    }, correct ? 430 : 650);
  }

  function completeSet() {
    session.retryQueue = session.questions.filter((q) => !q.initialCorrect);
    session.retryIndex = 0;
    session.input = '';
    session.locked = false;

    if (session.retryQueue.length === 0) {
      finalizeResult();
      return;
    }

    renderReviewIntro();
  }

  function renderReviewIntro() {
    session.phase = 'reviewIntro';
    session.retryQueue = session.questions.filter((q) => !q.initialCorrect);
    session.retryIndex = 0;
    session.input = '';
    session.locked = false;
    updateOperationState();
    const summary = summarizeSession(false);
    const provisional = previewRateResult(summary);
    els.questionCounter.textContent = '結果';
    els.gamePoint.textContent = session.practiceMode ? '学習済み反復' : `ポイント：${currentType().point}`;
    setMessage('1セット終了', '');
    setAnswerVisible(false);
    setFormula(resultHtml([
      ['初回正解', `${summary.firstCorrect} / ${SET_SIZE}`],
      ['平均時間', `${formatSeconds(summary.avgFirstTime)}秒`],
      ['変動見込み', `${provisional.delta >= 0 ? '+' : ''}${formatRate(provisional.delta)}`],
      ['ロス', formatRate(provisional.loss)]
    ], { loss: true }), 'result');
    setAnswerDisplay('');
    els.subInfo.textContent = session.retryQueue.length ? '答え直しでロスを減らせます' : 'レートを確定できます';
    els.inlineActions.innerHTML = '';

    if (session.retryQueue.length) {
      addInlineButton('答え直しへ', 'primary', () => renderRetryQuestion());
      addInlineButton('答え直しせず確定', 'secondary', () => finalizeResult());
    } else {
      els.subInfo.textContent = 'リザルトへ進みます';
      window.setTimeout(() => {
        if (session.phase === 'reviewIntro' && !session.ratingApplied) finalizeResult();
      }, 520);
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
    setAnswerVisible(true);
    setAnswerDisplay('');
    els.subInfo.textContent = '答えを入力してください';
    els.inlineActions.innerHTML = '';
    clearPad();
    updateOperationState();
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
    problem.retryImpact = estimateQuestionImpact(problem, correct, elapsed, true);
    if (correct) problem.lostPotential = Math.max(0, problem.lostPotential - Math.max(0, problem.retryImpact));
    session.locked = true;
    updateOperationState();
    beep(correct ? 'ok' : 'ng');
    triggerAnswerEffect(correct);
    setMessage(correct ? `答え直し成功　+${formatRate(Math.max(0, problem.retryImpact))}` : `まだ違います　ロス ${formatRate(problem.lostPotential)}`, correct ? 'success' : 'danger');
    els.subInfo.textContent = correct ? '減点を一部回復しました' : `正しくは ${problem.answer}`;

    window.setTimeout(() => {
      session.retryIndex += 1;
      renderRetryQuestion();
    }, correct ? 560 : 840);
  }

  function finalizeResult() {
    if (!session.ratingApplied) applyResultWithoutRendering();
    renderFinalResult();
  }

  function applyResultWithoutRendering() {
    if (session.ratingApplied) return;
    const summary = summarizeSession(true);
    const outcome = session.practiceMode ? 'practice' : judgeProgress(summary);
    const before = state.player.rating;
    const rateResult = calculateRateResult(summary, outcome, { practiceMode: session.practiceMode });
    const after = clamp(before + rateResult.delta, 0, MAX_RATE);
    state.player.rating = after;
    state.player.highestRating = Math.max(state.player.highestRating, after);
    session.lastDelta = after - before;
    session.lastOutcome = outcome;
    session.result = {
      ratingBefore: before,
      ratingAfter: after,
      delta: after - before,
      loss: rateResult.loss,
      idealDelta: rateResult.idealDelta,
      patternBefore: PATTERNS[state.progress.patternIndex]?.id || 'A',
      typeBefore: currentType().id
    };
    session.ratingApplied = true;

    updateMastery(summary);
    if (!session.practiceMode) {
      updateLearnedTypes(summary, outcome);
      updateProgress(outcome);
    }
    rememberRecentProblems(session.questions);
    state.history.push({
      date: new Date().toISOString(),
      before,
      after,
      delta: after - before,
      loss: rateResult.loss,
      firstCorrect: summary.firstCorrect,
      finalCorrect: summary.finalCorrect,
      avgFirstTime: summary.avgFirstTime,
      avgFinalTime: summary.avgFinalTime,
      typeId: session.result.typeBefore,
      pattern: session.result.patternBefore,
      outcome,
      practiceMode: session.practiceMode
    });
    state.history = state.history.slice(-50);
    state.progress.completedSets += 1;
    saveState();
  }

  function renderFinalResult() {
    const summary = summarizeSession(true);
    const result = session.result || { ratingBefore: state.player.rating, ratingAfter: state.player.rating, delta: 0, loss: 0 };
    const delta = result.delta;
    const sign = delta > 0 ? '+' : '';
    els.questionCounter.textContent = 'リザルト';
    els.gamePoint.textContent = session.practiceMode ? '学習済み反復' : `次：${currentType().point}`;
    setMessage(resultMessage(session.lastOutcome), delta >= 0 ? 'success' : 'danger');
    setAnswerVisible(false);
    setFormula(finalResultHtml(summary, result), 'result');
    setAnswerDisplay('');
    els.subInfo.textContent = resultSubInfo(session.lastOutcome);
    els.inlineActions.innerHTML = '';
    addInlineButton('もう一度', 'primary', () => startSet(session.practiceMode ? { practiceTypeId: session.practiceTypeId } : {}));
    addInlineButton('初期画面へ', 'secondary', () => goHome());
    updateTopInfo();
    animateResultNumbers(result);
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
    const excellent = isExcellent(summary);
    const strong = summary.firstCorrect === SET_SIZE && summary.avgFirstTime <= summary.targetTime * 1.15;
    const good = summary.finalCorrect >= 9 && summary.firstCorrect >= 8 && summary.avgFirstTime <= summary.targetTime * 1.45;
    const poor = summary.finalCorrect <= 5 || summary.firstCorrect <= 4 || summary.avgFirstTime > summary.targetTime * 2.0;
    if (excellent) return 'skip';
    if (strong || good) return 'advance';
    if (poor) return 'regress';
    return 'stay';
  }

  function isExcellent(summary) {
    return summary.firstCorrect === SET_SIZE && summary.avgFirstTime <= summary.targetTime;
  }

  function previewRateResult(summary) {
    const outcome = session.practiceMode ? 'practice' : judgeProgress(summary);
    return calculateRateResult(summary, outcome, { practiceMode: session.practiceMode });
  }

  function calculateRateResult(summary, outcome, options = {}) {
    const delta = calculateRateDelta(summary, outcome, options);
    const idealDelta = Math.max(delta, calculateIdealRateDelta(summary, outcome, options));
    const loss = Math.max(0, idealDelta - delta);
    return { delta, idealDelta, loss };
  }

  function calculateRateDelta(summary, outcome, options = {}) {
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

    let delta = deltaFromPerformance(summary, achieved, possible, outcome);

    if (outcome === 'skip') delta *= 1.28;
    if (options.practiceMode && delta > 0) delta *= 0.3;

    if (outcome === 'stay' && delta > 0) {
      delta *= Math.pow(0.5, state.progress.patternStayCount + 1);
    }

    const avgDifficulty = average(summary.questions.map((q) => findType(q.typeId)?.difficulty || 1));
    const cap = Math.max(80, 1200 * Math.pow(avgDifficulty, 1.1));
    delta = clamp(delta, -cap * 0.45, cap * (outcome === 'skip' ? 1.35 : 1));
    return Math.round(delta);
  }

  function calculateIdealRateDelta(summary, outcome, options = {}) {
    const possible = summary.questions.reduce((sum, q) => {
      const type = findType(q.typeId);
      return sum + 1.25 * (type?.difficulty || 1);
    }, 0);
    let delta = deltaFromPerformance(summary, possible, possible, 'skip');
    if (options.practiceMode && delta > 0) delta *= 0.3;
    const avgDifficulty = average(summary.questions.map((q) => findType(q.typeId)?.difficulty || 1));
    const cap = Math.max(80, 1200 * Math.pow(avgDifficulty, 1.1));
    return Math.round(clamp(delta, -cap * 0.45, cap * 1.35));
  }

  function deltaFromPerformance(summary, achieved, possible, outcome) {
    const performanceRatio = possible ? achieved / possible : 0;
    const avgDifficulty = average(summary.questions.map((q) => findType(q.typeId)?.difficulty || 1));
    const expectedRatio = clamp(0.27 + Math.log10(summary.ratingBefore + 100) / 22, 0.30, 0.78);
    const inflation = 260 * Math.pow(avgDifficulty, 1.35) * (1 + Math.log2(avgDifficulty + 1));
    const suppression = 1 / (1 + Math.log10(summary.ratingBefore + 10) / 5);

    let delta = (performanceRatio - expectedRatio) * inflation;
    if (summary.firstCorrect === SET_SIZE && summary.avgFirstTime <= summary.targetTime * 1.15) delta += 0.12 * inflation;
    if (summary.finalCorrect === SET_SIZE && summary.firstCorrect < SET_SIZE) delta += 0.04 * inflation;
    if (summary.finalCorrect <= 6) delta -= 0.08 * inflation;
    if (outcome === 'skip') delta += 0.1 * inflation;
    return delta * suppression;
  }

  function estimateQuestionPotential(problem) {
    const type = findType(problem.typeId);
    return Math.round(42 * Math.pow(type?.difficulty || 1, 1.32) * 1.25);
  }

  function estimateQuestionImpact(problem, correct, seconds, retry) {
    const type = findType(problem.typeId);
    const resultFactor = correct ? (retry ? 0.45 : 1) : 0;
    const speedFactor = getSpeedFactor(seconds, type?.targetSeconds || 5);
    return Math.round(42 * resultFactor * speedFactor * Math.pow(type?.difficulty || 1, 1.32));
  }

  function getSpeedFactor(seconds, targetSeconds) {
    if (seconds <= targetSeconds * 0.65) return 1.25;
    if (seconds <= targetSeconds) return 1.08;
    if (seconds <= targetSeconds * 1.35) return 0.92;
    if (seconds <= targetSeconds * 1.75) return 0.72;
    return 0.52;
  }

  function updateProgress(outcome) {
    if (outcome === 'skip') {
      skipPattern();
      state.progress.patternStayCount = 0;
      return;
    }

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
      state.progress.patternIndex = 3;
      return;
    }
    if (p === 5) {
      state.progress.patternIndex = 0;
      return;
    }
    state.progress.patternIndex = Math.min(PATTERNS.length - 1, p + 1);
  }

  function skipPattern() {
    const p = state.progress.patternIndex;
    if (p === 0) {
      state.progress.patternIndex = 2;
      return;
    }
    if (p === 1) {
      state.progress.patternIndex = 2;
      return;
    }
    if (p === 2) {
      state.progress.typeIndex = Math.min(CURRICULUM.length - 1, state.progress.typeIndex + 1);
      state.progress.patternIndex = 3;
      return;
    }
    if (p === 3) {
      state.progress.patternIndex = 5;
      return;
    }
    if (p === 4 || p === 5) {
      state.progress.patternIndex = 0;
      return;
    }
    advancePattern();
  }

  function regressPattern() {
    const p = state.progress.patternIndex;
    if (p === 3 && state.progress.typeIndex > 0) {
      state.progress.typeIndex -= 1;
      state.progress.patternIndex = 2;
      return;
    }
    state.progress.patternIndex = Math.max(0, p - 1);
  }

  function updateLearnedTypes(summary, outcome) {
    const typeId = session.result?.typeBefore || currentType().id;
    const pattern = session.result?.patternBefore || PATTERNS[state.progress.patternIndex]?.id || 'A';
    if (shouldUnlockLearnedType(summary, outcome, typeId, pattern) && !state.learnedTypes.includes(typeId)) {
      state.learnedTypes.push(typeId);
    }
  }

  function shouldUnlockLearnedType(summary, outcome, typeId, pattern) {
    const type = findType(typeId);
    if (!type) return false;
    const typeQuestions = summary.questions.filter((q) => q.typeId === typeId);
    const questions = typeQuestions.length ? typeQuestions : summary.questions;
    const allInitialCorrect = questions.every((q) => q.initialCorrect);
    const allFinalCorrect = questions.every((q) => q.finalCorrect);
    const avgTypeTime = average(questions.map((q) => q.firstTime).filter((v) => Number.isFinite(v))) || summary.avgFirstTime;

    // 基本確認で安定していれば、その時点で反復を解放する。
    if (pattern === 'A') {
      return allInitialCorrect && avgTypeTime <= type.targetSeconds * 1.20;
    }

    // 次の類型へ進めるだけの成績なら、直前の中心類型も反復対象にする。
    if (pattern === 'C' && ['advance', 'skip'].includes(outcome)) {
      return allFinalCorrect && summary.finalCorrect >= 9 && summary.firstCorrect >= 8;
    }

    return false;
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
    if (outcome === 'skip') return '十分に定着しています';
    if (outcome === 'advance') return '安定して解けています';
    if (outcome === 'regress') return '復習を強めます';
    if (outcome === 'practice') return '学習済みを確認しました';
    return 'もう少し確認します';
  }

  function resultSubInfo(outcome) {
    if (outcome === 'skip') return '解き方が安定しているため、次の確認へ進みます';
    if (outcome === 'advance') return '次の確認へ進みました';
    if (outcome === 'regress') return '少し前の内容も混ぜて確認します';
    if (outcome === 'practice') return '学習済み反復のため、レート加算は割引されています';
    return '同じ内容をもう一度確認します';
  }

  function resultHtml(rows, options = {}) {
    return `<div class="result-table">${rows.map(([label, value]) => {
      const lossClass = label === 'ロス' ? ' loss-row' : '';
      return `<div class="result-row${lossClass}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
    }).join('')}</div>`;
  }

  function finalResultHtml(summary, result) {
    const delta = result.delta || 0;
    const sign = delta > 0 ? '+' : '';
    return `<div class="result-table">
      <div class="result-row"><span>初回正解</span><strong>${summary.firstCorrect} / ${SET_SIZE}</strong></div>
      <div class="result-row"><span>最終正解</span><strong>${summary.finalCorrect} / ${SET_SIZE}</strong></div>
      <div class="result-row"><span>平均時間</span><strong>${formatSeconds(summary.avgFirstTime)}秒</strong></div>
      <div class="result-row emphasis"><span>変動</span><strong id="deltaCounter" data-final="${delta}">${sign}${formatRate(delta)}</strong></div>
      <div class="result-row emphasis fade-in"><span>レート</span><strong>${formatRate(result.ratingBefore)} → ${formatRate(result.ratingAfter)}</strong></div>
      <div class="result-row loss-row"><span>ロス</span><strong>${formatRate(result.loss || 0)}</strong></div>
    </div>`;
  }

  function animateResultNumbers(result) {
    const el = document.getElementById('deltaCounter');
    if (!el) return;
    const final = result.delta || 0;
    const sign = final > 0 ? '+' : final < 0 ? '-' : '';
    const absFinal = Math.abs(final);
    const started = performance.now();
    const duration = 620;
    const tick = (now) => {
      const t = clamp((now - started) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(absFinal * eased);
      el.textContent = `${sign}${formatRate(value)}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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

  function setAnswerVisible(visible) {
    els.answerLine.classList.toggle('hidden', !visible);
    if (!visible) {
      session.input = '';
      els.answerDisplay.textContent = '\u00a0';
    }
  }

  function setAnswerDisplay(value) {
    els.answerDisplay.textContent = value || '\u00a0';
    if (['playing', 'retry'].includes(session.phase) && !session.locked) {
      els.answerDisplay.classList.remove('pulse');
      void els.answerDisplay.offsetWidth;
      els.answerDisplay.classList.add('pulse');
      window.setTimeout(() => els.answerDisplay.classList.remove('pulse'), 150);
    }
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
      setMessage('', '');
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
      button.dataset.action = key.action;
      if (/^\d$/.test(key.action)) button.dataset.digit = key.action;
      if (key.keyName) button.dataset.keyName = key.keyName;
      if (key.row) button.style.gridRow = String(key.row);
      if (key.col) button.style.gridColumn = `${key.col} / span ${key.span || 2}`;
      button.setAttribute('aria-label', key.aria || key.label);
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        flashKey(key.action);
        handleInput(key.action);
      });
      els.keypad.appendChild(button);
    }

    if (layout === 'normal') {
      els.keyHint.textContent = 'デフォルト　数字キー：入力　Enter / Space：決定　Backspace：1文字削除';
    } else if (layout === 'topLeft') {
      els.keyHint.textContent = '疑似テンキー左　1 2 3 / Q W E / A S D F / Z　Space：決定';
    } else {
      els.keyHint.textContent = '疑似テンキー右　7 8 9 0 / U I O / J K L ;　Backspace：1文字削除';
    }
  }

  function getKeypadKeys(layout) {
    if (layout === 'topLeft') {
      return [
        digitKey('1', '', 1, 3, 2, '1'), digitKey('2', '', 1, 5, 2, '2'), digitKey('3', '', 1, 7, 2, '3'),
        digitKey('4', '', 2, 2, 2, 'Q'), digitKey('5', '', 2, 4, 2, 'W'), digitKey('6', '', 2, 6, 2, 'E'),
        digitKey('7', '', 3, 1, 2, 'A'), digitKey('8', '', 3, 3, 2, 'S'), digitKey('9', '', 3, 5, 2, 'D'), digitKey('0', '', 3, 7, 2, 'F'),
        controlKey('←', 'backspace', '', 4, 1, 2, 'Z'), okKey('Space', 'space-key', 4, 4, 5, 'Space')
      ];
    }
    if (layout === 'pseudo') {
      return [
        digitKey('7', '', 1, 2, 2, '7'), digitKey('8', '', 1, 4, 2, '8'), digitKey('9', '', 1, 6, 2, '9'), digitKey('0', '', 1, 8, 2, '0'),
        digitKey('4', '', 2, 1, 2, 'U'), digitKey('5', '', 2, 3, 2, 'I'), digitKey('6', '', 2, 5, 2, 'O'), controlKey('←', 'backspace', '', 2, 7, 2, 'Backspace'),
        digitKey('1', '', 3, 2, 2, 'J'), digitKey('2', '', 3, 4, 2, 'K'), digitKey('3', '', 3, 6, 2, 'L'), okKey(';', '', 3, 8, 2, ';')
      ];
    }
    return [
      digitKey('7'), digitKey('8'), digitKey('9'),
      digitKey('4'), digitKey('5'), digitKey('6'),
      digitKey('1'), digitKey('2'), digitKey('3'),
      controlKey('←', 'backspace'), digitKey('0'), okKey('OK')
    ];
  }

  function digitKey(n, className = '', row = null, col = null, span = 2, keyName = '') {
    return { label: n, action: n, aria: `${n}を入力`, className, row, col, span, keyName };
  }

  function controlKey(label, action, className = '', row = null, col = null, span = 2, keyName = '') {
    return { label, action, kind: 'control', className, row, col, span, keyName };
  }

  function okKey(label, className = '', row = null, col = null, span = 2, keyName = '') {
    return { label, action: 'submit', kind: 'ok', className, row, col, span, keyName };
  }

  function handleKeyboard(event) {
    if (event.isComposing) return;
    const key = event.key;
    const layout = state.settings.keypadLayout;
    const mapped = mapPhysicalKey(key, layout);
    if (!mapped) return;
    event.preventDefault();
    flashKey(mapped);
    handleInput(mapped);
  }

  function mapPhysicalKey(key, layout) {
    if (/^\d$/.test(key)) return key;
    if (key === 'Enter' || key === ' ') return 'submit';
    if (key === 'Backspace') return 'backspace';
    if (key === 'Delete') return 'backspace';

    if (layout === 'topLeft') {
      const map = { q: '4', w: '5', e: '6', a: '7', s: '8', d: '9', f: '0', z: 'backspace', ' ': 'submit' };
      return map[key.toLowerCase()] || null;
    }

    if (layout === 'pseudo') {
      const map = { u: '4', i: '5', o: '6', j: '1', k: '2', l: '3', '+': 'submit', ';': 'submit', ':': 'submit', ' ': 'submit' };
      return map[key.toLowerCase()] || null;
    }

    return null;
  }

  function showScreen(name) {
    for (const screen of [els.homeScreen, els.gameScreen, els.pauseScreen, els.settingsScreen, els.learnedScreen]) {
      screen.classList.remove('active');
    }
    const active = {
      home: els.homeScreen,
      game: els.gameScreen,
      pause: els.pauseScreen,
      settings: els.settingsScreen,
      learned: els.learnedScreen
    }[name];
    active?.classList.add('active');

    els.pauseButton.classList.toggle('hidden', !(name === 'game' && session.phase === 'playing'));
    els.homeButton.classList.toggle('hidden', name === 'home');
    updateTopInfo();
    updateOperationState();
  }

  function updateTopInfo() {
    const rate = formatRate(state.player.rating);
    els.statusText.textContent = `レート：${rate}`;
    els.homeRate.textContent = rate;
    els.homePoint.textContent = currentType().point;
    els.homeDetail.textContent = currentType().label;
    els.learnedSummary.textContent = learnedSummaryText();
  }

  function openSettings() {
    setRadioValue('keypadLayout', state.settings.keypadLayout);
    setRadioValue('inputSide', state.settings.inputSide);
    setRadioValue('handwritingPad', state.settings.handwritingPad ? 'on' : 'off');
    setRadioValue('handwritingMode', state.settings.handwritingMode || 'layout');
    setRadioValue('operationOrder', state.settings.operationOrder || 'padFirst');
    setRadioValue('formulaFont', state.settings.formulaFont);
    setRadioValue('sound', state.settings.sound ? 'on' : 'off');
    showScreen('settings');
  }

  function saveSettingsFromForm() {
    state.settings.keypadLayout = getRadioValue('keypadLayout') || 'normal';
    state.settings.inputSide = getRadioValue('inputSide') || 'right';
    state.settings.handwritingPad = getRadioValue('handwritingPad') !== 'off';
    state.settings.handwritingMode = getRadioValue('handwritingMode') || 'layout';
    state.settings.operationOrder = getRadioValue('operationOrder') || 'padFirst';
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
    els.inputZone.classList.toggle('left', state.settings.inputSide === 'left');
    els.inputZone.classList.toggle('overlay-mode', state.settings.handwritingMode === 'overlay');
    els.inputZone.classList.toggle('pad-first', state.settings.operationOrder !== 'keypadFirst');
    els.inputZone.classList.toggle('keypad-first', state.settings.operationOrder === 'keypadFirst');
    if (!state.settings.handwritingPad) session.padCollapsed = true;
    applyPadVisibility();
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
    if (session.questions.length >= SET_SIZE && !session.ratingApplied && ['reviewIntro', 'retry'].includes(session.phase)) {
      // 終了済みセットを破棄しない。ホームへ戻る操作でも、まずレートだけは確定する。
      applyResultWithoutRendering();
    }
    session = createEmptySession();
    session.padCollapsed = true;
    applyPadVisibility();
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
    const rounded = Math.round(Number(value) || 0);
    const negative = rounded < 0;
    const digits = String(Math.abs(rounded));
    const parts = [];
    for (let end = digits.length; end > 0; end -= 4) {
      const start = Math.max(0, end - 4);
      parts.unshift(digits.slice(start, end));
    }
    return `${negative ? '-' : ''}${parts.join('\u2009')}`;
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


  function flashKey(action) {
    const safeAction = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(action) : String(action).replace(/"/g, '\"');
    const selector = `[data-action="${safeAction}"]`;
    const button = els.keypad.querySelector(selector);
    if (!button) return;
    button.classList.remove('pressed');
    void button.offsetWidth;
    button.classList.add('pressed');
    window.setTimeout(() => button.classList.remove('pressed'), 110);
  }

  function triggerAnswerEffect(correct) {
    if (correct) {
      els.effectLayer.classList.remove('splash');
      void els.effectLayer.offsetWidth;
      els.effectLayer.classList.add('splash');
      window.setTimeout(() => els.effectLayer.classList.remove('splash'), 320);
      return;
    }
    els.navWindow.classList.remove('shake');
    void els.navWindow.offsetWidth;
    els.navWindow.classList.add('shake');
    window.setTimeout(() => els.navWindow.classList.remove('shake'), 240);
  }

  function applyPadVisibility() {
    const canShow = Boolean(state.settings.handwritingPad);
    els.padPanel.classList.toggle('off', !canShow);
    els.togglePadButton.classList.toggle('off', !canShow);
    els.padPanel.classList.toggle('collapsed', !canShow || session.padCollapsed);
    els.togglePadButton.textContent = session.padCollapsed ? 'メモを開く' : 'メモを閉じる';
  }

  function togglePad(force) {
    if (!state.settings.handwritingPad) return;
    session.padCollapsed = typeof force === 'boolean' ? !force : !session.padCollapsed;
    applyPadVisibility();
  }

  function updateOperationState() {
    const active = ['playing', 'retry'].includes(session.phase) && !session.locked;
    els.inputZone.classList.toggle('answering', active);
    els.operationStatus.textContent = active ? '入力できます' : 'テンキーウィンドウ';
  }

  function learnedSummaryText() {
    if (!state.learnedTypes.length) return 'なし';
    const labels = state.learnedTypes.slice(-2).map((id) => findType(id)?.label || id);
    const more = state.learnedTypes.length > 2 ? ` ほか${state.learnedTypes.length - 2}` : '';
    return `${labels.join(' / ')}${more}`;
  }

  function openLearned() {
    renderLearnedList();
    showScreen('learned');
  }

  function renderLearnedList() {
    els.learnedList.innerHTML = '';
    if (!state.learnedTypes.length) {
      const empty = document.createElement('p');
      empty.className = 'muted-text';
      empty.textContent = 'まだ学習済みの類型はありません。基本確認を全問正解かつ十分な速度で終えると解放されます。';
      els.learnedList.appendChild(empty);
      return;
    }
    for (const typeId of state.learnedTypes) {
      const type = findType(typeId);
      if (!type) continue;
      const item = document.createElement('div');
      item.className = 'learned-item';
      item.innerHTML = `<div><strong>${escapeHtml(type.label)}</strong><span>ポイント：${escapeHtml(type.point)}</span></div>`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'primary-button';
      button.textContent = '反復';
      button.addEventListener('click', () => startSet({ practiceTypeId: type.id }));
      item.appendChild(button);
      els.learnedList.appendChild(item);
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
    els.startButton.addEventListener('click', () => startSet());
    els.learnedButton.addEventListener('click', openLearned);
    els.learnedBackButton.addEventListener('click', goHome);
    els.settingsButton.addEventListener('click', openSettings);
    els.homeButton.addEventListener('click', goHome);
    els.pauseButton.addEventListener('click', pauseGame);
    els.resumeButton.addEventListener('click', resumeGame);
    els.pauseHomeButton.addEventListener('click', goHome);
    els.saveSettingsButton.addEventListener('click', saveSettingsFromForm);
    els.resetDataButton.addEventListener('click', resetData);
    els.clearPadButton.addEventListener('click', clearPad);
    els.togglePadButton.addEventListener('click', () => togglePad());
    els.closePadButton.addEventListener('click', () => togglePad(false));
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
