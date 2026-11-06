'use strict';
// Exercise the shipped Today controller against changing real-state contracts.
// No API, browser storage, production account or game engine is involved.
const assert=require('node:assert/strict');
const DailyUI=require('../../public/app/content/daily-special-ui.js');
const nodes=new Map();
class Element{
  constructor(){this.textContent='';this.innerHTML='';this.dataset={};this.hidden=false;this.children=new Map();this.attributes={};const names=new Set();this.classList={add:n=>names.add(n),remove:n=>names.delete(n),contains:n=>names.has(n),toggle:(n,on)=>{if(on)names.add(n);else names.delete(n)}};}
  querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Element());return this.children.get(selector)}
  querySelectorAll(){return []}
  setAttribute(k,v){this.attributes[k]=String(v)}
  removeAttribute(k){delete this.attributes[k]}
  append(el){el.parentElement=this;if(el.id)nodes.set('#'+el.id,el)}
  prepend(el){this.append(el)}
  insertBefore(el,anchor){assert.equal(anchor.parentElement,this,'result insertion must use an actual hero child');this.append(el)}
  closest(){return null}
}
for(const selector of ['#screen-daily','#screen-daily .daily-hero','#dailyHeroTitle','#dailyChallengeSwitch','#playDailyBtn','#shareDailyBtn','#dailySyncStatus','#dailyMeta','#dailyWeekRhythm','#studioDailyArt'])nodes.set(selector,new Element());
nodes.get('#screen-daily .daily-hero').append(nodes.get('#playDailyBtn'));
global.document={createElement:()=>new Element()};
let date='2026-10-21',profile={id:'player-one',token:'fixture'},base={puzzle:{difficulty:'medium'},active:null},special={descriptor:{dailyDate:date,challengeKey:'daily-special:'+date+':hardcore',rewardEligible:true},puzzle:{difficulty:'hardcore'},active:null,progress:null},queue=[],sync={},routes=[],renderBaseCalls=0,failBase=false;
let ui;
ui=DailyUI.create({
  $:selector=>nodes.get(selector)||null,pragueDateISO:()=>date,getProfile:()=>profile,
  dailyResultState:()=>{if(failBase)throw Error('content unavailable');return base},dailySpecialResultState:()=>special,
  DIFF:{medium:{label:'Střední'},hardcore:{label:'Mozkožrout'}},getSchedule:()=>[],getQueue:()=>queue,getSyncState:()=>sync,
  startDaily:()=>routes.push('base'),startSpecial:()=>routes.push('special'),openFree:()=>routes.push('free'),
  renderBase:()=>{renderBaseCalls++;assert(renderBaseCalls<20,'automatic selection must not recursively render base');nodes.get('#playDailyBtn').textContent=base.active?'Zobrazit dnešní výsledek':'Hrát Denní výzvu';ui.render()},
});
ui.render();
assert.equal(ui.getState().selected,'base');
assert.equal(nodes.get('#dailyHeroTitle').textContent,'Denní výzva');
assert.match(nodes.get('#dailyMeta').innerHTML,/>Střední<.*>\+100 XP</,'base difficulty and actual reward remain available as metadata');
assert.equal(nodes.get('#studioExtraCard').hidden,false);
assert.equal(renderBaseCalls,0,'a render must not call select/renderBase');

base.active={elapsedMs:123456,moves:7};ui.render();
assert.equal(ui.getState().selected,'special','base completion promotes unfinished Extra');
assert.equal(nodes.get('#dailyHeroTitle').textContent,'Extra výzva');
assert.match(nodes.get('#dailyMeta').innerHTML,/>Mozkožrout<.*>\+200 XP</,'difficulty stays readable in metadata, not the large heading');
assert.equal(nodes.get('#studioDailyArt').src,'/difficulty/printshop/hardcore.webp');
assert.equal(nodes.get('#studioExtraCard').hidden,true);
assert.equal(nodes.get('#studioDailyResult').querySelector('.studio-result-metrics').textContent,'2:03 · 7 tahů');
assert.equal(nodes.get('#studioDailyResult').parentElement,nodes.get('#screen-daily'),'base result remains separate when Extra owns the hero');
ui.start();assert.equal(routes.pop(),'special');

