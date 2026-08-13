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

let now = 1000;
const context = {
  performance: {now: () => now},
  document: {visibilityState: 'visible', hasFocus: () => true},
  currentScreen: 'game',
  currentGame: null,
  timerId: 1,
  stopTimer() { context.timerId = null; },
  startTimer() { context.timerId = 2; },
  updateActive() {},
  saveGameProgress() { context.saved = (context.saved || 0) + 1; },
  saveRescueProgress() { context.rescueSaved = (context.rescueSaved || 0) + 1; },
};
vm.createContext(context);
vm.runInContext([
  functionSource('gameElapsed'),
  functionSource('pauseGameClock'),
  functionSource('resumeGameClock'),
].join('\n'), context);

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

context.currentGame = {mode: 'daily', finished: false, start: now, baseElapsedMs: 0, pausedAt: null, path: [1], dragging: true};
now = 5000;
assertEqual(vm.runInContext('gameElapsed()', context), 4000, 'active elapsed');
assertEqual(vm.runInContext("pauseGameClock('hidden')", context), true, 'pause accepted');
assertEqual(context.currentGame.baseElapsedMs, 4000, 'pause snapshots elapsed');
assertEqual(context.currentGame.path.length, 0, 'pause cancels drawn word');
assertEqual(context.saved, 1, 'pause saves ordinary game');

now = 15000;
assertEqual(vm.runInContext('gameElapsed()', context), 4000, 'background time excluded');
assertEqual(vm.runInContext('resumeGameClock()', context), true, 'resume accepted');
now = 17000;
assertEqual(vm.runInContext('gameElapsed()', context), 6000, 'timer continues after resume');

vm.runInContext("pauseGameClock('hidden')", context);
context.document.visibilityState = 'hidden';
assertEqual(vm.runInContext('resumeGameClock()', context), false, 'hidden document cannot resume');
context.document.visibilityState = 'visible';
context.document.hasFocus = () => false;
assertEqual(vm.runInContext('resumeGameClock()', context), false, 'unfocused window cannot resume');
context.document.hasFocus = () => true;
assertEqual(vm.runInContext('resumeGameClock()', context), true, 'focused visible window resumes');

context.currentGame = {mode: 'rescue', finished: false, start: now, baseElapsedMs: 7000, pausedAt: null, path: []};
now += 3000;
assertEqual(vm.runInContext("pauseGameClock('blur')", context), true, 'rescue pause accepted');
now += 20000;
assertEqual(vm.runInContext('gameElapsed()', context), 10000, 'rescue background time excluded');
assertEqual(context.currentGame.rescueElapsedMs, 10000, 'rescue elapsed snapshot');
assertEqual(context.rescueSaved, 1, 'rescue pause is persisted');

if (/Date\.now\(\)-g\.wallStartedAt/.test(app)) throw new Error('Daily still uses wall-clock timing');
if (!app.includes("window.addEventListener('blur',()=>pauseGameClock('blur'))")) throw new Error('Missing blur pause binding');
if (!app.includes("window.addEventListener('focus',resumeGameClock)")) throw new Error('Missing focus resume binding');

console.log('PASS: active gameplay clock pauses while the app is hidden or unfocused.');
