'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/app.js','utf8');
const {create:createTajenkaStorage}=require('../../public/app/account/tajenka-storage.js');
const block=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);return source.slice(a,b)};
const modern={puzzleId:'g6-refresh-easy-001',challengeKey:'free:g6-refresh-easy-001',mode:'free',difficulty:'easy',level:318,contentGeneration:6,points:515,completedAt:'2026-11-02T12:00:00Z'};
const archive={puzzleId:'g3-easy-001',challengeKey:'free:g3-easy-001',mode:'free',difficulty:'easy',level:1,contentGeneration:3,points:15,completedAt:'2026-11-03T12:00:00Z'};
const initial=()=>({completed:{[modern.challengeKey]:{...modern},[archive.challengeKey]:{...archive}},inProgress:{},remoteProgressLoadedAt:'2026-12-03T12:00:00Z'});
function fixture(){
  const ctx={profile:{id:'A',token:'a-token',stats:{points:2840,resultXp:2840,rewardXp:0,xpAuthoritative:true}},
    states:{A:initial()},queue:[],requests:[],saves:0,otherXp:2810,accountProgressRequest:null,
    DIFF:{easy:{xp:15}},puzzleDB:{freeGeneration:6,starter:{meta:{rewardXp:25}}},TAJENKA_REWARD_XP:200,
    getProfile:()=>ctx.profile,playerScope:()=>ctx.profile?.id||'guest',
    getState:scope=>ctx.states[scope||ctx.playerScope()]||(ctx.states[scope||ctx.playerScope()]={completed:{},inProgress:{}}),
    saveState:(value,scope)=>{ctx.states[scope||ctx.playerScope()]=value;ctx.saves++},getQueue:()=>ctx.queue,
    currentLocalStats:()=>({points:ctx.otherXp+Object.values(ctx.getState().completed).reduce((n,r)=>n+Number(r.points||0),0),bestDailyMs:null}),
    freePuzzleSlot:id=>({generation:id.startsWith('g3-')?3:6,legacy:id.startsWith('g3-')}),
    mergeRemoteTajenkaProgress(){},datedDailyController:null,dailyPuzzleFor:()=>({id:'daily-new'}),
    accountProfileMatches:p=>!!p&&p.id===ctx.profile?.id&&p.token===ctx.profile?.token,
    renderAccountProgressStatus(){},validSupportMode:()=>true,rememberSupportMode(){},
    updateAccountProfile:patch=>{ctx.profile={...ctx.profile,...patch}},freeOrder:()=>({sync:async()=>{}}),
    document:{dispatchEvent(){}},CustomEvent:function(){},renderDaily(){},renderFree(){},renderProfile(){},navigator:{onLine:true},
    api:async path=>{ctx.requests.push(path);return ctx.response},Date,console};
  const memory=new Map(),tajenka=createTajenkaStorage({storage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)},stateKey:'tajenka-test',getScope:()=>ctx.playerScope(),rewardXp:200});
  ctx.tajenkaState=scope=>tajenka.read(scope);
  ctx.mergeRemoteTajenkaProgress=(rows,scope)=>tajenka.mergeRemote(rows,scope);
  vm.createContext(ctx);
  vm.runInContext(block('function reconcileLocalGen4Rewards(){','function normalizeLeagueCode('),ctx);
  vm.runInContext(block('function pendingAuthoritativeXp(','function isoShift('),ctx);
  vm.runInContext(block('function mergeRemoteProgress(','function renderPrivacyActions(){'),ctx);
  return ctx;
}
(async()=>{
  const c=fixture();
  assert.equal(c.currentLocalStats().points,3340,'reproduce real cached Gen6+Archive phantom500');
  assert.equal(c.reconcileLocalGen4Rewards().repairedXp,0,'authenticated authoritative accounts cannot mint local migration XP');
  assert.equal(c.effectiveStats().points,2840,'acknowledged server XP wins over inflated local total');
  const pending={challengeKey:'free:new-offline',puzzleId:'new-offline',mode:'free',difficulty:'easy',points:515,completedAt:'2026-12-03T12:01:00Z'};
  c.queue=[pending,{...pending}];
  assert.equal(c.effectiveStats().points,2855,'one offline base15 is optimistic; phantom500 and duplicate queue record are excluded');
  assert.equal(pending.points,515);assert.equal(pending.completedAt,'2026-12-03T12:01:00Z','display calculation never rewrites an offline payload');
  c.queue=[];c.response={stats:{...c.profile.stats},completed:[{...modern,points:15},{...archive}],cursor:'2026-12-03T12:02:00Z'};
  await c.refreshRemoteProfile();
  assert.equal(c.requests[0],'/api/account/snapshot','old delta cursor cannot hide a corrupted acknowledged row during one-time reconciliation');
  assert.equal(c.getState().completed[modern.challengeKey].points,15);
  assert.equal(c.getState().completed[modern.challengeKey].serverConfirmed,true);
  assert.equal(c.getState().remoteXpCanonicalVersion,1);
  c.response={stats:{...c.profile.stats},completed:[],cursor:'2026-12-03T12:03:00Z'};await c.refreshRemoteProfile();
  assert.match(c.requests[1],/^\/api\/account\/snapshot\?since=/,'ordinary delta reads resume after the canonical refresh');
  const lost={challengeKey:'daily:2026-12-03',puzzleId:'daily-new',mode:'daily',difficulty:'easy',points:100,completedAt:'2026-12-03T12:01:00Z'};
  c.queue=[lost];c.getState().completed[lost.challengeKey]={...lost};
  c.response={stats:{...c.profile.stats,points:2940,resultXp:2940},completed:[{...lost}],cursor:'2026-12-03T12:04:00Z'};
  await c.refreshRemoteProfile();
  assert.equal(c.queue.length,1,'canonical snapshot does not manufacture a queue acknowledgement');
  assert.equal(c.effectiveStats().points,2940,'lost-response queue already proven committed cannot double-count XP');
  const tajenka={challengeKey:'tajenka:week-01',puzzleId:'week-01',mode:'tajenka',points:200,completedAt:'2026-12-03T12:05:00Z'};
  c.queue=[tajenka];
  assert.equal(c.effectiveStats().points,3140,'a genuinely new offline Tajenka may optimistically show its base200');
  c.response={stats:{...c.profile.stats,points:3140,resultXp:3140},completed:[{...tajenka}],cursor:'2026-12-03T12:06:00Z'};
  await c.refreshRemoteProfile();
  assert.equal(c.queue.length,1);
  assert.equal(c.tajenkaState().completions[tajenka.puzzleId].remote,true);
  assert.equal(c.effectiveStats().points,3140,'a lost-response Tajenka already committed cannot double-add200');
  delete c.getState().completed[tajenka.challengeKey];
  assert.equal(c.effectiveStats().points,3140,'older separate Tajenka cache still proves its pending replay was already paid');
  c.getState().completed[lost.challengeKey]={...lost,puzzleId:'daily-new-generation'};c.queue=[c.getState().completed[lost.challengeKey]];
  assert.equal(c.effectiveStats().points,3140,'a new board for an already-paid Daily challenge cannot reintroduce optimistic XP after replacing its local record');
  c.queue=[];c.profile.stats={...c.profile.stats,points:3340,resultXp:3340,gen4ReturnBonusXp:500};
  c.mergeRemoteProgress([{...modern,points:515}]);
  assert.equal(c.getState().completed[modern.challengeKey].points,515,'a real canonical historical500 stays intact');
  assert.equal(c.effectiveStats().points,3340);
  const caps=fixture();caps.states.A.completed={};caps.queue=[
    {challengeKey:'daily:new',mode:'daily',points:600},{challengeKey:'starter:new',mode:'starter',points:525},
    {challengeKey:'free:new',mode:'free',difficulty:'easy',points:515},{challengeKey:'special:new',mode:'daily_special',points:700},
    {challengeKey:'tajenka:new',mode:'tajenka',points:700}];
  assert.equal(caps.pendingAuthoritativeXp(),100+25+15+200+200);
  caps.puzzleDB.starter={};caps.queue=[{challengeKey:'starter:legacy',mode:'starter',points:510}];
  assert.equal(caps.pendingAuthoritativeXp(),10,'legacy starter base10 cannot acquire a local500');
  const guest=fixture();guest.profile=null;guest.states.guest=initial();guest.states.guest.completed[modern.challengeKey].points=15;
  assert.equal(guest.reconcileLocalGen4Rewards().repairedXp,500,'guest historical migration policy is preserved');
  assert.equal(guest.getState().completed[modern.challengeKey].points,515);
  const stale=fixture();let release;stale.api=path=>{stale.requests.push(path);return new Promise(resolve=>{release=resolve})};
  const loading=stale.refreshRemoteProfile();stale.profile={id:'B',token:'b-token',stats:{points:0,xpAuthoritative:true}};
  release({stats:{points:2840,xpAuthoritative:true},completed:[{...modern,points:15}],cursor:'2026-12-03T12:04:00Z'});await loading;
  assert.equal(stale.saves,0,'a switched-account response cannot stamp canonical markers or alter either account cache');
  console.log('PASS authoritative local XP: actual phantom515 repair, canonical total, capped offline XP, lost receipt, one-time full snapshot, real500, guest migration and account race');
})().catch(error=>{console.error(error);process.exitCode=1});
