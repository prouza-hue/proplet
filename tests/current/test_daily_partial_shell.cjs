'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Daily=require('../../public/app/content/daily.js');
const nodes=new Map();
const label=()=>({textContent:'',classList:{add(){},remove(){},toggle(name,hidden){if(name==='hidden')this.hidden=hidden}}});
let fail=false,done=false,updates=0;
const d=Daily.create({$:s=>nodes.get(s)||null,pragueDateISO:()=> '2026-11-06',formatDateCZ:d=>d,
 dailyResultState:()=>{if(fail)throw Error('offline');return {active:done,puzzle:{difficulty:'easy',meta:{cells:9},answers:[{}]}}},
 DIFF:{easy:{label:'Snadná'}},countCz:(n,w)=>n+' '+w,effectiveStats:()=>({}),
 getProfile:()=>null,getQueue:()=>[],getSyncState:()=>({}),
 renderDailyWeekRhythm(){},renderLevelCard(){},renderRescueCard(){},renderQuickPlay(){},renderTajenkaEntry(){},afterRender(){updates++}});
for(const unavailable of [false,true]){
 fail=unavailable;
 assert.equal(d.renderDaily().daily===null,unavailable);
 nodes.set('#playDailyBtn',label());
 d.renderDaily();
 assert.equal(nodes.get('#playDailyBtn').textContent,unavailable?'Zkusit načíst dnešní výzvu':'Hrát dnešní výzvu');
 nodes.clear();
}
assert.equal(updates,4,'other panels still render on a partial shell');
for(const id of ['#dailyDate','#dailyMeta','#playDailyBtn','#shareDailyBtn','#dailySyncStatus'])nodes.set(id,label());
fail=false;d.renderDaily();
assert.equal(nodes.get('#dailyDate').textContent,'2026-11-06');
assert.match(nodes.get('#dailyMeta').textContent,/Snadná/);
assert.equal(nodes.get('#shareDailyBtn').classList.hidden,true);
done=true;d.renderDaily();
assert.equal(nodes.get('#shareDailyBtn').classList.hidden,false,'Daily sharing appears after completion');

const source=fs.readFileSync('public/home-layout.js','utf8');
const compact=source.slice(source.indexOf('function compactDailyHero('),source.indexOf('function dailyProgressExists('));
const date=label(),meta=label();
let title=null,line=null;
const main={querySelector:s=>s==='#dailyHeroTitle'?title:line};
const hero={querySelector:()=>main};
const document={querySelector:s=>s==='#dailyDate'?date:s==='#dailyMeta'?meta:hero,
 createElement:()=>({append(...children){assert.equal(this.parentElement,main,'never detach labels into an unattached row');assert.deepEqual(children,[date,meta]);line=this;}})};
const c=vm.createContext({document});
vm.runInContext(compact,c);
c.compactDailyHero();
assert.equal(line,null,'partial layout leaves both labels in place');
title={dataset:{},parentElement:main,closest:()=>null,insertAdjacentElement:(where,row)=>{assert.equal(where,'afterend');row.parentElement=main;}};
c.compactDailyHero();
assert.equal(line.parentElement,main,'complete layout still compacts the labels');
console.log('PASS partial Daily shell, retry and attached metadata row');
