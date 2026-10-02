/* Manufacture one reviewed, history-independent ID sequence per difficulty. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const context = {window: {}};
vm.runInNewContext(zlib.gunzipSync(fs.readFileSync(path.join(root, 'online-preview/free-refresh-fixtures.js.gz'))).toString(), context);
const fixtures = context.window.PROPLET_FREE_REFRESH_FIXTURES;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const numeric = rows => [...rows].sort((a, b) => Number(a.meta.level) - Number(b.meta.level));
const words = p => new Set(p.answers.map(a => a.word.normalize('NFC').toLocaleUpperCase('cs-CZ')));

function mixPublished(rows, preceding = []) {
  const old = numeric(rows.filter(p => !p.id.startsWith('g5-r1-')));
  const modern = numeric(rows.filter(p => p.id.startsWith('g5-r1-')));
  const recent = preceding.slice(-2), result = [];
  while (old.length || modern.length) {
    let pool = result.length % 3 === 0 ? modern : old;
    if (!pool.length) pool = pool === modern ? old : modern;
    const overlap = p => recent.reduce((sum, q, i) => sum + [...words(p)].filter(w => words(q).has(w)).length * (i + 1), 0);
    const candidates = pool.slice(0, 8).map((p, i) => ({p, i, overlap: overlap(p)}));
    candidates.sort((a, b) => a.overlap - b.overlap || a.i - b.i);
    const [next] = pool.splice(candidates[0].i, 1);
    result.push(next); recent.push(next); if (recent.length > 2) recent.shift();
  }
  return result;
}

const routes = {}, catalogRoutes = {}, policies = {};
for (const [diff, rows] of Object.entries(fixtures.puzzles.free)) {
  const catalogue = numeric(rows);
  const fresh = catalogue.filter(p => p.id.startsWith('g6-refresh-'));
  catalogRoutes[diff] = catalogue.map(p => p.id);
  if (fresh.length) {
    // Retain the complete previously delivered fresh sequence and its editorial ordering.
    routes[diff] = [...fresh, ...mixPublished(catalogue.filter(p => !p.id.startsWith('g6-refresh-')), fresh)].map(p => p.id);
    policies[diff] = 'Original Gen6 refresh100 sequence, then shared Gen5/Gen4 mix with two-board word-overlap avoidance.';
  } else if (['mozkomor', 'mozkokalypsa'].includes(diff)) {
    // Pavel: both are single content series; reserve mixed routing for a future series.
    routes[diff] = catalogue.map(p => p.id);
    policies[diff] = diff === 'mozkokalypsa' ? 'Retain approved mk100-v2 relief/main/challenge/summit waves; varied choice dormant until a future content series.' : 'Retain current published order; varied choice dormant until a future content series.';
  } else {
    routes[diff] = mixPublished(catalogue).map(p => p.id);
    policies[diff] = 'Shared Gen5/Gen4 mix with two-board word-overlap avoidance, without player-history input.';
  }
  if (new Set(routes[diff]).size !== rows.length || routes[diff].some(id => !catalogRoutes[diff].includes(id))) throw new Error('Invalid route: ' + diff);
}
const manifest = {
  schemaVersion: 1, version: 'shared-pestre-preview-v2', asOf: '2026-10-02', status: 'preview-only',
  bankContentHash: fixtures.build.bankContentHash, sourceMain: fixtures.build.sourceMain,
  sourceBanksSha256: hash(fixtures.puzzles.free), runtimeGeneration: fixtures.puzzles.freeGeneration,
  variedDifficulties: ['easy', 'medium', 'hard', 'hardcore'],
  counts: Object.fromEntries(Object.entries(routes).map(([d, ids]) => [d, ids.length])), routes, catalogRoutes, policies,
  selectionPriority: ['saved unfinished board in the chosen difficulty', 'first incomplete ID in the selected shared or numeric route'],
  modePolicy: 'Preserve an explicit preview choice and existing pestre-v1 mode. Otherwise demonstrate Pestře in the four mixed-content difficulties. Mozkomor and Mozkokalypsa retain published order and no switch until a future content series; this is not a production default migration.',
  onboarding: 'Retain native first-board-v1 assignment before shared ordering.',
  updatePolicy: 'Only route ID order changes. Bank bodies, ID, level, contentGeneration, saved attempts, results and XP remain untouched. Old pestre-v1 plans remain stored for rollback.',
  productionChanged: false, databaseWrites: false, accountSync: false
};
manifest.contentHash = hash(manifest);
const content = JSON.stringify(manifest, null, 2) + '\n';
const directory = path.join(root, 'online-preview/content/free-order');
fs.mkdirSync(directory, {recursive: true});
fs.writeFileSync(path.join(directory, 'shared-pestre-preview-v2.json'), content);
fs.writeFileSync(path.join(directory, 'shared-pestre-preview-v2.js'), 'window.PROPLET_SHARED_FREE_ORDER_MANIFEST = ' + content.trim() + ';\n');
console.log(JSON.stringify({version: manifest.version, counts: manifest.counts, contentHash: manifest.contentHash, sourceBanksSha256: manifest.sourceBanksSha256}));
