import fs from 'node:fs';
import vm from 'node:vm';
import { verifyAndCalculateRate } from '../supabase/functions/_shared/rate-engine.ts';

class FakeElement {
  id = '';
  classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  style: Record<string, unknown> = {};
  dataset: Record<string, string> = {};
  value = '';
  checked = false;
  disabled = false;
  innerHTML = '';
  textContent = '';
  hidden = false;
  width = 500;
  height = 500;
  parentElement: FakeElement | null = null;
  nextElementSibling: FakeElement | null = null;
  isConnected = true;
  addEventListener() {}
  removeEventListener() {}
  appendChild(child: FakeElement) { child.parentElement = this; }
  insertBefore(child: FakeElement) { child.parentElement = this; }
  querySelector() { return new FakeElement(); }
  querySelectorAll() { return [] as FakeElement[]; }
  focus() {}
  setAttribute() {}
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 500, height: 500 }; }
  getContext() { return { clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }; }
}

function loadClientDebug(): any {
  const elements = new Map<string, FakeElement>();
  const get = (id: string) => {
    if (!elements.has(id)) { const el = new FakeElement(); el.id = id; elements.set(id, el); }
    return elements.get(id)!;
  };
  const document = {
    getElementById: get,
    querySelector: () => new FakeElement(),
    querySelectorAll: () => [] as FakeElement[],
    addEventListener() {},
    body: new FakeElement(),
    createElement: () => new FakeElement(),
    activeElement: null
  };
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, String(value)),
    removeItem: (key: string) => storage.delete(key)
  };
  const btoa = (value: string) => Buffer.from(value, 'binary').toString('base64');
  const atob = (value: string) => Buffer.from(value, 'base64').toString('binary');
  const fakeWindow: any = {
    document, localStorage, btoa, atob,
    addEventListener() {},
    setTimeout() { return 1; }, clearTimeout() {},
    setInterval() { return 1; }, clearInterval() {},
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    confirm() { return false; },
    navigator: { onLine: false }, location: {}, performance: { now: () => 0 },
    HTMLElement: FakeElement,
    MulRateNameFilter: { validate: () => ({ ok: true }) }
  };
  fakeWindow.window = fakeWindow;
  fakeWindow.crypto = globalThis.crypto;
  fakeWindow.structuredClone = globalThis.structuredClone;
  const context: any = {
    window: fakeWindow, document, localStorage, btoa, atob,
    console, structuredClone: globalThis.structuredClone, crypto: globalThis.crypto,
    performance: fakeWindow.performance, navigator: fakeWindow.navigator,
    setTimeout: fakeWindow.setTimeout, clearTimeout: fakeWindow.clearTimeout,
    setInterval: fakeWindow.setInterval, clearInterval: fakeWindow.clearInterval,
    requestAnimationFrame: fakeWindow.requestAnimationFrame,
    cancelAnimationFrame: fakeWindow.cancelAnimationFrame,
    Intl, Date, Math, Number, String, Boolean, Array, Object, Map, Set, JSON, RegExp, Error, URL, TextEncoder,
    HTMLElement: FakeElement
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8'), context, { filename: 'app.js' });
  return fakeWindow.MulRateDebug;
}

const debug = loadClientDebug();
const catalog = debug.curriculum;
const patterns = debug.patterns;
const kukuPatterns = debug.kukuPatterns;

function buildTypeIds(context: any): string[] {
  const current = catalog[context.typeIndex];
  if (context.practiceMode) return Array(10).fill(context.practiceTypeId);
  if (current.family === 'kuku') return Array(10).fill(current.id);
  const p = patterns[context.patternIndex];
  const ids: string[] = [];
  const push = (id: string, count: number) => { for (let i = 0; i < count; i += 1) ids.push(id); };
  push(catalog[context.typeIndex].id, p.center);
  push(catalog[Math.max(0, context.typeIndex - 1)].id, p.recent);
  push(catalog[Math.max(0, context.typeIndex - 2)].id, p.base);
  push(catalog[Math.min(catalog.length - 1, context.typeIndex + 1)].id, p.challenge);
  while (ids.length < 10) ids.push(current.id);
  return ids.slice(0, 10);
}

