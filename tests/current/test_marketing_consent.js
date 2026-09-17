'use strict';
const assert = require('node:assert/strict');
const {create, CONSENT_KEY, EVENTS_KEY} = require('../../public/app/marketing.js');
function fixture(saved, enabled = true) {
  const values = new Map(saved ? [[CONSENT_KEY, JSON.stringify(saved)]] : []);
  const calls = [];
  let time = 1000000000000;
  const storage = {getItem: k => values.get(k), setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k)};
  const controller = create({storage, now: () => time, enabled: () => enabled,
    load: () => calls.push(['load']), send: (...args) => calls.push(args), revoke: () => calls.push(['revoke'])});
  return {controller, values, calls, advance: ms => time += ms};
}
const game = {mode: 'free', puzzle: {id: 'board-1'}, finished: false};
const f = fixture();
f.controller.start(); f.controller.event('GameStarted', game);
assert.deepEqual(f.calls, [], 'No SDK or events before consent');
f.controller.choose('denied'); f.controller.event('GameCompleted', {...game, finished: true});
assert.deepEqual(f.calls, [['revoke']], 'Denial never loads the SDK');
f.controller.choose('granted');
assert.equal(f.calls.filter(x => x[0] === 'PageView').length, 1);
assert.ok(!f.calls.some(x => x[0] === 'GameStarted'), 'No retrospective pre-consent events');
f.controller.event('GameStarted', game); f.controller.event('GameStarted', game);
assert.equal(f.calls.filter(x => x[0] === 'GameStarted').length, 1, 'Resume is deduplicated');
f.controller.event('GameCompleted', game);
assert.ok(!f.calls.some(x => x[0] === 'GameCompleted'), 'An unfinished board is not a conversion');
f.controller.event('GameCompleted', {...game, finished: true, isReplay: true});
assert.ok(!f.calls.some(x => x[0] === 'GameCompleted'), 'A replay is not a conversion');
f.controller.event('GameCompleted', {...game, finished: true});
f.controller.event('GameCompleted', {...game, finished: true});
assert.equal(f.calls.filter(x => x[0] === 'GameCompleted').length, 1);
assert.deepEqual(f.calls.find(x => x[0] === 'GameCompleted')[1], {game_mode: 'free'});
f.controller.event('GameCompleted', {...game, mode: 'starter', finished: true});
assert.equal(f.calls.filter(x => x[0] === 'CompleteTutorial').length, 1);
f.controller.choose('denied'); const revokedCount = f.calls.length;
f.controller.event('GameStarted', {...game, puzzle: {id: 'board-2'}});
assert.equal(f.calls.length, revokedCount, 'Revocation stops all further events');
assert.equal(f.values.has(EVENTS_KEY), false);
f.controller.choose('granted');
assert.equal(f.calls.filter(x => x[0] === 'PageView').length, 1, 'No duplicate PageView on re-grant');
f.advance(181 * 86400000); const expiredCount = f.calls.length;
f.controller.event('GameStarted', game);
assert.equal(f.calls.length, expiredCount, 'Expired consent stops events');
assert.equal(fixture({value: 'granted', at: 0}).controller.status(), null);
assert.equal(fixture({value: 'granted'}).controller.status(), null);
const preview = fixture(null, false); preview.controller.choose('granted'); preview.controller.event('GameStarted', game);
assert.deepEqual(preview.calls, [], 'Preview never loads or sends to Meta');
const corrupt = fixture(); corrupt.controller.choose('granted'); corrupt.values.set(EVENTS_KEY, '{}');
assert.doesNotThrow(() => corrupt.controller.event('GameStarted', game));
const failure = create({storage: {getItem(){throw Error();},setItem(){throw Error();}}, enabled: () => true, load(){throw Error('blocked');},send(){throw Error();},revoke(){throw Error();}});
assert.doesNotThrow(() => {failure.choose('granted'); failure.event('GameStarted', game); failure.choose('denied');});
console.log('PASS marketing consent, event semantics, deduplication, expiry, revocation and blocked SDK');

// Exercise the browser adapter and real hook registration with a synthetic
// pixel identifier; unit tests never download or contact Meta.
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../../public/app/marketing.js'), 'utf8').replace(/const PIXEL_ID = '[^']*';/, "const PIXEL_ID = '12345';");
function browserFixture(url) {
  const scripts = [], hooks = {};
  const win = {location: new URL(url), localStorage: {getItem: key => key === CONSENT_KEY ? JSON.stringify({value: 'granted', at: Date.now()}) : null, setItem(){}},
    document: {head: {appendChild: s => scripts.push(s)}, createElement: () => ({}), querySelectorAll: () => []},
    registerGameSessionHook: h => hooks.start = h, registerGameCompletionHook: h => hooks.complete = h, addEventListener(){}};
  vm.runInNewContext(source, {window: win, URL, Date});
  return {win, scripts, hooks};
}
for (const url of ['http://localhost/', 'https://preview.vercel.app/', 'https://hrajproplet.cz/?token=secret', 'https://hrajproplet.cz/#auth-secret', 'https://hrajproplet.cz/privacy.html']) {
  assert.equal(browserFixture(url).scripts.length, 0, `No SDK for ${url}`);
}
const production = browserFixture('https://hrajproplet.cz/index.html?utm_source=facebook&fbclid=example');
assert.equal(production.scripts.length, 1);
production.hooks.start.afterStart({game});
production.hooks.complete.after({game: {...game, finished: true}});
const queue = production.win.fbq.queue.map(args => Array.from(args));
assert.equal(queue.filter(args => args[0] === 'init').length, 1);
assert.ok(queue.some(args => args[0] === 'trackSingleCustom' && args[2] === 'GameCompleted'));
assert.ok(queue.some(args => args[0] === 'set' && args[1] === 'autoConfig' && args[2] === false));
assert.equal(production.win.fbq.disablePushState, true);
console.log('PASS production URL gating, SDK configuration and actual game hook wiring');
