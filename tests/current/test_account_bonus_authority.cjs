'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/account-bonus-v3331.js','utf8');

async function fixture(receipt,initialStats){
  let stats=initialStats;
  const toasts=[],events=[];
  const context={window:{},document:{querySelector:()=>null},
    getProfile:()=>({id:'synthetic-player',token:'synthetic-session'}),
    effectiveStats:()=>({...stats}),renderProfile(){},setAccountMode(){},
    showToast:text=>toasts.push(text),setTimeout(){},Date,
    api:async(path,options)=>{
      if(path==='/api/account-bonus/claim')return receipt;
      if(path==='/api/account-bonus-event')events.push(JSON.parse(options.body).event_type);
      return {ok:true};
    }};
  vm.createContext(context);vm.runInContext(source,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {context,toasts,events,setStats:value=>{stats=value}};
}

function raceFixture(){
  let player={id:'A',token:'A-token'};
  const requests=[],events=[],toasts=[],handlers={};
  const context={window:{},document:{querySelector:()=>null,addEventListener:(name,fn)=>handlers[name]=fn},
    getProfile:()=>player,effectiveStats:()=>({points:0,accountBonusXp:0,xpAuthoritative:true}),
    renderProfile(){},setAccountMode(){},showToast:text=>toasts.push(text),setTimeout(){},Date,
    api:(path,options)=>{
      if(path==='/api/account-bonus/claim')return new Promise((resolve,reject)=>requests.push({options,resolve,reject}));
      events.push({path,options});return Promise.resolve({ok:true});
    }};
  vm.createContext(context);vm.runInContext(source,context);
  return {context,requests,events,toasts,change(next,notify=true){player=next;if(notify)handlers['proplet:account-changed']();}};
}

(async()=>{
  const canonical={points:2740,resultXp:2740,rewardXp:0,accountBonusXp:0,xpAuthoritative:true};
  const simulated=await fixture({newlyGranted:true,bonusXp:500,accountCreationBonusGranted:true,simulated:true},canonical);
  assert.equal(simulated.context.effectiveStats().points,2740,'simulated receipt must not inflate authoritative profile XP');
  assert.equal(simulated.context.effectiveStats().accountBonusXp,0);
  assert.deepEqual(simulated.toasts,[],'a simulated grant must not announce real earned XP');
  assert.ok(!simulated.events.includes('account_bonus_granted'),'a simulated receipt must not track a real grant');
  const board={players:[{lifetimePoints:2740}]};
  assert.equal(simulated.context.window.PROPLET_ACCOUNT_BONUS_API.adjustRankingData(board),board,'simulation must not inflate ranking rows');

  const real=await fixture({newlyGranted:true,bonusXp:500,accountCreationBonusGranted:true},canonical);
  assert.equal(real.context.effectiveStats().points,3240,'real confirmed bonus may bridge a stale profile snapshot');
  assert.equal(real.toasts.length,1);assert.match(real.toasts[0],/\+500 XP/);
  assert.ok(real.events.includes('account_bonus_granted'));
  real.setStats({...canonical,points:3240,rewardXp:500,accountBonusXp:500});
  assert.equal(real.context.effectiveStats().points,3240,'canonical reread must not double-add the confirmed bonus');
  const authoritativeBoard={xpAuthoritative:true,players:[{lifetimePoints:3240}]};
  assert.equal(real.context.window.PROPLET_ACCOUNT_BONUS_API.adjustRankingData(authoritativeBoard),authoritativeBoard);
  assert.equal(real.context.window.PROPLET_ACCOUNT_BONUS_API.adjustRankingData(board).players[0].lifetimePoints,3240,'legacy non-authoritative ranking compatibility remains intact');
  const race=raceFixture();assert.equal(race.requests[0].options.authProfile.id,'A');
  race.change({id:'B',token:'B-token'});assert.equal(race.requests.length,2,'new identity does not wait for the previous account claim');
  race.requests[0].resolve({newlyGranted:true,bonusXp:500});await new Promise(setImmediate);
  assert.equal(race.context.effectiveStats().points,0,'late A receipt cannot add500 to B');
  assert.equal(race.context.window.PROPLET_ACCOUNT_BONUS,null);assert.deepEqual(race.toasts,[]);assert.deepEqual(race.events,[],'late grant cannot emit an event under the new identity');
  race.requests[1].resolve({newlyGranted:true,bonusXp:500});await new Promise(setImmediate);
  assert.equal(race.context.effectiveStats().points,500,'current B receipt still bridges its stale profile normally');
  assert.equal(race.events[0].options.authProfile.id,'B');assert.equal(race.toasts.length,1);
  race.change({id:'C',token:'expired'});assert.equal(race.context.effectiveStats().points,0,'settled B bonus is cleared immediately on account switch');
  race.change({id:'C',token:'renewed'});assert.equal(race.requests.length,4,'token renewal has its own claim');
  race.requests[2].reject({status:401});await new Promise(setImmediate);
  await race.context.window.PROPLET_ACCOUNT_BONUS_API.sync();assert.equal(race.requests.length,4,'stale401 must not release or replace the renewed in-flight claim');
  race.requests[3].resolve({bonusXp:0});await new Promise(setImmediate);
  await race.context.window.PROPLET_ACCOUNT_BONUS_API.sync();assert.equal(race.requests.length,4,'accepted new identity stays deduplicated');
  race.change(null);assert.equal(race.context.window.PROPLET_ACCOUNT_BONUS_API.bonusXp(),0);assert.equal(race.context.window.PROPLET_ACCOUNT_BONUS,null);
  const noEvent=raceFixture();noEvent.change({id:'B',token:'B-token'},false);
  noEvent.requests[0].resolve({newlyGranted:true,bonusXp:500});await new Promise(setImmediate);
  assert.equal(noEvent.context.effectiveStats().points,0,'response check is safe even before the account-change event is delivered');assert.deepEqual(noEvent.toasts,[]);
  console.log('PASS account bonus authority: simulated reward cannot toast or inflate server stats/rankings; real receipt bridges stale stats exactly once');
})().catch(error=>{console.error(error);process.exitCode=1});
