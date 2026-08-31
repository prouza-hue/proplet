#!/usr/bin/env node
'use strict';

const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');
const statePath=path.join(root,'public','app','game','state.js');

function assertEqual(actual,expected,label){if(actual!==expected)throw new Error(`${label}: expected ${expected}, got ${actual}`)}

if(fs.existsSync(statePath)){
  const state=require(statePath);
  let now=1000;
  const memory={state:{completed:{},rescues:{},inProgress:{}}};
  const timers=new Map();let next=1,saved=0;
  const session=state.create({
    performanceNow:()=>now,dateNow:()=>1700000000000,
    setIntervalFn:(fn,ms)=>{const id=next++;timers.set(id,{fn,ms});return id},
    clearIntervalFn:id=>timers.delete(id),
    readState:()=>JSON.parse(JSON.stringify(memory.state)),
    writeState:value=>{memory.state=JSON.parse(JSON.stringify(value));saved++},
    challengeKey:(mode,puzzle,date)=>mode==='daily'?'daily:'+date:'free:'+puzzle.id,
    samePath:(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]),colorCount:8,
  });
  const puzzle={id:'daily-test',difficulty:'easy',answers:[]};
  session.replace({puzzle,mode:'daily',dailyDate:'2026-08-31',found:[],finished:false,start:now,baseElapsedMs:0,pausedAt:null,path:[1],dragging:true,hints:0});
  now=5000;
  assertEqual(session.elapsed(),4000,'active elapsed');
  assertEqual(session.pause('hidden',{screen:'game'}),true,'pause accepted');
  assertEqual(session.get().baseElapsedMs,4000,'pause snapshots elapsed');
  assertEqual(session.get().path.length,0,'pause cancels drawn word');
  assertEqual(saved,1,'pause saves ordinary game');
  now=15000;
  assertEqual(session.elapsed(),4000,'background time excluded');
  assertEqual(session.resume({screen:'game',visibilityState:'visible',focused:true}),true,'resume accepted');
  now=17000;
  assertEqual(session.elapsed(),6000,'timer continues after resume');
  session.pause('hidden',{screen:'game'});
  assertEqual(session.resume({screen:'game',visibilityState:'hidden',focused:true}),false,'hidden document cannot resume');
  assertEqual(session.resume({screen:'game',visibilityState:'visible',focused:false}),false,'unfocused window cannot resume');
  assertEqual(session.resume({screen:'game',visibilityState:'visible',focused:true}),true,'focused visible window resumes');

  session.replace({puzzle:{id:'r1'},mode:'rescue',dailyDate:'2026-08-30',finished:false,start:now,baseElapsedMs:7000,pausedAt:null,path:[]});
  now+=3000;
  assertEqual(session.pause('blur',{screen:'game'}),true,'rescue pause accepted');
  now+=20000;
  assertEqual(session.elapsed(),10000,'rescue background time excluded');
  assertEqual(session.get().rescueElapsedMs,10000,'rescue elapsed snapshot');
  assertEqual(memory.state.rescues['2026-08-30'].elapsedMs,10000,'rescue pause is persisted');
}else{
  function functionSource(name){const start=app.indexOf(`function ${name}(`);if(start<0)throw new Error(`Missing function ${name}`);const brace=app.indexOf('{',start);let depth=0;for(let i=brace;i<app.length;i++){if(app[i]==='{')depth++;if(app[i]==='}'&&--depth===0)return app.slice(start,i+1)}throw new Error(`Unclosed function ${name}`)}
  let now=1000;
  const context={performance:{now:()=>now},document:{visibilityState:'visible',hasFocus:()=>true},currentScreen:'game',currentGame:null,timerId:1,stopTimer(){context.timerId=null},startTimer(){context.timerId=2},updateActive(){},saveGameProgress(){context.saved=(context.saved||0)+1},saveRescueProgress(){context.rescueSaved=(context.rescueSaved||0)+1}};
  vm.createContext(context);vm.runInContext([functionSource('gameElapsed'),functionSource('pauseGameClock'),functionSource('resumeGameClock')].join('\n'),context);
  context.currentGame={mode:'daily',finished:false,start:now,baseElapsedMs:0,pausedAt:null,path:[1],dragging:true};now=5000;
  assertEqual(vm.runInContext('gameElapsed()',context),4000,'active elapsed');assertEqual(vm.runInContext("pauseGameClock('hidden')",context),true,'pause accepted');
}
if(/Date\.now\(\)-g\.wallStartedAt/.test(app))throw new Error('Daily still uses wall-clock timing');
if(!app.includes("window.addEventListener('blur',()=>{releaseGameWakeLock();pauseGameClock('blur')})"))throw new Error('Missing blur pause/wake-lock binding');
if(!app.includes("window.addEventListener('focus',()=>{resumeGameClock();syncGameWakeLock()})"))throw new Error('Missing focus resume/wake-lock binding');
console.log('PASS: active gameplay clock pauses while the app is hidden or unfocused.');
