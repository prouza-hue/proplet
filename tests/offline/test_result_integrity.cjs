#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const {create:queueFactory} = require('../../public/app/core/result-queue.js');

async function queueChecks() {
  // JSON storage models a real cold start: each read returns new objects.
  const data = new Map();
  let now = 1000, active = true, calls = 0;
  const options = {
    now: () => now,
    getQueue: () => JSON.parse(data.get('queue') || '[]'),
    saveQueue: rows => data.set('queue', JSON.stringify(rows)),
    getRetry: () => JSON.parse(data.get('retry') || '{}'),
    saveRetry: value => data.set('retry', JSON.stringify(value)),
    isActive: () => active,
  };
  const record = {mode:'free', puzzleId:'p', challengeKey:'free:p', attemptId:'offline-attempt', completedAt:'2026-10-15T10:00:00Z', timingUnverified:true};
  let queue = queueFactory({...options, post: async () => { calls++; throw Object.assign(new Error('expired session'), {status:401}); }});
  queue.enqueue(record);
  const original = queue.getQueue()[0];
  await queue.sync();
  assert.equal(calls, 1);
  assert.equal(JSON.parse(data.get('retry')).status, 401);

  const received = [];
  queue = queueFactory({...options, post: async row => { calls++; received.push(row); }});
  assert.equal((await queue.sync()).deferred, true, 'expired-session cooldown survives cold start');
  assert.equal(calls, 1);
  assert.equal(queue.resetAuthRetry(), true, 'a new session can release only its auth cooldown');
  assert.equal((await queue.sync()).ok, true);
  assert.deepEqual(received, [original], 'the persistent attempt and trust flag remain unchanged on retry');
  assert.equal(queue.getQueue().length, 0);
  assert.equal(data.get('retry'), '{}');

  // Renewed authentication must never bypass Retry-After for a full queue.
  queue = queueFactory({...options, post: async () => { throw Object.assign(new Error('rate limited'), {status:429, retryAfterMs:3600000}); }});
  queue.enqueue(record);
  await queue.sync();
  assert.equal(queue.resetAuthRetry(), false);
  assert.equal((await queue.sync()).deferred, true);
  now += 3600001;

  // Switching accounts while the first request is in flight stops later
  // records. Confirmed work is removed only from this controller's scope.
  queue.enqueue({...record, puzzleId:'p2', challengeKey:'free:p2', attemptId:'offline-attempt-2'});
  let release, started;
  const waiting = new Promise(resolve => { release = resolve; });
  const begun = new Promise(resolve => { started = resolve; });
  const sent = [];
  queue = queueFactory({...options, post: async row => { sent.push(row.attemptId); started(); await waiting; }});
  const pending = queue.sync();
  await begun;
  active = false;
  release();
  const stale = await pending;
  assert.equal(stale.stale, true);
  assert.deepEqual(sent, ['offline-attempt']);
  assert.deepEqual(queue.getQueue().map(row => row.attemptId), ['offline-attempt-2']);
  assert.equal((await queue.sync()).left, 1);
  assert.equal(sent.length, 1, 'inactive authentication never sends another item');

  active = true;
  let failRequest;
  const inFlight = new Promise((_,reject) => { failRequest=reject; });
  data.set('retry','{}');
  queue = queueFactory({...options, post:()=>inFlight});
  const obsoleteSessionSync=queue.sync();
  // A replacement session's rate limit arrives while the old auth request
  // is still pending. Its eventual 401 must not overwrite the new policy.
  active=false;
  data.set('retry',JSON.stringify({status:429,until:now+3600000,failures:1}));
  failRequest(Object.assign(new Error('expired old session'),{status:401}));
  assert.equal((await obsoleteSessionSync).stale,true);
  assert.equal(JSON.parse(data.get('retry')).status,429);
  console.log('PASS durable offline attempts, auth renewal, rate limits and account-switch isolation');
}

async function fairPlayChecks() {
  const source = fs.readFileSync(path.join(__dirname, '../../public/app/game/fair-play.js'), 'utf8');
  let online = false, calls = 0, status = 0;
  const context = {navigator:{get onLine(){return online;}}, crypto:{randomUUID:()=> 'offline-attempt'}};
  vm.runInNewContext(source, context);
  const controller = context.PropletFairPlay.create({
    owner:'owner', profile:()=>({id:'p'}), elapsed:g=>g.baseElapsedMs||0,
    key:(mode,puzzle)=>`${mode}:${puzzle.id}`, now:()=> 100,
    setInterval:()=>1, clearInterval:()=>{}, status:()=>status++,
    api:async endpoint=>{calls++; return endpoint.endsWith('/config') ? {enabled:true} : {attempt_id:'online-attempt', verified:true, progress:{}};},
  });
  const puzzle = {id:'p',difficulty:'easy'};
  for (const mode of ['free','daily','tajenka']) {
    const result = await controller.prepare(puzzle, mode, null, {elapsedMs:4000,attemptId:'saved'});
    assert.equal(result.restored.timingUnverified, true);
    assert.equal(result.restored.attemptId, 'saved');
    assert.equal(result.fairPlay, false);
  }
  assert.equal(calls, 0, 'a cold offline start never waits for config or a session');
  online = true;
  const resumed = await controller.prepare(puzzle, 'free', null, {timingUnverified:true});
  assert.equal(resumed.restored.timingUnverified, true, 'server success cannot promote an offline local attempt');
  assert.equal(calls, 2);
  online = false;
  const game = {puzzle, mode:'free', fairPlay:true, attemptId:'online-attempt'};
  await controller.send(game, 'pulse');
  await controller.finish(game);
  assert.equal(game.timingUnverified, true);
  assert.equal(calls, 2, 'disconnect and finish do not issue doomed session calls');
  assert.equal(status, 2);
  console.log('PASS cold offline starts, sticky unverified time and offline finish');
}

(async()=>{await queueChecks(); await fairPlayChecks();})().catch(error=>{console.error(error);process.exitCode=1;});
