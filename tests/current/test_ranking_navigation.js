'use strict';
const assert=require('node:assert/strict');
const {create}=require('../../public/app/rankings/rankings.js');
const tick=()=>new Promise(setImmediate);
const rows=(name,count=40)=>Array.from({length:count},(_,i)=>({rank:i+1,name:`${name} ${i+1}`,isMine:i===count-1,xp:1000-i,lifetimePoints:1000,memberCount:3,players:3,score:100-i,moves:10,cleanSolve:true,elapsedMs:1000+i}));
const payload=(name,count=40)=>({players:rows(name,count),teams:rows(`${name} tým`,count>5?8:count),visibilityReady:true});
function fixture(){
  const handlers=new Map(),calls=[],pending=[];
  let profile={id:'one',token:'one'},date='2026-10-18';
  const nodes=new Map(['xpLeaderboardList','dailyLeaderboardList'].map(id=>[`#${id}`,{innerHTML:'',attrs:{},setAttribute(k,v){this.attrs[k]=v}}]));
  const buttons={};
  for(const [selector,key,values] of [
    ['.ranking-scope-tab','rankingXpScope',['players','teams']],
    ['.ranking-period-tab','rankingPeriod',['today','week','all']],
    ['.ranking-daily-tab','rankingDailyScope',['players','teams']],
  ])buttons[selector]=values.map(value=>({dataset:{[key]:value},classList:{toggle(){}},setAttribute(){},addEventListener:(type,callback)=>handlers.set(`${key}:${value}`,callback)}));
  const controller=create({$:s=>nodes.get(s)||null,$$:s=>buttons[s]||[],getProfile:()=>profile,pragueDateISO:()=>date,api:url=>{calls.push(url);return new Promise((resolve,reject)=>pending.push({url,resolve,reject}))},esc:s=>String(s),levelFor:()=>({current:{icon:'',name:''}})});
  controller.install();
  return {controller,nodes,calls,pending,click:(key,value)=>handlers.get(`${key}:${value}`)(),setProfile:value=>{profile=value},setDate:value=>{date=value},xp:()=>nodes.get('#xpLeaderboardList').innerHTML,daily:()=>nodes.get('#dailyLeaderboardList').innerHTML};
}
(async()=>{
  const f=fixture(),first=f.controller.renderLeaderboard();await tick();
  assert.deepEqual(f.calls,['/api/rankings/xp?period=today','/api/rankings/daily?daily_date=2026-10-18'],'initial section reads must run concurrently');
  // Switching scopes while the first request is unresolved must subscribe to
  // the same response, not send duplicate requests or rerender the other list.
  f.click('rankingXpScope','teams');f.click('rankingDailyScope','teams');await tick();
  assert.equal(f.calls.length,2,'same inflight response must be reused by player/team toggles');
  f.pending[0].resolve(payload('dnes'));f.pending[1].resolve(payload('daily'));await first;await tick();
  assert(f.xp().includes('dnes tým')&&!f.xp().includes('dnes 1<'),'current scope wins after an inflight switch');
  assert(f.daily().includes('daily tým'),'daily scope wins after an inflight switch');
  f.click('rankingXpScope','players');f.click('rankingDailyScope','players');await tick();
  assert.equal(f.calls.length,2,'fresh player/team toggles must not refetch either endpoint');
  assert.equal((f.xp().match(/leader-row ranking-row/g)||[]).length,6,'XP compact preview contains 5 leaders plus self');
  assert.equal((f.daily().match(/leader-row ranking-row/g)||[]).length,6,'Daily compact preview contains 5 leaders plus self');
  assert(f.xp().includes('dnes 40')&&f.daily().includes('daily 40'),'own distant rank stays visible in both previews');
  assert(!f.xp().includes('dnes 6<'),'middle ranks are kept behind expansion');
  const dailyBefore=f.daily();
  f.click('rankingPeriod','week');await tick();f.click('rankingPeriod','all');await tick();
  const week=f.pending.find(row=>row.url.endsWith('period=week')),all=f.pending.find(row=>row.url.endsWith('period=all'));
  all.resolve(payload('celkem'));await tick();week.resolve(payload('tyden'));await tick();
  assert(f.xp().includes('celkem')&&!f.xp().includes('tyden'),'late previous period response must not overwrite the selected period');
  assert.equal(f.daily(),dailyBefore,'XP period changes must leave the Daily DOM untouched');
  const count=f.calls.length;f.click('rankingPeriod','week');await tick();
  assert(f.xp().includes('tyden'),'an inactive period response still fills its own cache');assert.equal(f.calls.length,count);
  // A late response after an identity switch may not expose the old account's
  // own-row markers, and cache entries must never be shared across identities.
  f.setProfile({id:'two',token:'two'});const second=f.controller.renderLeaderboard();await tick();
  const newRequests=f.pending.slice(-2);f.setProfile({id:'three',token:'three'});
  newRequests.forEach(row=>row.resolve(payload('stary-ucet')));await second;
  assert(!f.xp().includes('stary-ucet')&&!f.daily().includes('stary-ucet'),'stale account response must be ignored');
  const third=f.controller.renderLeaderboard();await tick();f.pending.slice(-2).forEach(row=>row.resolve(payload('novy-ucet',2)));await third;
  assert(f.xp().includes('novy-ucet')&&f.daily().includes('novy-ucet'),'current identity receives its own reads');
  assert.equal((f.xp().match(/leader-row ranking-row/g)||[]).length,2,'short rankings must not duplicate own row');
  f.click('rankingPeriod','all');await tick();f.pending.at(-1).reject(new Error('syntetická síťová chyba'));await tick();
  assert(f.xp().includes('XP pořadí se teď nepodařilo načíst.')&&f.xp().includes('syntetická síťová chyba'),'failed selected read must show actionable error');
  assert.equal(f.nodes.get('#xpLeaderboardList').attrs['aria-busy'],'false','network errors must finish busy state');
  assert(f.daily().includes('novy-ucet'),'XP errors leave Daily results intact');
  f.setDate('2026-10-19');const nextDay=f.controller.renderLeaderboard();await tick();
  assert(f.calls.at(-1).includes('daily_date=2026-10-19'),'Daily cache must be keyed by Prague date');
  f.pending.slice(-2).forEach(row=>row.resolve(payload('dalsi-den')));await nextDay;
  console.log('PASS ranking compact/self, cache sharing, period race, identity race, independent errors and Prague-date reads');
})().catch(error=>{console.error(error);process.exitCode=1});
