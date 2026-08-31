(function installScopedStorage(global) {
  'use strict';

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
          player.completed[key] = player.completed[key] ? firstResult(player.completed[key], result) : result;
        }
        for (const [key, progress] of Object.entries(guest.inProgress || {})) {
          if (!player.completed[key] && !player.inProgress[key]) player.inProgress[key] = progress;
        }
        player.rescues = {...(player.rescues || {}), ...(guest.rescues || {})};
        storage.setItem(playerStateKey, JSON.stringify(player));
      } catch (_) {}

      try {
        const guestQueue = JSON.parse(storage.getItem(guestQueueKey) || '[]');
        const playerQueue = JSON.parse(storage.getItem(playerQueueKey) || '[]');
        const ids = new Set(playerQueue.map(row => row.attemptId || `${row.challengeKey}:${row.completedAt}`));
        for (const row of guestQueue) {
          const id = row.attemptId || `${row.challengeKey}:${row.completedAt}`;
          if (!ids.has(id)) {
            playerQueue.push(row);
            ids.add(id);
          }
        }
        storage.setItem(playerQueueKey, JSON.stringify(playerQueue));
      } catch (_) {}

      storage.removeItem(guestStateKey);
      storage.removeItem(guestQueueKey);
    }

    return {scopedKey, readState, writeState, readQueue, writeQueue, migrateLegacy, adoptGuest};
  }

  const api = {create};
  if (global) global.PropletScopedStorage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);
