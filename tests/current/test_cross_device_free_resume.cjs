'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Engine=require('../../public/app/content/free-order-engine.js');
const Store=require('../../public/app/content/free-order-store.js');
const Progression=require('../../public/app/content/progression.js');
const FairPlay=require('../../public/app/game/fair-play.js');

// Exercise the shipping menu adapter, store and session transport together. Each
// device has independent browser storage; only the bounded fake server is shared.
const source=fs.readFileSync('public/app.js','utf8');
const adapter=source.slice(source.indexOf('function freeProgress(diff)'),source.indexOf('\n',source.indexOf('function freeProgress(diff)')));
const render=source.slice(source.indexOf('function renderFree(){'),source.indexOf('\nasync function startFree('));
const start=source.slice(source.indexOf('async function startFree(diff)'),source.indexOf('\nfunction showStarterDailyNudge('));
const homeSource=fs.readFileSync('public/home-layout.js','utf8');
const homeResume=homeSource.slice(homeSource.indexOf('function latestFreeResume(){'),homeSource.indexOf('\n  function difficultyTiles('));
const difficulties=['easy','medium','hard','hardcore','mozkomor','mozkokalypsa'];
const banks=Object.fromEntries(difficulties.map(d=>[d,Array.from({length:3},(_,i)=>({id:`${d}-${i}`,difficulty:d,meta:{level:i+1}}))]));
const clone=value=>structuredClone(value);

function server(){
 const sessions=new Map();let activity=0;
 async function api(path,options={}){
  if(path.endsWith('/config'))return {enabled:true,heartbeatMs:25000};
  assert.equal(options.authProfile.id,'same-account','all session data is scoped to the signed-in player');
  if(path==='/api/free-order'){
   const resumeIds={};
   for(const row of [...sessions.values()].sort((a,b)=>a.activity-b.activity))if(!row.finished)resumeIds[row.difficulty]=row.puzzle_id;
   return {enabled:true,records:{},resumeIds};
  }
  assert.equal(path,'/api/play-session');
  const command=JSON.parse(options.body),previous=sessions.get(command.puzzle_id);
  if(previous&&!previous.paused&&previous.owner_id!==command.owner_id){const error=new Error('open elsewhere');error.status=409;throw error;}
  const progress=command.action==='open'&&previous?previous.progress:command.progress;
  const row={...command,progress:clone(progress),attempt_id:previous?.attempt_id||command.attempt_id,paused:command.action==='pause',activity:++activity,finished:command.action==='finish'};
  sessions.set(row.puzzle_id,row);
  if(command.action==='pause')assert.equal(options.keepalive,true,'closing snapshot survives navigation');
  return {attempt_id:row.attempt_id,progress:clone(row.progress),elapsed_ms:row.progress.elapsedMs,verified:true,finished:row.finished};
 }
 return {api,sessions};
}

function device(name,shared){
 const memory=new Map(),completed=new Set(),localResume=new Map();let profile={id:'same-account',token:'synthetic'},opened=null,opening=null;
 const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const store=Store.create({engine:Engine,storage,profile:()=>profile,bank:d=>banks[d],completed:d=>banks[d].filter(p=>completed.has(p.id)).map(p=>p.id),uuid:()=>`${name}-request`,api:shared.api});
 const fairPlay=FairPlay.create({owner:name,profile:()=>profile,elapsed:g=>g.elapsedMs||0,key:(_m,p)=>`free:${p.id}`,now:()=>0,isOnline:()=>true,setInterval:()=>1,clearInterval(){},api:shared.api});
 const progression=Progression.create({sortedFreeBank:d=>banks[d],localFreeSlotState:d=>({actual:new Set(banks[d].filter(p=>completed.has(p.id)).map(p=>p.meta.level)),transferred:new Set()}),resumableFreePuzzle:d=>localResume.get(d)||null});
 const cards={innerHTML:''};
 const context=vm.createContext({progression:()=>progression,freeOrder:()=>store,getProfile:()=>profile,navigator:{onLine:true},allowAccountGameStart:()=>true,
  startGame(p,mode,date){opened=p;opening=fairPlay.prepare(p,mode,date,null);},showToast:message=>assert.fail(message),
  renderAccountProgressStatus(){},renderNewContentBanner(){},renderFreeResumeCard(){},newContentCount:()=>0,freeHistory:()=>({progress:[]}),
  DIFF:Object.fromEntries(difficulties.map(d=>[d,{label:d,xp:100}])),esc:s=>s,difficultyIconMarkup:()=>'',
  $:selector=>selector==='#difficultyCards'?cards:null,$$:()=>[],window:{}});
 vm.runInContext(adapter+'\n'+render+'\n'+start+'\n'+homeResume,context);
 return {store,fairPlay,memory,completed,localResume,context,cards,setProfile:p=>profile=p,
  async open(diff){await context.startFree(diff);return {puzzle:opened,prepared:await opening};}};
}

