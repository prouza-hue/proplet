'use strict';

function run({helper, manifest, approvals, originalPuzzles, catalog}) {
  let checks = 0;
  function assert(condition, label) {
    checks++;
    if (!condition) throw new Error(label);
  }
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const byId = new Map(originalPuzzles.map(puzzle => [puzzle.id, puzzle]));
  const entries = new Map(manifest.boards.map(entry => [entry.puzzleId, entry]));
  const originalBytes = JSON.stringify(originalPuzzles);
  const xp = {easy: 15, medium: 25, hard: 50, hardcore: 100};
  const contexts = new Map();
  for (const row of catalog.content || []) {
    for (const context of row.contexts || []) {
      if (context.generation === 3 && context.bank === 'free') {
        const list = contexts.get(context.puzzleId) || [];
        list.push({...context, originalContentKey: row.contentKey});
        contexts.set(context.puzzleId, list);
      }
    }
  }

  assert(originalPuzzles.length === 800, 'expected exactly 800 original G3 boards');
  assert(manifest.boards.length === 800, 'all eight hundred Archive entries retained');
  assert(entries.size === 800, 'no duplicate Archive puzzle ids');
  assert(new Set(manifest.boards.map(entry => entry.rewardSlotKey)).size === 800, 'all reward slots unique');
  for (const difficulty of Object.keys(xp)) {
    const selected = manifest.boards.filter(entry => entry.difficulty === difficulty);
    assert(selected.length === 200, 'two hundred entries in ' + difficulty);
    assert(same(selected.map(entry => entry.historicalLevel).sort((a, b) => a - b),
      Array.from({length: 200}, (_, index) => index + 1)), 'all levels one through two hundred reachable in ' + difficulty);
  }
  for (const puzzle of originalPuzzles) {
    const entry = entries.get(puzzle.id);
    const context = contexts.get(puzzle.id) || [];
    assert(!!entry, 'original puzzle remains listed: ' + puzzle.id);
    assert(context.length === 1, 'one exact catalog identity: ' + puzzle.id);
    assert(entry.originalContentKey === context[0].originalContentKey, 'original content identity retained: ' + puzzle.id);
    assert(entry.historicalLevel === puzzle.meta.level && entry.historicalLevel === context[0].slot,
      'original reward level retained: ' + puzzle.id);
    assert(entry.rewardXp === xp[puzzle.difficulty], 'historical difficulty reward: ' + puzzle.id);
    assert(entry.rewardSlotKey === 'legacy-free:' + puzzle.difficulty + ':' + puzzle.meta.level,
      'historical pool key: ' + puzzle.id);
    assert(entry.selection === 'direct-any-order', 'arbitrary board selection: ' + puzzle.id);
    const contract = helper.create(puzzle, approvals.boards[puzzle.id] || {
      puzzleId: puzzle.id, gameplayScope: 'archive',
      solutionPolicyRevision: entry.solutionPolicyRevision,
      solutionSets: [puzzle.answers],
    });
    let state = contract.emptyState();
    for (const answer of puzzle.answers) {
      const result = contract.submit(state, answer.word, answer.path);
      assert(result.accepted, 'canonical answer accepted: ' + puzzle.id + ':' + answer.word);
      state = result.state;
    }
    assert(contract.evaluate(state).completed, 'canonical complete cover accepted: ' + puzzle.id);
    assert(contract.restore(state).completed, 'completed canonical state restored: ' + puzzle.id);
  }

  assert(Object.keys(approvals.boards).length === manifest.summary.approvedAlternativeBoards, 'all explicitly reviewed alternative boards');
  let alternativeRuns = 0;
  for (const [id, entry] of Object.entries(approvals.boards)) {
    const puzzle = byId.get(id);
    const contract = helper.create(puzzle, entry);
    assert(entry.solutionSets.length >= 2, 'explicit complete covers including original: ' + id);
    assert(entry.originalContentKey === entries.get(id).originalContentKey, 'overlay references original content: ' + id);
    for (const solution of entry.solutionSets) {
      for (let order = 0; order < 8; order++) {
        let sequence = solution.slice(order % solution.length).concat(solution.slice(0, order % solution.length));
        if (order % 2) sequence = sequence.reverse();
        let state = contract.emptyState();
        for (let index = 0; index < sequence.length; index++) {
          const answer = sequence[index];
          const next = contract.submit(state, answer.word.toLowerCase(), answer.path);
          assert(next.accepted, 'approved trace accepted in arbitrary order: ' + id);
          if (index < sequence.length - 1) assert(!next.completed, 'partial word count cannot finish: ' + id);
          state = contract.restore(next.state).state;
          assert(!!state, 'approved intermediate state restored: ' + id);
        }
        assert(contract.evaluate(state).completed, 'approved complete cover finishes: ' + id);
        alternativeRuns++;
      }
      for (const answer of solution) {
        assert(contract.isSolutionWord(answer.word.toLowerCase()), 'all alternative target words excluded from discovery: ' + id);
      }
    }
    const answer = entry.solutionSets[1].find((row, index) =>
      row.word !== entry.solutionSets[0][index].word) || entry.solutionSets[1][0];
    const first = contract.submit(contract.emptyState(), answer.word, answer.path);
    assert(first.accepted, 'alternative first word accepted: ' + id);
    const repeated = contract.submit(first.state, answer.word, answer.path);
    assert(!repeated.accepted && repeated.reason === 'already-found', 'duplicate gesture is not a new target: ' + id);
    const bad = contract.submit(contract.emptyState(), answer.word, answer.path.slice().reverse());
    assert(!bad.accepted, 'wrong ordered path rejected: ' + id);
    const stale = {...first.state, solutionPolicyRevision: 'old-revision'};
    assert(!contract.restore(stale).ok, 'unknown solution revision cannot silently restore: ' + id);
    assert(!contract.restore({...first.state, found: [first.state.found[0], first.state.found[0]]}).ok,
      'duplicate saved trace cannot complete: ' + id);
    const hinted = contract.hint(first.state, 3);
    assert(hinted.ok, 'hint after alternative first word exists: ' + id);
    const hintTrace = {word: hinted.hint.shownWord, path: hinted.hint.shownPath};
    assert(contract.submit(hinted.state, hintTrace.word, hintTrace.path).accepted,
      'revealed alternative-compatible target accepted: ' + id);
  }

  const e100 = helper.create(byId.get('g3-e-100'), approvals.boards['g3-e-100']);
  const canonical = approvals.boards['g3-e-100'].solutionSets[0];
  const alternative = approvals.boards['g3-e-100'].solutionSets[1];
  const misa = canonical.find(answer => answer.word === 'MÍSA');
  const ruze = canonical.find(answer => answer.word === 'RŮŽE');
  const sira = alternative.find(answer => answer.word === 'SÍRA');
  const muze = alternative.find(answer => answer.word === 'MŮŽE');
  for (const pair of [[misa, muze], [muze, misa], [ruze, sira], [sira, ruze]]) {
    const first = e100.submit(e100.emptyState(), pair[0].word, pair[0].path);
    assert(first.accepted, 'first trace of mixed e100 pair is valid');
    assert(!e100.submit(first.state, pair[1].word, pair[1].path).accepted, 'mixed e100 cover rejected in both orders');
    assert(!e100.restore({...first.state, found: pair}).ok, 'mixed saved e100 cover rejected in both orders');
  }
  const weakHint = e100.hint(e100.emptyState(), 1);
  assert(weakHint.ok && same(weakHint.hint.shownPath, [2]) && weakHint.hint.targetLength === 4,
    'level one reveals only M at cell two and length four');
  assert(weakHint.solutionIds.length === 2, 'both compatible solutions survive the weak hint');
  const afterMuze = e100.submit(weakHint.state, muze.word, muze.path);
  assert(afterMuze.accepted, 'MUZE remains legal after shared weak hint');
  const resumed = e100.restore(afterMuze.state);
  assert(resumed.ok, 'weak hint and alternative word survive restore');
  const nextHint = e100.hint(resumed.state, 3);
  assert(nextHint.ok && nextHint.hint.shownWord === 'SÍRA', 'next hint stays in the selected alternative cover');
  let state = nextHint.state;
  for (const answer of alternative.filter(answer => answer.word !== 'MŮŽE')) {
    const next = e100.submit(state, answer.word, answer.path);
    assert(next.accepted, 'alternative finishes after weak hint, MUZE, restore and SIRA hint');
    state = next.state;
  }
  assert(e100.evaluate(state).completed, 'hinted alternative reaches exact completed cover');
  const strongerHint = e100.hint(e100.emptyState(), 2);
  assert(strongerHint.ok && strongerHint.solutionIds.length === 1, 'MÍS prefix selects compatible canonical cover');
  assert(!e100.submit(strongerHint.state, muze.word, muze.path).accepted, 'MUZE cannot contradict revealed MIS path');
  const commonFirst = e100.submit(e100.emptyState(), 'NOHA', [12, 13, 14, 15]);
  assert(commonFirst.accepted && commonFirst.solutionIds.length === 2, 'common target preserves both complete covers');
  const noScope = {...approvals.boards['g3-e-100'], gameplayScope: 'free'};
  let scopeRejected = false;
  try { helper.create(byId.get('g3-e-100'), noScope); } catch { scopeRejected = true; }
  assert(scopeRejected, 'helper cannot be called as normal Free policy');
  const altered = JSON.parse(JSON.stringify(approvals.boards['g3-e-100']));
  altered.solutionSets[1][0].path = altered.solutionSets[1][1].path;
  let malformedRejected = false;
  try { helper.create(byId.get('g3-e-100'), altered); } catch { malformedRejected = true; }
  assert(malformedRejected, 'malformed cover rejected before play');
  assert(originalBytes === JSON.stringify(originalPuzzles), 'all original puzzle objects left unchanged');
  return {
    status: 'PASS', checks, originalBoards: originalPuzzles.length, rewardSlots: entries.size,
    explicitlyReviewedAlternativeBoards: Object.keys(approvals.boards).length, arbitraryOrderAlternativeRuns: alternativeRuns,
    mixedSolutionCasesRejected: 4,
    integrationStatus: 'isolated contract only; live input, hints, restore, completion and rewards are not enabled',
  };
}

module.exports = {run};

if (typeof require === 'function' && require.main === module) {
  const fs = require('node:fs');
  const path = require('node:path');
  const zlib = require('node:zlib');
  const crypto = require('node:crypto');
  const root = path.resolve(__dirname, '../..');
  const readJson = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  const manifest = readJson('content/archives/free-gen3-v1/manifest.json');
  const compressed = fs.readFileSync(path.join(root, manifest.originalBank.path));
  const blobSha = crypto.createHash('sha1')
    .update(Buffer.from('blob ' + compressed.length + '\0')).update(compressed).digest('hex');
  if (blobSha !== manifest.originalBank.gitBlobSha) throw new Error('historic bank git blob changed');
  const archive = JSON.parse(zlib.gunzipSync(compressed).toString('utf8'));
  const helper = require('./solution_contract.cjs');
  const result = run({
    helper, manifest, approvals: readJson('content/archives/free-gen3-v1/approved-solutions.json'),
    originalPuzzles: Object.values(archive.free).flat(),
    catalog: readJson(manifest.catalog.path),
  });
  console.log(JSON.stringify(result, null, 2));
}
