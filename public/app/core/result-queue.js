/* global crypto */
(function installResultQueue(global) {
  'use strict';

  function fallbackId() {
    try { return crypto.randomUUID(); } catch (_) {
      return `queue-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }

  function legacyId(item) {
    if (item?.attemptId) return String(item.attemptId);
    const challengeKey = String(item?.challengeKey || '').trim();
    const completedAt = String(item?.completedAt || '').trim();
    return challengeKey || completedAt ? `${challengeKey}:${completedAt}` : '';
  }

  function create(options = {}) {
    const read = typeof options.getQueue === 'function' ? options.getQueue : () => [];
    const write = typeof options.saveQueue === 'function' ? options.saveQueue : () => {};
    const post = typeof options.post === 'function' ? options.post : async () => {};
    const quarantine = typeof options.quarantine === 'function' ? options.quarantine : () => false;
    let syncPromise = null;

    function normalize() {
      let queue;
      try { queue = read(); } catch (_) { queue = []; }
      if (!Array.isArray(queue)) queue = [];
      let changed = false;
      const normalized = queue.filter(item => item && typeof item === 'object').map(item => {
        if (item.queueId) return item;
        changed = true;
        return {...item, queueId: legacyId(item) || fallbackId()};
      });
      if (changed || normalized.length !== queue.length) write(normalized);
      return normalized;
    }

    function id(item) {
      return item?.queueId || legacyId(item) || fallbackId();
    }

    function enqueue(record) {
      if (!record || typeof record !== 'object') return normalize();
      const queue = normalize();
      const next = {...record, queueId: fallbackId()};
      if (record.mode === 'daily') {
        const index = queue.findIndex(item => item.challengeKey === record.challengeKey);
        if (index < 0) queue.push(next);
        else if (queue[index].puzzleId !== record.puzzleId) queue[index] = next;
      } else {
        const recordId = record.attemptId || `${record.challengeKey || ''}:${record.completedAt || ''}`;
        if (!queue.some(item => (item.attemptId || `${item.challengeKey || ''}:${item.completedAt || ''}`) === recordId)) queue.push(next);
      }
      write(queue);
      return queue;
    }

    function current() { return normalize(); }

    function sync() {
      if (syncPromise) return syncPromise;
      const run = (async () => {
        const snapshot = current();
        const confirmed = new Set();
        const failed = [];
        let sent = 0;
        let quarantined = 0;
        let firstError = null;
        for (const item of snapshot) {
          const itemId = id(item);
          try {
            await post(item);
            confirmed.add(itemId);
            sent++;
          } catch (error) {
            if (Number(error?.status) === 400 && error?.message === 'Neznámá úloha' && quarantine(item, error.message)) {
              confirmed.add(itemId);
              quarantined++;
            } else {
              failed.push(item);
              if (!firstError) firstError = error?.message || 'Synchronizace selhala';
            }
          }
        }
        // Read storage again: enqueue() may have run while the requests above
        // were in flight. Only items from this snapshot may be removed.
        const remaining = current().filter(item => !confirmed.has(id(item)));
        write(remaining);
        const failedKeys = new Set(failed.map(item => item.challengeKey).filter(Boolean));
        remaining.forEach(item => { if (item.challengeKey) failedKeys.add(item.challengeKey); });
        return {
          ok: remaining.length === 0,
          left: remaining.length,
          sent,
          quarantined,
          error: firstError,
          failedKeys: [...failedKeys],
        };
      })();
      syncPromise = run.finally(() => { syncPromise = null; });
      return syncPromise;
    }

    return {enqueue, getQueue: current, sync, isSyncing: () => !!syncPromise};
  }

  const api = {create, legacyId};
  if (global) global.PropletResultQueue = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);