function buildItems(context: any, correctCount: number, finalCorrectCount: number, seconds: number): any[] {
  const current = catalog[context.typeIndex];
  const ids = buildTypeIds(context);
  return ids.map((typeId, index) => {
    const initialCorrect = index < correctCount;
    const finalCorrect = index < finalCorrectCount;
    let left = 12 + index;
    let right = 3;
    if (!context.practiceMode && current.family === 'kuku') {
      left = current.row;
      right = current.kukuMode === 'extended' ? 11 + index : 1 + index;
    }
    return { typeId, left, right, firstTime: seconds + index * 0.01, initialCorrect, finalCorrect };
  });
}

const cases = [
  { typeIndex: 0, patternIndex: 0, patternStayCount: 0, practiceMode: false, practiceTypeId: null, rating: 300, correct: 10, final: 10, seconds: 1.1 },
  { typeIndex: 14, patternIndex: 4, patternStayCount: 3, practiceMode: false, practiceTypeId: null, rating: 12000, correct: 8, final: 10, seconds: 5.2 },
  { typeIndex: 35, patternIndex: 2, patternStayCount: 1, practiceMode: false, practiceTypeId: null, rating: 80000, correct: 9, final: 10, seconds: 4.0 },
  { typeIndex: 70, patternIndex: 2, patternStayCount: 0, practiceMode: false, practiceTypeId: null, rating: 2500000, correct: 10, final: 10, seconds: 5.0 },
  { typeIndex: 99, patternIndex: 5, patternStayCount: 5, practiceMode: false, practiceTypeId: null, rating: 92000000, correct: 10, final: 10, seconds: 40.0 },
  { typeIndex: 80, patternIndex: 3, patternStayCount: 2, practiceMode: true, practiceTypeId: catalog[20].id, rating: 500000, correct: 9, final: 10, seconds: 8.0 }
];

for (const test of cases) {
  const current = catalog[test.typeIndex];
  const context = {
    formulaVersion: 'rate-v1',
    typeIndex: test.typeIndex,
    typeId: current.id,
    patternIndex: test.patternIndex,
    patternId: current.family === 'kuku' ? kukuPatterns[test.patternIndex].id : patterns[test.patternIndex].id,
    patternStayCount: test.patternStayCount,
    practiceMode: test.practiceMode,
    practiceTypeId: test.practiceTypeId
  };
  const items = buildItems(context, test.correct, test.final, test.seconds);
  const client = debug.calculateRateFromProof({ items, ratingBefore: test.rating, rateContext: context });
  const server = verifyAndCalculateRate(items, test.rating, context);
  if (!server.ok) throw new Error(`${current.id}: server rejected ${server.code} ${server.message}`);
  for (const key of ['outcome', 'rawDelta', 'appliedDelta', 'ratingAfter'] as const) {
    if (client[key] !== server[key]) throw new Error(`${current.id}: ${key} mismatch client=${client[key]} server=${server[key]}`);
  }
  if (JSON.stringify(client.nextProgress) !== JSON.stringify(server.nextProgress)) {
    throw new Error(`${current.id}: nextProgress mismatch client=${JSON.stringify(client.nextProgress)} server=${JSON.stringify(server.nextProgress)}`);
  }
  console.log(`PASS ${current.id} ${client.outcome} ${client.appliedDelta}`);
}

console.log(`All ${cases.length} rate parity cases passed.`);

const tamperBase = cases[1];
const tamperType = catalog[tamperBase.typeIndex];
const tamperContext = {
  formulaVersion: 'rate-v1',
  typeIndex: tamperBase.typeIndex,
  typeId: tamperType.id,
  patternIndex: tamperBase.patternIndex,
  patternId: patterns[tamperBase.patternIndex].id,
  patternStayCount: tamperBase.patternStayCount,
  practiceMode: false,
  practiceTypeId: null
};
const tamperedItems = buildItems(tamperContext, 8, 10, 5.2);
tamperedItems[0].typeId = catalog[99].id;
const tampered = verifyAndCalculateRate(tamperedItems, tamperBase.rating, tamperContext);
if (tampered.ok || tampered.code !== 'QUESTION_PLAN_MISMATCH') throw new Error('Tampered question plan was not rejected.');
const unsupported = verifyAndCalculateRate(buildItems(tamperContext, 8, 10, 5.2), tamperBase.rating, { ...tamperContext, formulaVersion: 'rate-v0' });
if (unsupported.ok || unsupported.code !== 'UNSUPPORTED_RATE_FORMULA') throw new Error('Unsupported formula was not rejected.');
console.log('Tamper rejection cases passed.');

