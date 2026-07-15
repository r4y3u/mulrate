(() => {
  'use strict';

  const APP_VERSION = '2.0.0-alpha.1';
  const STORAGE_KEY = 'mulrate_v2_0_0_alpha1_state';
  const LEGACY_STORAGE_KEYS = ['mulrate_v1_0_0_beta18_state'];
  const MAX_RATE = 99999999;
  const SET_SIZE = 10;
  const ANSWER_EPSILON = 1e-9;
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
    { id: 'A-1', label: 'のぼり', order: 'asc' },
    { id: 'A-2', label: 'くだり', order: 'desc' },
    { id: 'A-3', label: 'ばらばら', order: 'random' }
  ];

  function getOnlineAdapter() {
    return window.MulRateOnlineAdapter || {
      provider: 'none',
      isConfigured: false,
      submitRanking: async () => ({ ok: false, code: 'NOT_CONFIGURED' }),
      fetchRanking: async () => ({ ok: false, code: 'NOT_CONFIGURED', entries: [] }),
      deletePlayerData: async () => ({ ok: false, code: 'NOT_CONFIGURED' })
    };
  }

  const DEFAULT_STATE = {
    schemaVersion: 2,
    player: {
      rating: 300,
      highestRating: 300
    },
    online: {
      enabled: false,
      provider: 'none',
      playerId: '',
      nickname: 'プレイヤー',
      consent: false,
      createdAt: '',
      updatedAt: '',
      lastSyncAt: '',
      lastSyncStatus: 'offline'
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
    gameCard: document.querySelector('#gameScreen .game-card'),
    homeButton: document.getElementById('homeButton'),
    pauseButton: document.getElementById('pauseButton'),
    statusText: document.getElementById('statusText'),
    homeScreen: document.getElementById('homeScreen'),
    gameScreen: document.getElementById('gameScreen'),
    pauseScreen: document.getElementById('pauseScreen'),
    settingsScreen: document.getElementById('settingsScreen'),
    learnedScreen: document.getElementById('learnedScreen'),
    profileScreen: document.getElementById('profileScreen'),
    rankingScreen: document.getElementById('rankingScreen'),
    homeRate: document.getElementById('homeRate'),
    homePoint: document.getElementById('homePoint'),
    homeDetail: document.getElementById('homeDetail'),
        startButton: document.getElementById('startButton'),
    learnedButton: document.getElementById('learnedButton'),
    learnedCount: document.getElementById('learnedCount'),
    learnedList: document.getElementById('learnedList'),
    learnedBackButton: document.getElementById('learnedBackButton'),
    settingsButton: document.getElementById('settingsButton'),
    profileButton: document.getElementById('profileButton'),
    rankingButton: document.getElementById('rankingButton'),
    nicknameInput: document.getElementById('nicknameInput'),
    rankingConsentInput: document.getElementById('rankingConsentInput'),
    profilePreviewName: document.getElementById('profilePreviewName'),
    profileCode: document.getElementById('profileCode'),
    profileSyncState: document.getElementById('profileSyncState'),
    profileSaveMessage: document.getElementById('profileSaveMessage'),
    profileSaveButton: document.getElementById('profileSaveButton'),
    profileBackButton: document.getElementById('profileBackButton'),
    profileResetButton: document.getElementById('profileResetButton'),
    rankingPlayerName: document.getElementById('rankingPlayerName'),
    rankingConnectionBadge: document.getElementById('rankingConnectionBadge'),
    rankingCurrentRate: document.getElementById('rankingCurrentRate'),
    rankingHighestRate: document.getElementById('rankingHighestRate'),
    rankingLearnedCount: document.getElementById('rankingLearnedCount'),
    rankingCompletedSets: document.getElementById('rankingCompletedSets'),
    rankingOnlineStatus: document.getElementById('rankingOnlineStatus'),
    rankingRecentList: document.getElementById('rankingRecentList'),
    rankingProfileButton: document.getElementById('rankingProfileButton'),
    rankingBackButton: document.getElementById('rankingBackButton'),
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
    resetDataButton: document.getElementById('resetDataButton'),
    inputZone: document.getElementById('inputZone'),
    handwritingModeFieldset: document.getElementById('handwritingModeFieldset'),
    operationOrderFieldset: document.getElementById('operationOrderFieldset'),
    togglePadButton: document.getElementById('togglePadButton'),
    padPanel: document.getElementById('padPanel'),
    clearPadButton: document.getElementById('clearPadButton'),
    closePadButton: document.getElementById('closePadButton'),
    scratchPad: document.getElementById('scratchPad'),
    keypadPanel: document.getElementById('keypadPanel'),
    keypad: document.getElementById('keypad'),
    keyHint: document.getElementById('keyHint'),
    navPadControls: document.getElementById('navPadControls'),
    navClearPadButton: document.getElementById('navClearPadButton'),
    navClosePadButton: document.getElementById('navClosePadButton'),
    inputEcho: document.getElementById('inputEcho'),
    padInputEcho: document.getElementById('padInputEcho'),
    navPadTitle: document.getElementById('navPadTitle')
  };

  const CURRICULUM = [
    // 1〜15: 通常九九と、1けたをかける筆算への最小限の準備。
    ...buildKukuTypes('base', [5, 2, 3, 4, 6, 7, 8, 9, 1], range(1, 10)),
    makeKukuType(0, 'base', range(1, 10)),
    makeKukuType(10, 'base', range(1, 10)),
    makeKukuMixType('KUKU_MIX_1_9', '九九 1〜9混合', '7×8', range(1, 9), range(1, 10), 1.42, 3.2),
    makeKukuMixType('KUKU_MIX_0_10', '0〜10の段 混合', '10×6', range(0, 10), range(1, 10), 1.55, 3.6),
    {
      id: 'PLACE_10X_100X', label: '10倍・100倍', point: '23×10', example: [23, 10], difficulty: 1.55, targetSeconds: 4.4,
      generate: () => makeProblem('PLACE_10X_100X', randInt(2, 99), Math.random() < 0.72 ? 10 : 100)
    },
    {
      id: 'TENS_X_1D', label: '何十×1けた', point: '20×3', example: [20, 3], difficulty: 1.72, targetSeconds: 4.5,
      generate: () => makeProblem('TENS_X_1D', randInt(2, 9) * 10, randInt(2, 9))
    },

    // 16〜20: 2けた×1けた。繰り上がりと積の桁数を同時に見る。
    {
      id: 'M2D1_NC_P2', label: '2けた×1けた 繰り上がりなし・積2けた', point: '21×3', example: [21, 3], difficulty: 1.95, targetSeconds: 4.9,
      generate: () => generateByCondition('M2D1_NC_P2', () => [randInt(11, 49), randInt(2, 4)], ([a, b]) => countCarriesByDigit(a, b) === 0 && a * b < 100 && a % 10 !== 0)
    },
    {
      id: 'M2D1_C1_P2', label: '2けた×1けた 繰り上がり1回・積2けた', point: '27×3', example: [27, 3], difficulty: 2.14, targetSeconds: 5.3,
      generate: () => generateByCondition('M2D1_C1_P2', () => [randInt(11, 49), randInt(2, 5)], ([a, b]) => countCarriesByDigit(a, b) === 1 && a * b < 100)
    },
    {
      id: 'M2D1_C1_P3', label: '2けた×1けた 繰り上がり1回・積3けた', point: '43×3', example: [43, 3], difficulty: 2.30, targetSeconds: 5.8,
      generate: () => generateByCondition('M2D1_C1_P3', () => [randInt(21, 89), randInt(2, 6)], ([a, b]) => countCarriesByDigit(a, b) === 1 && a * b >= 100)
    },
    {
      id: 'M2D1_CM_P3', label: '2けた×1けた 繰り上がり複数・積3けた', point: '78×6', example: [78, 6], difficulty: 2.55, targetSeconds: 6.2,
      generate: () => generateByCondition('M2D1_CM_P3', () => [randInt(22, 99), randInt(3, 9)], ([a, b]) => countCarriesByDigit(a, b) >= 2 && a * b >= 100)
    },
    {
      id: 'M2D1_MIX', label: '2けた×1けた 積の桁数混合', point: '56×7', example: [56, 7], difficulty: 2.70, targetSeconds: 6.6,
      generate: () => makeProblem('M2D1_MIX', randInt(11, 99), randInt(2, 9))
    },

    // 21〜27: 3けた×1けた。何百をかける計算から入り、積3けたと4けたを分ける。
    {
      id: 'HUNDREDS_X_1D', label: '何百×1けた', point: '200×3', example: [200, 3], difficulty: 2.35, targetSeconds: 5.8,
      generate: () => makeProblem('HUNDREDS_X_1D', randInt(1, 9) * 100, randInt(2, 9))
    },
    {
      id: 'M3D1_NC_P3', label: '3けた×1けた 繰り上がりなし・積3けた', point: '213×2', example: [213, 2], difficulty: 2.85, targetSeconds: 7.2,
      generate: () => generateByCondition('M3D1_NC_P3', () => [randInt(111, 444), randInt(2, 4)], ([a, b]) => countCarriesByDigit(a, b) === 0 && a * b < 1000 && !String(a).includes('0'))
    },
    {
      id: 'M3D1_C_P3', label: '3けた×1けた 繰り上がりあり・積3けた', point: '128×3', example: [128, 3], difficulty: 3.05, targetSeconds: 7.8,
      generate: () => generateByCondition('M3D1_C_P3', () => [randInt(111, 499), randInt(2, 6)], ([a, b]) => countCarriesByDigit(a, b) >= 1 && a * b < 1000 && !String(a).includes('0'))
    },
    {
      id: 'M3D1_C1_P4', label: '3けた×1けた 繰り上がり1〜2回・積4けた', point: '263×4', example: [263, 4], difficulty: 3.25, targetSeconds: 8.3,
      generate: () => generateByCondition('M3D1_C1_P4', () => [randInt(201, 699), randInt(2, 6)], ([a, b]) => countCarriesByDigit(a, b) >= 1 && countCarriesByDigit(a, b) <= 2 && a * b >= 1000 && !String(a).includes('0'))
    },
    {
      id: 'M3D1_CM_P4', label: '3けた×1けた 連続繰り上がり・積4けた', point: '678×7', example: [678, 7], difficulty: 3.58, targetSeconds: 8.9,
      generate: () => generateByCondition('M3D1_CM_P4', () => [randInt(222, 999), randInt(3, 9)], ([a, b]) => countCarriesByDigit(a, b) >= 3 && a * b >= 1000)
    },
    {
      id: 'M3D1_ZERO', label: '3けた×1けた 0を含む', point: '304×6', example: [304, 6], difficulty: 3.15, targetSeconds: 8.3,
      generate: () => generateByCondition('M3D1_ZERO', () => [randInt(101, 909), randInt(2, 9)], ([a]) => String(a).includes('0') && a % 100 !== 0)
    },
    {
      id: 'M3D1_MIX', label: '3けた×1けた 積の桁数混合', point: '476×8', example: [476, 8], difficulty: 3.68, targetSeconds: 9.3,
      generate: () => makeProblem('M3D1_MIX', randInt(101, 999), randInt(2, 9))
    },

    // 28〜39: 拡張九九は、1けたをかける筆算を習得してから扱う。
    ...buildKukuTypes('base', range(11, 20), range(1, 10)),
    makeKukuMixType('KUKU_MIX_11_20', '11〜20の段 混合', '16×7', range(11, 20), range(1, 10), 1.86, 4.8),
    makeKukuMixType('KUKU_MIX_0_20', '0〜20の段 混合', '18×9', range(0, 20), range(1, 10), 1.94, 5.0),

    // 40〜45: 2けた・3けたの数に10、何十をかける準備。
    {
      id: 'TENS_X_TENS', label: '何十×何十', point: '30×40', example: [30, 40], difficulty: 3.25, targetSeconds: 7.6,
      generate: () => makeProblem('TENS_X_TENS', randInt(2, 9) * 10, randInt(2, 9) * 10)
    },
    {
      id: 'HUNDREDS_X_TENS', label: '何百×何十', point: '200×30', example: [200, 30], difficulty: 3.45, targetSeconds: 8.2,
      generate: () => makeProblem('HUNDREDS_X_TENS', randInt(1, 9) * 100, randInt(2, 9) * 10)
    },
    {
      id: 'M2D_X10', label: '2けた×10', point: '23×10', example: [23, 10], difficulty: 3.55, targetSeconds: 8.8,
      generate: () => makeProblem('M2D_X10', randInt(12, 99), 10)
    },
    {
      id: 'M2D_X_TENS', label: '2けた×何十', point: '23×20', example: [23, 20], difficulty: 3.75, targetSeconds: 9.8,
      generate: () => makeProblem('M2D_X_TENS', randInt(12, 99), randInt(2, 9) * 10)
    },
    {
      id: 'M3D_X10', label: '3けた×10', point: '123×10', example: [123, 10], difficulty: 3.90, targetSeconds: 10.2,
      generate: () => makeProblem('M3D_X10', randInt(101, 999), 10)
    },
    {
      id: 'M3D_X_TENS', label: '3けた×何十', point: '123×20', example: [123, 20], difficulty: 4.15, targetSeconds: 11.5,
      generate: () => makeProblem('M3D_X_TENS', randInt(101, 999), randInt(2, 9) * 10)
    },

    // 46〜55: 2けた・3けた×2けた。積の桁数別に段階化。
    {
      id: 'M2D2_LC_P3', label: '2けた×2けた 繰り上がり少なめ・積3けた', point: '21×13', example: [21, 13], difficulty: 4.25, targetSeconds: 12.2,
      generate: () => generateByCondition('M2D2_LC_P3', () => [randInt(11, 49), randInt(11, 29)], ([a, b]) => a * b < 1000 && countCarriesTwoDigit(a, b) <= 1)
    },
    {
      id: 'M2D2_MC_P3', label: '2けた×2けた 繰り上がり複数・積3けた', point: '38×24', example: [38, 24], difficulty: 4.55, targetSeconds: 13.2,
      generate: () => generateByCondition('M2D2_MC_P3', () => [randInt(22, 69), randInt(12, 39)], ([a, b]) => a * b < 1000 && countCarriesTwoDigit(a, b) >= 2)
    },
    {
      id: 'M2D2_LC_P4', label: '2けた×2けた 繰り上がり少なめ・積4けた', point: '42×25', example: [42, 25], difficulty: 4.72, targetSeconds: 13.8,
      generate: () => generateByCondition('M2D2_LC_P4', () => [randInt(32, 79), randInt(15, 49)], ([a, b]) => a * b >= 1000 && countCarriesTwoDigit(a, b) <= 2)
    },
    {
      id: 'M2D2_MC_P4', label: '2けた×2けた 繰り上がり複数・積4けた', point: '76×34', example: [76, 34], difficulty: 5.02, targetSeconds: 15.0,
      generate: () => generateByCondition('M2D2_MC_P4', () => [randInt(42, 99), randInt(22, 99)], ([a, b]) => a * b >= 1000 && countCarriesTwoDigit(a, b) >= 3)
    },
    {
      id: 'M2D2_MIX', label: '2けた×2けた 積の桁数混合', point: '48×27', example: [48, 27], difficulty: 5.18, targetSeconds: 15.8,
      generate: () => makeProblem('M2D2_MIX', randInt(11, 99), randInt(11, 99))
    },
    {
      id: 'M3D2_LC_P4', label: '3けた×2けた 繰り上がり少なめ・積4けた', point: '213×21', example: [213, 21], difficulty: 5.48, targetSeconds: 18.5,
      generate: () => generateByCondition('M3D2_LC_P4', () => [randInt(101, 399), randInt(11, 39)], ([a, b]) => a * b < 10000 && countCarriesTwoDigit(a, b) <= 2)
    },
    {
      id: 'M3D2_MC_P4', label: '3けた×2けた 繰り上がり複数・積4けた', point: '386×24', example: [386, 24], difficulty: 5.82, targetSeconds: 20.0,
      generate: () => generateByCondition('M3D2_MC_P4', () => [randInt(201, 699), randInt(12, 39)], ([a, b]) => a * b < 10000 && countCarriesTwoDigit(a, b) >= 3)
    },
    {
      id: 'M3D2_LC_P5', label: '3けた×2けた 繰り上がり少なめ・積5けた', point: '425×25', example: [425, 25], difficulty: 6.02, targetSeconds: 21.2,
      generate: () => generateByCondition('M3D2_LC_P5', () => [randInt(301, 799), randInt(15, 49)], ([a, b]) => a * b >= 10000 && countCarriesTwoDigit(a, b) <= 3)
    },
    {
      id: 'M3D2_MC_P5', label: '3けた×2けた 繰り上がり複数・積5けた', point: '728×36', example: [728, 36], difficulty: 6.35, targetSeconds: 23.0,
      generate: () => generateByCondition('M3D2_MC_P5', () => [randInt(402, 999), randInt(22, 99)], ([a, b]) => a * b >= 10000 && countCarriesTwoDigit(a, b) >= 4)
    },
    {
      id: 'M3D2_MIX', label: '3けた×2けた 積の桁数混合', point: '528×47', example: [528, 47], difficulty: 6.52, targetSeconds: 24.0,
      generate: () => makeProblem('M3D2_MIX', randInt(101, 999), randInt(11, 99))
    },

    // 56〜77: 乗数11〜20の拡張は、3けた×2けたの筆算習得後に置く。
    ...buildKukuTypes('extended', [5, 2, 3, 4, 6, 7, 8, 9, 1, 0, 10, ...range(11, 20)], range(11, 20)),
    makeKukuMixType('KUKU_EXT_MIX_0_20_X11_20', '0〜20×11〜20 混合', '18×17', range(0, 20), range(11, 20), 3.95, 10.8),

    // 78〜87: 小数の乗法。小数点は答え欄に先に表示する。
    {
      id: 'DEC_TENTHS_LT1_X_1D', label: '0.?×1けた', point: '0.2×3', example: [0.2, 3], difficulty: 4.65, targetSeconds: 11.5,
      generate: () => makeProblem('DEC_TENTHS_LT1_X_1D', tenths(randInt(1, 9)), randInt(2, 9))
    },
    {
      id: 'DEC_TENTHS_X_1D', label: '小数第一位×1けた', point: '1.2×3', example: [1.2, 3], difficulty: 4.95, targetSeconds: 12.8,
      generate: () => makeProblem('DEC_TENTHS_X_1D', tenths(randInt(11, 99)), randInt(2, 9))
    },
    {
      id: 'DEC_HUNDREDTHS_LT1_X_1D', label: '0.??×1けた', point: '0.25×4', example: [0.25, 4], difficulty: 5.18, targetSeconds: 14.0,
      generate: () => makeProblem('DEC_HUNDREDTHS_LT1_X_1D', hundredths(randInt(1, 99)), randInt(2, 9))
    },
    {
      id: 'DEC_HUNDREDTHS_X_1D', label: '小数第二位×1けた', point: '1.25×4', example: [1.25, 4], difficulty: 5.35, targetSeconds: 14.8,
      generate: () => makeProblem('DEC_HUNDREDTHS_X_1D', hundredths(randInt(101, 999)), randInt(2, 9))
    },
    {
      id: 'DEC_X_WHOLE_2D', label: '小数×2けた整数', point: '1.2×23', example: [1.2, 23], difficulty: 5.85, targetSeconds: 18.5,
      generate: () => makeProblem('DEC_X_WHOLE_2D', Math.random() < 0.55 ? tenths(randInt(11, 99)) : hundredths(randInt(101, 999)), randInt(12, 99))
    },
    {
      id: 'DEC_X_10_100', label: '小数×10・100', point: '1.23×10', example: [1.23, 10], difficulty: 4.35, targetSeconds: 9.6,
      generate: () => makeProblem('DEC_X_10_100', hundredths(randInt(1, 999)), Math.random() < 0.65 ? 10 : 100)
    },
    {
      id: 'WHOLE_X_DEC_TENTHS', label: '整数×0.?', point: '3×0.2', example: [3, 0.2], difficulty: 5.45, targetSeconds: 14.5,
      generate: () => makeProblem('WHOLE_X_DEC_TENTHS', randInt(2, 99), tenths(randInt(1, 9)))
    },
    {
      id: 'DEC_TENTHS_X_TENTHS', label: '小数第一位×小数第一位', point: '1.2×3.4', example: [1.2, 3.4], difficulty: 6.25, targetSeconds: 21.0,
      generate: () => makeProblem('DEC_TENTHS_X_TENTHS', tenths(randInt(2, 99)), tenths(randInt(2, 99)))
    },
    {
      id: 'DEC_HUNDREDTHS_X_TENTHS', label: '小数第二位×小数第一位', point: '1.25×3.4', example: [1.25, 3.4], difficulty: 6.65, targetSeconds: 24.0,
      generate: () => makeProblem('DEC_HUNDREDTHS_X_TENTHS', hundredths(randInt(2, 999)), tenths(randInt(2, 99)))
    },
    {
      id: 'DECIMAL_MUL_MIX', label: '小数のかけ算 混合', point: '2.4×1.5', example: [2.4, 1.5], difficulty: 7.10, targetSeconds: 27.0,
      generate: () => makeProblem('DECIMAL_MUL_MIX', Math.random() < 0.5 ? tenths(randInt(2, 99)) : hundredths(randInt(2, 999)), Math.random() < 0.5 ? tenths(randInt(2, 99)) : randInt(2, 99))
    },

    // 88〜100: 学習指導要領の延長線上に置く熟達者向け段階。
    {
      id: 'M4D1_P4', label: '4けた×1けた・積4けた', point: '1234×2', example: [1234, 2], difficulty: 7.35, targetSeconds: 28.0,
      generate: () => generateByCondition('M4D1_P4', () => [randInt(1001, 4999), randInt(2, 4)], ([a, b]) => a * b < 10000)
    },
    {
      id: 'M4D1_P5', label: '4けた×1けた・積5けた', point: '6789×7', example: [6789, 7], difficulty: 7.65, targetSeconds: 30.0,
      generate: () => generateByCondition('M4D1_P5', () => [randInt(2001, 9999), randInt(2, 9)], ([a, b]) => a * b >= 10000)
    },
    {
      id: 'M4D2_P5', label: '4けた×2けた・積5けた', point: '1234×12', example: [1234, 12], difficulty: 7.95, targetSeconds: 34.0,
      generate: () => generateByCondition('M4D2_P5', () => [randInt(1001, 4999), randInt(11, 29)], ([a, b]) => a * b < 100000)
    },
    {
      id: 'M4D2_P6', label: '4けた×2けた・積6けた', point: '6789×47', example: [6789, 47], difficulty: 8.25, targetSeconds: 38.0,
      generate: () => generateByCondition('M4D2_P6', () => [randInt(3001, 9999), randInt(22, 99)], ([a, b]) => a * b >= 100000)
    },
    {
      id: 'M2D3_P4', label: '2けた×3けた・積4けた', point: '24×123', example: [24, 123], difficulty: 8.05, targetSeconds: 34.0,
      generate: () => generateByCondition('M2D3_P4', () => [randInt(11, 49), randInt(101, 399)], ([a, b]) => a * b < 10000)
    },
    {
      id: 'M2D3_P5', label: '2けた×3けた・積5けた', point: '76×428', example: [76, 428], difficulty: 8.30, targetSeconds: 38.0,
      generate: () => generateByCondition('M2D3_P5', () => [randInt(32, 99), randInt(201, 999)], ([a, b]) => a * b >= 10000)
    },
    {
      id: 'M3D3_P5', label: '3けた×3けた・積5けた', point: '123×246', example: [123, 246], difficulty: 8.55, targetSeconds: 42.0,
      generate: () => generateByCondition('M3D3_P5', () => [randInt(101, 399), randInt(101, 399)], ([a, b]) => a * b < 100000)
    },
    {
      id: 'M3D3_P6', label: '3けた×3けた・積6けた', point: '728×436', example: [728, 436], difficulty: 8.85, targetSeconds: 47.0,
      generate: () => generateByCondition('M3D3_P6', () => [randInt(302, 999), randInt(202, 999)], ([a, b]) => a * b >= 100000)
    },
    {
      id: 'M4D3_P6', label: '4けた×3けた・積6けた', point: '1234×246', example: [1234, 246], difficulty: 9.10, targetSeconds: 52.0,
      generate: () => generateByCondition('M4D3_P6', () => [randInt(1001, 3999), randInt(101, 399)], ([a, b]) => a * b < 1000000)
    },
    {
      id: 'M4D3_P7', label: '4けた×3けた・積7けた', point: '6789×436', example: [6789, 436], difficulty: 9.40, targetSeconds: 58.0,
      generate: () => generateByCondition('M4D3_P7', () => [randInt(3001, 9999), randInt(202, 999)], ([a, b]) => a * b >= 1000000)
    },
    {
      id: 'DEC_X_HUNDREDTHS', label: '小数×小数第二位', point: '12.4×0.25', example: [12.4, 0.25], difficulty: 9.25, targetSeconds: 48.0,
      generate: () => makeProblem('DEC_X_HUNDREDTHS', Math.random() < 0.5 ? tenths(randInt(11, 999)) : hundredths(randInt(101, 9999)), hundredths(randInt(1, 99)))
    },
    {
      id: 'M4D4_MIX', label: '4けた×4けた 積7〜8けた', point: '1234×5678', example: [1234, 5678], difficulty: 9.65, targetSeconds: 68.0,
      generate: () => makeProblem('M4D4_MIX', randInt(1001, 9999), randInt(1001, 9999))
    },
    {
      id: 'MASTER_MUL_MIX', label: '乗法 熟達者総合', point: '1234×56', example: [1234, 56], difficulty: 9.80, targetSeconds: 60.0,
      generate: () => {
        const mode = randInt(1, 4);
        if (mode === 1) return makeProblem('MASTER_MUL_MIX', randInt(1001, 9999), randInt(2, 99));
        if (mode === 2) return makeProblem('MASTER_MUL_MIX', randInt(101, 999), randInt(101, 999));
        if (mode === 3) return makeProblem('MASTER_MUL_MIX', hundredths(randInt(101, 9999)), hundredths(randInt(1, 999)));
        return makeProblem('MASTER_MUL_MIX', randInt(1001, 9999), randInt(101, 999));
      }
    }
  ];

  let state = loadState();
  let session = createEmptySession();
  let audioContext = null;
  let isDrawing = false;
  let lastPoint = null;
  let homeRateAnimationId = null;

  function createEmptySession() {
    return {
      phase: 'idle',
      sessionId: '',
      startedAtIso: '',
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
      padBaseProblem: null,
      resumePadAfterPause: false,
      lastDelta: 0,
      lastOutcome: 'stay',
      result: null
    };
  }

  function loadState() {
    try {
      for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const migrated = migrateState(JSON.parse(raw));
        if (key !== STORAGE_KEY) localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      return migrateState(DEFAULT_STATE);
    } catch (error) {
      console.warn('Failed to load state:', error);
      return migrateState(DEFAULT_STATE);
    }
  }

  function migrateState(value) {
    const next = structuredCloneSafe(DEFAULT_STATE);
    const now = new Date().toISOString();
    next.schemaVersion = 2;
    next.player = { ...next.player, ...(value.player || {}) };
    next.online = { ...next.online, ...(value.online || {}) };
    next.settings = { ...next.settings, ...(value.settings || {}) };
    next.progress = { ...next.progress, ...(value.progress || {}) };
    next.mastery = value.mastery || {};
    next.learnedTypes = Array.isArray(value.learnedTypes) ? value.learnedTypes.filter((id) => CURRICULUM.some((t) => t.id === id)) : [];
    next.recentProblems = Array.isArray(value.recentProblems) ? value.recentProblems.slice(-80) : [];
    next.history = Array.isArray(value.history) ? value.history.slice(-50) : [];
    next.progress.typeIndex = clamp(Math.trunc(next.progress.typeIndex || 0), 0, CURRICULUM.length - 1);
    next.progress.patternIndex = clamp(Math.trunc(next.progress.patternIndex || 0), 0, maxPatternIndexForType(next.progress.typeIndex));
    next.progress.patternStayCount = Math.max(0, Math.trunc(next.progress.patternStayCount || 0));
    next.player.rating = clamp(Math.round(next.player.rating || 300), 0, MAX_RATE);
    next.player.highestRating = clamp(Math.round(next.player.highestRating || next.player.rating), 0, MAX_RATE);
    next.online.playerId = String(next.online.playerId || generatePlayerId());
    next.online.nickname = sanitizeNickname(next.online.nickname || value.player?.nickname || 'プレイヤー');
    next.online.consent = Boolean(next.online.consent);
    next.online.createdAt = next.online.createdAt || now;
    next.online.updatedAt = next.online.updatedAt || now;
    const adapter = getOnlineAdapter();
    next.online.provider = adapter.isConfigured ? adapter.provider : 'none';
    next.online.enabled = Boolean(adapter.isConfigured && next.online.consent);
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
      const kukuCleared = isKukuType(type) && (pattern === 'A-3' || outcome === 'kuku_skip_row') && firstCorrect === SET_SIZE && avgFirstTime <= effectiveTargetSeconds(type) * 1.8;
      const basicCleared = !isKukuType(type) && pattern === 'A' && firstCorrect === SET_SIZE && avgFirstTime <= effectiveTargetSeconds(type) * 1.25;
      const typeCleared = !isKukuType(type) && pattern === 'C' && (outcome === 'advance' || isSkipOutcome(outcome)) && finalCorrect >= 9 && firstCorrect >= 8;
      if (kukuCleared || basicCleared || typeCleared) learned.add(type.id);
    }

    return Array.from(learned).filter((id) => CURRICULUM.some((type) => type.id === id));
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function structuredCloneSafe(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function generatePlayerId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const random = Math.random().toString(36).slice(2, 12);
    return `local-${Date.now().toString(36)}-${random}`;
  }

  function shortPlayerCode(playerId) {
    return String(playerId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase().padEnd(8, '-');
  }

  function sanitizeNickname(value) {
    const normalized = String(value || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ');
    const allowed = Array.from(normalized).filter((char) => /[\p{L}\p{N}_・ー\- ]/u.test(char));
    const result = allowed.slice(0, 12).join('').trim();
    return result || 'プレイヤー';
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

  function range(min, max) {
    const values = [];
    for (let n = min; n <= max; n++) values.push(n);
    return values;
  }

  function buildKukuTypes(mode, rows, multipliers) {
    return rows.map((row) => makeKukuType(row, mode, multipliers));
  }

  function makeKukuMixType(id, label, point, leftCandidates, rightCandidates, difficulty, targetSeconds) {
    return {
      id,
      label,
      point,
      example: point.split('×').map(Number),
      difficulty,
      targetSeconds,
      family: 'kukuMix',
      generate: () => makeProblem(id, choice(leftCandidates), choice(rightCandidates))
    };
  }

  function tenths(value) {
    return normalizeNumber(value / 10);
  }

  function hundredths(value) {
    return normalizeNumber(value / 100);
  }

  function makeKukuType(row, mode, multipliers) {
    const expanded = mode === 'extended';
    const suffix = expanded ? '11_20' : '1_10';
    const labelRange = expanded ? '11〜20' : '1〜10';
    const point = `${row}×${expanded ? 12 : Math.min(10, Math.max(1, row === 0 ? 1 : row))}`;
    const baseDifficulty = kukuBaseDifficulty(row);
    const difficulty = expanded ? baseDifficulty + 0.78 : baseDifficulty;
    const targetSeconds = expanded ? kukuExtendedTarget(row) : kukuBaseTarget(row);
    const id = `KUKU_${row}_${suffix}`;
    return {
      id,
      label: expanded ? `拡張九九 ${row}の段（${labelRange}）` : `九九 ${row}の段（${labelRange}）`,
      point,
      example: [row, expanded ? 12 : 10],
      difficulty,
      targetSeconds,
      family: 'kuku',
      kukuMode: mode,
      row,
      multipliers,
      generate: () => makeProblem(id, row, choice(multipliers))
    };
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

  function isKukuType(type = currentType()) {
    return type?.family === 'kuku';
  }

  function maxPatternIndexForType(typeIndex) {
    const type = CURRICULUM[typeIndex] || CURRICULUM[0];
    return isKukuType(type) ? KUKU_PATTERNS.length - 1 : PATTERNS.length - 1;
  }

  function currentPattern() {
    const type = currentType();
    const maxIndex = maxPatternIndexForType(state.progress.typeIndex);
    const index = clamp(state.progress.patternIndex, 0, maxIndex);
    return isKukuType(type) ? KUKU_PATTERNS[index] : PATTERNS[index];
  }

  function isSkipOutcome(outcome) {
    return ['skip', 'kuku_skip_to_random', 'kuku_skip_row'].includes(outcome);
  }

  function kukuProblem(leftCandidates, rightCandidates) {
    let a = choice(leftCandidates);
    let b = choice(rightCandidates);
    if (Math.random() < 0.35) [a, b] = [b, a];
    return makeProblem('', a, b);
  }

  function makeProblem(typeId, left, right) {
    const type = typeId ? findType(typeId) : null;
    const normalizedAnswer = normalizeNumber(Number(left) * Number(right));
    return {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      typeId,
      typeLabel: type ? type.label : '',
      point: `${formatOperand(left)}×${formatOperand(right)}`,
      left,
      right,
      answer: normalizedAnswer,
      firstAnswer: null,
      retryAnswer: null,
      firstTime: null,
      retryTime: null,
      initialCorrect: false,
      retryCorrect: false,
      finalCorrect: false
    };
  }

  function normalizeNumber(value) {
    return Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000;
  }

  function formatOperand(value) {
    const n = normalizeNumber(value);
    if (Number.isInteger(n)) return String(n);
    return String(n).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }

  function formatAnswer(value) {
    return formatOperand(value);
  }

  function answerSpec(answer) {
    const text = formatAnswer(answer);
    const negative = text.startsWith('-');
    const body = negative ? text.slice(1) : text;
    const dotIndex = body.indexOf('.');
    if (dotIndex < 0) {
      return { text, negative, decimalPlaces: 0, integerDigits: body.length, totalDigits: body.length };
    }
    const integerDigits = dotIndex;
    const decimalPlaces = body.length - dotIndex - 1;
    return { text, negative, decimalPlaces, integerDigits, totalDigits: integerDigits + decimalPlaces };
  }

  function isDecimalAnswer(problemOrAnswer) {
    const answer = typeof problemOrAnswer === 'object' && problemOrAnswer ? problemOrAnswer.answer : problemOrAnswer;
    return answerSpec(answer).decimalPlaces > 0;
  }

  function activeInputProblem() {
    if (session.phase === 'playing') return session.questions[session.currentIndex] || null;
    if (session.phase === 'retry') return session.retryQueue[session.retryIndex] || null;
    return null;
  }

  function answerDigitLimit(problem) {
    if (!problem) return 10;
    const spec = answerSpec(problem.answer);
    if (spec.decimalPlaces > 0) return spec.totalDigits + (spec.negative ? 1 : 0);
    return 10;
  }

  function inputToAnswerValue(input, answer) {
    if (!input) return NaN;
    const spec = answerSpec(answer);
    if (spec.decimalPlaces <= 0) return Number(input);
    const negative = input.startsWith('-');
    const digits = input.replace(/[^0-9]/g, '');
    if (digits.length !== spec.totalDigits) return NaN;
    const whole = digits.slice(0, spec.integerDigits) || '0';
    const fraction = digits.slice(spec.integerDigits);
    return Number(`${negative ? '-' : ''}${whole}.${fraction}`);
  }

  function hasEnoughInput(input, problem) {
    if (!problem || !input) return false;
    const spec = answerSpec(problem.answer);
    if (spec.decimalPlaces <= 0) return true;
    return input.replace(/[^0-9]/g, '').length >= spec.totalDigits;
  }

  function isAnswerCorrect(input, answer) {
    const numeric = inputToAnswerValue(input, answer);
    return Number.isFinite(numeric) && Math.abs(normalizeNumber(numeric) - normalizeNumber(answer)) <= ANSWER_EPSILON;
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

  function createProblemFromPlan(plan, usedKeys = new Set()) {
    if (plan && typeof plan === 'object' && plan.kind === 'fixed') {
      const type = findType(plan.typeId) || CURRICULUM[0];
      const problem = makeProblem(type.id, plan.left, plan.right);
      problem.typeId = type.id;
      problem.typeLabel = type.label;
      usedKeys.add(problemKey(problem));
      return problem;
    }
    return createProblemByType(plan, usedKeys);
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
    const type = currentType();
    if (isKukuType(type)) return buildKukuQuestionPlan(type);

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

  function buildKukuQuestionPlan(type) {
    const phase = KUKU_PATTERNS[clamp(state.progress.patternIndex, 0, KUKU_PATTERNS.length - 1)] || KUKU_PATTERNS[0];
    let multipliers = type.multipliers.slice(0, SET_SIZE);
    if (phase.order === 'desc') multipliers = multipliers.slice().reverse();
    if (phase.order === 'random') multipliers = shuffle(multipliers);
    return multipliers.map((right) => ({ kind: 'fixed', typeId: type.id, left: type.row, right }));
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
    const plans = practiceTypeId ? Array(SET_SIZE).fill(practiceTypeId) : buildQuestionPlan();
    session = createEmptySession();
    session.phase = 'playing';
    session.sessionId = generatePlayerId();
    session.startedAtIso = new Date().toISOString();
    session.practiceMode = Boolean(practiceTypeId);
    session.practiceTypeId = practiceTypeId;
    // 手書きパッドは、必要なときに明示的に開く。
    session.padCollapsed = true;
    session.questions = plans.map((plan) => createProblemFromPlan(plan, used));
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
    els.subInfo.textContent = isDecimalAnswer(problem) ? '小数点は表示済みです。各位に数字だけ入力してください' : '答えを入力してください';
    els.inlineActions.innerHTML = '';
    setPadProblem(problem);
    updateOperationState();
  }

  function submitAnswer() {
    if (session.locked) return;
    if (!['playing', 'retry'].includes(session.phase)) return;
    const problem = activeInputProblem();
    if (!session.input) {
      setMessage('数字を入力してください', 'warning');
      return;
    }
    if (!hasEnoughInput(session.input, problem)) {
      setMessage('空いている位に数字を入れてください', 'warning');
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
    const numericAnswer = inputToAnswerValue(session.input, problem.answer);
    const correct = isAnswerCorrect(session.input, problem.answer);
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
    setMessage(correct ? `正解！　${formatSeconds(elapsed)}秒　+${formatRate(Math.max(0, problem.firstImpact))}` : `確認　ロス ${formatRate(problem.lostPotential)}`, correct ? 'success' : 'danger');
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
    closePadForNavTransition(false);
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
    els.subInfo.textContent = isDecimalAnswer(problem) ? '小数点は表示済みです。各位に数字だけ入力してください' : '答えを入力してください';
    els.inlineActions.innerHTML = '';
    setPadProblem(problem);
    updateOperationState();
  }

  function submitRetryAnswer() {
    const problem = session.retryQueue[session.retryIndex];
    if (!problem) return;
    const elapsed = elapsedSeconds(session.questionStartedAt);
    const numericAnswer = inputToAnswerValue(session.input, problem.answer);
    const correct = isAnswerCorrect(session.input, problem.answer);
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
    setMessage(correct ? `正解！　答え直し成功　+${formatRate(Math.max(0, problem.retryImpact))}` : `確認　ロス ${formatRate(problem.lostPotential)}`, correct ? 'success' : 'danger');
    els.subInfo.textContent = correct ? '減点を一部回復しました' : `正しくは ${formatAnswer(problem.answer)}`;

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
      patternBefore: currentPattern()?.id || 'A',
      typeBefore: currentType().id
    };
    session.ratingApplied = true;

    updateMastery(summary);
    if (!session.practiceMode) {
      updateLearnedTypes(summary, outcome);
      updateProgress(outcome);
      state.learnedTypes = repairLearnedTypes(state);
    }
    rememberRecentProblems(session.questions);
    const finishedAt = new Date().toISOString();
    const verification = createSessionVerification(finishedAt);
    state.history.push({
      date: finishedAt,
      sessionId: session.sessionId,
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
      practiceMode: session.practiceMode,
      verification
    });
    state.history = state.history.slice(-50);
    state.progress.completedSets += 1;
    saveState();
  }

  function createSessionVerification(finishedAt) {
    const items = session.questions.map((problem) => ({
      typeId: problem.typeId,
      left: problem.left,
      right: problem.right,
      firstAnswer: problem.firstAnswer,
      retryAnswer: problem.retryAnswer,
      firstTime: roundForProof(problem.firstTime),
      retryTime: roundForProof(problem.retryTime),
      initialCorrect: Boolean(problem.initialCorrect),
      finalCorrect: Boolean(problem.finalCorrect)
    }));
    const digestSource = items.map((item) => [item.typeId, item.left, item.right, item.firstAnswer, item.retryAnswer, item.firstTime, item.retryTime].join(':')).join('|');
    return {
      version: 1,
      appVersion: APP_VERSION,
      sessionId: session.sessionId,
      startedAt: session.startedAtIso,
      finishedAt,
      durationMs: Math.max(0, Math.round(performance.now() - session.startedAt)),
      problemDigest: hashText(digestSource),
      items
    };
  }

  function roundForProof(value) {
    return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
  }

  function hashText(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function renderFinalResult() {
    closePadForNavTransition(false);
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
    addInlineButton('スタート', 'primary', () => startSet(session.practiceMode ? { practiceTypeId: session.practiceTypeId } : {}));
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
    const targetTime = average(qs.map((q) => effectiveTargetSeconds(findType(q.typeId))));
    const ratingBefore = state.player.rating;
    return { questions: qs, firstCorrect, finalCorrect, avgFirstTime, avgFinalTime, targetTime, ratingBefore };
  }

  function average(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function judgeProgress(summary) {
    if (isKukuType(currentType())) return judgeKukuProgress(summary);

    const excellent = isExcellent(summary);
    const strong = summary.firstCorrect === SET_SIZE && summary.avgFirstTime <= summary.targetTime * 1.15;
    const good = summary.finalCorrect >= 9 && summary.firstCorrect >= 8 && summary.avgFirstTime <= summary.targetTime * 1.45;
    const poor = summary.finalCorrect <= 5 || summary.firstCorrect <= 4 || summary.avgFirstTime > summary.targetTime * 2.0;
    if (excellent) return 'skip';
    if (strong || good) return 'advance';
    if (poor) return 'regress';
    return 'stay';
  }

  function judgeKukuProgress(summary) {
    const type = currentType();
    const phaseIndex = clamp(state.progress.patternIndex, 0, KUKU_PATTERNS.length - 1);
    const times = summary.questions.map((q) => q.firstTime).filter((v) => Number.isFinite(v));
    const maxTime = times.length ? Math.max(...times) : Infinity;
    const strict = type.kukuMode === 'base' && type.row <= 10;
    const limit = strict ? 4.0 : 8.0;
    const randomLimit = strict ? 5.0 : 9.0;
    const skipToRandom = strict ? 3.0 : 5.5;
    const skipRow = strict ? 2.0 : 4.0;
    const allInitialCorrect = summary.firstCorrect === SET_SIZE;

    if (summary.finalCorrect <= 5 || summary.firstCorrect <= 4 || summary.avgFirstTime > randomLimit * 2.0) return 'regress';
    if (!allInitialCorrect) return summary.finalCorrect >= 8 ? 'stay' : 'regress';

    if (phaseIndex === 0) {
      if (maxTime < skipRow) return 'kuku_skip_row';
      if (maxTime < skipToRandom) return 'kuku_skip_to_random';
      if (maxTime < limit) return 'advance';
      return 'stay';
    }

    if (phaseIndex === 1) {
      if (maxTime < skipRow) return 'kuku_skip_row';
      if (maxTime < limit) return 'advance';
      return 'stay';
    }

    if (maxTime < randomLimit) return 'advance';
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

    const achievedRaw = summary.questions.reduce((sum, q) => {
      const type = findType(q.typeId);
      const resultFactor = q.initialCorrect ? 1 : q.retryCorrect ? 0.45 : 0;
      const time = q.firstTime || effectiveTargetSeconds(type);
      const speedFactor = getSpeedFactor(time, effectiveTargetSeconds(type));
      return sum + resultFactor * speedFactor * (type?.difficulty || 1);
    }, 0);
    const achieved = achievedRaw * getInitialAccuracyFactor(summary);

    let delta = deltaFromPerformance(summary, achieved, possible, outcome);

    if (isSkipOutcome(outcome)) delta *= 1.28;
    if (options.practiceMode && delta > 0) delta *= 0.3;

    const avgDifficulty = average(summary.questions.map((q) => findType(q.typeId)?.difficulty || 1));

    if (outcome === 'stay' && delta > 0) {
      const highStage = avgDifficulty >= 8.0;
      delta *= Math.max(highStage ? 0.78 : 0.35, Math.pow(highStage ? 0.88 : 0.68, state.progress.patternStayCount + 1));
    }
    if (isKukuType(currentType()) && outcome === 'stay' && summary.firstCorrect === SET_SIZE) {
      delta = Math.max(0, delta);
    }

    const cap = Math.max(360, RATE_CAP_BASE * Math.pow(avgDifficulty, 1.20));
    if (summary.finalCorrect >= 8 && delta < 0) {
      delta = 0;
    }
    if (outcome === 'stay' && summary.finalCorrect === SET_SIZE && summary.avgFirstTime <= summary.targetTime * 1.75) {
      const highAccuracy = summary.firstCorrect >= 8;
      const masteryFloor = avgDifficulty >= 8.0 ? (highAccuracy ? 0.30 : 0.18) : 0.04;
      delta = Math.max(delta, cap * masteryFloor);
    }
    if (state.progress.typeIndex === CURRICULUM.length - 1 && summary.ratingBefore >= 90000000 && summary.finalCorrect === SET_SIZE && summary.firstCorrect >= 9 && summary.avgFirstTime <= summary.targetTime * 1.15) {
      delta = Math.max(delta, (MAX_RATE - summary.ratingBefore) * 0.50);
    }
    delta = clamp(delta, -cap * 0.20, Math.max(cap * (isSkipOutcome(outcome) ? 1.46 : 1.12), delta));
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
    const cap = Math.max(360, RATE_CAP_BASE * Math.pow(avgDifficulty, 1.20));
    return Math.round(clamp(delta, -cap * 0.20, cap * 1.46));
  }


  function getEndgameRateBoost(avgDifficulty) {
    const x = Math.max(0, avgDifficulty - 6.4);
    return 1 + Math.pow(x, 1.35) * 0.38;
  }

  function deltaFromPerformance(summary, achieved, possible, outcome) {
    const performanceRatio = possible ? achieved / possible : 0;
    const avgDifficulty = average(summary.questions.map((q) => findType(q.typeId)?.difficulty || 1));
    const expectedRatio = clamp(0.25 + Math.log10(summary.ratingBefore + 100) / 24, 0.28, 0.76);
    const endgameBoost = getEndgameRateBoost(avgDifficulty);
    const inflation = RATE_INFLATION_BASE * Math.pow(avgDifficulty, 1.42) * (1 + Math.log2(avgDifficulty + 1)) * endgameBoost;
    const suppression = 1 / (1 + Math.log10(summary.ratingBefore + 10) / (6.2 + Math.max(0, avgDifficulty - 6.2) * 1.8));

    let delta = (performanceRatio - expectedRatio) * inflation;
    if (summary.firstCorrect === SET_SIZE) {
      delta += 0.10 * inflation;
      if (summary.avgFirstTime <= summary.targetTime * 1.15) delta += 0.11 * inflation;
    } else if (summary.firstCorrect >= 9 && summary.finalCorrect === SET_SIZE) {
      delta += 0.06 * inflation;
    } else if (summary.firstCorrect <= 8) {
      delta -= (9 - summary.firstCorrect) * 0.035 * inflation;
    }
    if (summary.finalCorrect === SET_SIZE && summary.firstCorrect < SET_SIZE) delta += 0.035 * inflation;
    if (summary.finalCorrect <= 6) delta -= 0.1 * inflation;
    if (isSkipOutcome(outcome)) delta += 0.11 * inflation;
    if (delta > 0 && summary.firstCorrect <= 7) delta *= 0.68;
    else if (delta > 0 && summary.firstCorrect <= 8) delta *= 0.82;
    return delta * suppression;
  }

  function getInitialAccuracyFactor(summary) {
    const rate = summary.firstCorrect / SET_SIZE;
    if (summary.firstCorrect === SET_SIZE) return 1;
    if (summary.firstCorrect >= 9) return 0.90;
    if (summary.firstCorrect >= 8) return 0.74;
    if (summary.firstCorrect >= 7) return 0.60;
    return clamp(0.40 + rate * 0.22, 0.40, 0.56);
  }

  function estimateQuestionPotential(problem) {
    const type = findType(problem.typeId);
    return Math.round(42 * Math.pow(type?.difficulty || 1, 1.32) * 1.25);
  }

  function estimateQuestionImpact(problem, correct, seconds, retry) {
    const type = findType(problem.typeId);
    const resultFactor = correct ? (retry ? 0.45 : 1) : 0;
    const speedFactor = getSpeedFactor(seconds, effectiveTargetSeconds(type));
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
    if (isKukuType(currentType())) {
      updateKukuProgress(outcome);
      return;
    }

    if (isSkipOutcome(outcome)) {
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

  function updateKukuProgress(outcome) {
    const phaseIndex = clamp(state.progress.patternIndex, 0, KUKU_PATTERNS.length - 1);
    if (outcome === 'stay') {
      state.progress.patternStayCount += 1;
      return;
    }
    state.progress.patternStayCount = 0;

    if (outcome === 'regress') {
      if (phaseIndex > 0) {
        state.progress.patternIndex = phaseIndex - 1;
        return;
      }
      if (state.progress.typeIndex > 0) {
        state.progress.typeIndex -= 1;
        state.progress.patternIndex = maxPatternIndexForType(state.progress.typeIndex);
      }
      return;
    }

    if (outcome === 'kuku_skip_to_random') {
      state.progress.patternIndex = 2;
      return;
    }

    if (outcome === 'kuku_skip_row' || (outcome === 'advance' && phaseIndex >= 2) || (outcome === 'skip' && phaseIndex >= 1)) {
      advanceTypeFromKuku();
      return;
    }

    if (outcome === 'advance' || outcome === 'skip') {
      state.progress.patternIndex = Math.min(2, phaseIndex + 1);
      return;
    }
  }

  function advanceTypeFromKuku() {
    state.progress.typeIndex = Math.min(CURRICULUM.length - 1, state.progress.typeIndex + 1);
    state.progress.patternIndex = 0;
  }

  function advancePattern() {
    const p = state.progress.patternIndex;
    if (p === 2) {
      state.progress.typeIndex = Math.min(CURRICULUM.length - 1, state.progress.typeIndex + 1);
      state.progress.patternIndex = isKukuType(CURRICULUM[state.progress.typeIndex]) ? 0 : 3;
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
      state.progress.patternIndex = isKukuType(CURRICULUM[state.progress.typeIndex]) ? 0 : 3;
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
      state.progress.patternIndex = maxPatternIndexForType(state.progress.typeIndex);
      return;
    }
    state.progress.patternIndex = Math.max(0, p - 1);
  }

  function updateLearnedTypes(summary, outcome) {
    const typeId = session.result?.typeBefore || currentType().id;
    const pattern = session.result?.patternBefore || currentPattern()?.id || 'A';
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

    if (isKukuType(type)) {
      const maxTime = Math.max(...questions.map((q) => q.firstTime).filter((v) => Number.isFinite(v)));
      const limit = (type.kukuMode === 'extended' || type.row > 10) ? 9.0 : 5.0;
      return allInitialCorrect && maxTime < limit && (pattern === 'A-3' || outcome === 'kuku_skip_row');
    }

    const typeInitialCorrect = questions.filter((q) => q.initialCorrect).length;
    const typeInitialRate = typeInitialCorrect / Math.max(1, questions.length);
    const highStage = type.difficulty >= 7.0;
    const finalStage = type.id === CURRICULUM[CURRICULUM.length - 1].id;
    const stableHighStage = highStage && allFinalCorrect && summary.finalCorrect >= 9 && summary.firstCorrect >= 8 && typeInitialRate >= 0.75 && avgTypeTime <= effectiveTargetSeconds(type) * 1.75;
    const stableFinalStage = finalStage && allFinalCorrect && summary.finalCorrect >= 9 && summary.firstCorrect >= 7 && avgTypeTime <= effectiveTargetSeconds(type) * 1.85;

    // 基本確認で安定していれば、その時点で反復を解放する。
    if (pattern === 'A') {
      return (allInitialCorrect && avgTypeTime <= effectiveTargetSeconds(type) * 1.20) || stableHighStage || stableFinalStage;
    }

    // 次の類型へ進めるだけでなく、初回正解の安定も見て反復対象にする。
    // 高速だがミスが残る場合は、解放を少し遅らせる。
    if ((pattern === 'C' || highStage || finalStage) && (isSkipOutcome(outcome) || outcome === 'advance' || outcome === 'stay')) {
      return stableHighStage || stableFinalStage || (allFinalCorrect && summary.finalCorrect >= 9 && summary.firstCorrect >= 9 && typeInitialRate >= 0.9 && avgTypeTime <= effectiveTargetSeconds(type) * 1.55);
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
      const target = effectiveTargetSeconds(type);
      const speed = type ? clamp(target / Math.max(target, m.avgTime || target), 0.35, 1) : 0.5;
      m.mastery = clamp(firstRate * 0.62 + finalRate * 0.25 + speed * 0.13, 0, 1);
    }
  }

  function rememberRecentProblems(questions) {
    const keys = questions.map(problemKey);
    state.recentProblems = state.recentProblems.concat(keys).slice(-80);
  }


  function writtenGraceForType(type) {
    if (!type || isKukuType(type)) return 1;
    const id = type.id || '';
    if (id.startsWith('M2D2') || id.startsWith('M3D2')) return 1.18;
    if (id.startsWith('M4D') || id.startsWith('M2D3') || id.startsWith('M3D3') || id === 'M4D4_MIX' || id === 'MASTER_MUL_MIX') return 1.28;
    if (id.startsWith('DEC_') || id.startsWith('WHOLE_X_DEC') || id === 'DECIMAL_MUL_MIX') return type.difficulty >= 6 ? 1.18 : 1.12;
    if (type.difficulty >= 4.0) return 1.12;
    return 1;
  }

  function effectiveTargetSeconds(type) {
    return (type?.targetSeconds || 5) * writtenGraceForType(type);
  }

  function currentType() {
    return CURRICULUM[state.progress.typeIndex] || CURRICULUM[0];
  }

  function resultMessage(outcome) {
    if (isSkipOutcome(outcome)) return '十分に定着しています';
    if (outcome === 'advance') return '安定して解けています';
    if (outcome === 'regress') return '復習を強めます';
    if (outcome === 'practice') return '学習済みを確認しました';
    return 'もう少し確認します';
  }

  function resultSubInfo(outcome) {
    if (isSkipOutcome(outcome)) return '解き方が安定しているため、次の確認へ進みます';
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
      els.answerDisplay.classList.remove('decimal-answer');
      els.answerDisplay.textContent = '\u00a0';
    }
    updateInputEcho();
  }

  function renderAnswerSlots(value, problem) {
    if (!problem || !isDecimalAnswer(problem)) return value ? escapeHtml(value) : '\u00a0';
    const spec = answerSpec(problem.answer);
    const rawDigits = String(value || '').replace(/[^0-9]/g, '').slice(0, spec.totalDigits);
    const pieces = [];
    if (spec.negative) pieces.push('<span class="answer-sign">-</span>');
    for (let i = 0; i < spec.integerDigits; i++) {
      const digit = rawDigits[i] || '';
      pieces.push(`<span class="answer-slot${digit ? ' filled' : ''}">${digit || '&nbsp;'}</span>`);
    }
    pieces.push('<span class="answer-dot">.</span>');
    for (let i = 0; i < spec.decimalPlaces; i++) {
      const index = spec.integerDigits + i;
      const digit = rawDigits[index] || '';
      pieces.push(`<span class="answer-slot${digit ? ' filled' : ''}">${digit || '&nbsp;'}</span>`);
    }
    return pieces.join('');
  }

  function setAnswerDisplay(value) {
    const problem = activeInputProblem();
    const decimal = Boolean(problem && isDecimalAnswer(problem));
    els.answerDisplay.classList.toggle('decimal-answer', decimal);
    els.answerDisplay.innerHTML = renderAnswerSlots(value, problem);
    updateInputEcho();
    if (['playing', 'retry'].includes(session.phase) && !session.locked) {
      els.answerDisplay.classList.remove('pulse');
      void els.answerDisplay.offsetWidth;
      els.answerDisplay.classList.add('pulse');
      window.setTimeout(() => els.answerDisplay.classList.remove('pulse'), 150);
    }
  }

  function formatInputEcho() {
    const problem = activeInputProblem();
    if (!['playing', 'retry'].includes(session.phase) || !problem) return '';
    const raw = String(session.input || '').replace(/[^0-9]/g, '');
    if (!raw) return '入力：—';
    if (!isDecimalAnswer(problem)) return `入力：${raw}`;
    const spec = answerSpec(problem.answer);
    const digits = raw.slice(0, spec.totalDigits);
    const whole = digits.slice(0, spec.integerDigits).padEnd(spec.integerDigits, '□');
    const frac = digits.slice(spec.integerDigits).padEnd(spec.decimalPlaces, '□');
    return `入力：${whole}.${frac}`;
  }

  function updateInputEcho() {
    const text = formatInputEcho();
    for (const el of [els.inputEcho, els.padInputEcho]) {
      if (!el) continue;
      el.textContent = text;
      el.classList.toggle('empty', !text || text.endsWith('—'));
      el.classList.toggle('off', !text);
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
      const problem = activeInputProblem();
      if (session.input.length >= answerDigitLimit(problem)) return;
      session.input += action;
      setAnswerDisplay(session.input);
      setMessage('', '');
      return;
    }

    if (action === '.') {
      // 小数点は答え欄にあらかじめ表示するため、入力としては受け付けない。
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
        if (key.row) spacer.style.gridRow = String(key.row);
        if (key.col) spacer.style.gridColumn = `${key.col} / span ${key.span || 1}`;
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
        beep('click');
        handleInput(key.action);
      });
      els.keypad.appendChild(button);
    }

    if (layout === 'normal') {
      els.keyHint.textContent = '数字:入力  Enter/Space:決定  Backspace:削除';
    } else if (layout === 'topLeft') {
      els.keyHint.textContent = '疑似左  123/QWE/ASDF/Z  Space:決定';
    } else {
      els.keyHint.textContent = '疑似右  7890/UIO/JKL/;:決定';
    }
  }

  function getKeypadKeys(layout) {
    if (layout === 'topLeft') {
      return [
        digitKey('1', '', 1, 1, 4, '1'), digitKey('2', '', 1, 5, 4, '2'), digitKey('3', '', 1, 9, 4, '3'),
        digitKey('4', '', 2, 3, 4, 'Q'), digitKey('5', '', 2, 7, 4, 'W'), digitKey('6', '', 2, 11, 4, 'E'),
        digitKey('7', '', 3, 4, 4, 'A'), digitKey('8', '', 3, 8, 4, 'S'), digitKey('9', '', 3, 12, 4, 'D'), digitKey('0', '', 3, 16, 4, 'F'),
        controlKey('←', 'backspace', '', 4, 6, 4, 'Z'), okKey('Space', 'space-key', 4, 10, 8, 'Space')
      ];
    }
    if (layout === 'pseudo') {
      return [
        digitKey('7', '', 1, 1, 4, '7'), digitKey('8', '', 1, 5, 4, '8'), digitKey('9', '', 1, 9, 4, '9'), digitKey('0', '', 1, 13, 4, '0'),
        digitKey('4', '', 2, 3, 4, 'U'), digitKey('5', '', 2, 7, 4, 'I'), digitKey('6', '', 2, 11, 4, 'O'), controlKey('←', 'backspace', '', 2, 15, 4, 'Backspace'),
        digitKey('1', '', 3, 4, 4, 'J'), digitKey('2', '', 3, 8, 4, 'K'), digitKey('3', '', 3, 12, 4, 'L'), okKey(';', '', 3, 16, 4, ';')
      ];
    }
    return [
      digitKey('7', '', 1, 1, 1), digitKey('8', '', 1, 2, 1), digitKey('9', '', 1, 3, 1),
      digitKey('4', '', 2, 1, 1), digitKey('5', '', 2, 2, 1), digitKey('6', '', 2, 3, 1),
      digitKey('1', '', 3, 1, 1), digitKey('2', '', 3, 2, 1), digitKey('3', '', 3, 3, 1),
      controlKey('←', 'backspace', '', 4, 1, 1), digitKey('0', '', 4, 2, 1), { blank: true, row: 4, col: 3, span: 1 },
      okKey('OK', '', 5, 1, 3)
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
    beep('click');
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
    els.app.dataset.screen = name;
    for (const cls of ['screen-home', 'screen-game', 'screen-pause', 'screen-settings', 'screen-learned', 'screen-profile', 'screen-ranking']) els.app.classList.remove(cls);
    els.app.classList.add(`screen-${name}`);
    for (const screen of [els.homeScreen, els.gameScreen, els.pauseScreen, els.settingsScreen, els.learnedScreen, els.profileScreen, els.rankingScreen]) {
      screen?.classList.remove('active');
    }
    const active = {
      home: els.homeScreen,
      game: els.gameScreen,
      pause: els.pauseScreen,
      settings: els.settingsScreen,
      learned: els.learnedScreen,
      profile: els.profileScreen,
      ranking: els.rankingScreen
    }[name];
    active?.classList.add('active');

    els.pauseButton.classList.toggle('hidden', !(name === 'game' && session.phase === 'playing'));
    els.homeButton.classList.toggle('hidden', name === 'home');
    updateTopInfo({ animateHomeRate: name === 'home' });
    updateOperationState();
  }

  function updateTopInfo(options = {}) {
    const rate = formatRate(state.player.rating);
    const highestRate = Math.max(state.player.highestRating || 0, state.player.rating || 0);
    const nickname = state.online.nickname === 'プレイヤー' ? '' : `${state.online.nickname}｜`;
    els.statusText.textContent = `${nickname}レート：${rate}`;
    if (options.animateHomeRate) {
      animateHomeRate(highestRate);
    } else if (!els.homeScreen.classList.contains('active')) {
      setHomeRate(highestRate);
    }
    els.homePoint.textContent = currentType().point;
    els.homeDetail.textContent = isKukuType(currentType()) ? `${currentType().label}：${currentPattern().label}` : currentType().label;
  }

  function setHomeRate(value) {
    els.homeRate.textContent = formatRate(value);
  }

  function animateHomeRate(target) {
    if (homeRateAnimationId) window.clearInterval(homeRateAnimationId);
    const started = performance.now();
    const duration = 2000;
    const final = Math.max(0, Math.round(target || 0));
    setHomeRate(0);
    homeRateAnimationId = window.setInterval(() => {
      const t = clamp((performance.now() - started) / duration, 0, 1);
      setHomeRate(Math.round(final * t));
      if (t >= 1) {
        window.clearInterval(homeRateAnimationId);
        homeRateAnimationId = null;
        setHomeRate(final);
      }
    }, 50);
  }

  function openProfile() {
    renderProfile();
    showScreen('profile');
  }

  function renderProfile() {
    if (els.nicknameInput) els.nicknameInput.value = state.online.nickname;
    if (els.rankingConsentInput) els.rankingConsentInput.checked = Boolean(state.online.consent);
    if (els.profilePreviewName) els.profilePreviewName.textContent = state.online.nickname;
    if (els.profileCode) els.profileCode.textContent = `端末ID：${shortPlayerCode(state.online.playerId)}`;
    if (els.profileSyncState) {
      els.profileSyncState.textContent = state.online.enabled
        ? `接続済み：${state.online.provider}`
        : '現在はサーバー未接続です。外部への送信は行われません。';
    }
    if (els.profileSaveMessage) els.profileSaveMessage.textContent = '';
  }

  function saveProfile() {
    const rawNickname = els.nicknameInput?.value || '';
    const nickname = sanitizeNickname(rawNickname);
    state.online.nickname = nickname;
    state.online.consent = Boolean(els.rankingConsentInput?.checked);
    state.online.updatedAt = new Date().toISOString();
    const adapter = getOnlineAdapter();
    state.online.provider = adapter.isConfigured ? adapter.provider : 'none';
    state.online.enabled = Boolean(adapter.isConfigured && state.online.consent);
    saveState();
    renderProfile();
    updateTopInfo();
    if (els.profileSaveMessage) {
      els.profileSaveMessage.textContent = nickname === String(rawNickname).normalize('NFKC').trim()
        ? '保存しました。'
        : `使用できる文字に整えて「${nickname}」として保存しました。`;
    }
  }

  function resetProfile() {
    const ok = window.confirm('プロフィールと端末IDを初期化します。学習データは残ります。よろしいですか。');
    if (!ok) return;
    const now = new Date().toISOString();
    state.online = {
      ...structuredCloneSafe(DEFAULT_STATE.online),
      playerId: generatePlayerId(),
      createdAt: now,
      updatedAt: now
    };
    saveState();
    renderProfile();
    updateTopInfo();
    if (els.profileSaveMessage) els.profileSaveMessage.textContent = 'プロフィールを初期化しました。';
  }

  function openRanking() {
    renderRanking();
    showScreen('ranking');
  }

  function renderRanking() {
    if (els.rankingPlayerName) els.rankingPlayerName.textContent = state.online.nickname;
    if (els.rankingCurrentRate) els.rankingCurrentRate.textContent = formatRate(state.player.rating);
    if (els.rankingHighestRate) els.rankingHighestRate.textContent = formatRate(Math.max(state.player.highestRating, state.player.rating));
    if (els.rankingLearnedCount) els.rankingLearnedCount.textContent = `${state.learnedTypes.length} / ${CURRICULUM.length}`;
    if (els.rankingCompletedSets) els.rankingCompletedSets.textContent = formatRate(state.progress.completedSets || 0);
    if (els.rankingConnectionBadge) {
      els.rankingConnectionBadge.textContent = state.online.enabled ? 'オンライン' : '端末内';
      els.rankingConnectionBadge.classList.toggle('online', state.online.enabled);
    }
    if (els.rankingOnlineStatus) {
      els.rankingOnlineStatus.textContent = state.online.enabled
        ? `ランキングへ接続しています。最終同期：${state.online.lastSyncAt || '未同期'}`
        : state.online.consent
          ? '公開への同意は保存済みです。バックエンド接続後に、成績送信を開始できます。'
          : 'バックエンド未接続のため、現在は端末内記録のみ表示しています。プロフィールで公開同意を設定できます。';
    }
    renderRankingRecentList();
  }

  function renderRankingRecentList() {
    if (!els.rankingRecentList) return;
    els.rankingRecentList.innerHTML = '';
    const recent = state.history.slice(-8).reverse();
    if (!recent.length) {
      const empty = document.createElement('p');
      empty.className = 'muted-text';
      empty.textContent = 'まだ記録がありません。1セット終えると表示されます。';
      els.rankingRecentList.appendChild(empty);
      return;
    }
    for (const item of recent) {
      const row = document.createElement('div');
      row.className = 'ranking-recent-item';
      const delta = Number(item.delta || 0);
      const sign = delta > 0 ? '+' : '';
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(formatHistoryDate(item.date))}</strong>
          <span>${escapeHtml(findType(item.typeId)?.label || item.typeId || 'トレーニング')}・初回 ${Number(item.firstCorrect || 0)} / ${SET_SIZE}</span>
        </div>
        <strong class="${delta < 0 ? 'negative' : 'positive'}">${sign}${escapeHtml(formatRate(delta))}</strong>
      `;
      els.rankingRecentList.appendChild(row);
    }
  }

  function formatHistoryDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '日時不明';
    return new Intl.DateTimeFormat('ja-JP', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function buildRankingSubmission() {
    const latest = state.history.at(-1) || null;
    return {
      schemaVersion: 1,
      appVersion: APP_VERSION,
      player: {
        playerId: state.online.playerId,
        nickname: state.online.nickname
      },
      consent: Boolean(state.online.consent),
      metrics: {
        currentRating: state.player.rating,
        highestRating: Math.max(state.player.highestRating, state.player.rating),
        learnedCount: state.learnedTypes.length,
        completedSets: state.progress.completedSets || 0
      },
      latestSession: latest ? {
        date: latest.date,
        before: latest.before,
        after: latest.after,
        delta: latest.delta,
        firstCorrect: latest.firstCorrect,
        finalCorrect: latest.finalCorrect,
        typeId: latest.typeId,
        pattern: latest.pattern,
        outcome: latest.outcome,
        verification: latest.verification || null
      } : null
    };
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
  }

  function setRadioValue(name, value) {
    const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
  }

  function getRadioValue(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value;
  }

  function applySettings() {
    const leftHanded = state.settings.inputSide === 'left';
    const padHidden = !state.settings.handwritingPad;
    const navPadMode = !padHidden && state.settings.handwritingMode === 'layout';
    const keypadPadMode = !padHidden && state.settings.handwritingMode === 'overlay';
    els.app.classList.toggle('input-left', leftHanded);
    els.app.classList.toggle('window-keypad-first', state.settings.operationOrder === 'keypadFirst');
    els.app.classList.toggle('pad-nav-mode', navPadMode);
    els.inputZone.classList.toggle('left', leftHanded);
    els.inputZone.classList.toggle('right', !leftHanded);
    els.inputZone.classList.toggle('overlay-mode', keypadPadMode);
    els.inputZone.classList.remove('pad-first', 'keypad-first');
    movePadToCurrentHost();
    if (els.handwritingModeFieldset) {
      els.handwritingModeFieldset.classList.toggle('settings-disabled', padHidden);
      els.handwritingModeFieldset.querySelectorAll('input').forEach((input) => { input.disabled = padHidden; });
    }
    if (els.operationOrderFieldset) {
      els.operationOrderFieldset.classList.remove('settings-disabled');
      els.operationOrderFieldset.querySelectorAll('input').forEach((input) => { input.disabled = false; });
    }
    if (padHidden) session.padCollapsed = true;
    applyPadVisibility();
    renderKeypad();
    updateTopInfo();
  }

  function isNavPadMode() {
    return Boolean(state.settings.handwritingPad && state.settings.handwritingMode === 'layout');
  }

  function movePadToCurrentHost() {
    if (!els.padPanel) return;
    if (isNavPadMode()) {
      if (els.padPanel.parentElement !== els.navWindow) els.navWindow.appendChild(els.padPanel);
      return;
    }
    if (els.padPanel.parentElement !== els.inputZone) {
      els.inputZone.insertBefore(els.padPanel, els.keypadPanel);
    } else if (els.keypadPanel && els.padPanel.nextElementSibling !== els.keypadPanel) {
      els.inputZone.insertBefore(els.padPanel, els.keypadPanel);
    }
  }

  function resetData() {
    const ok = window.confirm('レートと学習データをリセットします。よろしいですか。');
    if (!ok) return;
    const settings = structuredCloneSafe(state.settings);
    const online = structuredCloneSafe(state.online);
    state = migrateState(DEFAULT_STATE);
    state.settings = settings;
    state.online = online;
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
    session.padBaseProblem = null;
    applyPadVisibility();
    clearPad();
    showScreen('home');
  }

  function closePadForNavTransition(restoreOnResume = false) {
    if (!state.settings.handwritingPad) return;
    const wasOpen = !session.padCollapsed;
    if (restoreOnResume) session.resumePadAfterPause = wasOpen;
    if (wasOpen) {
      session.padCollapsed = true;
      applyPadVisibility();
    }
  }

  function pauseGame() {
    if (session.phase !== 'playing') return;
    session.pauseStartedAt = performance.now();
    closePadForNavTransition(true);
    showScreen('pause');
  }

  function resumeGame() {
    if (session.phase !== 'playing') return;
    const pausedMs = performance.now() - session.pauseStartedAt;
    session.questionStartedAt += pausedMs;
    showScreen('game');
    if (session.resumePadAfterPause && state.settings.handwritingPad) {
      session.padCollapsed = false;
      session.resumePadAfterPause = false;
      applyPadVisibility();
    }
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

  function ensureAudioContext() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    audioContext ||= new AudioCtor();
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  }

  function beep(type) {
    if (!state.settings.sound) return;
    try {
      const ctx = ensureAudioContext();
      if (!ctx) return;
      const playTone = (frequency, startOffset, duration, volume, wave = 'sine') => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + startOffset;
        oscillator.type = wave;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.018);
      };
      if (type === 'click') {
        playTone(620, 0, 0.035, 0.018, 'square');
      } else if (type === 'ok') {
        playTone(740, 0, 0.085, 0.045);
        playTone(990, 0.075, 0.105, 0.050);
      } else {
        playTone(210, 0, 0.075, 0.026);
      }
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
    els.effectLayer.classList.remove('correct-pop');
    els.navWindow.classList.remove('correct-glow');
    els.answerDisplay.classList.remove('answer-correct', 'answer-wrong');
    els.formula.classList.remove('formula-wrong');
    els.gameCard?.classList.remove('wrong-nudge');
    void els.effectLayer.offsetWidth;

    if (correct) {
      els.effectLayer.classList.add('correct-pop');
      els.navWindow.classList.add('correct-glow');
      els.answerDisplay.classList.add('answer-correct');
      window.setTimeout(() => {
        els.effectLayer.classList.remove('correct-pop');
        els.navWindow.classList.remove('correct-glow');
        els.answerDisplay.classList.remove('answer-correct');
      }, 560);
      return;
    }

    els.answerDisplay.classList.add('answer-wrong');
    els.formula.classList.add('formula-wrong');
    els.gameCard?.classList.add('wrong-nudge');
    window.setTimeout(() => {
      els.answerDisplay.classList.remove('answer-wrong');
      els.formula.classList.remove('formula-wrong');
      els.gameCard?.classList.remove('wrong-nudge');
    }, 240);
  }

  function applyPadVisibility() {
    movePadToCurrentHost();
    const canShow = Boolean(state.settings.handwritingPad);
    const navMode = isNavPadMode();
    const keypadMode = canShow && state.settings.handwritingMode === 'overlay';
    const isOpen = canShow && !session.padCollapsed;
    els.app.classList.toggle('pad-nav-open', isOpen && navMode);
    els.app.classList.toggle('pad-keypad-open', isOpen && keypadMode);
    els.inputZone.classList.toggle('no-pad', !canShow);
    els.inputZone.classList.toggle('pad-open', isOpen);
    els.inputZone.classList.toggle('pad-nav-active', isOpen && navMode);
    els.padPanel.classList.toggle('off', !canShow);
    els.padPanel.classList.toggle('nav-pad-panel', navMode);
    els.padPanel.classList.toggle('keypad-pad-panel', keypadMode);
    els.togglePadButton.classList.toggle('off', !canShow || isOpen);
    els.navPadControls?.classList.toggle('off', !canShow || !isOpen || !navMode);
    els.navPadTitle?.classList.toggle('off', !canShow || !isOpen || !navMode);
    els.padPanel.classList.toggle('collapsed', !canShow || session.padCollapsed);
    els.togglePadButton.textContent = session.padCollapsed ? 'メモを開く' : '';
    updateInputEcho();
  }

  function togglePad(force) {
    if (!state.settings.handwritingPad) return;
    session.padCollapsed = typeof force === 'boolean' ? !force : !session.padCollapsed;
    applyPadVisibility();
  }

  function updateOperationState() {
    const active = ['playing', 'retry'].includes(session.phase) && !session.locked;
    els.inputZone.classList.toggle('answering', active);
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
    if (els.learnedCount) els.learnedCount.textContent = `${state.learnedTypes.length} / ${CURRICULUM.length}`;
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
      const index = CURRICULUM.findIndex((item) => item.id === type.id) + 1;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'learned-item';
      item.setAttribute('aria-label', `${index}番 ${type.label}を復習する`);
      item.innerHTML = `<span class="learned-main"><strong>${escapeHtml(type.label)}</strong><span class="learned-point">ポイント：${escapeHtml(type.point)}</span></span><span class="learned-number">${index}</span>`;
      item.addEventListener('click', () => startSet({ practiceTypeId: type.id }));
      els.learnedList.appendChild(item);
    }
  }

  function setupCanvas() {
    const canvas = els.scratchPad;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
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

    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('dblclick', (event) => event.preventDefault());
    canvas.addEventListener('selectstart', (event) => event.preventDefault());
    canvas.addEventListener('gesturestart', (event) => event.preventDefault());

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

  function setPadProblem(problem) {
    session.padBaseProblem = problem || null;
    clearPad();
  }

  function clearPad() {
    const canvas = els.scratchPad;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (session.padBaseProblem) drawScratchBase(session.padBaseProblem);
  }

  function drawScratchBase(problem) {
    const canvas = els.scratchPad;
    const ctx = canvas.getContext('2d');
    const left = formatOperand(problem.left);
    const right = formatOperand(problem.right);
    const longest = Math.max(left.length, right.length + 2);
    const fontSize = longest >= 9 ? 46 : longest >= 7 ? 54 : 66;
    const lineHeight = Math.round(fontSize * 1.30);
    const blockWidth = Math.min(canvas.width * 0.58, Math.max(230, longest * fontSize * 0.70 + 64));
    const ratio = state.settings.inputSide === 'left' ? 0.40 : 0.70;
    const x = clamp(canvas.width * ratio, blockWidth + 24, canvas.width - 48);
    const y = Math.max(62, fontSize + 18);

    ctx.save();
    ctx.font = `900 ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = 'rgba(16, 43, 37, 0.58)';
    ctx.strokeStyle = 'rgba(16, 43, 37, 0.36)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(left, x, y);
    ctx.fillText(`× ${right}`, x, y + lineHeight);
    ctx.beginPath();
    ctx.moveTo(x - blockWidth + 18, y + lineHeight + 18);
    ctx.lineTo(x + 10, y + lineHeight + 18);
    ctx.stroke();
    ctx.restore();
  }

  function attachEvents() {
    els.startButton.addEventListener('click', () => startSet());
    els.learnedButton.addEventListener('click', openLearned);
    els.learnedBackButton.addEventListener('click', goHome);
    els.settingsButton.addEventListener('click', openSettings);
    els.profileButton?.addEventListener('click', openProfile);
    els.rankingButton?.addEventListener('click', openRanking);
    els.profileSaveButton?.addEventListener('click', saveProfile);
    els.profileBackButton?.addEventListener('click', goHome);
    els.profileResetButton?.addEventListener('click', resetProfile);
    els.rankingBackButton?.addEventListener('click', goHome);
    els.rankingProfileButton?.addEventListener('click', openProfile);
    els.nicknameInput?.addEventListener('input', () => {
      if (els.profilePreviewName) els.profilePreviewName.textContent = sanitizeNickname(els.nicknameInput.value);
      if (els.profileSaveMessage) els.profileSaveMessage.textContent = '';
    });
    els.homeButton.addEventListener('click', goHome);
    els.pauseButton.addEventListener('click', pauseGame);
    els.resumeButton.addEventListener('click', resumeGame);
    els.pauseHomeButton.addEventListener('click', goHome);
    document.querySelectorAll('#settingsScreen input[type="radio"]').forEach((input) => {
      input.addEventListener('change', saveSettingsFromForm);
    });
    els.resetDataButton.addEventListener('click', resetData);
    els.clearPadButton.addEventListener('click', clearPad);
    els.navClearPadButton?.addEventListener('click', clearPad);
    els.togglePadButton.addEventListener('click', () => togglePad());
    els.closePadButton.addEventListener('click', () => togglePad(false));
    els.navClosePadButton?.addEventListener('click', () => togglePad(false));
    window.addEventListener('pointerdown', () => { if (state.settings.sound) ensureAudioContext(); }, { passive: true });
    window.addEventListener('keydown', handleKeyboard);
    document.addEventListener('gesturestart', (event) => event.preventDefault());
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
    getSession: () => structuredCloneSafe(session),
    reset: () => {
      for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) localStorage.removeItem(key);
      state = loadState();
      applySettings();
      goHome();
    },
    version: APP_VERSION,
    getRankingSubmission: () => structuredCloneSafe(buildRankingSubmission()),
    curriculum: CURRICULUM.map(({ id, label, point, difficulty, targetSeconds }) => ({ id, label, point, difficulty, targetSeconds })),
    patterns: PATTERNS,
    kukuPatterns: KUKU_PATTERNS
  };
})();
