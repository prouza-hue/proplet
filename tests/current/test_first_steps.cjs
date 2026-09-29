'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
const ctx={window:{},document:{readyState:'loading',addEventListener(){}},localStorage:memory(),sessionStorage:memory(),getAnonymousId:()=> 'synthetic-guest'};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/app/engagement/first-steps.js','utf8'),ctx);
const api=ctx.window.PropletFirstSteps,p=api.trainingPuzzle({id:'old'}),used=[];
assert.equal(p.rows,3);assert.equal(p.cols,3);assert.equal(p.answers.length,3);
for(const answer of p.answers){
 assert.equal(answer.path.map(i=>p.letters[i]).join(''),answer.word);
 assert.equal(new Set(answer.path).size,answer.path.length);
 for(let i=1;i<answer.path.length;i++){
  const a=answer.path[i-1],b=answer.path[i];assert.equal(Math.abs(a%p.cols-b%p.cols)+Math.abs(Math.floor(a/p.cols)-Math.floor(b/p.cols)),1,'orthogonal neighbours only');
 }
 used.push(...answer.path);
}
assert.deepEqual([...used].sort((a,b)=>a-b),Array.from({length:9},(_,i)=>i),'exact full-board cover without overlaps');
assert.equal(p.meta.rewardXp,10,'existing one-time training reward');assert.equal(api.analyticsVersion(),'board-v3-short');
p.letters[0]='X';assert.equal(api.trainingPuzzle({}).letters[0],'P','mutable game cannot corrupt future training');
ctx.window.PROPLET_FIRST_STEPS_ENABLED=false;const old={id:'old'};assert.equal(api.trainingPuzzle(old),old);assert.equal(api.analyticsVersion(),null);
console.log('PASS three short words, valid paths, full coverage, stable reward, fresh copies and legacy fallback');
// Exercise the actual submission guard: the normal four-letter rule must not
// reject the short tutorial, nor be relaxed for other puzzle modes.
const app=fs.readFileSync('public/app.js','utf8');
const submit=app.slice(app.indexOf('function submitPath(){'),app.indexOf('function resetGame(){'));
const accepted=Error('accepted by minimum-length guard');
for(const [mode,version,word,allow] of [['starter',3,'PES',true],['starter',3,'PE',false],['starter',2,'PES',false],['free',3,'PES',false],['free',3,'STŮL',true]]){
 const game={mode,puzzle:{meta:{starterVersion:version},answers:{findIndex(){throw accepted}}},path:[0,1,2],moves:0};
 const test={currentGame:game,currentWord:()=>word,updateActive(){},message(){},renderGameBoard(){},renderGameHUD(){},$:()=>({})};
 vm.createContext(test);vm.runInContext(submit,test);
 if(allow)assert.throws(()=>test.submitPath(),error=>error===accepted);else assert.doesNotThrow(()=>test.submitPath());
}
console.log('PASS real submission accepts short tutorial and preserves normal minimum length');
ctx.window.PROPLET_FIRST_STEPS_ENABLED=true;
ctx.sessionStorage.setItem('proplet-first-steps-auth-v1',JSON.stringify({at:Date.now(),boardId:'g4-e-001',owner:'new-account',flow:{enrolled:true,firstBoardId:'g4-e-001'}}));
ctx.getAnonymousId=()=> 'rotated-guest';ctx.getProfile=()=>({id:'new-account',token:'synthetic'});
assert.equal(api.analyticsVersion(),'board-v3-short','auth return survives successful anonymous claim rotation');
ctx.getProfile=()=>({id:'other-account',token:'synthetic'});
assert.equal(api.analyticsVersion(),null,'return metadata cannot leak into another account');
ctx.getProfile=()=>null;assert.equal(api.analyticsVersion(),null,'logged-out guest does not inherit account return');
console.log('PASS auth flow survives guest rotation and remains account isolated');
ctx.getProfile=()=>null;ctx.getAnonymousId=()=> 'synthetic-experiment';
ctx.localStorage.setItem('proplet-first-steps-v1:synthetic-experiment',JSON.stringify({enrolled:true,firstStepsRunId:'0ce2fd87-ef20-4d9f-b4dd-bebac4e36db4',onboardingVersion:'board-v3-short',clientRelease:'candidate',firstBoardId:'g4-e-009',firstBoardExperiment:{key:'first-board-v1',variant:'challenger_e009',bucket:58,boardId:'g4-e-009'}}));
const headers=api.eventHeaders();
assert.equal(headers['X-Proplet-Experiment'],'first-board-v1');assert.equal(headers['X-Proplet-Experiment-Variant'],'challenger_e009');assert.equal(headers['X-Proplet-Experiment-Bucket'],'58');
console.log('PASS first-board experiment provenance survives the complete first-steps flow');
