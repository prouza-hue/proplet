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

// Sprint 11A runtime: finishGame owns the pipeline; late layers use explicit hooks.
has(app,/function registerGameCompletionHook\(hook\)/,'completion hook registration facade missing');
has(app,/await runGameCompletionHooks\('before',completion\)/,'before completion phase missing');
has(app,/await runGameCompletionHooks\('after',completion\)/,'after completion phase missing');

has(sharing,/id:'competitive-sharing-v3331'/,'competitive sharing hook missing');
has(sharing,/priority:30/,'competitive sharing hook priority missing');
has(sharing,/sharingCompletionHookInstalled/,'competitive sharing mixed-cache fallback guard missing');
has(sharing,/track\('shared_daily_completed'\)/,'shared Daily completion event missing');

has(quality,/id:'quality-calm-v40114'/,'calm completion hook missing');
has(quality,/priority:20/,'calm hook priority missing');
has(quality,/calmCompletionHookInstalled/,'calm mixed-cache fallback guard missing');
has(quality,/if\(g\?\.calmMode\)applyCalmWin\(g\);applyCalmRunUi\(\)/,'calm post-completion behavior missing');

has(density,/id:'copy-density-v3327'/,'copy-density completion hook missing');
has(density,/priority:10/,'copy-density hook priority missing');
has(density,/name==='finishGame'&&densityCompletionHookInstalled/,'copy-density fallback skip guard missing');
has(density,/classList\.remove\('comparison-loaded'\)/,'comparison-loaded reset missing');

has(theme,/loadScript\('\/copy-density-v3327\.js\?v=2'/,'copy-density loader missing');
has(theme,/loadScript\('\/competitive-sharing-v3331\.js\?v=4'/,'competitive-sharing loader missing');
assert(theme.indexOf('/copy-density-v3327.js?v=2')<theme.indexOf('/competitive-sharing-v3331.js?v=4'));

const pipelinePath=path.join(root,'public/app/core/completion-pipeline.js');
assert(fs.existsSync(pipelinePath),'completion pipeline module missing');
const pipeline=require(pipelinePath);
assert.strictEqual(typeof pipeline.create,'function');
const core=pipeline.create(),order=[];
assert.strictEqual(core.register({id:'late',priority:30,before:()=>order.push('before-late'),after:()=>order.push('after-late')}),true);
assert.strictEqual(core.register({id:'early',priority:10,before:()=>order.push('before-early'),after:()=>order.push('after-early')}),true);
assert.strictEqual(core.register({id:'late',priority:1,before:()=>order.push('duplicate')}),true);
(async()=>{
  const event={game:{mode:'free'},data:{}};
  await core.runBefore(event);
  await core.runAfter(event);
  assert.deepStrictEqual(order,['before-early','before-late','after-early','after-late']);
  assert.deepStrictEqual(core.registeredIds(),['early','late']);
  console.log('PASS: Sprint 11A explicit completion pipeline preserves ownership and hook order');
})().catch(error=>{console.error(error);process.exitCode=1});
