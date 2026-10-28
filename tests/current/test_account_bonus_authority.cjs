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
  console.log('PASS account bonus authority: simulated reward cannot toast or inflate server stats/rankings; real receipt bridges stale stats exactly once');
})().catch(error=>{console.error(error);process.exitCode=1});
