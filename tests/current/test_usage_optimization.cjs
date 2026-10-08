'use strict';
const assert = require('node:assert/strict');
const {webcrypto} = require('node:crypto');
const {test} = require('node:test');
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const {create} = require('../../public/app/analytics.js');
test('a normal event burst persists immediately and sends one delayed batch', async () => {
  const items = new Map(), calls = [];
  let callback, cancelled = 0;
  const tracker = create({
    storage: {getItem: key => items.get(key), setItem: (key, value) => items.set(key, value)},
    getScope: () => 'p:synthetic',
    setTimeout: (fn, delay) => {assert.equal(delay,1000); callback=fn;return 42;},
    clearTimeout: () => {cancelled++;},
    request: async (path, opts) => {calls.push({path, opts});}
  });
  tracker.track('app_open');
  tracker.track('onboarding_started');
  tracker.track('starter_started');
  assert.equal(calls.length,0);
  assert.equal(JSON.parse(items.get('proplet-events-v2:p:synthetic')).length,3);
  callback();
  await tracker.flush();
  assert.equal(calls.length,1);
  assert.equal(calls[0].path,'/api/product-events');
  assert.equal(JSON.parse(calls[0].opts.body).events.length,3);
  tracker.track('starter_word_found');
  await tracker.flush();
  assert.equal(cancelled,1,'explicit lifecycle flush cancels delay');
  assert.equal(calls.length,2);
  assert.deepEqual(JSON.parse(items.get('proplet-events-v2:p:synthetic')),[]);
});