(async()=>{
 for(const difficulty of difficulties){
  const shared=server(),desktop=device('desktop',shared),mobile=device('mobile',shared);
  await desktop.store.configure();await mobile.store.configure();
  const target=banks[difficulty][2],stale=banks[difficulty][0];
  desktop.localResume.set(difficulty,stale);mobile.localResume.set(difficulty,stale);
  const first=await desktop.fairPlay.prepare(target,'free',null,{attemptId:`attempt-${difficulty}`});
  const game={puzzle:target,mode:'free',attemptId:first.restored.attemptId,fairPlay:true,
   found:[{answerIndex:0,word:'TEST',path:[0,1,2,3],colorIndex:0}],elapsedMs:18000,moves:3,hints:1,wrongAttempts:1,maxHintLevel:2};
  await desktop.fairPlay.pause(game);
  await mobile.store.sync();
  mobile.localResume.clear();
  const home=mobile.context.latestFreeResume();
  assert.equal(home?.difficulty,difficulty,`${difficulty}: Today discovers the remote board even without any local history`);
  assert.equal(home.q.resume.id,target.id);
  mobile.localResume.set(difficulty,stale);mobile.context.renderFree();
  assert.match(mobile.cards.innerHTML,new RegExp(`data-play-free="${difficulty}" aria-label="Pokračovat:`),`${difficulty}: a fresh remote session is visibly offered as Continue`);
  assert.equal(mobile.context.freeProgress(difficulty).resume.id,target.id,`${difficulty}: remote session wins over a stale local board`);
  const received=await mobile.open(difficulty);
  assert.equal(received.puzzle.id,target.id,`${difficulty}: desktop to mobile opens the exact board`);
  for(const field of ['found','elapsedMs','moves','hints','wrongAttempts','maxHintLevel'])assert.deepEqual(received.prepared.restored[field],game[field],`${difficulty}: transfers ${field}`);
  const continued={...game,...received.prepared.restored,puzzle:target,fairPlay:true,found:[...game.found,{answerIndex:1,word:'SLOVO',path:[4,5,6,7,8],colorIndex:1}],elapsedMs:35000,moves:4};
  await mobile.fairPlay.pause(continued);
  await desktop.store.sync();desktop.context.renderFree();
  const returned=await desktop.open(difficulty);
  assert.equal(returned.puzzle.id,target.id,`${difficulty}: mobile to desktop opens the same board`);
  assert.deepEqual(returned.prepared.restored.found,continued.found,`${difficulty}: return journey keeps newly found words`);
  assert.equal(returned.prepared.restored.elapsedMs,35000);
  assert.equal(returned.prepared.restored.hints,1);
  desktop.completed.add(target.id);
  assert.equal(desktop.context.freeProgress(difficulty).resume.id,stale.id,`${difficulty}: completed server boards are never resumed`);
  mobile.setProfile({id:'different-account',token:'other'});
  assert.equal(mobile.context.freeProgress(difficulty).resume.id,stale.id,`${difficulty}: changing accounts cannot expose the previous account's remote board`);
 }
 console.log('PASS six free difficulties: independent devices, visible Continue, stale local override, exact board and full progress in both directions, completion and account isolation');
})().catch(error=>{console.error(error);process.exitCode=1;});
