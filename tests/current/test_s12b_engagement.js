#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const app = read('public/app.js');
const theme = read('public/theme-init.js');
const index = read('public/index.html');
const sw = read('public/sw.js');
const model = read('public/onboarding-model-v3328.js');
const returning = read('public/onboarding-return-v3332.js');
const starterCopy = read('public/starter-copy-hotfix.js');
const difficulty = read('public/difficulty-nudge.js');
const pushOrigin = read('public/push-origin-v3325.js');
const pushRetention = read('public/push-retention-v3329.js');
const accountBonus = read('public/account-bonus-v3331.js');
const accountConversion = read('public/account-conversion-v3331.js');

function includes(source, needle, label) {
  assert(source.includes(needle), 'Sprint 12B characterization missing: ' + label);
}
function ordered(source, needles, label) {
  let cursor = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1);
    assert(next > cursor, 'Sprint 12B order changed (' + label + '): ' + needle);
    cursor = next;
  }
}

includes(app, 'const ACCOUNT_NUDGE_THRESHOLDS=[1,4,10];', 'account CTA thresholds');
includes(app, "g.mode!=='starter'", 'starter-only hint');
includes(app, 'g.found.length<2', 'starter hint requires two found words');
includes(app, 'if(idle<10000)return', 'starter hint waits ten seconds');
includes(app, "window.addEventListener('beforeinstallprompt'", 'install prompt listener');
includes(app, "window.addEventListener('appinstalled'", 'installed listener');

const continueFlow = app.slice(
  app.indexOf('async function closeWinAndContinue'),
  app.indexOf('function showDailyResult')
);
ordered(continueFlow, [
  "maybeOfferFirstWinReturnNudge('continue')",
  "maybeOfferAccountNudge('continue')",
  "maybeOfferPushNudge('continue')",
  "maybeOfferInstallNudge('continue','daily')",
  "performPostWinAction('continue')"
], 'continue post-win engagement');
ordered(continueFlow, [
  "maybeOfferFirstWinReturnNudge('menu')",
  "maybeOfferAccountNudge('menu')",
  "maybeOfferPushNudge('menu')",
  "maybeOfferInstallNudge('menu','daily')",
  "performPostWinAction('menu')"
], 'menu post-win engagement');

includes(model, 'window.__PROPLET_ONBOARDING_MODEL_V3328__', 'onboarding model install sentinel');
includes(model, "title:'Najdi PES'", 'mandatory PES tutorial');
includes(model, 'ONBOARD_STEPS.splice(0,ONBOARD_STEPS.length,pesStep,principleStep)', 'two-step onboarding model');
includes(model, "trackProductEvent('onboarding_principle_completed')", 'principle completion analytics');
includes(model, "if(launchStarter)startStarter();else nav('daily')", 'starter launch after onboarding');
includes(model, "rememberSupportMode('younger')", 'younger helper default');

includes(returning, 'window.__PROPLET_ONBOARDING_RETURN_V3332__', 'returning-player install sentinel');
includes(returning, 'let observer=null;', 'single returning-player observer owner');
includes(returning, 'let authWatch=null;', 'single auth polling owner');
includes(returning, 'class="onboarding-return-login"', 'returning-player login path');
includes(returning, 'class="onboarding-return-skip"', 'returning-player skip path');

includes(starterCopy, "const FROM='Zkus ČOKOLÁDU';", 'legacy starter copy source');
includes(starterCopy, "const TO='Najdi slovo ČOKOLÁDA';", 'correct starter copy target');
includes(difficulty, 'const WINDOW_SIZE=5;', 'difficulty five-game window');
includes(difficulty, 'const FAST_REQUIRED=4;', 'difficulty four-fast-games threshold');
includes(difficulty, 'const MAX_DECLINES=2;', 'difficulty decline cap');
includes(difficulty, "easy:{target:'medium',thresholdMs:45000}", 'easy threshold');
includes(difficulty, "medium:{target:'hard',thresholdMs:75000}", 'medium threshold');
includes(difficulty, "hard:{target:'hardcore',thresholdMs:120000}", 'hard threshold');
includes(difficulty, "String(getProfile?.()?.id||'guest')", 'profile-scoped difficulty state');
includes(difficulty, 'new MutationObserver(()=>setTimeout(handleWin,0))', 'difficulty win observer');

includes(pushOrigin, "const baseUpdate=typeof updatePushUI==='function'?updatePushUI:null;", 'push origin wrapper');
includes(pushRetention, 'window.__PROPLET_PUSH_RETENTION_V3329__', 'push retention sentinel');
includes(accountBonus, 'window.__PROPLET_ACCOUNT_BONUS_V3331__', 'account bonus sentinel');
includes(accountConversion, 'window.__PROPLET_ACCOUNT_CONVERSION_V3331__', 'account conversion sentinel');

ordered(theme, [
  "/starter-copy-hotfix.js?v=1",
  "/difficulty-nudge.js?v=2",
  "/onboarding-model-v3328.js?v=3"
], 'starter and difficulty patch precedence');
ordered(theme, [
  "/account-bonus-v3331.js?v=2",
  "/account-conversion-v3331.js?v=2",
  "/onboarding-return-v3332.js?v=2"
], 'account and returning-player wrapper precedence');
ordered(index, ['/theme-init.js', '/app.js'], 'legacy bootstrap order');
includes(sw, "'/app.js'", 'offline app shell');
includes(sw, "'/theme-init.js", 'offline theme bootstrap');

const onboardingModule = path.join(root, 'public/app/engagement/onboarding.js');
const nudgesModule = path.join(root, 'public/app/engagement/nudges.js');
assert.strictEqual(
  fs.existsSync(onboardingModule),
  fs.existsSync(nudgesModule),
  'Sprint 12B engagement modules must be installed as one complete slice'
);
if (fs.existsSync(onboardingModule)) {
  for (const modulePath of [onboardingModule, nudgesModule]) {
    const api = require(modulePath);
    assert.strictEqual(typeof api.install, 'function', path.basename(modulePath) + ' must export install()');
  }
}

console.log('PASS: Sprint 12B onboarding and engagement baseline characterized');
