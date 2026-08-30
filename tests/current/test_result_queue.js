#!/usr/bin/env node
'use strict';

// Characterization for the pre-Sprint-01 implementation.  This deliberately
// mirrors the old app.js shape: sync takes a snapshot, awaits the network,
// then writes a whole derived array back to storage.
async function legacySync(getQueue, saveQueue, post) {
  const queue = getQueue();
  const left = [];
  for (const item of queue) {
    try {
      await post(item);
    } catch {
      left.push(item);
    }
  }
  saveQueue(left);
}

async function main() {
  const first = {challengeKey: 'daily:2026-08-30', puzzleId: 'g4-d-1'};
  const duringSync = {challengeKey: 'free:g4-1', puzzleId: 'g4-f-1'};
  let queue = [first];
  let releaseRequest;
  const requestPaused = new Promise(resolve => { releaseRequest = resolve; });
  let requestStarted;
  const started = new Promise(resolve => { requestStarted = resolve; });

  const sync = legacySync(
    () => queue.slice(),
    next => { queue = next; },
    async item => {
      requestStarted(item);
      await requestPaused;
    },
  );
  await started;

  // This is the race: a completion arrives while the old snapshot is in
  // flight. The old saveQueue(left) is allowed to erase it.
  queue.push(duringSync);
  releaseRequest();
  await sync;

  if (queue.length !== 0) {
    throw new Error('legacy race was not reproduced: queue should be erased');
  }
  console.log('PASS: legacy snapshot sync loses an enqueue during the request');

  const {create, legacyId} = require('../../public/app/core/result-queue.js');
  let safeQueue = [first];
  let releaseSafeRequest;
  const safePaused = new Promise(resolve => { releaseSafeRequest = resolve; });
  let safeStarted;
  const safeRequestStarted = new Promise(resolve => { safeStarted = resolve; });
  const safe = create({
    getQueue: () => safeQueue,
    saveQueue: next => { safeQueue = next; },
    post: async item => {
      safeStarted(item);
      await safePaused;
    },
  });
  const firstSync = safe.sync();
  await safeRequestStarted;
  safe.enqueue(duringSync);
  if (firstSync !== safe.sync()) throw new Error('overlapping sync calls were not single-flight');
  releaseSafeRequest();
  const safeResult = await firstSync;
  if (safeResult.left !== 1 || safeQueue[0].queueId === first.queueId || !safeResult.failedKeys.includes(duringSync.challengeKey)) {
    throw new Error('compare/remove removed an enqueue made during sync');
  }
  console.log('PASS: enqueue during sync remains in the current queue');

  const dailyRecord = {...first, mode: 'daily'};
  const sameDaily = {...dailyRecord, queueId: 'same-daily', marker: 'preserve'};
  let dailyQueue = [sameDaily];
  const daily = create({getQueue: () => dailyQueue, saveQueue: next => { dailyQueue = next; }});
  daily.enqueue({...dailyRecord, marker: 'must-not-overwrite'});
  if (dailyQueue.length !== 1 || dailyQueue[0].queueId !== 'same-daily' || dailyQueue[0].marker !== 'preserve') throw new Error('same Daily puzzle was overwritten');
  daily.enqueue({...dailyRecord, puzzleId: 'g4-d-2', marker: 'replacement'});
  if (dailyQueue.length !== 1 || dailyQueue[0].puzzleId !== 'g4-d-2' || dailyQueue[0].marker !== 'replacement') throw new Error('changed Daily puzzle was not replaced');
  console.log('PASS: Daily preserves same puzzle and replaces changed puzzle');

  const sent = [];
  let retryQueue = [{...first, queueId: 'first'}, {...duringSync, queueId: 'second'}];
  let failOnce = true;
  const retry = create({
    getQueue: () => retryQueue,
    saveQueue: next => { retryQueue = next; },
    post: async item => {
      sent.push(item.queueId);
      if (item.queueId === 'second' && failOnce) { failOnce = false; throw new Error('timeout'); }
    },
  });
  const firstResult = await retry.sync();
  if (firstResult.ok || retryQueue.map(item => item.queueId).join() !== 'second') throw new Error('failed item was not retained');
  await retry.sync();
  if (retryQueue.length || sent.join() !== 'first,second,second') throw new Error('retry/FIFO contract failed');
  console.log('PASS: FIFO and retry retain only failed items');

  const quarantined = [];
  let obsoleteQueue = [{...first, queueId: 'obsolete'}];
  const obsolete = create({
    getQueue: () => obsoleteQueue,
    saveQueue: next => { obsoleteQueue = next; },
    post: async () => { const error = new Error('Neznámá úloha'); error.status = 400; throw error; },
    quarantine: item => { quarantined.push(item.queueId); return true; },
  });
  const obsoleteResult = await obsolete.sync();
  if (!obsoleteResult.ok || obsoleteQueue.length || quarantined.join() !== 'obsolete') throw new Error('obsolete result was not quarantined');
  console.log('PASS: only exact obsolete 400 is quarantined');

  let legacyQueue = [{...first}];
  let migratedWrites = 0;
  const legacy = create({
    getQueue: () => legacyQueue,
    saveQueue: next => { legacyQueue = next; migratedWrites++; },
  });
  const migrated = legacy.getQueue();
  if (!migrated[0].queueId || !migratedWrites) throw new Error('legacy queue item was not assigned a stable ID');
  if (legacyId({}) === ':' || legacyId({challengeKey: '  ', completedAt: '  '}) === ':') throw new Error('malformed legacy item received a colliding ID');
  console.log('PASS: legacy queue records are normalized without changing their payload fields');

  let ordinary400Queue = [{...first, queueId: 'ordinary-400'}];
  const ordinary400 = create({
    getQueue: () => ordinary400Queue,
    saveQueue: next => { ordinary400Queue = next; },
    post: async () => { const error = new Error('Jiná chyba'); error.status = 400; throw error; },
    quarantine: () => { throw new Error('non-obsolete 400 was quarantined'); },
  });
  const ordinary400Result = await ordinary400.sync();
  if (ordinary400Result.ok || ordinary400Queue.length !== 1) throw new Error('non-obsolete 400 was removed');
  console.log('PASS: non-obsolete 400 remains retryable');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
