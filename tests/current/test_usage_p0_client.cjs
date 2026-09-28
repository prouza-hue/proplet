'use strict';
const assert = require('node:assert/strict');
const {create} = require('../../public/app/game/fair-play.js');

(async () => {
  let heartbeat = null;
  const controller = create({
    owner: 'synthetic', profile: () => null, elapsed: () => 0,
    key: (mode, puzzle) => `${mode}:${puzzle.id}`, now: () => 0,
    setInterval: (_fn, ms) => {heartbeat = ms; return 1;}, clearInterval: () => {},
    api: async path => path.endsWith('/config')
      ? {enabled: true, heartbeatMs: 25000, leaseMs: 45000}
      : {attempt_id: 'attempt', progress: {}, elapsed_ms: 0, verified: true},
  });
  const prepared = await controller.prepare({id: 'p'}, 'daily', '2026-09-28', null);
  controller.start({puzzle: {id: 'p'}, mode: 'daily', fairPlay: true, attemptId: prepared.restored.attemptId, found: [], pausedAt: null});
  assert.equal(heartbeat, 25000);
  console.log('PASS fair-play controller honors the server heartbeat while preserving the lease margin');
})().catch(error => {console.error(error); process.exitCode = 1;});
