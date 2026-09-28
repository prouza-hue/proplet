'use strict';
const assert = require('node:assert/strict');
const {webcrypto} = require('node:crypto');
const {test} = require('node:test');
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const {create} = require('../../public/app/analytics.js');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
function setup(request) {
  const items = new Map(), calls = [];
  let clock = Date.UTC(2026, 8, 24), scope = 'a:guest', profile = null;
  const storage = {getItem: key => items.get(key), setItem: (key, value) => items.set(key, value)};
  const controller = create({storage, now: () => clock, getScope: () => scope, getProfile: () => profile,
    getHeaders: (_, properties) => ({'X-Proplet-Run': properties?.run || ''}),
    request: (path, options) => {calls.push({path, ...options}); return request?.(calls.length, options);}});
  return {controller, calls, storage, rows: (target = scope) => JSON.parse(items.get(`proplet-events-v2:${target}`) || '[]'),
    advance: ms => {clock += ms;}, setIdentity: (nextScope, nextProfile) => {scope = nextScope; profile = nextProfile;}};
}

test('events appended during an in-flight request drain without another timer or flush', async () => {
  const first = deferred(), env = setup(index => index === 1 ? first.promise : undefined);
  env.controller.track('starter_started', {run: 'first'});
  const flight = env.controller.flush();
  env.controller.track('starter_word_found', {run: 'second'});
  env.controller.trackChallenge('challenge_started', {run: 'third'});
  assert.strictEqual(env.controller.flush(), flight, 'overlapping flush callers share the same drain');
  assert.equal(env.calls.length, 1, 'one request at a time');
  first.resolve();
  await flight;
  assert.deepEqual(env.calls.map(call => JSON.parse(call.body).event_type), ['starter_started', 'starter_word_found', 'challenge_started']);
  assert.deepEqual(env.calls.map(call => call.headers['X-Proplet-Run']), ['first', 'second', 'third']);
  assert.equal(env.calls[2].path, '/api/challenge-event');
  assert.equal(new Set(env.calls.map(call => call.headers['X-Proplet-Event-ID'])).size, 3);
  assert.deepEqual(env.rows(), []);
});

test('transient rejection retains events and obeys server retry backoff', async () => {
  const first = deferred(), env = setup(index => index === 1 ? first.promise : undefined);
  env.controller.track('app_open');
  const flight = env.controller.flush();
  env.controller.track('starter_started');
  first.reject({status: 429, retryAfterMs: 120000});
  await flight;
  assert.equal(env.rows().length, 2);
  const eventId = env.calls[0].headers['X-Proplet-Event-ID'];
  env.advance(60000); await env.controller.flush();
  assert.equal(env.calls.length, 1);
  env.advance(60000); await env.controller.flush();
  assert.equal(env.calls.length, 2);
  assert.equal(env.calls[1].path, '/api/product-events');
  const retried=JSON.parse(env.calls[1].body).events;
  assert.equal(retried.length, 2);
  assert(retried.some(event=>event.id===eventId), 'batch retry preserves idempotency key');
  assert.deepEqual(env.rows(), []);
});

test('permanent 400 discards only rejected ID and continues through newly appended rows', async () => {
  const first = deferred(), env = setup(index => index === 1 ? first.promise : undefined);
  env.controller.track('unsupported');
  const flight = env.controller.flush();
  env.controller.track('app_open');
  first.reject({status: 400});
  await flight;
  assert.equal(env.calls.length, 2);
  assert.deepEqual(env.rows(), []);
});

test('account switch keeps the current drain scope and auth snapshot isolated', async () => {
  const first = deferred(), env = setup(index => index === 1 ? first.promise : undefined);
  const profileA = {id: 'A', token: 'token-A'}, profileB = {id: 'B', token: 'token-B'};
  env.setIdentity('p:A', profileA);
  env.controller.track('app_open');
  const flight = env.controller.flush();
  env.controller.track('starter_started');
  env.setIdentity('p:B', profileB);
  env.controller.track('onboarding_completed');
  first.resolve(); await flight;
  assert.equal(env.calls.length, 2);
  assert(env.calls.every(call => call.authProfile === profileA));
  assert.deepEqual(env.rows('p:A'), []);
  assert.equal(env.rows('p:B').length, 1);
  await env.controller.flush();
  assert.strictEqual(env.calls[2].authProfile, profileB);
  assert.deepEqual(env.rows('p:B'), []);
});

test('guest adoption preserves queued event IDs and sends duplicate IDs once per drain', async () => {
  const env = setup();
  const row = {id: 'same-event', event: 'starter_started', at: Date.UTC(2026, 8, 24), headers: {}};
  env.storage.setItem('proplet-events-v2:a:guest', JSON.stringify([row]));
  env.storage.setItem('proplet-events-v2:p:A', JSON.stringify([row]));
  env.controller.adoptGuest('guest', 'A');
  assert.deepEqual(env.rows('a:guest'), []);
  env.setIdentity('p:A', {id: 'A', token: 'token-A'});
  await env.controller.flush();
  assert.equal(env.calls.length, 1);
  assert.equal(env.calls[0].headers['X-Proplet-Event-ID'], row.id);
  assert.deepEqual(env.rows(), []);
});

test('failed storage removal cannot resend a successful event indefinitely', async () => {
  const env = setup();
  env.storage.setItem('proplet-events-v2:a:guest', JSON.stringify([{id: 'persisted', event: 'app_open', at: Date.UTC(2026, 8, 24)}]));
  env.storage.setItem = () => {throw new Error('Storage blocked');};
  await env.controller.flush();
  assert.equal(env.calls.length, 1);
  assert.equal(env.rows().length, 1);
});

test('a continuous stream of new events yields after a bounded drain', async () => {
  let env;
  env = setup(async index => {await Promise.resolve(); if (index < 250) env.controller.track('starter_word_found');});
  env.controller.track('app_open');
  await env.controller.flush();
  assert(env.calls.length > 1, 'the initial snapshot is not the entire drain');
  assert(env.calls.length <= 100, 'a flush is bounded even when producers keep appending');
  assert.equal(env.rows().length, 1, 'remaining events stay persisted for a later flush');
});
