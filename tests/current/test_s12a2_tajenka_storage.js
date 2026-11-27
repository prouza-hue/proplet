#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const tajenkaStorage = require(path.resolve(__dirname, '../../public/app/account/tajenka-storage.js'));
const appSource = fs.readFileSync(path.resolve(__dirname, '../../public/app.js'), 'utf8');

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.has(String(key)) ? data.get(String(key)) : null,
    setItem: (key, value) => data.set(String(key), String(value)),
    removeItem: key => data.delete(String(key)),
  };
}

const stateKey = 'tajenka';
const marker = 'tajenka-migrated';
const storage = memoryStorage({
  [stateKey]: JSON.stringify({
    version: 1,
    completions: {legacy: {puzzleId: 'legacy', found: [{answerIndex: 0}]}},
    inProgress: {puzzleId: 'newer-progress', savedAt: 20, found: [{answerIndex: 1}], moves: 2},
  }),
  [`${stateKey}:guest`]: JSON.stringify({
    version: 2,
    completions: {scoped: {puzzleId: 'scoped'}},
    inProgress: {puzzleId: 'older-progress', savedAt: 10},
  }),
});
const core = tajenkaStorage.create({
  storage,
  stateKey,
  marker,
  getScope: () => 'account-a',
  scopedKey: (base, scope) => `${base}:${scope}`,
  rewardXp: 200,
});

assert.strictEqual(core.migrateLegacy('guest'), true);
assert.strictEqual(storage.getItem(stateKey), null, 'legacy global Tajenka state must be removed after a lossless merge');
assert(storage.getItem(marker), 'migration marker missing');
let guest = core.read('guest');
assert.deepStrictEqual(Object.keys(guest.completions).sort(), ['legacy', 'scoped']);
assert.strictEqual(guest.inProgress.puzzleId, 'newer-progress', 'newest progress should survive legacy migration');
assert.deepStrictEqual(Object.keys(guest.progressByPuzzle).sort(), ['newer-progress','older-progress']);
assert.deepStrictEqual(core.read('account-a'), {}, 'legacy global state must never be assigned to the currently signed-in account');

storage.setItem(`${stateKey}:guest`, JSON.stringify({
  completions: {guestDone: {puzzleId: 'guestDone'}},
  progressByPuzzle: {'other-day': {puzzleId: 'other-day', savedAt: 30}},
  inProgress: {puzzleId: 'shared-progress', attemptId: 'guest-attempt', savedAt: 50, found: [{answerIndex: 0}], moves: 3},
}));
storage.setItem(`${stateKey}:account-b`, JSON.stringify({
  completions: {playerDone: {puzzleId: 'playerDone'}},
  inProgress: {puzzleId: 'shared-progress', attemptId: 'account-attempt', savedAt: 40, found: [{answerIndex: 1}], hints: 2},
}));
assert.strictEqual(core.adoptGuest('account-b'), true);
assert.strictEqual(storage.getItem(`${stateKey}:guest`), null, 'guest state must be removed only after adoption');
const accountB = core.read('account-b');
assert.deepStrictEqual(Object.keys(accountB.completions).sort(), ['guestDone', 'playerDone']);
assert.deepStrictEqual(accountB.inProgress.found.map(row => row.answerIndex).sort(), [0, 1]);
assert.strictEqual(accountB.inProgress.moves, 3);
assert.strictEqual(accountB.inProgress.hints, 2);
assert.equal(accountB.progressByPuzzle['other-day'].savedAt, 30);
assert.equal(accountB.progressByPuzzle['shared-progress'].timingUnverified, true);
assert.equal(accountB.progressByPuzzle['shared-progress'].mergedAttempts, true);

core.write({
  inProgress: {puzzleId: 'week-1', savedAt: 1},
  progressByPuzzle: {'week-1': {puzzleId: 'week-1'}, 'week-2': {puzzleId: 'week-2', savedAt: 2}},
}, 'account-a');
core.write({}, 'account-b');
assert.strictEqual(core.mergeRemote([{
  mode: 'tajenka',
  puzzleId: 'week-1',
  challengeKey: 'tajenka:week-1',
  points: 200,
  moves: 5,
  elapsedMs: 60_000,
  completedAt: '2026-08-31T10:00:00Z',
}], 'account-a'), true);
const accountA = core.read('account-a');
assert(accountA.completions['week-1'], 'server completion was not imported to its explicit account scope');
assert.strictEqual(accountA.inProgress, undefined, 'official completion must clear matching local progress');
assert.deepStrictEqual(Object.keys(accountA.progressByPuzzle), ['week-2']);
assert.deepStrictEqual(core.read('account-b'), {}, 'remote account A data leaked into account B');

