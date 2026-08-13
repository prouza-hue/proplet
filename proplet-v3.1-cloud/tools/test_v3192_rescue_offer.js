#!/usr/bin/env node
'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const brace = app.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < app.length; i++) {
    if (app[i] === '{') depth++;
    if (app[i] === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

const values = new Map();
const timers = [];
const context = {
  RESCUE_OFFER_KEY: 'rescue-offer',
  rescueStatus: null,
  currentScreen: 'daily',
  modalOpen: false,
  opened: 0,
  scopedStorageKey: key => `${key}:guest`,
  localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  },
  setTimeout: fn => { timers.push(fn); return timers.length; },
  openTransientModal: () => context.modalOpen ? {} : null,
  openRescueOffer: () => { context.opened++; },
};
vm.createContext(context);
vm.runInContext(functionSource('maybeOfferRescue'), context);

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}
function runTimer() {
  const fn = timers.shift();
  if (!fn) throw new Error('Expected a scheduled offer');
  fn();
}

assertEqual(vm.runInContext('maybeOfferRescue()', context), false, 'no rescue does not schedule');
context.rescueStatus = {state: 'available', missedDate: '2026-08-12'};
assertEqual(vm.runInContext('maybeOfferRescue()', context), true, 'eligible rescue schedules offer');
context.modalOpen = true;
runTimer();
assertEqual(context.opened, 0, 'onboarding or another modal is never covered');
assertEqual(values.size, 0, 'blocked offer is not marked as shown');

context.modalOpen = false;
assertEqual(vm.runInContext('maybeOfferRescue()', context), true, 'offer retries after modal closes');
runTimer();
assertEqual(context.opened, 1, 'rescue offer opens');
assertEqual(vm.runInContext('maybeOfferRescue()', context), false, 'same offer appears only once');

context.rescueStatus = {state: 'started', missedDate: '2026-08-12'};
assertEqual(vm.runInContext('maybeOfferRescue()', context), true, 'started rescue gets one resume offer');
runTimer();
assertEqual(context.opened, 2, 'resume offer opens');
context.currentScreen = 'free';
context.rescueStatus = {state: 'available', missedDate: '2026-08-11'};
assertEqual(vm.runInContext('maybeOfferRescue()', context), false, 'offer stays on daily screen');

console.log('PASS: rescue offer is defined, modal-safe and shown once per missed day/state.');
