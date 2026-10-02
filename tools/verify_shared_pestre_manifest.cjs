'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), zlib = require('node:zlib'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), seed = {window: {}};
vm.runInNewContext(zlib.gunzipSync(fs.readFileSync(path.join(root, 'online-preview/free-refresh-fixtures.js.gz'))).toString(), seed);
const fixtures = seed.window.PROPLET_FREE_REFRESH_FIXTURES;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'online-preview/content/free-order/shared-pestre-preview-v2.json')));
const engine = require('../online-preview/app/content/shared-free-order.js').create(manifest, fixtures.puzzles.free);
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const {contentHash, ...body} = manifest;
assert.equal(hash(body), contentHash);
assert.equal(hash(fixtures.puzzles.free), manifest.sourceBanksSha256);
assert.equal(manifest.bankContentHash, '7048e9bc26c8e7670bab4aad158bb87f73ff1bbf86e6215a7e262d2c3905635e');
assert.equal(manifest.runtimeGeneration, 4);
const checks = [];
for (const [diff, bank] of Object.entries(fixtures.puzzles.free)) {
  const ids = engine.ids(diff), numeric = engine.ids(diff, 'numeric');
  const canonical = [...bank].sort((a, b) => a.meta.level - b.meta.level).map(p => p.id);
  assert.deepEqual([...numeric], canonical);
  assert.equal(ids.length, bank.length);
  assert.deepEqual([...ids].sort(), canonical.slice().sort());
  const before = JSON.stringify(bank);
  // Arbitrary histories only remove completed IDs from a fixed relative order.
  for (let residue = 0; residue < 7; residue++) {
    const done = ids.filter((_, i) => i % 7 === residue);
    const expected = ids.find(id => !done.includes(id));
    assert.equal(engine.next(diff, {completedIds: [...done].reverse()}).id, expected);
    assert.equal(engine.next(diff, {completedIds: [...done, 'retired-id', 'daily-id']}).id, expected);
    const resumeId = ids.findLast(id => !done.includes(id));
    assert.equal(engine.next(diff, {completedIds: done, resumeId}).id, resumeId);
    assert.equal(engine.next(diff, {completedIds: done, resumeId, mode: 'numeric'}).id, resumeId);
  }
  assert.equal(engine.next(diff, {completedIds: ids}), null);
  assert.equal(engine.next(diff, {completedIds: ids, resumeId: ids[0]}), null);
  assert.equal(engine.next(diff, {resumeId: 'retired-id'}).id, ids[0]);
  assert.equal(JSON.stringify(bank), before);
  if (['easy', 'medium', 'hard'].includes(diff)) assert.deepEqual([...ids.slice(0, 100)], [...fixtures.routes[diff].slice(0, 100)]);
  if (['mozkomor', 'mozkokalypsa'].includes(diff)) {
    assert.deepEqual([...ids], canonical);
    assert.equal(engine.supports(diff), false);
  } else assert.equal(engine.supports(diff), true);
  checks.push({difficulty: diff, count: bank.length, first: ids[0], numericFirst: numeric[0], pass: true});
}
assert.throws(() => engine.next('easy', {mode: 'random'}));
assert.throws(() => require('../online-preview/app/content/shared-free-order.js').create({...manifest, routes: {...manifest.routes, easy: manifest.routes.easy.slice(1)}}, fixtures.puzzles.free));
assert.equal(Object.values(manifest.counts).reduce((a, b) => a + b, 0), 1750);
// A future editorial series can enable the dormant mechanism through the manifest.
const future = require('../online-preview/app/content/shared-free-order.js').create({...manifest, variedDifficulties: Object.keys(fixtures.puzzles.free)}, fixtures.puzzles.free);
assert.equal(future.supports('mozkomor'), true);
assert.equal(future.supports('mozkokalypsa'), true);
console.log(JSON.stringify({version: manifest.version, contentHash, checks, all1750IDsUniqueWithinDifficulty: true, originalBankUnchanged: true}, null, 2));
