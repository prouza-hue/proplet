(()=>{
'use strict';

/**
 * Archive-only solution contract for the isolated integrated preview. It accepts an explicit finite set of complete covers; dictionary
 * recognition alone never grants a solution word.
 */
function normalizeWord(value) {
  return String(value || '').normalize('NFC').trim().toUpperCase();
}
function samePath(left, right) {
  return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => Number.isInteger(value) && value === right[index]);
}
function traceKey(trace) {
  return normalizeWord(trace.word) + ':' + trace.path.join(',');
}
function normalizedTrace(trace) {
  if (!trace || !Array.isArray(trace.path) ||
      !trace.path.length || trace.path.some(index => !Number.isInteger(index))) {
    throw new Error('invalid-trace');
  }
  return {word: normalizeWord(trace.word), path: [...trace.path]};
}
function validateCover(puzzle, solution) {
  if (!Array.isArray(solution) || solution.length !== puzzle.answers.length) {
    throw new Error('invalid-target-count');
  }
  const active = new Set(puzzle.mask);
  const used = new Set();
  const words = new Set();
  const normalized = solution.map(normalizedTrace);
  const expectedLengths = puzzle.answers.map(answer => answer.word.length).sort((a, b) => a - b);
  const lengths = normalized.map(answer => answer.word.length).sort((a, b) => a - b);
  if (JSON.stringify(expectedLengths) !== JSON.stringify(lengths)) throw new Error('invalid-lengths');
  for (const answer of normalized) {
    if (!answer.word || answer.path.length !== answer.word.length || words.has(answer.word) ||
        answer.path.map(index => puzzle.letters[index] || '').join('') !== answer.word) {
      throw new Error('invalid-word-path');
    }
    words.add(answer.word);
    for (let index = 0; index < answer.path.length; index++) {
      const cell = answer.path[index];
      if (!active.has(cell) || used.has(cell)) throw new Error('overlapping-cover');
      used.add(cell);
      if (index) {
        const previous = answer.path[index - 1];
        const distance = Math.abs(Math.floor(cell / puzzle.cols) - Math.floor(previous / puzzle.cols)) +
          Math.abs(cell % puzzle.cols - previous % puzzle.cols);
        if (distance !== 1) throw new Error('nonorthogonal-path');
      }
    }
  }
  if (used.size !== active.size) throw new Error('incomplete-cover');
  return normalized;
}
function create(puzzle, entry) {
  if (!puzzle || !entry || entry.puzzleId !== puzzle.id || entry.gameplayScope !== 'archive' ||
      !entry.solutionPolicyRevision || !Array.isArray(entry.solutionSets) || !entry.solutionSets.length) {
    throw new Error('archive-entry-required');
  }
  const solutions = entry.solutionSets.map(solution => validateCover(puzzle, solution));
  if (!solutions[0].every((answer, index) =>
      answer.word === normalizeWord(puzzle.answers[index].word) &&
      samePath(answer.path, puzzle.answers[index].path))) {
    throw new Error('canonical-original-mismatch');
  }
  const revision = entry.solutionPolicyRevision;
  const keys = solutions.map(solution => new Set(solution.map(traceKey)));
  const allWords = new Set(solutions.flat().map(answer => answer.word));

  function emptyState() {
    return {solutionPolicyRevision: revision, found: [], revealed: []};
  }
  function normalizeHint(hint) {
    if (!hint || ![1, 2, 3].includes(hint.level) ||
        !Number.isInteger(hint.targetLength) || hint.targetLength < 4 ||
        !Array.isArray(hint.shownPath) || !hint.shownPath.length ||
        hint.shownPath.some(index => !Number.isInteger(index))) throw new Error('invalid-hint');
    const expected = hint.level === 1 ? 1 : hint.level === 2 ? Math.min(3, hint.targetLength) : hint.targetLength;
    if (hint.shownPath.length !== expected) throw new Error('invalid-hint-prefix');
    const normalized = {level: hint.level, targetLength: hint.targetLength, shownPath: [...hint.shownPath]};
    if (hint.level === 3) {
      normalized.shownWord = normalizeWord(hint.shownWord);
      if (normalized.shownWord.length !== hint.targetLength) throw new Error('invalid-hint-word');
    }
    return normalized;
  }
  function hintMatches(hint, answer) {
    return answer.path.length === hint.targetLength &&
      hint.shownPath.every((cell, index) => answer.path[index] === cell) &&
      (hint.level < 3 || answer.word === hint.shownWord);
  }
  function evaluate(snapshot) {
    try {
      if (!snapshot || snapshot.solutionPolicyRevision !== revision) {
        return {ok: false, reason: 'solution-policy-revision-mismatch'};
      }
      if (!Array.isArray(snapshot.found) || !Array.isArray(snapshot.revealed)) {
        return {ok: false, reason: 'invalid-progress'};
      }
      const found = snapshot.found.map(normalizedTrace);
      const revealed = snapshot.revealed.map(normalizeHint);
      const foundKeys = found.map(traceKey);
      if (new Set(foundKeys).size !== foundKeys.length) {
        return {ok: false, reason: 'duplicate-progress'};
      }
      const compatible = solutions.map((solution, index) => ({solution, index}))
        .filter(({solution, index}) =>
          foundKeys.every(key => keys[index].has(key)) &&
          revealed.every(hint => solution.some(answer => hintMatches(hint, answer))));
      if (!compatible.length) return {ok: false, reason: 'incompatible-progress'};
      const state = {solutionPolicyRevision: revision, found, revealed};
      const completed = compatible.some(({solution, index}) =>
        found.length === solution.length && foundKeys.every(key => keys[index].has(key)));
      return {ok: true, state, solutionIds: compatible.map(item => item.index), completed};
    } catch (error) {
      return {ok: false, reason: error.message || 'invalid-progress'};
    }
  }
  function submit(snapshot, word, path) {
    const before = evaluate(snapshot);
    if (!before.ok) return {accepted: false, reason: before.reason};
    let candidate;
    try { candidate = normalizedTrace({word, path}); }
    catch (error) { return {accepted: false, reason: error.message}; }
    const key = traceKey(candidate);
    if (before.state.found.some(trace => traceKey(trace) === key)) {
      return {accepted: false, reason: 'already-found', state: before.state};
    }
    if (!keys.some(set => set.has(key))) {
      return {accepted: false, reason: 'not-an-approved-solution-trace', state: before.state};
    }
    const after = evaluate({...before.state, found: [...before.state.found, candidate]});
    if (!after.ok) return {accepted: false, reason: 'conflicts-with-selected-solution', state: before.state};
    return {accepted: true, state: after.state, solutionIds: after.solutionIds, completed: after.completed};
  }
  function hint(snapshot, level) {
    const status = evaluate(snapshot);
    if (!status.ok) return {ok: false, reason: status.reason};
    if (![1, 2, 3].includes(level)) return {ok: false, reason: 'invalid-hint-level'};
    const solution = solutions[status.solutionIds[0]];
    const found = new Set(status.state.found.map(traceKey));
    const answer = solution.find(item => !found.has(traceKey(item)));
    if (!answer) return {ok: false, reason: 'already-completed'};
    const revealed = {
      level,
      targetLength: answer.path.length,
      shownPath: answer.path.slice(0, level === 1 ? 1 : level === 2 ? 3 : answer.path.length),
    };
    if (level === 3) revealed.shownWord = answer.word;
    const next = evaluate({...status.state, revealed: [...status.state.revealed, revealed]});
    if (!next.ok) throw new Error('invalid-generated-hint');
    return {ok: true, hint: revealed, state: next.state, solutionIds: next.solutionIds};
  }
  function nextTargets(snapshot) {
    const status = evaluate(snapshot);
    if (!status.ok) return [];
    const found = new Set(status.state.found.map(traceKey));
    return solutions[status.solutionIds[0]].filter(answer => !found.has(traceKey(answer)))
      .map(answer => ({word: answer.word, path: [...answer.path]}));
  }
  return {
    emptyState, evaluate, restore: evaluate, submit, hint, nextTargets,
    isSolutionWord: word => allWords.has(normalizeWord(word)),
    solutionWords: () => [...allWords],
  };
}
window.PropletArchiveSolutions = {create, validateCover};

})();
