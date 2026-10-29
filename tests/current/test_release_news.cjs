'use strict';
const assert=require('node:assert/strict');
const {allowed,install}=require('../../public/release-news.js');
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
   if(selector==='.modal:not(.hidden),dialog[open]')return modal||elements.find(e=>e.tag==='dialog'&&e.isConnected&&e.open)||null;
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
for(const [env,host] of [['production',preview],['preview','https://hrajproplet.cz/']]){const f=fixture('?showNews=1',env,host);install(f.win);f.ready();assert.equal(f.elements.length,0);assert.equal(f.win.PropletReleaseNews,undefined);}
const plain=fixture();install(plain.win);plain.ready();assert.equal(plain.dialog,undefined,'ordinary preview visit has no unsolicited announcement');
const f=fixture('?showNews=1');install(f.win);assert.equal(f.dialog,undefined,'explicit request waits for native readiness');
f.playing(true);f.ready();assert.equal(f.dialog,undefined,'must not interrupt a game');f.modal(true);f.playing(false);assert.equal(f.dialog,undefined,'must wait for onboarding or other native modal');
f.modal(false);assert(f.dialog.open);assert.equal(f.doc.activeElement,f.controls.title);assert.equal(f.dialog.attrs['aria-labelledby'],'releaseNewsTitle');
assert(f.dialog.innerHTML.includes('id="releaseNewsTitle" tabindex="-1"'));assert(f.dialog.innerHTML.includes('Každý měsíc nová soutěž o&nbsp;vládce Propletu.'));
assert(!f.dialog.innerHTML.includes('Méně hledání, víc hraní.'));assert(f.dialog.innerHTML.includes('čistším designu'));assert(f.dialog.innerHTML.includes('nejlepších 20&nbsp;dnů — rychlost nerozhoduje.'));assert(f.dialog.innerHTML.includes('/assets/navigation/competitions-v1.webp'));
f.dialog.events.cancel({preventDefault(){}});assert.equal(f.dialog.open,false);assert.equal(f.screen,'daily');assert.equal(f.doc.activeElement,f.feature,'Escape returns focus to the visible Today action');
f.modal(false);assert.equal(f.dialog.open,false,'reconciliation cannot reopen a dismissed explicit request');
const settings=f.elements.find(e=>e.id==='releaseNewsSettings');f.win.nav('profile');settings.getClientRects=()=>f.screen==='profile'?[{}]:[];settings.focus();settings.onclick();assert(f.dialog.open);assert.equal(f.screen,'daily','manual Settings entry also leaves closing on Today');
f.controls.play.onclick();assert.equal(f.dialog.open,false);assert.equal(f.screen,'daily');assert.equal(f.monthly,0,'Jdu hrát never starts a board or changes progress');
settings.onclick();f.controls.monthly.onclick();assert.equal(f.monthly,1,'primary delegates to the real monthly opener exactly once');assert.equal(f.screen,'monthly');assert.equal(f.dialog.open,false);
const away=fixture('?showNews=1');install(away.win);away.win.nav('free');away.ready();assert.equal(away.dialog,undefined);away.win.nav('daily');away.flush();assert(away.dialog.open,'pending explicit request appears only after reaching Today');
console.log('PASS release news: production denied, no unsolicited display/storage/transport, readiness/game/modal guards, native monthly action, Settings reopen, Escape and focus restore');

// The subscriber must exist before app boot can emit proplet:ready.
{const html=require("node:fs").readFileSync(require("node:path").join(__dirname,"../../public/index.html"),"utf8");require("node:assert/strict")(html.indexOf('/release-news.js?')<html.indexOf('/app.js?'),"announcement must subscribe before app boot");}
