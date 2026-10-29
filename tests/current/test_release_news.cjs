'use strict';
const assert=require('node:assert/strict');
const {allowed,delivery,CAMPAIGN,install}=require('../../public/release-news.js');
const {create:createAnnouncements}=require('../../public/app/engagement/announcements.js');
const preview='https://proplet-git-codex-monthly-competi-a7b681-pavel-prouzas-projects.vercel.app/';
function fixture(search='',environment='preview',hostname=preview){
 const events={},frames=[],controls={},elements=[];let screen='daily',playing=false,modal=false,observer,monthly=0;
 const element=tag=>{const node={tag,id:'',attrs:{},events:{},isConnected:true,hidden:false,open:false,innerHTML:'',textContent:'',disabled:false,
  setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this.events[k]=fn;},append(child){elements.push(child);},remove(){this.isConnected=false;},
  closest(){return null;},getClientRects(){return [{}];},focus(){doc.activeElement=this;},showModal(){this.open=true;},close(){this.open=false;}};
  if(tag==='dialog'){for(const key of ['close','play','monthly','title'])controls[key]=element('button');node.querySelector=s=>s==='h2'?controls.title:controls.monthly;node.querySelectorAll=()=>[controls.close,controls.play];}
  return node;
 };
 const body=element('body'),settings=element('div'),feature=element('button');body.classList={contains:()=>playing};
 const doc={body,activeElement:body,createElement:element,addEventListener:(name,fn)=>events[name]=fn,
  querySelector:selector=>{
   if(selector==='.modal:not(.hidden),dialog[open],.quality-modal:not(.hidden)')return modal||elements.find(e=>e.tag==='dialog'&&e.isConnected&&e.open)||null;
   if(selector==='#screen-daily.active')return screen==='daily'?{}:null;
   if(selector==='#profileSettingsHeader .profile-settings-heading')return settings;
   if(selector==='#oneScreenToday .os-feature')return feature;
   return elements.find(e=>e.isConnected&&'#'+e.id===selector)||null;
  }};
 const win={document:doc,location:{href:hostname+search},PROPLET_RUNTIME_ENV:environment,requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},MutationObserver:class{constructor(cb){observer=cb;}observe(){}},
  nav:value=>{screen=value;events['proplet:screen-changed']?.({detail:{screen:value}});},
  PropletMonthlyCompetition:{open(){monthly++;screen='monthly';}},fetch(){assert.fail('announcement must not send requests');},api(){assert.fail('announcement must not save receipts');}};
 Object.defineProperty(win,'localStorage',{get(){assert.fail('preview must not persist campaign receipts');}});
 const flush=()=>{while(frames.length)frames.shift()();};
 return {win,doc,elements,controls,feature,flush,events,get screen(){return screen;},get monthly(){return monthly;},get dialog(){return elements.find(e=>e.tag==='dialog'&&e.isConnected);},
  ready(){events['proplet:ready']?.();flush();},playing(value){playing=value;observer?.([{target:body}]);flush();},modal(value){modal=value;observer?.([{target:body}]);flush();}};
}
for(const href of ['https://hrajproplet.cz/','https://www.hrajproplet.cz/','https://other.hrajproplet.cz/','https://proplet-git-main-pavel-prouzas-projects.vercel.app/'])assert(!allowed(href,'preview'));
assert(!allowed(preview,'production'));assert(allowed(preview,'preview'));
for(const [env,host] of [['production',preview],['preview','https://hrajproplet.cz/']]){const f=fixture('?showNews=1',env,host);install(f.win);f.ready();assert.equal(f.elements.length,0);assert.equal(f.win.PropletReleaseNews.open(),false);}
const plain=fixture();install(plain.win);plain.ready();assert.equal(plain.dialog,undefined,'ordinary preview visit has no unsolicited announcement');
const f=fixture('?showNews=1');let manualEntry;f.win.getProfile=()=>({id:'reviewer',token:'review-session'});f.win.PropletAnnouncements={register:entry=>{manualEntry=entry;},kick(){}};install(f.win);assert.equal(f.dialog,undefined,'explicit request waits for native readiness');
f.playing(true);f.ready();assert.equal(f.dialog,undefined,'must not interrupt a game');f.modal(true);f.playing(false);assert.equal(f.dialog,undefined,'must wait for onboarding or other native modal');
f.modal(false);assert(f.dialog.open);assert.equal(f.doc.activeElement,f.controls.title);assert.equal(f.dialog.attrs['aria-labelledby'],'releaseNewsTitle');
assert(f.dialog.innerHTML.includes('id="releaseNewsTitle" tabindex="-1"'));assert(f.dialog.innerHTML.includes('Každý měsíc nová soutěž o&nbsp;vládce Propletu.'));
assert(!f.dialog.innerHTML.includes('Méně hledání, víc hraní.'));assert(f.dialog.innerHTML.includes('čistším designu'));assert(f.dialog.innerHTML.includes('nejlepších 20&nbsp;dnů — rychlost nerozhoduje.'));assert(f.dialog.innerHTML.includes('/assets/navigation/competitions-v1.webp'));
f.dialog.events.cancel({preventDefault(){}});assert.equal(f.dialog.open,false);assert.equal(f.screen,'daily');assert.equal(f.doc.activeElement,f.feature,'Escape returns focus to the visible Today action');
f.modal(false);assert.equal(f.dialog.open,false,'reconciliation cannot reopen a dismissed explicit request');
assert.equal(manualEntry.eligible({account:'reviewer'}),false,'explicit visual review never becomes an automatic claim after closing');
const settings=f.elements.find(e=>e.id==='releaseNewsSettings');f.win.nav('profile');settings.getClientRects=()=>f.screen==='profile'?[{}]:[];settings.focus();settings.onclick();assert(f.dialog.open);assert.equal(f.screen,'daily','manual Settings entry also leaves closing on Today');
f.controls.play.onclick();assert.equal(f.dialog.open,false);assert.equal(f.screen,'daily');assert.equal(f.monthly,0,'Jdu hrát never starts a board or changes progress');
settings.onclick();f.controls.monthly.onclick();assert.equal(f.monthly,1,'primary delegates to the real monthly opener exactly once');assert.equal(f.screen,'monthly');assert.equal(f.dialog.open,false);
const away=fixture('?showNews=1');install(away.win);away.win.nav('free');away.ready();assert.equal(away.dialog,undefined);away.win.nav('daily');away.flush();assert(away.dialog.open,'pending explicit request appears only after reaching Today');
console.log('PASS release news: production denied, no unsolicited display/storage/transport, readiness/game/modal guards, native monthly action, Settings reopen, Escape and focus restore');

