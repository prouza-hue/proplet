'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const EDITION='free-gen3-v1',REVISION='g3-reviewed-covers-20261008-r3';
function fixture(){
 const boards=[];
 for(const [difficulty,rewardXp] of Object.entries({easy:15,medium:25,hard:50,hardcore:100})){
  for(let level=1;level<=200;level++)boards.push({puzzleId:'g3-'+difficulty+'-'+level,level,difficulty,rewardXp,rewardSlotKey:'legacy-free:'+difficulty+':'+level});
 }
 const r=boards[0],puzzle={id:r.puzzleId,difficulty:r.difficulty,rows:2,cols:2,mask:[0,1,2,3],letters:['A','B','C','D'],answers:[{word:'ABDC',path:[0,1,3,2]}],meta:{level:r.level,contentGeneration:3}};
 return {catalogue:{editionId:EDITION,solutionPolicyRevision:REVISION,completeCovers:879,boards},entry:{editionId:EDITION,...r,puzzle,solutions:{puzzleId:puzzle.id,gameplayScope:'archive',solutionPolicyRevision:REVISION,solutionSets:[puzzle.answers,[{word:'DCAB',path:[3,2,0,1]}]]}}};
}
function runtime({online=false,config={archiveEnabled:true},catalogue,entry,api}={}){
 let started=null,calls=0;
 const local=new Map();
 const context={structuredClone,console,URLSearchParams,
  window:{navigator:{onLine:online},PropletOffline:{getPublicConfig:async()=>config,getArchiveCatalogue:async()=>catalogue,getArchiveEntry:async id=>entry?.puzzle.id===id?entry:null}},
  document:{querySelector:()=>null,querySelectorAll:()=>[]},
  localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},
  getProfile:()=>null,playerScope:()=> 'guest',
  api:async(...args)=>{calls++;if(api)return api(...args);throw Error('network-unavailable');},
  startGame:async(puzzle,mode,date,options)=>{started={puzzle,mode,date,options};},
 };
 vm.createContext(context);
 for(const name of ['solution-contract.js','experience.js'])vm.runInContext(fs.readFileSync(path.join(root,'public/app/archive',name),'utf8'),context,{filename:name});
 return {experience:context.window.PropletArchiveExperience,get started(){return started},get calls(){return calls}};
}
(async()=>{
 // A cached public release flag supports a true offline cold start; availability
 // of downloaded boards alone must never opt a player into a release.
 for(const config of [null,{archiveEnabled:false},{archiveEnabled:'true'}]){
  const app=runtime({config});const value=await app.experience.configure();
  assert.notEqual(value?.archiveEnabled,true);
  assert.equal(app.calls,0);
 }
 const f=fixture(),app=runtime({...f,catalogue:f.catalogue,entry:f.entry});
 assert.equal((await app.experience.configure()).archiveEnabled,true);
 assert.equal((await app.experience.loadBank()).boards.length,800);
 await app.experience.start(f.entry.puzzle.id);
 assert.equal(app.calls,0,'known offline startup performs no API calls');
 assert.equal(app.started.puzzle.meta.archiveExperience,true);
 assert.equal(app.started.mode,'free');
 assert.equal(app.started.puzzle.answers[0].word,'ABDC');
 assert.equal(app.started.options.archive,true);
 const game={puzzle:app.started.puzzle,found:[],archiveHints:[]};
 app.experience.beforeSubmit(game,'DCAB',[3,2,0,1]);
 assert.equal(game.puzzle.answers[0].word,'DCAB','offline play accepts the downloaded finite approved alternative');
 game.found=[{word:'DCAB',path:[3,2,0,1]}];
 app.experience.prepareCompletion(game);
 assert.equal(game.archiveSolution.editionId,EDITION);
 assert.equal(game.archiveSolution.solutionPolicyRevision,REVISION);
 assert.equal(game.archiveSolution.found[0].word,'DCAB');
 assert.equal(app.experience.reward(game),0,'offline completion never speculates about personal XP');
 // Failure of the network, including an expired session or captive portal,
 // still opens the previously downloaded public catalogue and approved board.
 const dropped=runtime({online:true,catalogue:f.catalogue,entry:f.entry});
 await dropped.experience.start(f.entry.puzzle.id);
 assert.equal(dropped.started.puzzle.id,f.entry.puzzle.id);
 assert.equal(dropped.calls,0,'validated immutable public downloads also avoid per-board requests online');
 const emptyCache=runtime({online:true,api:async url=>url==='/api/archive'?f.catalogue:f.entry});
 await emptyCache.experience.start(f.entry.puzzle.id);
 assert.equal(emptyCache.started.puzzle.id,f.entry.puzzle.id);
 assert.equal(emptyCache.calls,2,'missing downloads fall back to the normal public APIs');
 const outdated=fixture();outdated.entry.solutions.solutionPolicyRevision='old';
 const renewed=runtime({online:true,catalogue:f.catalogue,entry:outdated.entry,api:async()=>f.entry});
 await renewed.experience.start(f.entry.puzzle.id);
 assert.equal(renewed.started.puzzle.id,f.entry.puzzle.id);
 assert.equal(renewed.calls,1,'an entry from another revision is rejected and retrieved again');
 // Missing and mixed downloads never become playable, and don't reach startGame.
 for(const mutate of [
  f=>f.catalogue.boards.pop(),
  f=>f.catalogue.boards[1].rewardSlotKey=f.catalogue.boards[0].rewardSlotKey,
  f=>f.catalogue.solutionPolicyRevision='old',
  f=>f.entry.solutions.solutionPolicyRevision='old',
  f=>f.entry.rewardXp=999,
  f=>f.entry.puzzle.meta.level=2,
  f=>f.entry.solutions.solutionSets[1][0].path=[0,3,2,1],
  f=>f.entry=null,
 ]){
  const bad=fixture();mutate(bad);const rejected=runtime({catalogue:bad.catalogue,entry:bad.entry});
  await assert.rejects(()=>rejected.experience.start(bad.catalogue.boards[0].puzzleId));
  assert.equal(rejected.started,null);
 }
 // A fresh server closure takes precedence over an older cached enabled flag.
 const disabled=runtime({online:true,config:{archiveEnabled:true},api:async()=>({archiveEnabled:false})});
 assert.equal((await disabled.experience.configure()).archiveEnabled,false);
 console.log('PASS Archive offline download, cold start, finite solutions and public release gate');
})().catch(e=>{console.error(e);process.exitCode=1;});
