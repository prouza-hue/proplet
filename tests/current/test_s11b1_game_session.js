#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const quality=fs.readFileSync(path.join(root,'public/quality-v334-core-v40114.js'),'utf8');
const sharing=fs.readFileSync(path.join(root,'public/competitive-sharing-v3331.js'),'utf8');
const statePath=path.join(root,'public/app/game/state.js');

function has(source,pattern,label){assert(pattern.test(source),label)}

if(!fs.existsSync(statePath)){
  has(app,/let currentGame=null;/,'legacy currentGame owner missing');
  has(app,/let timerId=null;/,'legacy timer owner missing');
  has(app,/function savedProgressFor\(/,'legacy restore path missing');
  has(app,/function gameElapsed\(/,'legacy elapsed clock missing');
  has(app,/function pauseGameClock\(/,'legacy pause path missing');
  has(app,/function resumeGameClock\(/,'legacy resume path missing');
  has(app,/function saveGameProgress\(/,'legacy persistence path missing');
  has(app,/function startTimer\(/,'legacy timer loop missing');
  has(app,/if\(Date\.now\(\)-\(currentGame\.lastAutosaveAt\|\|0\)>5000\)saveGameProgress\(\)/,'5s autosave contract missing');
  has(app,/currentGame\?\.mode==='rescue'\?100:250/,'timer cadence contract missing');
  has(app,/document\.addEventListener\('visibilitychange'.*pauseGameClock\('hidden'\).*resumeGameClock\(\)/s,'visibility pause/resume binding missing');
  has(app,/window\.addEventListener\('blur'.*pauseGameClock\('blur'\)/s,'blur pause binding missing');
  has(app,/window\.addEventListener\('focus'.*resumeGameClock\(\)/s,'focus resume binding missing');
  has(quality,/startGame=wrapped/,'calm startGame wrapper missing');
  has(quality,/saveGameProgress=wrapped/,'calm persistence wrapper missing');
  has(sharing,/startGame=function\(puzzle,mode,dailyDate,options=\{\}\)/,'sharing startGame wrapper missing');
  console.log('PASS: Sprint 11B.1 legacy GameSession lifecycle characterized');
  process.exit(0);
}

const state=require(statePath);
assert.strictEqual(typeof state.create,'function','GameSession factory missing');
has(app,/function gameSession\(/,'GameSession adapter missing');
has(app,/Object\.defineProperty\(window,'currentGame'/,'currentGame compatibility accessor missing');
has(app,/function registerGameSessionHook\(/,'session hook facade missing');
has(app,/session\.pause\(reason,/,'pause does not delegate to GameSession');
has(app,/session\.resume\(\{screen:/,'resume does not delegate to GameSession');
has(app,/session\.saveProgress\(currentGame\)/,'persistence does not delegate to GameSession');
has(app,/session\.startTimer\(tick,/,'timer does not delegate to GameSession');
assert(!/let currentGame=null;/.test(app),'legacy mutable currentGame still owns session');
assert(!/let timerId=null;/.test(app),'legacy timerId still owns timer');
assert(!/startGame=wrapped/.test(quality),'quality still overwrites startGame');
assert(!/saveGameProgress=wrapped/.test(quality),'quality still overwrites persistence');
assert(!/startGame=function\(puzzle,mode,dailyDate,options=\{\}\)/.test(sharing),'sharing still overwrites startGame');

let now=1000;
const intervals=new Map(); let nextTimer=1;
const memory={state:{completed:{},rescues:{},inProgress:{}},tajenka:{version:1,inProgress:null}};
const session=state.create({
  performanceNow:()=>now,
  dateNow:()=>1700000000000,
  setIntervalFn:(fn,ms)=>{const id=nextTimer++;intervals.set(id,{fn,ms});return id},
  clearIntervalFn:id=>intervals.delete(id),
  readState:()=>JSON.parse(JSON.stringify(memory.state)),
  writeState:s=>{memory.state=JSON.parse(JSON.stringify(s))},
  readTajenkaState:()=>JSON.parse(JSON.stringify(memory.tajenka)),
  writeTajenkaState:s=>{memory.tajenka=JSON.parse(JSON.stringify(s))},
  challengeKey:(mode,puzzle,date)=>mode==='daily'?'daily:'+date:'free:'+puzzle.id,
  samePath:(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]),
  colorCount:8,
});

const puzzle={id:'p1',difficulty:'easy',answers:[{word:'TEST',path:[0,1,2,3]}]};
session.replace({puzzle,mode:'daily',dailyDate:'2026-08-31',found:[],used:new Map(),path:[0],dragging:true,lastPointer:1,moves:0,start:now,pausedAt:null,pauseReason:null,baseElapsedMs:0,elapsedMs:0,finished:false,hints:0,wrongAttempts:0,maxHintLevel:0,attemptId:'a1',wordDiscoveryXpAwarded:0,lastAutosaveAt:0});
now=5000;
assert.strictEqual(session.elapsed(),4000);
assert.strictEqual(session.pause('hidden',{screen:'game'}),true);
assert.strictEqual(session.elapsed(),4000);
assert.deepStrictEqual(session.get().path,[]);
assert.strictEqual(memory.state.inProgress['daily:2026-08-31'].elapsedMs,4000);
now=15000;
assert.strictEqual(session.resume({screen:'game',visibilityState:'visible',focused:true}),true);
now=17000;
assert.strictEqual(session.elapsed(),6000);

session.startTimer(()=>{},250);
assert.strictEqual([...intervals.values()][0].ms,250);
session.stopTimer();
assert.strictEqual(intervals.size,0);

console.log('PASS: Sprint 11B.1 GameSession owns state, clock and persistence contracts');
