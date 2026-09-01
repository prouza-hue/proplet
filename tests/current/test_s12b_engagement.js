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
const onboardingSource = read('public/app/engagement/onboarding.js');
const nudgesSource = read('public/app/engagement/nudges.js');
const onboarding = require(path.join(root, 'public/app/engagement/onboarding.js'));
const nudges = require(path.join(root, 'public/app/engagement/nudges.js'));

function includes(source, needle, label) {
  assert(source.includes(needle), 'Sprint 12B contract missing: ' + label);
}
function ordered(source, needles, label) {
  let cursor = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1);
    assert(next > cursor, 'Sprint 12B order changed (' + label + '): ' + needle);
    cursor = next;
  }
}

assert.strictEqual(typeof onboarding.install, 'function');
assert.strictEqual(typeof onboarding.shouldOfferStarterHint, 'function');
assert.strictEqual(typeof nudges.install, 'function');
assert.strictEqual(typeof nudges.runPostWin, 'function');

const baseGame={mode:'starter',finished:false,starterHintUsed:false,starterHintOfferShown:false,found:['A','B'],dragging:false,start:100,lastProgressAt:100};
assert.strictEqual(onboarding.shouldOfferStarterHint({game:baseGame,now:10099}),false);
assert.strictEqual(onboarding.shouldOfferStarterHint({game:baseGame,now:10100}),true);
assert.strictEqual(onboarding.shouldOfferStarterHint({game:{...baseGame,found:['A']},now:20000}),false);
assert.strictEqual(onboarding.shouldOfferStarterHint({game:{...baseGame,mode:'daily'},now:20000}),false);
assert.strictEqual(onboarding.shouldOfferStarterHint({game:baseGame,now:20000,hidden:true}),false);
assert.strictEqual(onboarding.shouldOfferStarterHint({game:baseGame,now:20000,transientOpen:true}),false);

async function verifyPostWinOrder() {
  const calls=[];
  const deps={
    maybeOfferFirstWinReturnNudge:async action=>{calls.push('return:'+action);return false},
    maybeOfferAccountNudge:action=>{calls.push('account:'+action);return false},
    maybeOfferPushNudge:async action=>{calls.push('push:'+action);return false},
    maybeOfferInstallNudge:(action,source)=>{calls.push('install:'+action+':'+source);return false},
    hideWin:()=>calls.push('hide'),
    performPostWinAction:action=>calls.push('action:'+action),
  };
  assert.strictEqual(await nudges.runPostWin('continue',deps),false);
  assert.deepStrictEqual(calls,['return:continue','account:continue','push:continue','install:continue:daily','hide','action:continue']);

  const stopped=[];
  assert.strictEqual(await nudges.runPostWin('menu',{
    ...deps,
    maybeOfferFirstWinReturnNudge:async()=>{stopped.push('return');return false},
    maybeOfferAccountNudge:()=>{stopped.push('account');return true},
    maybeOfferPushNudge:async()=>{stopped.push('push');return false},
    maybeOfferInstallNudge:()=>{stopped.push('install');return false},
    hideWin:()=>stopped.push('hide'),
    performPostWinAction:()=>stopped.push('action'),
  }),true);
  assert.deepStrictEqual(stopped,['return','account']);
}

includes(onboardingSource, 'window.__PROPLET_ONBOARDING_MODEL_V3328__', 'onboarding model sentinel');
includes(onboardingSource, "title:'Najdi PES'", 'mandatory PES tutorial');
includes(onboardingSource, 'ONBOARD_STEPS.splice(0,ONBOARD_STEPS.length,pesStep,principleStep)', 'two-step onboarding model');
includes(onboardingSource, "rememberSupportMode('younger')", 'younger helper default');
includes(onboardingSource, 'window.__PROPLET_ONBOARDING_RETURN_V3332__', 'returning-player sentinel');
includes(onboardingSource, 'class="onboarding-return-login"', 'returning-player login');
includes(onboardingSource, 'class="onboarding-return-skip"', 'returning-player skip');
includes(onboardingSource, "const TO='Najdi slovo ČOKOLÁDA';", 'starter copy');

includes(nudgesSource, 'const WINDOW_SIZE=5;', 'difficulty five-game window');
includes(nudgesSource, 'const FAST_REQUIRED=4;', 'difficulty four-fast-games threshold');
includes(nudgesSource, 'const MAX_DECLINES=2;', 'difficulty decline cap');
includes(nudgesSource, "easy:{target:'medium',thresholdMs:45000}", 'easy threshold');
includes(nudgesSource, "medium:{target:'hard',thresholdMs:75000}", 'medium threshold');
includes(nudgesSource, "hard:{target:'hardcore',thresholdMs:120000}", 'hard threshold');
includes(nudgesSource, "String(getProfile?.()?.id||'guest')", 'profile-scoped difficulty state');
includes(nudgesSource, 'if(installLifecycleBound', 'single install lifecycle owner');
ordered(nudgesSource, ['maybeOfferFirstWinReturnNudge(action)','maybeOfferAccountNudge(action)','maybeOfferPushNudge(action)',"maybeOfferInstallNudge(action,'daily')",'performPostWinAction(action)'], 'post-win engagement');

includes(app, 'window.PropletEngagementOnboarding', 'onboarding adapter');
includes(app, 'window.PropletEngagementNudges', 'nudges adapter');
assert(!app.includes("window.addEventListener('beforeinstallprompt'"), 'app still owns install listener');
assert(!app.includes("window.addEventListener('appinstalled'"), 'app still owns installed listener');
for(const legacy of ['/starter-copy-hotfix.js','/difficulty-nudge.js','/onboarding-model-v3328.js','/onboarding-return-v3332.js']){
  assert(!theme.includes("loadScript('"+legacy), 'legacy engagement patch still loads: '+legacy);
}
ordered(index, ['/app/engagement/onboarding.js','/app/engagement/nudges.js','/app.js'], 'engagement bootstrap');
includes(sw, '/app/engagement/onboarding.js', 'offline onboarding owner');
includes(sw, '/app/engagement/nudges.js', 'offline nudges owner');

(async()=>{await verifyPostWinOrder();console.log('PASS: Sprint 12B engagement owners preserve onboarding and nudge behavior')})()
  .catch(error=>{console.error(error);process.exitCode=1});