ui.select('base');ui.render();
assert.equal(ui.getState().selected,'base','explicit base choice survives another paint');
ui.start();assert.equal(routes.pop(),'base','completed base still uses existing result handler');
assert.equal(nodes.get('#studioDailyArt').src,'/rewards/printshop/symbol-daily.svg');
assert.equal(nodes.get('#dailyHeroTitle').textContent,'Denní výzva');
assert.equal(nodes.get('#studioDailyResult').parentElement,nodes.get('#screen-daily .daily-hero'),'base selection brings its result inside the base hero');

profile={id:'player-two',token:'fixture'};base.active=null;ui.render();
assert.equal(ui.getState().selected,'base');
nodes.get('#studioExtraCard').querySelector('button').onclick();
assert.equal(ui.getState().selected,'special');assert.equal(routes.pop(),'special','secondary action uses canonical Extra handler');
ui.render();assert.equal(ui.getState().selected,'special','explicit Extra choice persists');
date='2026-10-22';special.descriptor.dailyDate=date;ui.render();
assert.equal(ui.getState().selected,'base','Prague day change resets explicit selection');

base.active={elapsedMs:90000,moves:4};ui.render();
assert.equal(ui.getState().selected,'special');
special.active={elapsedMs:110000,moves:8};ui.render();
assert.equal(ui.getState().selected,'base');
assert.equal(nodes.get('#playDailyBtn').textContent,'Vybrat volnou hru');
assert.equal(nodes.get('#dailyHeroTitle').textContent,'Denní výzva','completed state keeps the stable challenge heading');
assert.equal(nodes.get('#studioDailyResult').parentElement,nodes.get('#screen-daily .daily-hero'));
ui.start();assert.equal(routes.pop(),'free','completed day opens existing free navigation');
nodes.get('#studioDailyResult').querySelector('button').onclick();assert.equal(routes.pop(),'base','summary remains real Daily result, not a new game');

special.active=null;profile=null;queue=[{challengeKey:'daily:'+date}];sync={status:'error',error:'Bez připojení'};ui.render();
assert.equal(ui.getState().selected,'special');
assert.equal(nodes.get('#studioDailyResult').parentElement,nodes.get('#screen-daily'),'pending base sync remains visible separately from Extra');
assert.match(nodes.get('#studioDailyResult').querySelector('.studio-result-sync').textContent,/Č?eká na synchronizaci.*Bez připojení/i);
assert.equal(nodes.get('#studioDailyResult').querySelector('.studio-result-sync').hidden,false);
queue=[];ui.render();assert.match(nodes.get('#studioDailyResult').querySelector('.studio-result-sync').textContent,/tomto zařízení/);

ui.select('special');special={descriptor:null,puzzle:null,active:null,progress:null};ui.render();
assert.equal(ui.getState().selected,'base','unavailable Extra cannot retain active start target');
assert.equal(nodes.get('#studioExtraCard').hidden,true);
base.active=null;failBase=true;nodes.get('#playDailyBtn').textContent='Zkusit načíst dnešní výzvu';ui.render();
assert.equal(nodes.get('#playDailyBtn').textContent,'Zkusit načíst dnešní výzvu','loading error retains canonical retry');
assert.equal(nodes.get('#studioDailyResult').hidden,true);
// A partial hero can keep its controls while its metadata nodes are absent.
failBase=false;
nodes.delete('#dailyMeta');
ui.render();
assert.equal(ui.getState().selected,'base');
special={descriptor:{dailyDate:date,challengeKey:'special',rewardEligible:true},puzzle:{difficulty:'hardcore'}};
// renderBase is exercised with the main control in place.
ui.select('special');
assert.match(nodes.get('#playDailyBtn').innerHTML,/Hrát Mozkožrouta/);
nodes.delete('#playDailyBtn');
ui.render();
ui.start();
assert.equal(routes.pop(),'special');
console.log('PASS Studio Today: automatic hierarchy, explicit choice, date/account reset, canonical routes, real summary and sync errors');