const rankingBase = {
  enabled: true,
  consent: true,
  rankingStatus: 'verified',
  currentRank: 37,
  totalPlayers: 512,
  verifiedSessionCount: 18,
  syncQueue: [],
  lastSyncAt: '2026-07-16T12:00:00.000Z',
  reviewMessage: ''
};
const verifiedUi = debug.buildRankingUiModel(rankingBase, true);
if (verifiedUi.badge !== '認定済み' || verifiedUi.position !== '37位／512位中' || !verifiedUi.statusText.includes('認定済みセッション')) {
  throw new Error(`Verified ranking UI mismatch: ${JSON.stringify(verifiedUi)}`);
}
const provisionalUi = debug.buildRankingUiModel({ ...rankingBase, rankingStatus: 'provisional', currentRank: null }, true);
if (provisionalUi.badge !== '暫定' || provisionalUi.position !== '暫定記録' || !provisionalUi.statusText.includes('公開順位には含まれません')) {
  throw new Error(`Provisional ranking UI mismatch: ${JSON.stringify(provisionalUi)}`);
}
const quarantineUi = debug.buildRankingUiModel({ ...rankingBase, rankingStatus: 'quarantined', currentRank: null, reviewMessage: '確認テスト' }, true);
if (quarantineUi.badge !== '確認中' || quarantineUi.position !== '記録確認中' || quarantineUi.statusText !== '確認テスト') {
  throw new Error(`Quarantined ranking UI mismatch: ${JSON.stringify(quarantineUi)}`);
}
console.log('Ranking UI state cases passed.');

const migratedAlpha4 = debug.migrateState({
  schemaVersion: 3,
  player: { rating: 12345, highestRating: 13000 },
  online: {
    nickname: '移行テスト', profileComplete: true, nicknameLocked: true,
    consent: true, consentLocked: true, playerId: '11111111-1111-4111-8111-111111111111',
    playerSecret: 'abcdefghijklmnopqrstuvwxyzABCDEFGH12345678'
  },
  progress: { typeIndex: 12, patternIndex: 0, patternStayCount: 2, completedSets: 44 },
  history: []
});
if (migratedAlpha4.schemaVersion !== 6 || migratedAlpha4.player.rating !== 12345 || migratedAlpha4.online.nickname !== '移行テスト') {
  throw new Error(`alpha.4 to alpha.7 migration mismatch: ${JSON.stringify(migratedAlpha4)}`);
}
if (migratedAlpha4.online.rankingStatus !== 'not_joined' || migratedAlpha4.progress.completedSets !== 44) {
  throw new Error(`alpha.7 online migration defaults mismatch: ${JSON.stringify(migratedAlpha4.online)}`);
}
if (migratedAlpha4.online.certificationStatus !== 'not_started' || migratedAlpha4.online.certificationLevel !== null) {
  throw new Error(`alpha.7 certification migration defaults mismatch: ${JSON.stringify(migratedAlpha4.online)}`);
}
console.log('alpha.4 to alpha.7 state migration passed.');
const notJoinedUi = debug.buildRankingUiModel({ ...rankingBase, rankingStatus: 'not_joined', currentRank: null, verifiedSessionCount: 0 }, true);
if (notJoinedUi.badge !== '未参加' || notJoinedUi.position !== '—位／—位中' || !notJoinedUi.statusText.includes('1セット完了')) {
  throw new Error(`Not-joined ranking UI mismatch: ${JSON.stringify(notJoinedUi)}`);
}
console.log('Not-joined ranking UI case passed.');
