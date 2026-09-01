/* Execute the shared vectors against function bodies extracted from public/app.js. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '../..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'contracts/domain-golden-v1.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');

function between(name, nextName) {
  const start = appSource.indexOf(`function ${name}(`);
  const end = appSource.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `public/app.js function missing: ${name}`);
  assert.notEqual(end, -1, `public/app.js boundary missing after: ${name}`);
  return appSource.slice(start, end);
}

const storage = new Map();
const context = {
  console,
  Date,
  Set,
  Math,
  Number,
  Object,
  JSON,
  DIFF: {
    easy: {xp: 15}, medium: {xp: 25}, hard: {xp: 50},
    hardcore: {xp: 100}, mozkomor: {xp: 150},
  },
  TAJENKA_REWARD_XP: 200,
  MOZKOMOR_UNLOCK_BASE: 200,
  MOZKOMOR_QA_PREVIEW: false,
  MOZKOMOR_UNLOCK_KEY: 'golden-unlock',
  testToday: '2026-08-30',
  testTajenkaCompleted: false,
  testSlots: {actual: new Set()},
  testRemote: {},
  puzzleDB: null,
  pragueDateISO() { return context.testToday; },
  tajenkaCompletion() { return context.testTajenkaCompleted; },
  localFreeSlotState() { return context.testSlots; },
  getProfile() { return {stats: context.testRemote}; },
  scopedStorageKey(key) { return key; },
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
  },
};
vm.createContext(context);
const runtimeFunctions = [
  between('resultRankTuple', 'betterResult'),
  between('freePuzzleSlot', 'localFreeSlotState'),
  between('dayOffsetISO', 'dailyBankFor'),
  between('challengeKey', 'pointsFor'),
  between('pointsFor', 'savedProgressFor'),
  between('isoShift', 'streakEndingOn'),
  between('streakEndingOn', 'localRescueStatus'),
  between('calcStreak', 'calcLongest'),
  between('calcLongest', 'levelFor'),
  between('localMozkomorBaseDone', 'mozkomorUnlockState'),
  between('mozkomorUnlockState', 'renderQuickPlay'),
].join('\n');
vm.runInContext(`${runtimeFunctions}\nthis.runtime = {resultRankTuple, freePuzzleSlot, challengeKey, pointsFor, streakEndingOn, calcStreak, calcLongest, mozkomorUnlockState};`, context);
const runtime = context.runtime;
const progression=require(path.join(root,'public/app/content/progression.js')).create({
  getPuzzleDB:()=>context.puzzleDB,
  getState:()=>({completed:{}}),
  dayOffsetISO:(...args)=>context.dayOffsetISO(...args),
});
runtime.dailyPuzzleFor=iso=>progression.dailyPuzzleFor(iso);

context.puzzleDB = {
  freeGeneration: 4,
  free: {
    easy: [{id: 'easy-1', meta: {level: 1, contentGeneration: 4}}],
    hardcore: [{id: 'hardcore-1', meta: {level: 1, contentGeneration: 4}}],
    mozkomor: [{id: 'mozkomor-1', meta: {level: 1, contentGeneration: 4}}],
  },
};
for (const vector of fixture.xp) {
  context.testTajenkaCompleted = false;
  context.testSlots = {actual: new Set()};
  const puzzle = {id: vector.puzzleId || 'daily', meta: {rewardXp: vector.rewardXp}};
  assert.equal(runtime.pointsFor(vector.mode, vector.difficulty, puzzle), vector.expected);
}

for (const vector of fixture.challengeKeys) {
  assert.equal(runtime.challengeKey(vector.mode, {id: vector.puzzleId}, vector.dailyDate), vector.expected);
}

for (const vector of fixture.streak) {
  context.testToday = vector.today;
  assert.equal(runtime.calcStreak(vector.dates), vector.current);
  assert.equal(runtime.calcLongest(vector.dates), vector.longest);
}

for (const vector of fixture.unlock) {
  storage.clear();
  context.testRemote = {
    freeBasePlayedCurrent: {hardcore: vector.baseCurrentHardcore},
    mozkomorUnlocked: vector.rows.some(row => row.mode === 'free' && row.difficulty === 'mozkomor'),
  };
  context.testSlots = {actual: new Set()};
  assert.equal(runtime.mozkomorUnlockState().unlocked, vector.expected);
}

assert.deepEqual(
  fixture.rank.map(vector => Array.from(runtime.resultRankTuple(vector.clientRow))),
  fixture.rank.map(vector => vector.expected),
);

for (const vector of fixture.daily) {
  context.puzzleDB = vector.data;
  assert.equal(runtime.dailyPuzzleFor(vector.date).id, vector.expected);
}

context.puzzleDB = fixture.freeSelection.data;
for (const vector of fixture.freeSelection.cases) {
  const resolved = runtime.freePuzzleSlot(vector.id);
  if (vector.expected === null) {
    assert.equal(resolved, null);
  } else {
    const projected = {};
    for (const key of Object.keys(vector.expected)) projected[key] = resolved[key];
    assert.deepEqual(projected, vector.expected);
  }
}

const serverContent = JSON.parse(fs.readFileSync(path.join(root, 'data/puzzles.json'), 'utf8'));
const publicContent = JSON.parse(fs.readFileSync(path.join(root, 'public/puzzles.json'), 'utf8'));
assert.equal(serverContent.daily.length, fixture.contentSources.serverDailyCount);
assert.equal(publicContent.daily.length, fixture.contentSources.publicDailyCount);

console.log('domain golden vectors (actual runtime owners): PASS');
