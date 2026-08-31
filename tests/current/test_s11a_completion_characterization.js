#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const sharing=fs.readFileSync(path.join(root,'public/competitive-sharing-v3331.js'),'utf8');
const quality=fs.readFileSync(path.join(root,'public/quality-v334-core-v40114.js'),'utf8');
const density=fs.readFileSync(path.join(root,'public/copy-density-v3327.js'),'utf8');
const theme=fs.readFileSync(path.join(root,'public/theme-init.js'),'utf8');

function has(source,pattern,label){assert(pattern.test(source),label)}

// Baseline: finishGame owns persistence, queueing, telemetry, win UI and leaderboard scheduling.
has(app,/async function finishGame\(\)/,'finishGame entry missing');
has(app,/saveState\(state\);queueResult\(rec\);g\.finishTelemetryPromise=finishAttemptTelemetry\(rec\)/,'completion persistence order drifted');
has(app,/renderRunWinXp\(g\)/,'win XP render missing');
has(app,/renderWinFeedback\(\);confetti\(\);fx\('win'\);renderDaily\(\);renderFree\(\);renderProfile\(\)/,'win render sequence drifted');
has(app,/syncQueue\(\{announce:false\}\)\.then/,'post-win sync scheduling missing');

// Late layers currently monkey-patch finishGame. Characterize them before replacing that ownership model.
has(sharing,/baseFinishGame=finishGame/,'competitive sharing no longer captures finishGame baseline');
has(sharing,/finishGame=async function\(\)/,'competitive sharing finishGame wrapper missing');
has(sharing,/if\(ctx\)renderChallengeResult\(ctx\)/,'shared challenge post-completion render missing');
has(sharing,/track\('shared_daily_completed'\)/,'shared Daily completion event missing');

has(quality,/if\(typeof finishGame==='function'&&!finishGame\.__calmWrapped\)/,'calm finishGame wrapper missing');
has(quality,/if\(g\?\.calmMode\)applyCalmWin\(g\);applyCalmRunUi\(\)/,'calm post-completion behavior missing');

has(density,/for\(const name of \['finishGame','finishStarterGame','finishRescue','showDailyResult'\]\)/,'copy-density completion wrapper list missing');
has(density,/classList\.remove\('comparison-loaded'\)/,'comparison-loaded reset missing');

// Load ordering is part of the observed wrapper order: quality core is injected before
// theme extras, while copy-density is inserted before competitive-sharing.
has(theme,/loadScript\('\/copy-density-v3327\.js\?v=2'/,'copy-density loader missing');
has(theme,/loadScript\('\/competitive-sharing-v3331\.js\?v=4'/,'competitive-sharing loader missing');
assert(theme.indexOf('/copy-density-v3327.js?v=2')<theme.indexOf('/competitive-sharing-v3331.js?v=4'));

const pipelinePath=path.join(root,'public/app/core/completion-pipeline.js');
if(fs.existsSync(pipelinePath)){
  const pipeline=require(pipelinePath);
  assert.strictEqual(typeof pipeline.create,'function');
}

console.log('PASS: Sprint 11A completion ownership and side-effect order characterized');
