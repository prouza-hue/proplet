#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'sw.js'), 'utf8');
if (source.includes('client.navigate(client.url)')) {
  throw new Error('activation must not navigate all clients');
}

const handlers = {};
let navigations = 0;
const messages = [];
const activeGameClient = {
  url: 'https://hrajproplet.cz/?open=daily',
  localGameState: {found: ['AUTO'], elapsedMs: 42000},
  navigate: async () => { navigations += 1; },
  postMessage: message => { messages.push(message); },
};
const context = {
  console,
  URL,
  fetch: async () => ({ok: true, clone() { return this; }}),
  caches: {
    keys: async () => [],
    open: async () => ({put: async () => {}}),
    match: async () => null,
  },
  self: {
    location: new URL('https://hrajproplet.cz/sw.js'),
    addEventListener: (name, handler) => { handlers[name] = handler; },
    clients: {
      claim: async () => {},
      matchAll: async () => [activeGameClient],
    },
  },
};
vm.createContext(context);
vm.runInContext(source, context, {filename: 'public/sw.js'});

(async () => {
  if (!handlers.activate) throw new Error('activate handler missing');
  let activation;
  handlers.activate({waitUntil: promise => { activation = promise; }});
  await activation;
  if (navigations !== 0) throw new Error(`activation navigated an active game client ${navigations} times`);
  if (messages.length !== 1 || messages[0].type !== 'PROPLET_SW_UPDATED') throw new Error('activation did not announce the update to the client');
  if (activeGameClient.localGameState.found[0] !== 'AUTO') throw new Error('activation mutated the active local game state');
  console.log('PASS: SW activation announces update without reloading active game');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
