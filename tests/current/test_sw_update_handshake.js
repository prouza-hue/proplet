#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'app.js'), 'utf8');
const start = source.indexOf('function consumeServiceWorkerUpdateMessage(');
if (start < 0) throw new Error('missing explicit service-worker update state helper');
const brace = source.indexOf('{', start);
let depth = 0;
let end = -1;
for (let index = brace; index < source.length; index += 1) {
  if (source[index] === '{') depth += 1;
  if (source[index] === '}' && --depth === 0) { end = index + 1; break; }
}
if (end < 0) throw new Error('unclosed service-worker update state helper');

const context = {serviceWorkerFirstInstallMessagePending: true, pendingSW: null, runtimeUpdateRequired: false};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
if (vm.runInContext('consumeServiceWorkerUpdateMessage()', context)) throw new Error('first install update message showed a banner');
if (!vm.runInContext('consumeServiceWorkerUpdateMessage()', context)) throw new Error('later real update message was permanently suppressed');

context.serviceWorkerFirstInstallMessagePending = true;
context.pendingSW = {};
if (!vm.runInContext('consumeServiceWorkerUpdateMessage()', context)) throw new Error('pending update was suppressed');
console.log('PASS: first install is quiet and later/pending updates remain actionable');
