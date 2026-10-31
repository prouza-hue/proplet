'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/valid-word-feedback-v3330.js','utf8');
const date='2026-10-21',puzzleId='g6-ds-hardcore-w02',word='LEDNA',path=[77,76,66,67,57];
const rewardKey=`word_discovery_v1:${puzzleId}:ledna`,storageKey='proplet-v4-word-discovery-v1:synthetic';
const bank=JSON.parse(fs.readFileSync('data/daily_specials_private.json','utf8'));
const noop=()=>{},tick=()=>new Promise(setImmediate);
function client({mode="daily_special",saved={},practice=false,fail=false,loggedIn=true,finished=false,alreadyRecovered=false}={}){
  const storage=new Map([[storageKey,JSON.stringify({entries:saved})]]),claims=[],messages=[];
  const game={mode,dailyDate:date,attemptId:'extra-first',finished,found:[],path:[...path],
    puzzle:{...bank.puzzles[puzzleId],meta:{dailySpecialBinding:{official:!practice,rewardEligible:!practice,
      challengeKey:practice?`daily-special-practice:${date}:hardcore:${puzzleId}`:`daily-special:${date}:hardcore`}}}};
  const ctx={currentGame:game,pragueDateISO:()=>date,navigator:{onLine:true},setTimeout:noop,
    window:{addEventListener:noop},document:{addEventListener:noop,querySelector:()=>null,
      createElement:()=>({setAttribute:noop,remove:noop}),head:{appendChild:noop},body:{appendChild:noop}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    getProfile:()=>loggedIn?{id:'synthetic',token:'fixture'}:null,samePath:()=>false,
    currentWord:()=>word,submitPath:()=>{game.path=[]},message:s=>messages.push(s),
    fetch:async()=>({ok:true,text:async()=>word}),
    api:async(url,opts)=>{
      if(!opts)return {totalDiscoveryXp:0,rewardKeys:[]};
      const claim=JSON.parse(opts.body);claims.push(claim);
      assert.equal(claim.mode,mode);if(mode==='daily_special')assert.equal(claim.challenge_key,`daily-special:${date}:hardcore`);else assert.equal(claim.challenge_key,undefined);
      assert.deepEqual(claim.path,path);
      if(fail)throw Object.assign(new Error('Slovo neodpovídá platné vedlejší cestě této desky'),{status:400});
      return {newlyGranted:!alreadyRecovered,awardedPoints:alreadyRecovered?0:1,
        limitReason:alreadyRecovered?'recovered':'granted',totalDiscoveryXp:1,rewardKeys:[rewardKey]};
    }};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return {ctx,claims,game,messages,storage};
}
(async()=>{
  for(const loggedIn of [true,false]){
    const c=client({loggedIn});await tick();vm.runInContext('submitPath()',c.ctx);await tick();
    assert.equal(c.game.wordDiscoveryXpAwarded,1);assert(c.messages.some(s=>s.includes('+1 XP')));
    if(loggedIn)assert.equal(c.claims.length,1);
    c.game.path=[...path];vm.runInContext('submitPath()',c.ctx);await tick();
    assert.equal(c.game.wordDiscoveryXpAwarded,1,'one reward per word, even after another trace');
    const practice=client({practice:true,loggedIn});await tick();vm.runInContext('submitPath()',practice.ctx);await tick();
    assert.equal(practice.claims.length,0);assert.equal(practice.game.wordDiscoveryXpAwarded,undefined);
  }
  const old={puzzleId,mode:'daily_special',difficulty:'hardcore',dailyDate:date,attemptId:'extra-first',
    word,path,status:'rejected',rejectedStatus:422,rejectedReason:'[object Object]',recognitionVersion:7};
  const recovered=client({saved:{[rewardKey]:old},finished:true});await tick();
  assert.equal(recovered.claims.length,1,'stored original proof retried on boot');
  assert.equal(recovered.game.wordDiscoveryXpAwarded,1,'same finished run receives recovered XP');
  assert.equal(JSON.parse(recovered.storage.get(storageKey)).entries[rewardKey].status,'confirmed');
  await recovered.ctx.window.PROPLET_WORD_DISCOVERY_API.sync();
  assert.equal(recovered.claims.length,1,'recovery remains idempotent on refresh');
  const reserve=client({saved:{[rewardKey]:old},alreadyRecovered:true});await tick();
  assert.equal(JSON.parse(reserve.storage.get(storageKey)).entries[rewardKey].status,'confirmed');
  assert.equal(reserve.game.wordDiscoveryXpAwarded,undefined,'reserve exchange does not display a second reward');
  const wrongMode=client({saved:{[rewardKey]:{...old,rejectedStatus:400,rejectedReason:'Odměna platí jen v běžné hře'}}});
  await tick();assert.equal(wrongMode.claims.length,1,'old allowlist failure also retries');
  const invalid=client({saved:{[rewardKey]:{...old,rejectedStatus:400,rejectedReason:'Slovo neodpovídá platné vedlejší cestě této desky'}}});
  await tick();assert.equal(invalid.claims.length,0,'other old errors are not upgraded into rewards');
  const rejected=client({saved:{[rewardKey]:old},fail:true});await tick();
  await rejected.ctx.window.PROPLET_WORD_DISCOVERY_API.sync();
  assert.equal(rejected.claims.length,1,'a still-invalid saved path is rejected once under the new protocol');
  const tajenka=client({mode:'tajenka'});await tick();vm.runInContext('submitPath()',tajenka.ctx);await tick();assert.equal(tajenka.game.wordDiscoveryXpAwarded,1);assert.equal(tajenka.claims.length,1);
  const oldTajenka={...old,mode:'tajenka',claimVersion:2,rejectedStatus:400,rejectedReason:'Odměna platí jen v běžné hře'};
  const restoredTajenka=client({mode:'tajenka',saved:{[rewardKey]:oldTajenka}});await tick();assert.equal(restoredTajenka.claims.length,1);await restoredTajenka.ctx.window.PROPLET_WORD_DISCOVERY_API.sync();assert.equal(restoredTajenka.claims.length,1);
  const invalidTajenka=client({mode:'tajenka',saved:{[rewardKey]:{...oldTajenka,rejectedReason:'Slovo neodpovídá platné vedlejší cestě této desky'}}});await tick();assert.equal(invalidTajenka.claims.length,0);
  const app=fs.readFileSync('public/app.js','utf8');let savedRun;
  const resume={currentGame:{mode:'tajenka',puzzle:{id:'tajenka-v2-week-17'},found:[],attemptId:'tajenka-resume',wordDiscoveryXpAwarded:4},tajenkaState:()=>({}),gameElapsed:()=>1000,saveTajenkaState:s=>savedRun=s,Date};
  vm.runInNewContext(app.slice(app.indexOf('function saveTajenkaGameProgress('),app.indexOf('function clearGameProgress('))+';saveTajenkaGameProgress();',resume);
  assert.equal(savedRun.inProgress.wordDiscoveryXpAwarded,4,'Tajenka save retains run bonus for normal restore');
  console.log('PASS Tajenka fresh bonus and exact-error proof retry; Extra live/guest discovery, practice exclusion, saved proof recovery, repeated sync and invalid proof rejection');
})().catch(error=>{console.error(error);process.exitCode=1});
