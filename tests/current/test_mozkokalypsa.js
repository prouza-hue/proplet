const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('public/app/game/state.js','utf8'),context);
let normalReads=0,normalWrites=0,isolatedWrites=0,now=0;
const session=context.PropletGameState.create({performanceNow:()=>now,dateNow:()=>now,
 readState:()=>{normalReads++;return {inProgress:{},completed:{}}},writeState:()=>normalWrites++,
 readPlaytestProgress:()=>({elapsedMs:42}),writePlaytestProgress:()=>{isolatedWrites++;return true}});
assert.equal(session.restore({id:'mk26-01'},'playtest').elapsedMs,42);
session.replace({mode:'playtest',puzzle:{id:'mk26-01'},found:[],start:0,baseElapsedMs:0});
assert(session.saveProgress());now=100;session.pause('background',{screen:'game'});
assert.equal(normalReads,0);assert.equal(normalWrites,0);assert.equal(isolatedWrites,2);
const code=fs.readFileSync('public/app/mozkokalypsa.js','utf8');
assert(!code.includes('setInterval'));assert(!code.includes('MutationObserver'));
assert(!code.includes('/api/result'));assert(!code.includes('queueResult'));
assert(code.includes('authProfile:profile'));assert(code.includes('active.scope!==scope()'));
const app=fs.readFileSync('public/app.js','utf8');
assert(app.includes("if(finishing.mode==='playtest')return window.PropletPlaytest.finish(finishing)"));
assert(fs.readFileSync('public/valid-word-feedback-v3330.js','utf8').includes("if(candidate?.mode==='playtest')return 'disabled'"));
console.log('PASS isolated local restore/save/pause, no polling, XP guarded, native completion fork');