core.remove('account-a');
assert.deepStrictEqual(core.read('account-a'), {}, 'account deletion did not remove Tajenka state');

assert(appSource.includes("core.migrateLegacy('guest')"), 'legacy Tajenka migration is not pinned to neutral guest scope');
assert(appSource.includes('post:r=>api(\'/api/result\''), 'result queue does not own its account-auth snapshot');
assert(appSource.includes('authProfile:profile'), 'result queue upload does not use the captured account token');
assert(appSource.includes('getQueue:()=>getQueue(scope)'), 'result queue storage is not pinned to the captured account scope');
assert(appSource.includes('quarantineRejectedResult(row,reason,scope)'), 'rejected results are not pinned to the captured account scope');
const boot = appSource.slice(appSource.indexOf('async function boot()'));
assert(boot.indexOf('migrateTajenkaStorage()') < boot.indexOf('await loadPuzzleDatabaseWithRecovery()'), 'legacy Tajenka migration can race the auth callback');

// A different tab can replace the profile while a board still has the old owner.
const oldGame = {mode:'tajenka', tajenkaScope:'account-a', tajenkaEditionsScreen:'free', fairPlay:true};
const events = [];
const staleTab = {
  currentGame:oldGame, currentScreen:'game', playerScope:()=>'account-b',
  fairPlay:()=>({stop:()=>events.push('timing stopped')}), clearTimeout(){},
  $:()=>({classList:{add(){}}}), nav:screen=>events.push(screen), showToast(){},
  tajenkaState(){ throw new Error('Read or wrote into the new account'); },
};
const save = appSource.slice(appSource.indexOf('function saveTajenkaGameProgress('), appSource.indexOf('function clearGameProgress('));
const switched = appSource.slice(appSource.indexOf('function refreshTajenkaPlayer('), appSource.indexOf('function showTajenkaRecap('));
vm.runInNewContext(save + switched + 'saveTajenkaGameProgress(); refreshTajenkaPlayer();', staleTab);
assert.deepStrictEqual(events, ['timing stopped','free']);
assert.strictEqual(oldGame.fairPlay, false);

console.log('PASS: Sprint 12A.2 scopes, migrates, adopts, syncs, and deletes Tajenka state by account');

// Both timelines can offer the same edition ID with different board content.
(async function checkPublishedCalendarCache() {
  const storage = memoryStorage();
  const window = {localStorage: storage};
  const modulePath = path.resolve(__dirname, '../../public/app/content/tajenka-editions.js');
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), {
    window, document: {addEventListener() {}}, navigator: {onLine: true},
  });
  const calendar = window.PropletDailyTajenka;
  const productionKey = 'proplet-published-tajenky-v1';
  const id = 'tajenka-v2-week-40';
  const options = {dailyFrom: '2026-11-27', previewHost: () => false, valid: board => board.id === id};
  const listing = date => ({date, dailyFrom: options.dailyFrom, editions: [{id, week: 40, date: '2026-12-15'}]});
  let finishList, finishBoard;
  calendar.configure({...options, cacheKey: 'preview-2026-12-16', today: () => '2026-12-16',
    fetchRecent: () => new Promise(resolve => { finishList = resolve; }),
    fetchPuzzle: () => new Promise(resolve => { finishBoard = resolve; }),
  });
  const pending = [calendar.list(), calendar.load(id)];
  await Promise.resolve();

  const liveBoard = {id, source: 'published'};
  calendar.configure({...options, today: () => '2026-12-15',
    fetchRecent: () => listing('2026-12-15'), fetchPuzzle: () => liveBoard,
  });
  const live = [calendar.list(), calendar.load(id)];
  await new Promise(resolve => setImmediate(resolve));
  const saved = storage.getItem(productionKey);
  assert.deepStrictEqual(JSON.parse(saved), {boards: [liveBoard], listing: listing('2026-12-15')});

  finishList(listing('2026-12-16'));
  finishBoard({id, source: 'sample'});
  await Promise.all([...pending, ...live]);
  assert.strictEqual(storage.getItem(productionKey), saved, 'late sample requests overwrote the live cache');
  assert.strictEqual(calendar.cached(id).source, 'published');
  console.log('PASS: a late preview listing and board preserve the default published Tajenka cache');
})().catch(error => { console.error(error); process.exitCode = 1; });
