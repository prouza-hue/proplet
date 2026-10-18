const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/valid-word-feedback-v3330.js','utf8');
const code=source.slice(source.indexOf('  const awardDiscovery='),source.indexOf('  const resetForGame='));
let loggedIn=false,online=true,awarded=0,requests=0;
const stores={guest:{entries:{}},alice:{entries:{}},bob:{entries:{}}};let owner='alice';
const c={rewardDisabled:()=>false,patchEffectiveStats(){},discoveryRewardKey:(p,w)=>p+':'+w,scope:()=>loggedIn?owner:'guest',
 readDiscoveryStore:s=>stores[s],writeDiscoveryStore:(value,s)=>stores[s]=value,profile:()=>loggedIn?{id:owner,token:'synthetic'}:null,
 normalize:w=>w,localDay:()=> '2026-10-21',navigator:{get onLine(){return online}},setTimeout(){},syncDiscoveries(){},
 creditRunXp:(_,n)=>awarded+=n,showXpPop(){},refreshVisibleUi(){},discoveryKnownKeys:new Set(),claimPayload:x=>x,
 api:async()=>{requests++;return {newlyGranted:true,awardedPoints:1,totalDiscoveryXp:requests}},markServerState(){},permanentClaimError:()=>false};
vm.createContext(c);vm.runInContext(code+';globalThis.award=awardDiscovery;',c);
const word=n=>({puzzleId:'board',mode:'free',difficulty:'easy',word:'word'+n,path:[0,1,2,3]});
(async()=>{
 for(let i=0;i<65;i++)assert.equal(await c.award(word(i)),'awarded');
 assert.equal(awarded,65);assert.equal(await c.award(word(64)),'duplicate');assert.equal(awarded,65);
 loggedIn=true;awarded=0;for(let i=0;i<65;i++)assert.equal(await c.award(word(i)),'awarded');
 assert.equal(requests,65);assert.equal(awarded,65);assert.equal(await c.award(word(64)),'duplicate');assert.equal(requests,65);
 online=false;assert.equal(await c.award(word(66)),'pending');assert.equal(awarded,65,'offline signed-in claim does not invent confirmed XP');assert.equal(stores.alice.entries['board:word66'].status,'pending');
 online=true;stores.alice.entries['board:word67']={status:'capped',limitReason:'daily_limit'};
 assert.equal(await c.award(word(67)),'awarded','a newly rediscovered formerly capped word may now earn XP');
 owner='bob';assert.equal(await c.award(word(0)),'awarded','another account has its own ledger');
 assert.equal(await c.award({...word(99),mode:'playtest'}),'disabled');
 console.log('PASS guest/server >50 XP, exact deduplication, offline pending, former cap rediscovery and account isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
