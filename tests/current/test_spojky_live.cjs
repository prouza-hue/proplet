'use strict';
const assert = require('node:assert/strict');

(async () => {
  const { boards } = await import('../../public/design/spojky/boards.js');
  const nativeDate = Date;
  let now = '2026-12-06T22:59:00Z'; // Sunday evening in Prague.
  global.Date = class extends nativeDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return nativeDate.parse(now); }
  };
  const nativeTimeout = setTimeout;
  global.setTimeout = (...args) => nativeTimeout(...args).unref();
  const saved = new Map();
  global.localStorage = {
    get length() { return saved.size; }, key: i => [...saved.keys()][i],
    getItem: k => saved.get(k) ?? null, setItem: (k,v) => saved.set(k,v), removeItem: k => saved.delete(k),
  };
  const nodes = new Map();
  class Node extends EventTarget {
    constructor() { super(); this.dataset = {}; this.classList = {contains: () => false}; }
    querySelector(key) { if (!nodes.has(key)) nodes.set(key, new Node()); return nodes.get(key); }
    setAttribute() {}
  }
  const card = new Node();
  global.document = Object.assign(new EventTarget(), {getElementById: () => card});
  let owner = 'guest';
  global.window = Object.assign(new EventTarget(), {playerScope: () => owner, PROPLET_RUNTIME_META: {environment: 'production'}});
  global.location = {search: '?spojkyReview=2027-01-18'};
  Object.defineProperty(global, 'navigator', {configurable: true, value: {onLine: true}});
  let reply = {available: true, date: '2026-12-06', week: 1, start: '2026-11-27', end: '2026-12-06', nextStart: '2026-12-07', board: boards[0]};
  const requests = [];
  global.fetch = async url => { requests.push(url); return {ok: true, json: async () => reply}; };
  const ready = () => new Promise(resolve => document.addEventListener('proplet:spojky-ready', resolve, {once: true}));
  const loaded = ready();
  await import('../../public/app/game/spojky.js');
  await loaded;
  const play = window.PropletSpojky;
  assert.deepEqual(requests, ['/api/spojky'], 'the production app must never request a future review date');
  assert.equal(play.available(), true);
  assert.equal(card.dataset.state, 'new');

  const { getProgress } = await import('../../public/design/spojky/game.js');
  const board = boards[0];
  // Two real finds on the same board, one before sign-in and one from an existing account.
  const signature = [board.rows.join('/'), ...board.chain, ...board.answers.map(a => a.word)].join('|');
  for (const [scope, i] of [['live.guest', 0], ['live.alena', 1], ['review.guest', 2]]) {
    localStorage.setItem('proplet.spojky.crossings.v1.'+scope+'.'+board.id+'.answer.'+i, JSON.stringify({signature,path:board.answers[i].path}));
  }
  play.adoptGuest('alena'); owner = 'alena'; document.dispatchEvent(new Event('proplet:account-changed'));
  assert.deepEqual(getProgress(board, 'live.alena'), {status:'started', found:2});
  assert.match(card.querySelector('.os-spojky-detail').textContent, /2 ze 3/);
  assert.equal(getProgress(board, 'live.guest').found, 0);
  assert.equal(getProgress(board, 'review.guest').found, 1);
  play.removeAccount(owner);
  assert.equal(getProgress(board, 'live.alena').found, 0);

  navigator.onLine = false;
  now = '2026-12-06T23:00:00Z'; // Midnight on Monday, new edition not cached.
  assert.equal(play.available(), false);
  assert.equal(play.open(), false, 'an old card must not open a retired edition');
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(card.hidden, true);
  assert.equal(play.settled(), true);
  assert.equal(requests.length, 1, 'offline rollover never fetches');
  navigator.onLine = true;
  reply = {available:true,date:'2026-12-07',week:2,start:'2026-12-07',end:'2026-12-13',nextStart:'2026-12-14',board:boards[1]};
  const refreshed = ready(); window.dispatchEvent(new Event('online')); await refreshed;
  assert.equal(card.hidden, false);
  assert.equal(card.dataset.state, 'new');
  assert.equal(play.available(), true);
  assert.equal(requests.length, 2);
  console.log('PASS Spojky preserve account finds and respect the Prague release boundary during offline and online play.');
})().catch(error => { console.error(error); process.exitCode = 1; });
