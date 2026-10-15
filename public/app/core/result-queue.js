/* global crypto */
(function installResultQueue(global) {
  'use strict';

  function fallbackId() {
    try { return crypto.randomUUID(); } catch (_) {
      return `queue-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }

  function legacyId(item) {
    const challengeKey = String(item?.challengeKey || '').trim();
    if (item?.attemptId) return `${item.mode || ''}:${challengeKey}:${item.attemptId}`;
    const completedAt = String(item?.completedAt || '').trim();
    return challengeKey || completedAt ? `${challengeKey}:${completedAt}` : '';
  }

  function create(options = {}) {
    const read = typeof options.getQueue === 'function' ? options.getQueue : () => [];
    const write = typeof options.saveQueue === 'function' ? options.saveQueue : () => {};
    const post = typeof options.post === 'function' ? options.post : async () => {};
    const quarantine = typeof options.quarantine === 'function' ? options.quarantine : () => false;
    const isActive = typeof options.isActive === 'function' ? options.isActive : () => true;
    let syncPromise = null;
    const now = options.now || (() => Date.now());
    const readRetry = options.getRetry || (() => null);
    const writeRetry = options.saveRetry || (() => {});
    let retry = readRetry() || {};

    function normalize() {
      let queue;
      try { queue = read(); } catch (_) { queue = []; }
      if (!Array.isArray(queue)) queue = [];
      let changed = false;
      const seenIds = new Set();
      const normalized = queue.filter(item => item && typeof item === 'object').map(item => {
        if (item.queueId && !seenIds.has(item.queueId)) { seenIds.add(item.queueId); return item; }
        changed = true;
        let queueId = legacyId(item) || fallbackId();
        if (seenIds.has(queueId)) queueId = fallbackId();
        seenIds.add(queueId);
        return {...item, queueId};
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
        const identity = item => `${item.mode || ''}:${item.challengeKey || ''}:${item.attemptId || item.completedAt || ''}`;
        const recordId = identity(record);
        if (!queue.some(item => identity(item) === recordId)) queue.push(next);
      }
      write(queue);
      return queue;
    }

    function current() { return normalize(); }

    // A renewed session should not inherit the wait caused by its expired
    // predecessor. Keep rate-limit/server backoff, and never persist tokens.
    function resetAuthRetry() {
      retry = readRetry() || retry;
      if (Number(retry.status) !== 401) return false;
      retry = {}; writeRetry(retry);
      return true;
    }

    function sync() {
      if (syncPromise) return syncPromise;
      retry = readRetry() || retry;
      if (Number(retry.until) > now()) return Promise.resolve({ok:false,left:current().length,sent:0,deferred:true,retryAt:retry.until,error:'Synchronizace chvíli počká a zkusí to automaticky znovu.'});
      const run = (async () => {
        const snapshot = current();
        const confirmed = new Set();
        const failed = [];
        let sent = 0;
        let quarantined = 0;
        let firstError = null;
        let stale = false;
        for (const item of snapshot) {
          if (!isActive()) { stale = true; break; }
          const itemId = id(item);
          try {
            await post(item);
            confirmed.add(itemId);
            sent++;
            if (isActive()) { retry = {}; writeRetry(retry); }
          } catch (error) {
            // The response belongs to the captured session. Do not let its
            // late 401 overwrite backoff belonging to a renewed session.
            if (!isActive()) { stale = true; break; }
            if (Number(error?.status) === 400 && error?.message === 'Neznámá úloha' && quarantine(item, error.message)) {
              confirmed.add(itemId);
              quarantined++;
            } else {
              failed.push(item);
              if (!firstError) firstError = error?.message || 'Synchronizace selhala';
              if (!error?.status || Number(error.status) === 429 || Number(error.status) >= 500 || Number(error.status) === 401) {
                const failures = Math.min(7, (Number(retry.failures) || 0) + 1);
                const delay = Math.max(Number(error.retryAfterMs) || 0, Math.min(3600000, 60000 * 2 ** (failures - 1)));
                retry = {failures, until:now() + delay, status:Number(error.status) || 0}; writeRetry(retry);
                break;
              }
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
          ...(stale ? {stale:true} : {}),
          error: firstError,
          failedKeys: [...failedKeys],
        };
      })();
      syncPromise = run.finally(() => { syncPromise = null; });
      return syncPromise;
    }

    return {enqueue, getQueue: current, sync, resetAuthRetry, isSyncing: () => !!syncPromise};
  }

  const api = {create, legacyId};
  if (global) global.PropletResultQueue = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis);

