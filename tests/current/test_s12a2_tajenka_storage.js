#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
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
assert.deepStrictEqual(core.read('account-a'), {}, 'legacy global state must never be assigned to the currently signed-in account');

storage.setItem(`${stateKey}:guest`, JSON.stringify({
  completions: {guestDone: {puzzleId: 'guestDone'}},
  inProgress: {puzzleId: 'shared-progress', savedAt: 50, found: [{answerIndex: 0}], moves: 3},
}));
storage.setItem(`${stateKey}:account-b`, JSON.stringify({
  completions: {playerDone: {puzzleId: 'playerDone'}},
  inProgress: {puzzleId: 'shared-progress', savedAt: 40, found: [{answerIndex: 1}], hints: 2},
}));
assert.strictEqual(core.adoptGuest('account-b'), true);
assert.strictEqual(storage.getItem(`${stateKey}:guest`), null, 'guest state must be removed only after adoption');
const accountB = core.read('account-b');
assert.deepStrictEqual(Object.keys(accountB.completions).sort(), ['guestDone', 'playerDone']);
assert.deepStrictEqual(accountB.inProgress.found.map(row => row.answerIndex).sort(), [0, 1]);
assert.strictEqual(accountB.inProgress.moves, 3);
assert.strictEqual(accountB.inProgress.hints, 2);

core.write({inProgress: {puzzleId: 'week-1', savedAt: 1}}, 'account-a');
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
assert.deepStrictEqual(core.read('account-b'), {}, 'remote account A data leaked into account B');

core.remove('account-a');
assert.deepStrictEqual(core.read('account-a'), {}, 'account deletion did not remove Tajenka state');

assert(appSource.includes("core.migrateLegacy('guest')"), 'legacy Tajenka migration is not pinned to neutral guest scope');
assert(appSource.includes('post:r=>api(\'/api/result\''), 'result queue does not own its account-auth snapshot');
assert(appSource.includes('authProfile:profile'), 'result queue upload does not use the captured account token');
assert(appSource.includes('getQueue:()=>getQueue(scope)'), 'result queue storage is not pinned to the captured account scope');
assert(appSource.includes('quarantineRejectedResult(row,reason,scope)'), 'rejected results are not pinned to the captured account scope');
const boot = appSource.slice(appSource.indexOf('async function boot()'));
assert(boot.indexOf('migrateTajenkaStorage()') < boot.indexOf('await loadPuzzleDatabase()'), 'legacy Tajenka migration can race the auth callback');

console.log('PASS: Sprint 12A.2 scopes, migrates, adopts, syncs, and deletes Tajenka state by account');
