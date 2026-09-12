'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('public/app.js','utf8');
const source=app.slice(app.indexOf('function canAutomaticallyUpdate('),app.indexOf('function ensureAudio('));
function harness(){
 const timers=new Map(),store=new Map(),events={};let id=0,reloads=0,deletes=0,modal=null,editing=false;
 const ctx={currentScreen:'daily',document:{visibilityState:'visible',activeElement:{matches:()=>editing},addEventListener:()=>{}},navigator:{onLine:true},openTransientModal:()=>modal,
  automaticUpdateTimer:null,automaticUpdateTarget:'',runtimeRecoveryBusy:false,runtimeUpdateRequired:false,pendingSW:null,canonicalUpdateTarget:null,
  serviceWorkerFirstInstallMessagePending:false,releaseProbeBusy:false,lastReleaseProbeAt:0,APP_PREVIEW_RELEASE:'old',APP_VERSION:'1',
  $:()=>({classList:{add:()=>{},remove:()=>{throw Error('Unexpected update banner')}}}),
  sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},
  setTimeout:(fn)=>{timers.set(++id,fn);return id},clearTimeout:i=>timers.delete(i),setInterval:()=>{},
  location:{protocol:'https:',origin:'https://hrajproplet.cz',reload:()=>reloads++},window:{addEventListener:()=>{}},trackProductEvent:()=>{},
  caches:{keys:async()=>['proplet-shell','proplet-data-v11'],delete:async()=>deletes++},
  fetch:async()=>({ok:true,text:async()=>"const SHELL_CACHE='new';",json:async()=>({environment:'production'})})};
 const reg={update:async()=>{},addEventListener:()=>{}};
 ctx.navigator.serviceWorker={controller:{},register:async()=>reg,getRegistration:async()=>reg,addEventListener:(n,f)=>events[n]=f};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,reg,events,store,timers,get reloads(){return reloads},get deletes(){return deletes},set modal(v){modal=v},set editing(v){editing=v},async tick(){const [key,fn]=timers.entries().next().value;timers.delete(key);await fn();for(let i=0;i<20;i++)await Promise.resolve()}};
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
 const loop=harness();loop.store.set('proplet-auto-update-new','1');loop.ctx.scheduleAutomaticUpdate('new');await loop.tick();assert.equal(loop.reloads,0,'same release cannot reload repeatedly');
 const prod=harness();await prod.ctx.probeCanonicalRelease(true);await prod.tick();assert.equal(prod.reloads,1,'production detects shell changes without product version bump');
 const preview=harness();preview.ctx.location.origin='https://preview.example';preview.ctx.fetch=async u=>{assert(u.startsWith('/'));return {ok:true,json:async()=>({environment:'preview'}),text:async()=>"const SHELL_CACHE='new';"}};await preview.ctx.probeCanonicalRelease(true);await preview.tick();assert.equal(preview.reloads,1);
 const fresh=harness();fresh.ctx.serviceWorkerFirstInstallMessagePending=true;assert.equal(fresh.ctx.consumeServiceWorkerUpdateMessage(),false);assert.equal(fresh.ctx.consumeServiceWorkerUpdateMessage(),true);
 const waiting=harness();let notify;waiting.reg.waiting={state:'installed',addEventListener:(_,f)=>notify=f,removeEventListener:()=>{},postMessage:()=>{waiting.reg.waiting.state='activated';notify()}};waiting.ctx.scheduleAutomaticUpdate('new');await waiting.tick();assert.equal(waiting.reloads,1,'waiting worker activates before reload');
 console.log('PASS automatic updates: safe menu reload, deferred gameplay/forms/offline, async race, cache retention, loop guard, production and preview detection, activation handshake');
})().catch(e=>{console.error(e);process.exitCode=1});
