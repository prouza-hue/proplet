'use strict';
const assert=require('node:assert/strict');
const {create}=require('../../public/app/rankings/rankings.js');
const tick=()=>new Promise(setImmediate);
const rows=(name,count=40)=>Array.from({length:count},(_,i)=>({rank:i+1,name:`${name} ${i+1}`,isMine:i===count-1,xp:1000-i,lifetimePoints:1000,memberCount:3,players:3,score:100-i,moves:10,cleanSolve:true,elapsedMs:1000+i}));
const payload=(name,count=40)=>({players:rows(name,count),teams:rows(`${name} tým`,count>5?8:count),visibilityReady:true});
function fixture(){
  const handlers=new Map(),calls=[],pending=[],weekly=[];
  let profile={id:'one',token:'one'},date='2026-10-18';
  const nodes=new Map(['xpLeaderboardList','dailyLeaderboardList'].map(id=>[`#${id}`,{innerHTML:'',attrs:{},setAttribute(k,v){this.attrs[k]=v}}]));
  const buttons={};
  for(const [selector,key,values] of [
    ['.ranking-scope-tab','rankingXpScope',['players','teams']],
    ['.ranking-period-tab','rankingPeriod',['today','week','all']],
    ['.ranking-daily-tab','rankingDailyScope',['players','teams']],
  ])buttons[selector]=values.map(value=>({dataset:{[key]:value},classList:{toggle(){}},setAttribute(){},addEventListener:(type,callback)=>handlers.set(`${key}:${value}`,callback)}));
  const controller=create({openWeekly:panel=>weekly.push(panel),$:s=>nodes.get(s)||null,$$:s=>buttons[s]||[],getProfile:()=>profile,pragueDateISO:()=>date,api:url=>{calls.push(url);return new Promise((resolve,reject)=>pending.push({url,resolve,reject}))},esc:s=>String(s),levelFor:()=>({current:{icon:'',name:''}})});
  controller.install();
  return {controller,nodes,calls,pending,weekly,click:(key,value)=>handlers.get(`${key}:${value}`)(),setProfile:value=>{profile=value},setDate:value=>{date=value},xp:()=>nodes.get('#xpLeaderboardList').innerHTML,daily:()=>nodes.get('#dailyLeaderboardList').innerHTML};
}
(async()=>{
  const f=fixture(),first=f.controller.renderLeaderboard();await tick();
  assert.deepEqual(f.calls,['/api/rankings/daily?daily_date=2026-10-18'],'only the active view reads its ranking');
  f.click('rankingDailyScope','teams');await tick();assert.equal(f.calls.length,1,'scope change reuses inflight response');
  f.pending[0].resolve(payload('daily'));await first;await tick();assert(f.daily().includes('daily tým'));
  f.click('rankingDailyScope','players');await tick();assert.equal(f.calls.length,1);
  assert.equal((f.daily().match(/leader-row ranking-row/g)||[]).length,6);assert(f.daily().includes('daily 40'),'own distant rank stays visible');
  const xpStart=f.controller.openView('xp');await tick();assert.equal(f.calls.at(-1),'/api/rankings/xp?period=today');
  await f.controller.openView('daily');f.pending[1].resolve(payload('dnes'));await xpStart;
  assert(!f.xp().includes('dnes 1'),'late inactive view must not repaint its table');
  await f.controller.openView('xp');assert.equal(f.calls.length,2,'inactive response still fills its identity-specific cache');
  assert.equal((f.xp().match(/leader-row ranking-row/g)||[]).length,6);assert(f.xp().includes('dnes 40'));
  const dailyBefore=f.daily();f.click('rankingPeriod','week');await tick();f.click('rankingPeriod','all');await tick();
  const week=f.pending.find(row=>row.url.endsWith('period=week')),all=f.pending.find(row=>row.url.endsWith('period=all'));
  all.resolve(payload('celkem'));await tick();week.resolve(payload('tyden'));await tick();
  assert(f.xp().includes('celkem')&&!f.xp().includes('tyden'),'late previous period cannot overwrite current');assert.equal(f.daily(),dailyBefore);
  const count=f.calls.length;f.click('rankingPeriod','week');await tick();assert(f.xp().includes('tyden'));assert.equal(f.calls.length,count);
  f.click('rankingXpScope','teams');await tick();assert.deepEqual(f.weekly,['week']);assert.equal(f.calls.length,count,'team/week opens existing competition, no duplicate table read');
  assert.equal(f.controller.getState().rankingXpScope,'players','returning to XP preserves last distinct XP view');
  f.click('rankingPeriod','today');f.click('rankingXpScope','teams');await tick();assert(f.xp().includes('dnes tým'),'team today remains available');
  f.click('rankingPeriod','all');await tick();assert(f.xp().includes('celkem tým'),'team all-time remains available');
  f.click('rankingPeriod','week');await tick();assert.deepEqual(f.weekly,['week','week']);assert.equal(f.controller.getState().rankingXpPeriod,'all');
  f.controller.openView('weekly');assert.equal(f.weekly.length,3,'top-level weekly uses same competition');
  f.setProfile({id:'two',token:'two'});const second=f.controller.renderLeaderboard();await tick();const old=f.pending.at(-1);f.setProfile({id:'three',token:'three'});old.resolve(payload('stary-ucet'));await second;
  assert(!f.xp().includes('stary-ucet'),'stale account response ignored');
  const third=f.controller.renderLeaderboard();await tick();f.pending.at(-1).resolve(payload('novy-ucet',2));await third;assert(f.xp().includes('novy-ucet'));
  assert.equal((f.xp().match(/leader-row ranking-row/g)||[]).length,2,'short ranking never duplicates own row');
  f.click('rankingPeriod','today');await tick();f.pending.at(-1).reject(new Error('syntetická síťová chyba'));await tick();
  assert(f.xp().includes('XP pořadí se teď nepodařilo načíst.')&&f.xp().includes('syntetická síťová chyba'));assert.equal(f.nodes.get('#xpLeaderboardList').attrs['aria-busy'],'false');
  f.setDate('2026-10-19');const nextDay=f.controller.openView('daily');await tick();assert(f.calls.at(-1).includes('daily_date=2026-10-19'));f.pending.at(-1).resolve(payload('dalsi-den'));await nextDay;
  assert.equal(f.controller.getState().rankingView,'daily');assert(f.daily().includes('dalsi-den'));
  // Execute a fresh shipped controller per remembered-navigation scenario.
  const vm=require('node:vm'),fs=require('node:fs');
  function entryFixture(saved,{monthly=true,weekly=true,blocked=false}={}){
    const store=new Map(saved?[['proplet-competition-view-v1',saved]]:[]),opened=[],reads=[],events={};
    const context={module:{exports:{}},document:{addEventListener:(name,fn)=>{events[name]=fn}},
      localStorage:{getItem:key=>{if(blocked)throw Error('blocked');return store.get(key)},setItem:(key,value)=>{if(blocked)throw Error('blocked');store.set(key,value)}}};
    if(monthly)context.PropletMonthlyCompetition={open:()=>opened.push('monthly')};
    if(weekly)context.PropletWeeklyCompetition={open:()=>opened.push('weekly')};
    vm.runInNewContext(fs.readFileSync('public/app/rankings/rankings.js','utf8'),context);
    const controller=context.module.exports.create({api:url=>{reads.push(url);return Promise.resolve(payload('entry',2))},pragueDateISO:()=> '2026-11-01'});
    return {controller,store,opened,reads,events};
  }
  let entry=entryFixture();await entry.controller.openLastView();assert.deepEqual(entry.opened,['monthly']);assert.equal(entry.reads.length,0);
  entry=entryFixture(null,{monthly:false});await entry.controller.openLastView();assert.equal(entry.controller.getState().rankingView,'daily');
  for(const remembered of ['daily','xp','weekly','monthly']){
    entry=entryFixture(remembered);await entry.controller.openLastView();
    assert.equal(entry.store.get('proplet-competition-view-v1'),remembered);
    assert.equal(entry.opened[0]||entry.controller.getState().rankingView,remembered);
  }
  entry=entryFixture('monthly',{monthly:false});await entry.controller.openLastView();assert.equal(entry.controller.getState().rankingView,'daily');
  entry=entryFixture('weekly',{weekly:false});await entry.controller.openLastView();assert.equal(entry.controller.getState().rankingView,'daily');
  entry=entryFixture('untrusted');await entry.controller.openLastView();assert.deepEqual(entry.opened,['monthly']);
  entry=entryFixture(null,{blocked:true});await entry.controller.openView('xp');await entry.controller.openLastView();assert.equal(entry.controller.getState().rankingView,'xp');
  entry=entryFixture();entry.events['proplet:screen-changed']({detail:{screen:'weekly'}});await entry.controller.openLastView();assert.deepEqual(entry.opened,['weekly'],'direct screen navigation is remembered');
  console.log('PASS single ranking view, weekly route reuse, teams today/all, own row, cached scope changes, period/account races, errors and Prague date');
})().catch(error=>{console.error(error);process.exitCode=1});
