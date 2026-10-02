(function installTajenkaStorage(global) {
  'use strict';

  function objectState(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function parseState(raw) {
    try { return objectState(JSON.parse(raw || '{}')); } catch (_) { return {}; }
  }

  function completionMap(state) {
    const completions = {...(objectState(state).completions || {})};
    if (state?.completed?.puzzleId && !completions[state.completed.puzzleId]) {
      completions[state.completed.puzzleId] = state.completed;
    }
    return completions;
  }

  function mergeFound(preferred, fallback) {
    const primary = Array.isArray(preferred) ? preferred : [];
    const secondary = Array.isArray(fallback) ? fallback : [];
    if (!primary.length) return secondary;
    if (!secondary.length) return primary;
    const result = [...primary];
    const ids = new Set(primary.map(row => row?.answerIndex).filter(Number.isInteger));
    for (const row of secondary) {
      if (!Number.isInteger(row?.answerIndex) || ids.has(row.answerIndex)) continue;
      result.push(row);
      ids.add(row.answerIndex);
    }
    return result;
  }

  function mergeCompletion(preferred, fallback) {
    if (!preferred) return fallback;
    if (!fallback) return preferred;
    return {...fallback, ...preferred, found: mergeFound(preferred.found, fallback.found)};
  }

  function savedAt(row) {
    const value = Number(row?.savedAt || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function mergeProgress(preferred, fallback, completions) {
    if (preferred?.puzzleId && completions[preferred.puzzleId]) preferred = null;
    if (fallback?.puzzleId && completions[fallback.puzzleId]) fallback = null;
    if (!preferred) return fallback || null;
    if (!fallback) return preferred;
    if (preferred.puzzleId !== fallback.puzzleId) return savedAt(preferred) >= savedAt(fallback) ? preferred : fallback;
    const newer = savedAt(preferred) >= savedAt(fallback) ? preferred : fallback;
    const older = newer === preferred ? fallback : preferred;
    return {
      ...older,
      ...newer,
      found: mergeFound(newer.found, older.found),
      moves: Math.max(Number(preferred.moves) || 0, Number(fallback.moves) || 0),
      hints: Math.max(Number(preferred.hints) || 0, Number(fallback.hints) || 0),
      wrongAttempts: Math.max(Number(preferred.wrongAttempts) || 0, Number(fallback.wrongAttempts) || 0),
      maxHintLevel: Math.max(Number(preferred.maxHintLevel) || 0, Number(fallback.maxHintLevel) || 0),
      elapsedMs: Math.max(Number(preferred.elapsedMs) || 0, Number(fallback.elapsedMs) || 0),
      savedAt: Math.max(savedAt(preferred), savedAt(fallback)),
    };
  }

  function mergeStates(preferredValue, incomingValue) {
    const preferred = objectState(preferredValue);
    const incoming = objectState(incomingValue);
    const completions = completionMap(incoming);
    for (const [puzzleId, completion] of Object.entries(completionMap(preferred))) {
      completions[puzzleId] = mergeCompletion(completion, completions[puzzleId]);
    }
    const result = {...incoming, ...preferred, completions};
    const progress = mergeProgress(preferred.inProgress, incoming.inProgress, completions);
    if (progress) result.inProgress = progress;
    else delete result.inProgress;
    if (!result.completed) result.completed = preferred.completed || incoming.completed;
    result.version = Math.max(Number(preferred.version) || 0, Number(incoming.version) || 0, 2);
    return result;
  }

  function create(options = {}) {
    const storage = options.storage || global?.localStorage;
    const stateKey = options.stateKey || 'proplet-tajenka-test-v1';
    const marker = options.marker || 'proplet-v4-01-40-scoped-tajenka';
    const rewardXp = Number(options.rewardXp) || 200;
    const getScope = typeof options.getScope === 'function' ? options.getScope : () => 'guest';
    const scopedKey = typeof options.scopedKey === 'function'
      ? options.scopedKey
      : (base, scope) => `${base}:${scope}`;

    function key(scope = getScope()) { return scopedKey(stateKey, scope); }
    function read(scope = getScope()) { return parseState(storage?.getItem(key(scope))); }
    function write(state, scope = getScope()) {
      if (storage) storage.setItem(key(scope), JSON.stringify(objectState(state)));
      return state;
    }

    function migrateLegacy(scope = getScope()) {
      if (!storage || storage.getItem(marker)) return false;
      const legacyRaw = storage.getItem(stateKey);
      if (legacyRaw) write(mergeStates(read(scope), parseState(legacyRaw)), scope);
      storage.removeItem(stateKey);
      storage.setItem(marker, '1');
      return !!legacyRaw;
    }

    function adoptGuest(profileId) {
      if (!storage || !profileId) return false;
      const guestRaw = storage.getItem(key('guest'));
      if (!guestRaw) return false;
      write(mergeStates(read(profileId), parseState(guestRaw)), profileId);
      storage.removeItem(key('guest'));
      return true;
    }

    function mergeRemote(rows, scope = getScope()) {
      const remote = (rows || []).filter(row => row?.mode === 'tajenka' && row.puzzleId);
      if (!remote.length) return false;
      const state = read(scope);
      state.completions = completionMap(state);
      for (const row of remote) {
        const old = state.completions[row.puzzleId];
        const points = Number(row.points);
        state.completions[row.puzzleId] = {
          ...row,
          found: Array.isArray(old?.found) ? old.found : [],
          hints: Math.max(0, Number(row.hintsUsed ?? old?.hints) || 0),
          elapsedMs: Math.max(0, Number(row.elapsedMs ?? old?.elapsedMs) || 0),
          moves: Math.max(0, Number(row.moves ?? old?.moves) || 0),
          completedAt: row.completedAt || old?.completedAt || null,
          rewarded: true,
          rewardXp: Math.max(0, Number.isFinite(points) ? points : Number(old?.rewardXp) || rewardXp),
          remote: true,
        };
        if (state.inProgress?.puzzleId === row.puzzleId) delete state.inProgress;
      }
      state.version = Math.max(Number(state.version) || 0, 2);
      write(state, scope);
      return true;
    }

    function remove(scope = getScope()) {
      if (storage) storage.removeItem(key(scope));
    }

    return {key, read, write, migrateLegacy, adoptGuest, mergeRemote, remove, mergeStates};
  }

  const api = {create, mergeStates};
  if (global) global.PropletTajenkaStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);
