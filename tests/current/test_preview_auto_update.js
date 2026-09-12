'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const app=fs.readFileSync('public/app.js','utf8'),sw=fs.readFileSync('public/sw.js','utf8');
const release=app.match(/APP_PREVIEW_RELEASE='([^']+)'/)[1];
assert.equal(release,sw.match(/SHELL_CACHE='([^']+)'/)[1]);
const fn=app.slice(app.indexOf('async function probeCanonicalRelease('),app.indexOf('function consumeServiceWorkerUpdateMessage('));
async function check(next,screen='daily',visibility='visible',enterGame=false){
 const calls=[],timers=[],updates=[];
 const ctx={APP_PREVIEW_RELEASE:release,releaseProbeBusy:false,lastReleaseProbeAt:0,currentScreen:screen,document:{visibilityState:visibility},runtimeUpdateRequired:false,pendingSW:null,fetch:async u=>{calls.push(u);return {ok:true,json:async()=>({environment:'preview'}),text:async()=>`const SHELL_CACHE='${next}';`}},showUpdateBanner:()=>{},setTimeout:fn=>timers.push(fn),recoverRuntimeUpdate:o=>updates.push(o)};
 vm.createContext(ctx);vm.runInContext(fn,ctx);await ctx.probeCanonicalRelease(true);
 if(enterGame)ctx.currentScreen='game';timers.forEach(f=>f());
 assert(calls.every(u=>u.startsWith('/')),'preview stays on its own origin');
 assert.equal(updates.length,next!==release&&screen!=='game'&&visibility==='visible'&&!enterGame?1:0);
 assert.equal(ctx.runtimeUpdateRequired,next!==release);
}
(async()=>{await check(release);await check(release+'-new');await check(release+'-new','game');await check(release+'-new','daily','hidden');await check(release+'-new','daily','visible',true);console.log('PASS preview update detection, same-origin isolation and gameplay/visibility guards');})();
