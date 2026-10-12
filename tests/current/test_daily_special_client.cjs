const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
globalThis.crypto=webcrypto;
const Special=require('../../public/app/content/daily-special.js');
const Daily=require('../../public/app/content/daily-dated.js');
const Game=require('../../public/app/game/state.js');
const Queue=require('../../public/app/core/result-queue.js');
const Storage=require('../../public/app/core/storage.js');
const Statistics=require('../../public/app/account/statistics.js');
const FairPlay=require('../../public/app/game/fair-play.js');

function memory(){const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}}
const answer={word:'AB',path:[0,1]};
const puzzle=(id,difficulty)=>({id,difficulty,rows:1,cols:2,letters:['A','B'],answers:[answer],meta:{cells:2}});
const iso='2026-10-21',hash='a'.repeat(64);
const descriptor={schemaVersion:1,serverToday:iso,validUntil:'2026-10-21T22:00:00Z',dailyDate:iso,mode:'daily_special',challengeKind:'special',difficulty:'hardcore',puzzleId:'g6-ds-hardcore-w01',puzzle:puzzle('g6-ds-hardcore-w01','hardcore'),bankVersion:'specials-v1',contentHash:hash,challengeKey:`daily-special:${iso}:hardcore`,official:true,rewardEligible:true};

(async()=>{
  let day=iso,now=Date.parse('2026-10-21T12:00:00Z'),offline=false,calls=0;
  const cache=memory(),fetchFn=async()=>{calls++;await new Promise(resolve=>setImmediate(resolve));if(offline)throw Error('offline');return {ok:true,json:async()=>({schemaVersion:1,serverToday:day,validUntil:`${day}T22:00:00Z`,special:day===iso?descriptor:null,schedule:[{dailyDate:'2026-10-23',difficulty:'mozkomor'}]})}};
  const special=Special.create({storage:cache,dateISO:()=>day,now:()=>now,fetchFn});
  const [bound,bound2]=await Promise.all([special.refresh(),special.refresh()]);
  assert.equal(calls,1,'parallel reads share one special fetch');assert.equal(bound.puzzleId,bound2.puzzleId);
  const base=Daily.create({storage:cache,dateISO:()=>day,now:()=>now});
  base.remember({...descriptor,mode:'daily',challengeKey:`daily:${iso}`,puzzleId:'base',puzzle:puzzle('base','medium')});
  assert.equal(base.cached(iso).puzzleId,'base');assert.equal(special.cached(iso).puzzleId,descriptor.puzzleId,'special never replaces basic cache');
  assert.throws(()=>special.remember({...descriptor,challengeKey:`daily:${iso}`}),/binding-invalid/);
  assert.throws(()=>special.remember({...descriptor,contentHash:'b'.repeat(64)}),/binding-conflict/);
  assert.throws(()=>special.remember({...descriptor,dailyDate:'2026-10-23',challengeKey:'daily-special:2026-10-23:hardcore'}),/binding-invalid/,'future board must fail closed');
  offline=true;assert.equal((await special.refresh()).puzzleId,descriptor.puzzleId);
  const restart=Special.create({storage:cache,dateISO:()=>day,now:()=>now,fetchFn});assert.equal(restart.cached(iso).contentHash,hash);
  now=Date.parse('2026-10-21T22:01:00Z');day='2026-10-22';await assert.rejects(special.refresh());
  offline=false;assert.equal(await special.refresh(),null,'non-special day is explicit');offline=true;assert.equal(await special.refresh(),null,'same-day empty cache remains useful offline');
  const archive=await special.historical(iso,descriptor.puzzleId);assert.equal(archive.rewardEligible,false);assert.match(archive.challengeKey,/^daily-special-practice:/);assert.equal(archive.officialChallengeKey,descriptor.challengeKey);

  let state={completed:{},inProgress:{},rescues:{}};
  const gameState=Game.create({readState:()=>state,writeState:value=>state=value,performanceNow:()=>5000,dateNow:()=>now});
  const running=(p,mode,attemptId)=>({puzzle:p,mode,dailyDate:iso,found:[{answerIndex:0,word:'AB',path:[0,1],colorIndex:0}],moves:1,start:0,hints:0,attemptId,calmMode:true});
  gameState.saveProgress(running(base.cached(iso).puzzle,'daily','base-run'));
  gameState.saveProgress(running(bound.puzzle,'daily_special','special-run'));
  assert.equal(Object.keys(state.inProgress).length,2,'simultaneous base and special resumes survive');
  assert.equal(gameState.restore(bound.puzzle,'daily_special',iso).attemptId,'special-run');
  assert.equal(gameState.restore(bound.puzzle,'daily_special',iso).calmMode,true);
  const mismatched={...bound.puzzle,meta:{...bound.puzzle.meta,dailySpecialBinding:{...bound.puzzle.meta.dailySpecialBinding,contentHash:'b'.repeat(64)}}};
  assert.equal(gameState.restore(mismatched,'daily_special',iso),null,'same ID with changed content cannot resume');
  const practice=gameState.restore(archive.puzzle,'daily_special',iso);assert.equal(practice.attemptId,null,'archive receives a new practice session');assert.equal(practice.found.length,1,'expired progress remains playable');assert.equal(practice.challengeKey,archive.challengeKey);

  let queue=[],release;const blocker=new Promise(resolve=>release=resolve);
  const resultQueue=Queue.create({getQueue:()=>queue,saveQueue:value=>queue=value,post:async row=>{if(row.mode==='daily')await blocker}});
  resultQueue.enqueue({mode:'daily',challengeKey:`daily:${iso}`,puzzleId:'base',attemptId:'base-run'});
  resultQueue.enqueue({mode:'daily_special',challengeKey:descriptor.challengeKey,puzzleId:descriptor.puzzleId,attemptId:'special-run'});
  resultQueue.enqueue({mode:'daily_special',challengeKey:descriptor.challengeKey,puzzleId:descriptor.puzzleId,attemptId:'special-run'});
  assert.equal(queue.length,2,'retry is deduplicated without conflating daily keys');
  const sync=resultQueue.sync();
  resultQueue.enqueue({mode:'daily_special',challengeKey:'daily-special:2026-10-23:mozkomor',puzzleId:'future',attemptId:'new-run'});
  release();await sync;assert.equal(queue.length,1,'in-flight sync preserves concurrently queued special');
  assert.equal(queue[0].attemptId,'new-run');
  let legacyQueue=[{mode:'daily',challengeKey:`daily:${iso}`,attemptId:'legacy-overlap'},
    {mode:'daily_special',challengeKey:descriptor.challengeKey,attemptId:'legacy-overlap'}];
  const legacySync=Queue.create({getQueue:()=>legacyQueue,saveQueue:next=>legacyQueue=next,post:async row=>{if(row.mode==='daily_special'){const error=new Error('special binding invalid');error.status=400;throw error}}});
  await legacySync.sync();assert.equal(legacyQueue.length,1,'confirmation never removes a different failed legacy command');assert.equal(legacyQueue[0].mode,'daily_special');

  const storage=memory(),scoped=Storage.create({storage,getScope:()=>'guest',firstResult:(a,b)=>a.completedAt<=b.completedAt?a:b});
  const canonicalProgress=state.inProgress[descriptor.challengeKey];
  scoped.writeState('state',{completed:{[`daily:${iso}`]:{mode:'daily',puzzleId:'base'}},inProgress:{[descriptor.challengeKey]:canonicalProgress}},'guest');
  scoped.writeState('state',{completed:{},inProgress:{[descriptor.challengeKey]:{...canonicalProgress,attemptId:'other-device',elapsedMs:8000}}},'account');
  scoped.writeQueue('queue',[{mode:'daily',challengeKey:`daily:${iso}`,attemptId:'same-legacy-attempt'},{mode:'daily_special',challengeKey:descriptor.challengeKey,attemptId:'same-legacy-attempt'}],'guest');
  scoped.writeQueue('queue',[],'account');
  assert.equal(scoped.adoptGuest({profileId:'account',stateKey:'state',queueKey:'queue'}),true);
  const adopted=scoped.readState('state','account');assert.equal(adopted.completed[`daily:${iso}`].puzzleId,'base');assert.equal(adopted.inProgress[descriptor.challengeKey].mergedAttempts,true);assert.equal(scoped.readQueue('queue','account').length,2,'guest claim preserves same-day base and special commands');
  const bad=Storage.mergeProgress(canonicalProgress,{...canonicalProgress,contentHash:'b'.repeat(64),elapsedMs:12000});assert.equal(bad.contentHash,hash,'different binding cannot contaminate progress');

  const rows={base:{mode:'daily',dailyDate:iso,challengeKey:`daily:${iso}`,difficulty:'medium',puzzleId:'base',elapsedMs:3000,completedAt:'2026-10-21T12:00:00Z'},replacement:{mode:'daily',dailyDate:iso,challengeKey:`daily:${iso}`,difficulty:'medium',puzzleId:'base-new',elapsedMs:4000,completedAt:'2026-10-21T12:05:00Z'},special:{mode:'daily_special',dailyDate:iso,challengeKey:descriptor.challengeKey,difficulty:'hardcore',puzzleId:descriptor.puzzleId,elapsedMs:5000,completedAt:'2026-10-21T12:10:00Z'},replay:{mode:'daily_special',dailyDate:iso,challengeKey:descriptor.challengeKey,difficulty:'hardcore',puzzleId:descriptor.puzzleId,elapsedMs:1000,completedAt:'2026-10-21T13:10:00Z'},practice:{mode:'daily_special',dailyDate:iso,challengeKey:archive.challengeKey,difficulty:'hardcore',puzzleId:descriptor.puzzleId,elapsedMs:1000,rewardEligible:false}};
  const stats=Statistics.calculate(rows);assert.equal(stats.daily.medium.completed,1);assert.equal(stats.daily.hardcore.completed,1);assert.equal(stats.daily.hardcore.fastestMs,5000,'intentional replay does not replace first official solve');assert.equal(stats.free.hardcore.completed,0);
  const markup=Statistics.markup({data:stats,dailyCompleted:1,longestStreak:7});assert.match(markup,/<strong>2<\/strong>/);assert.match(markup,/Sérii udržuje jen základní/);

  const commands=[],fair=FairPlay.create({owner:'tab',api:async(url,options)=>{if(url.endsWith('config'))return {enabled:true};const command=JSON.parse(options.body);commands.push(command);return {attempt_id:command.attempt_id,verified:true,progress:command.progress}},profile:()=>null,elapsed:()=>0,key:(mode,p,d)=>mode==='daily'?`daily:${d}`:p.meta.dailySpecialBinding.challengeKey});
  await fair.prepare(bound.puzzle,'daily_special',iso,{attemptId:'official-session'});
  await fair.prepare(archive.puzzle,'daily_special',iso,{attemptId:'practice-session'});
  assert.equal(commands.length,2);assert.equal(commands[0].challenge_key,descriptor.challengeKey);assert.equal(commands[1].challenge_key,archive.challengeKey);
  const finishedPractice=FairPlay.create({owner:'tab',api:async url=>url.endsWith('config')?{enabled:true}:{finished:true,attempt_id:'old-practice',verified:true,progress:{found:[answer]}},profile:()=>null,completed:()=>false,elapsed:()=>0,key:()=>archive.challengeKey});
  for(let repeat=0;repeat<2;repeat++){
    const replay=await finishedPractice.prepare(archive.puzzle,'daily_special',iso,null);
    assert.equal(replay.restored,null,'finished practice starts with an empty board on every repeat');
    assert.equal(replay.replay,true);assert.equal(replay.fairPlay,false);
  }
  console.log('PASS: special/base cache isolation, immutable bindings, midnight, practice restore, queue race, guest merge, statistics and fair-play sessions');
})().catch(error=>{console.error(error);process.exit(1)});