// The subscriber must exist before app boot can emit proplet:ready.
{const html=require("node:fs").readFileSync(require("node:path").join(__dirname,"../../public/index.html"),"utf8");require("node:assert/strict")(html.indexOf('/release-news.js?')<html.indexOf('/app.js?'),"announcement must subscribe before app boot");}

const tick=()=>new Promise(setImmediate);
const status=(extra={})=>({campaignId:CAMPAIGN,enabled:true,eligible:true,canShowAutomatically:true,...extra});
function automaticFixture(){
 let player={id:'A',token:'session-A'},online=true,time=1000,opened=0;
 const requests=[],context={ready:true,account:'A',authenticated:true,completed:5,onboarded:true,quiet:false,blocked:false,hidden:false,incoming:false,screen:'daily'};
 const controller=delivery({getProfile:()=>player,online:()=>online,now:()=>time,request:(path,options)=>new Promise((resolve,reject)=>requests.push({path,options,resolve,reject}))});
 const queue=createAnnouncements({context:()=>context});
 queue.register({id:CAMPAIGN,priority:120,eligible:c=>c.screen==='daily'&&controller.canOffer(c.account),show:permit=>controller.show(permit,()=>{opened++;context.blocked=true;return true;})});
 return {controller,queue,context,requests,get opened(){return opened;},account(id,token){player={id,token};context.account=id;controller.sync();},setOnline:value=>online=value,advance:ms=>time+=ms};
}
(async()=>{
 const a=automaticFixture();a.context.blocked=true;await a.queue.kick();assert.equal(a.requests.length,0,'no claim/status request while a result/onboarding/nudge owns the modal queue');
 a.context.blocked=false;a.context.quiet=true;await a.queue.kick();assert.equal(a.requests.length,0);a.context.quiet=false;
 const show=a.queue.kick();assert.equal(a.requests[0].path,'/api/release-news');assert.equal(a.requests[0].options.authProfile.id,'A');
 a.requests[0].resolve(status());await tick();assert.equal(a.requests[1].path,'/api/release-news/claim');assert.equal(a.requests[1].options.method,'POST');assert.equal(a.requests[1].options.body,undefined,'server owns player and campaign, never the client body');
 a.requests[1].resolve(status({canShowAutomatically:false,displayGranted:true}));assert.equal(await show,true);assert.equal(a.opened,1);assert(a.queue.sessionUsed());a.context.blocked=false;await a.queue.kick();assert.equal(a.opened,1);

 const raced=automaticFixture(),pending=raced.queue.kick();raced.requests[0].resolve(status());await tick();raced.context.screen='free';raced.requests[1].resolve(status({canShowAutomatically:false,displayGranted:true}));assert.equal(await pending,false);assert.equal(raced.opened,0,'navigation during claim never opens late on another screen');assert(!raced.queue.sessionUsed(),'undisplayed grant does not manufacture a local session display');
 assert.equal(raced.controller.snapshot().state.canShowAutomatically,false,'atomic server receipt remains authoritative after the navigation race');

 const switched=automaticFixture(),old=switched.queue.kick();switched.requests[0].resolve(status());await tick();switched.account('A','renewed-session');switched.requests[1].resolve(status({displayGranted:true,canShowAutomatically:false}));assert.equal(await old,false);assert.equal(switched.opened,0);assert.equal(switched.controller.snapshot().state,null,'same ID but changed token rejects old claim response');
 const staleGet=automaticFixture(),oldGet=staleGet.queue.kick();staleGet.account('B','session-B');staleGet.requests[0].resolve(status());assert.equal(await oldGet,false);assert.equal(staleGet.requests.length,1,'old account status cannot trigger a claim for the new account');

 const elsewhere=automaticFixture(),alreadySeen=elsewhere.queue.kick();elsewhere.requests[0].resolve(status());await tick();elsewhere.requests[1].resolve(status({displayGranted:false,canShowAutomatically:false}));assert.equal(await alreadySeen,false);assert.equal(elsewhere.opened,0,'other-device winner prevents this tab from showing');
 for(const response of [status({enabled:false,eligible:false,canShowAutomatically:false}),status({eligible:false,canShowAutomatically:false}),status({canShowAutomatically:false})]){
  const f=automaticFixture(),run=f.queue.kick();f.requests[0].resolve(response);assert.equal(await run,false);assert.equal(f.requests.length,1,'disabled/new/seen status never posts a claim');
 }
 const offline=automaticFixture();offline.setOnline(false);await offline.queue.kick();assert.equal(offline.requests.length,0,'offline creates no receipt');offline.setOnline(true);
 const failure=offline.queue.kick();offline.requests[0].reject(Error('offline'));assert.equal(await failure,false);await offline.queue.kick();assert.equal(offline.requests.length,1,'failure backs off instead of polling');
 const retry=offline.controller.load(true);offline.requests[1].resolve(status());await retry;const afterOnline=offline.queue.kick();await tick();offline.requests[2].resolve(status({displayGranted:true,canShowAutomatically:false}));assert.equal(await afterOnline,true,'online retry can recover without fake display');
 const claimFailure=automaticFixture(),failedClaim=claimFailure.queue.kick();claimFailure.requests[0].resolve(status());await tick();claimFailure.requests[1].reject(Error('lost connection'));assert.equal(await failedClaim,false);assert.equal(claimFailure.opened,0);assert(!claimFailure.queue.seen(CAMPAIGN));
 assert(allowed('https://hrajproplet.cz/','production',true),'future production manual entry requires explicit server enabled capability');assert(!allowed('https://hrajproplet.cz/','production',false));
 console.log('PASS automatic release: shared queue, real server claim, no game/modal/offline claims, cross-device denial, token/account/navigation races, failed-request retry and disabled/new/seen states');
})().catch(error=>{console.error(error);process.exitCode=1;});
