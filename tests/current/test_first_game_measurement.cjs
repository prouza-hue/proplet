'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const baseline=process.env.TEST_SOURCE_REF;
const source=path=>baseline?execFileSync('git',['show',baseline+':'+path],{encoding:'utf8'}):fs.readFileSync(path,'utf8');
const app=source('public/app.js');
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
const element=()=>({classList:{add(){},remove(){},toggle(){}},style:{setProperty(){}},textContent:'',innerHTML:'',dataset:{}});
const nodes=new Map(),query=s=>{if(!nodes.has(s))nodes.set(s,element());return nodes.get(s)};
const ctx={window:{},document:{readyState:'loading',addEventListener(){},querySelector:query},localStorage:memory(),sessionStorage:memory(),getAnonymousId:()=> 'test-guest',getProfile:()=>null,location:{search:'?tutorial=1'},URLSearchParams,APP_PREVIEW_RELEASE:'candidate-release',currentGame:null};
const events=[];ctx.trackProductEvent=(event,props)=>events.push({event,props,headers:ctx.window.PropletFirstSteps.eventHeaders(props)});
vm.createContext(ctx);vm.runInContext(source('public/app/engagement/first-steps.js'),ctx);
const first=ctx.window.PropletFirstSteps;
const flow='00000000-0000-4000-8000-000000000011',attempt='00000000-0000-4000-8000-000000000012';
ctx.localStorage.setItem('proplet-first-steps-v1:test-guest',JSON.stringify({enrolled:true,firstStepsRunId:flow,onboardingVersion:'board-v3-short',clientRelease:'older-release',isTest:true,firstBoardId:'g4-e-009',firstBoardExperiment:{key:'first-board-v1',variant:'challenger_e009',bucket:51,identityBucket:1,allocationPolicy:'challenger_rollout_20261007',boardId:'g4-e-009'},events:[]}));
const g={mode:'free',puzzle:{id:'g4-e-009'},attemptId:attempt,isReplay:false};ctx.currentGame=g;
if(!baseline){
 g.firstStepsTelemetry=first.captureFirstGame(g.puzzle,{firstSteps:true});
 assert(g.firstStepsTelemetry&&Object.isFrozen(g.firstStepsTelemetry.provenance));
 assert(Object.isFrozen(g.firstStepsTelemetry.provenance.assignment));
 first.recordStarted(g);first.recordStarted(g);
 ctx.getAnonymousId=()=> 'rotated-guest';ctx.APP_PREVIEW_RELEASE='unrelated-release';
 first.recordCompleted(g);first.recordCompleted(g);
 assert.deepEqual(events.map(e=>e.event),['first_board_experiment_started','first_board_experiment_completed']);
 assert(events.every(e=>e.headers['X-Proplet-First-Steps-Run']===flow&&e.headers['X-Proplet-Experiment-Variant']==='challenger_e009'&&e.headers['X-Proplet-Onboarding']==='board-v3-short'&&e.headers['X-Proplet-Client-Release']==='candidate-release'&&e.headers['X-Proplet-Test']==='1'&&e.props.attemptId===attempt));
 assert.equal(first.isFirstGame({...g,isReplay:true}),false);
 assert.equal(first.isFirstGame({...g,puzzle:{id:'g4-e-001'}}),false);
 const restoreSource=source('public/app/engagement/first-steps.js');let restored;
 const restore={game:()=>g,state:()=>({firstStepsRunId:flow,clientRelease:'older-release'}),update:patch=>{restored=patch}};
 vm.createContext(restore);vm.runInContext(restoreSource.slice(restoreSource.indexOf('  function restoreGameFlow('),restoreSource.indexOf('  function eventHeaders(')),restore);
 restore.restoreGameFlow(g);assert.equal(restored.clientRelease,'candidate-release','same pending flow upgraded from older client retains the actual producer version');
 console.log('PASS immutable per-game flow/assignment/release/test provenance, attempt link, once-only events and replay isolation');
}
// Actual historical-result constructor must create a complete game snapshot.
const puzzle={id:'g6-d-test',difficulty:'easy',answers:[{word:'PES',path:[0,1,2]},{word:'LES',path:[3,4,5]}]};
const view={currentGame:null,winDailyGlobalData:null,COLORS:['red','blue'],DIFF:{easy:{label:'Snadná'}},renderTimingStatus(){},historicalDailyPuzzle:async()=>puzzle,stopTimer(){},renderCompletionPraise(){},setWinXpDisplay(){},renderRunWinXp(){},configureWinReplay(){},updateWinAccountCta(){},renderWinFeedback(){},loadWinDailyGlobalLeaderboard(){},renderWinBadges(){},getState:()=>({completed:{}}),$:query,fmtTime:String,countCz:String,esc:String,renderTajenkaPhrase(){},renderMagnifierControls(){}};
vm.createContext(view);
if(!baseline)vm.runInContext(app.slice(app.indexOf('function dailyResultSnapshot('),app.indexOf('async function showDailyResult(')),view);
vm.runInContext(app.slice(app.indexOf('async function showDailyResult('),app.indexOf('function shareText()')),view);
vm.runInContext(app.slice(app.indexOf('function updateGameFeel(){'),app.indexOf('function sleep(')),view);
vm.runInContext(app.slice(app.indexOf('function renderGameHUD(){'),app.indexOf('function fitGameBoard(')),view);
(async()=>{
 await view.showDailyResult('2026-10-09',{elapsedMs:10000,moves:2,puzzleId:puzzle.id});
 if(baseline){
  assert.throws(()=>view.updateGameFeel(),/length/);assert.throws(()=>view.renderGameHUD(),/length/);
  console.log('REPRODUCED baseline: historical result produces undefined.length in both game-feel and HUD consumers');
 }else{
  assert.equal(view.currentGame.found.length,2);assert.equal(view.currentGame.isReplay,true);assert.equal(view.currentGame.path.length,0);
  assert.doesNotThrow(()=>view.updateGameFeel());assert.doesNotThrow(()=>view.renderGameHUD());
  console.log('PASS historical result supports both actual length consumers without exceptions');
  // Measurement commit must precede optional results decorations and hooks.
  const finish=app.slice(app.indexOf('async function finishGame(){'),app.indexOf('function accountNudgeState(){'));
  assert(finish.indexOf('recordCompleted(g)')<finish.indexOf('completionAchievements('));
  assert(app.indexOf('recordStarted(currentGame)')<app.indexOf("runGameSessionHooks('afterStart'"));
  console.log('PASS first-game start/completion recorded before optional UI hooks');
 }
})().catch(e=>{console.error(e);process.exitCode=1});
