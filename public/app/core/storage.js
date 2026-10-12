(function installScopedStorage(global) {
  'use strict';

  // Preserve progress at an identity boundary; never add overlapping clocks.
  function mergeProgress(current, incoming) {
    if (!current) return incoming;
    if (!incoming) return current;
    if (current.puzzleId !== incoming.puzzleId || current.mode !== incoming.mode) return current;
    if (current.mode === 'daily_special' && (current.challengeKey !== incoming.challengeKey
      || current.dailyDate !== incoming.dailyDate || current.contentHash !== incoming.contentHash)) return current;
    const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    const preferred = number(incoming.elapsedMs) > number(current.elapsedMs) ? incoming : current;
    const other = preferred === current ? incoming : current;
    const found = [], seen = new Set();
    for (const row of [...(preferred.found || []), ...(other.found || [])]) {
      if (!Number.isInteger(row?.answerIndex) || seen.has(row.answerIndex)) continue;
      seen.add(row.answerIndex); found.push({...row, colorIndex:found.length});
    }
    const merged = {...other, ...preferred, found};
    for (const field of ['elapsedMs','moves','hints','wrongAttempts','maxHintLevel','wordDiscoveryXpAwarded','savedAt']) {
      merged[field] = Math.max(number(current[field]), number(incoming[field]));
    }
    merged.moves = Math.max(merged.moves, found.length + merged.wrongAttempts);
    merged.calmMode = !!(current.calmMode || incoming.calmMode);
    merged.timingUnverified = !!(current.timingUnverified || incoming.timingUnverified);
    merged.cleanSolve = merged.hints === 0 && merged.maxHintLevel === 0;
    // Distinct attempts cannot be proven to represent one uninterrupted run.
    merged.mergedAttempts = !!(current.mergedAttempts || incoming.mergedAttempts ||
      (current.attemptId && incoming.attemptId && current.attemptId !== incoming.attemptId));
    return merged;
  }

  function create(options = {}) {
    const storage = options.storage || global.localStorage;
    const getScope = typeof options.getScope === 'function' ? options.getScope : () => 'guest';
    const blankState = typeof options.blankState === 'function'
      ? options.blankState
      : () => ({completed:{}, rescues:{}, inProgress:{}, dailyDates:[], statsVersion:5});
    const firstResult = typeof options.firstResult === 'function' ? options.firstResult : (current => current);

    function scopedKey(base, scope = getScope()) {
      return `${base}:${scope}`;
    }

    function readState(base, scope = getScope()) {
      try {
        return {...blankState(), ...JSON.parse(storage.getItem(scopedKey(base, scope)) || '{}')};
      } catch (_) {
        return blankState();
      }
    }

    function writeState(base, value, scope = getScope()) {
      storage.setItem(scopedKey(base, scope), JSON.stringify(value));
    }

    function readQueue(base, scope = getScope()) {
      try {
        return JSON.parse(storage.getItem(scopedKey(base, scope)) || '[]');
      } catch (_) {
        return [];
      }
    }

    function writeQueue(base, value, scope = getScope()) {
      storage.setItem(scopedKey(base, scope), JSON.stringify(value));
    }

    function migrateLegacy({marker, stateKey, queueKey, scope = getScope()}) {
      if (storage.getItem(marker)) return;
      const legacyState = storage.getItem(stateKey);
      const legacyQueue = storage.getItem(queueKey);
      if (legacyState && !storage.getItem(scopedKey(stateKey, scope))) {
        storage.setItem(scopedKey(stateKey, scope), legacyState);
      }
      if (legacyQueue && !storage.getItem(scopedKey(queueKey, scope))) {
        storage.setItem(scopedKey(queueKey, scope), legacyQueue);
      }
      storage.setItem(marker, '1');
    }

    function adoptGuest({profileId, stateKey, queueKey, guestScope = 'guest'}) {
      const guestStateKey = scopedKey(stateKey, guestScope);
      const guestQueueKey = scopedKey(queueKey, guestScope);
      const playerStateKey = scopedKey(stateKey, profileId);
      const playerQueueKey = scopedKey(queueKey, profileId);

      try {
        const guest = {...blankState(), ...JSON.parse(storage.getItem(guestStateKey) || '{}')};
        const player = {...blankState(), ...JSON.parse(storage.getItem(playerStateKey) || '{}')};
        for (const [key, result] of Object.entries(guest.completed || {})) {
          const existing = player.completed[key];
          if (existing && (existing.mode === 'daily_special' || result.mode === 'daily_special')
            && (existing.mode !== result.mode || existing.puzzleId !== result.puzzleId
              || existing.dailyDate !== result.dailyDate || existing.contentHash !== result.contentHash)) continue;
          player.completed[key] = player.completed[key] ? firstResult(player.completed[key], result) : result;
        }
        for (const [key, progress] of Object.entries(guest.inProgress || {})) {
          if (!player.completed[key]) player.inProgress[key] = mergeProgress(player.inProgress[key], progress);
        }
        player.rescues = {...(player.rescues || {}), ...(guest.rescues || {})};
        storage.setItem(playerStateKey, JSON.stringify(player));
      } catch (_) { return false; }

      try {
        const guestQueue = JSON.parse(storage.getItem(guestQueueKey) || '[]');
        const playerQueue = JSON.parse(storage.getItem(playerQueueKey) || '[]');
        const identity = row => `${row.mode || ''}:${row.challengeKey || ''}:${row.attemptId || row.completedAt || ''}`;
        const ids = new Set(playerQueue.map(identity));
        for (const row of guestQueue) {
          const id = identity(row);
          if (!ids.has(id)) {
            playerQueue.push(row);
            ids.add(id);
          }
        }
        storage.setItem(playerQueueKey, JSON.stringify(playerQueue));
      } catch (_) { return false; }

      storage.removeItem(guestStateKey);
      storage.removeItem(guestQueueKey);
      return true;
    }

    return {scopedKey, readState, writeState, readQueue, writeQueue, migrateLegacy, adoptGuest};
  }

  const api = {create, mergeProgress};
  if (global) global.PropletScopedStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);
