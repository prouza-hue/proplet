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
