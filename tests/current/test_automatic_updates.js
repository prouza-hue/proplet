'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('public/app.js','utf8');
const source=app.slice(app.indexOf('function canAutomaticallyUpdate('),app.indexOf('function ensureAudio('));
function harness({store=new Map(),release='old',now=100000}={}){
 const timers=new Map(),events={};let id=0,reloads=0,deletes=0,banners=0,modal=null,editing=false;
 const ctx={currentScreen:'daily',document:{visibilityState:'visible',activeElement:{matches:()=>editing},addEventListener:()=>{}},navigator:{onLine:true},openTransientModal:()=>modal,
  automaticUpdateTimer:null,automaticUpdateTarget:'',runtimeRecoveryBusy:false,runtimeUpdateRequired:false,pendingSW:null,canonicalUpdateTarget:null,
  serviceWorkerFirstInstallMessagePending:false,releaseProbeBusy:false,lastReleaseProbeAt:0,APP_PREVIEW_RELEASE:release,APP_VERSION:'1',Date:{now:()=>now},
  $:()=>({querySelector:()=>({}),classList:{add:()=>{},remove:()=>banners++}}),
  sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  setTimeout:(fn,delay=0)=>{timers.set(++id,{fn,delay});return id},clearTimeout:i=>timers.delete(i),setInterval:()=>{},
  location:{protocol:'https:',origin:'https://hrajproplet.cz',reload:()=>reloads++},window:{addEventListener:()=>{}},trackProductEvent:()=>{},
  caches:{keys:async()=>['proplet-shell','proplet-data-v11'],delete:async()=>deletes++},
  fetch:async()=>({ok:true,text:async()=>"const SHELL_CACHE='new';",json:async()=>({environment:'production'})})};
 const reg={update:async()=>{},addEventListener:()=>{}};
 ctx.navigator.serviceWorker={controller:{},register:async()=>reg,getRegistration:async()=>reg,addEventListener:(n,f)=>events[n]=f};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,reg,events,store,timers,get now(){return now},get reloads(){return reloads},get deletes(){return deletes},get banners(){return banners},set modal(v){modal=v},set editing(v){editing=v},async tick(){const [key,timer]=timers.entries().next().value;timers.delete(key);now+=timer.delay;await timer.fn();for(let i=0;i<20;i++)await Promise.resolve()}};
}
(async()=>{
 const h=harness();h.ctx.showUpdateBanner({});h.ctx.showUpdateBanner({});assert.equal(h.timers.size,1);await h.tick();assert.equal(h.reloads,1);assert.equal(h.deletes,0,'automatic updates retain offline caches');
 for(const block of ['game','hidden','offline','modal','editing']){
  const h=harness();if(block==='game')h.ctx.currentScreen='game';if(block==='hidden')h.ctx.document.visibilityState='hidden';if(block==='offline')h.ctx.navigator.onLine=false;if(block==='modal')h.modal={};if(block==='editing')h.editing=true;
  h.ctx.scheduleAutomaticUpdate('new');await h.tick();assert.equal(h.reloads,0,block);
  h.ctx.currentScreen='daily';h.ctx.document.visibilityState='visible';h.ctx.navigator.onLine=true;h.modal=null;h.editing=false;await h.tick();assert.equal(h.reloads,1,`${block} resumes automatically`);
 }
 const race=harness();race.reg.update=async()=>{race.ctx.currentScreen='game'};race.ctx.scheduleAutomaticUpdate('new');await race.tick();assert.equal(race.reloads,0,'game started while update awaited');assert.equal(race.store.size,0,'deferred update remains retryable');race.ctx.currentScreen='daily';race.reg.update=async()=>{};await race.tick();assert.equal(race.reloads,1);
 const failed=harness();failed.ctx.fetch=async()=>{throw Error('network down')};failed.ctx.scheduleAutomaticUpdate('new');await failed.tick();assert.equal(failed.reloads,0);assert.equal(failed.deletes,0);assert.equal(failed.timers.size,1);
 const missingRelease=harness();missingRelease.ctx.fetch=async()=>({ok:true,text:async()=>'<html>not a worker</html>'});missingRelease.ctx.scheduleAutomaticUpdate();await missingRelease.tick();assert.equal(missingRelease.reloads,0,'missing release cannot cause untracked reloads');assert.equal(missingRelease.store.size,0);
 const legacy=harness();legacy.store.set('proplet-auto-update-new','1');legacy.ctx.scheduleAutomaticUpdate('new');await legacy.tick();assert.equal(legacy.reloads,1,'legacy attempt marker must not permanently suppress recovery');assert.equal(JSON.parse(legacy.store.get('proplet-auto-update-new')).attempts,2);
 const first=harness();first.ctx.scheduleAutomaticUpdate('new');await first.tick();assert.equal(first.reloads,1);assert.equal(JSON.parse(first.store.get('proplet-auto-update-new')).attempts,1);
 const stillOld=harness({store:first.store,now:first.now});stillOld.ctx.scheduleAutomaticUpdate('new');await stillOld.tick();assert.equal(stillOld.reloads,0,'retry is delayed after a stale reload');assert.equal(stillOld.timers.size,1);await stillOld.tick();assert.equal(stillOld.reloads,1,'still-old app retries automatically');assert.equal(JSON.parse(first.store.get('proplet-auto-update-new')).attempts,2);
 const third=harness({store:first.store,now:stillOld.now});third.ctx.scheduleAutomaticUpdate('new');await third.tick();assert.equal(third.reloads,0);await third.tick();assert.equal(third.reloads,1);assert.equal(JSON.parse(first.store.get('proplet-auto-update-new')).attempts,3);
 const exhausted=harness({store:first.store,now:third.now});exhausted.ctx.scheduleAutomaticUpdate('new');await exhausted.tick();assert.equal(exhausted.reloads,0);assert.equal(exhausted.banners,1,'three stale reloads offer manual recovery');assert.equal(exhausted.timers.size,0,'no automatic reload loop');exhausted.ctx.scheduleAutomaticUpdate('new');await exhausted.tick();assert.equal(exhausted.reloads,0,'future probes cannot bypass retry budget');
 const loaded=harness({store:first.store,release:'new'});loaded.ctx.window.PROPLET_RUNTIME_META={version:'new'};assert.equal(loaded.ctx.confirmAutomaticUpdate('other'),false,'fresh metadata does not confirm another app release');assert(first.store.has('proplet-auto-update-new'));loaded.ctx.registerServiceWorker();await Promise.resolve();assert.equal(first.store.has('proplet-auto-update-new'),false,'executing target app confirms success and clears pending attempts');loaded.ctx.scheduleAutomaticUpdate('new');await loaded.tick();assert.equal(loaded.reloads,0,'already-current app does not reload');
 const partial=harness({release:'new'});await partial.ctx.recoverRuntimeUpdate({automatic:true,forceReload:true});assert.equal(partial.reloads,1,'explicit module repair can reload a partial same-release shell');assert.equal(partial.deletes,0,'module repair preserves offline/data caches');
 const unavailable=harness();unavailable.ctx.sessionStorage.setItem=()=>{throw Error('blocked storage')};unavailable.ctx.scheduleAutomaticUpdate('new');await unavailable.tick();assert.equal(unavailable.reloads,0,'no unbounded reloads when retry state cannot persist');assert.equal(unavailable.banners,1);assert.equal(unavailable.deletes,0);
 const changed=harness({store:first.store});changed.store.set('proplet-auto-update-previous',JSON.stringify({attempts:3,nextAttemptAt:999999}));changed.ctx.scheduleAutomaticUpdate('new');await changed.tick();assert.equal(changed.reloads,1,'older target budget does not block a new release');
 const prod=harness();await prod.ctx.probeCanonicalRelease(true);await prod.tick();assert.equal(prod.reloads,1,'production detects shell changes without product version bump');
 const preview=harness();preview.ctx.location.origin='https://preview.example';preview.ctx.fetch=async u=>{assert(u.startsWith('/'));return {ok:true,json:async()=>({environment:'preview'}),text:async()=>"const SHELL_CACHE='new';"}};await preview.ctx.probeCanonicalRelease(true);await preview.tick();assert.equal(preview.reloads,1);
 const fresh=harness();fresh.ctx.serviceWorkerFirstInstallMessagePending=true;assert.equal(fresh.ctx.consumeServiceWorkerUpdateMessage(),false);assert.equal(fresh.ctx.consumeServiceWorkerUpdateMessage(),true);
 const waiting=harness();let notify;waiting.reg.waiting={state:'installed',addEventListener:(_,f)=>notify=f,removeEventListener:()=>{},postMessage:()=>{waiting.reg.waiting.state='activated';notify()}};waiting.ctx.scheduleAutomaticUpdate('new');await waiting.tick();assert.equal(waiting.reloads,1,'waiting worker activates before reload');
 console.log('PASS automatic updates: safe menu reload, deferred gameplay/forms/offline, async race, cache retention, verified app release, stale/legacy retry, backoff, bounded manual fallback, blocked storage, production and preview detection, activation handshake');
})().catch(e=>{console.error(e);process.exitCode=1});
