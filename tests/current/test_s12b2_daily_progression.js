#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const app=read('public/app.js');
const home=read('public/home-layout.js');
const release=read('public/release-notes-v3331.js');
const menu=read('public/daily-win-menu-v40123.js');
const progressionPath=path.join(root,'public/app/content/progression.js');
const dailyPath=path.join(root,'public/app/content/daily.js');

function extractFunction(source,name){
  const start=source.indexOf(`function ${name}(`);
  assert(start>=0,`missing function ${name}`);
  const open=source.indexOf('{',start);
  let depth=0,quote=null,escaped=false,lineComment=false,blockComment=false;
  for(let i=open;i<source.length;i++){
    const ch=source[i],next=source[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++}continue}
    if(quote){if(escaped){escaped=false;continue}if(ch==='\\'){escaped=true;continue}if(ch===quote)quote=null;continue}
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue}
    if(ch==='\''||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unterminated function ${name}`);
}

function legacyFunctions(names,context){
  const source=names.map(name=>extractFunction(app,name)).join('\n');
  const sandbox={...context};
  sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.__out={${names.join(',')}}`,sandbox);
  return sandbox.__out;
}

const days=(iso,base)=>Math.round((Date.parse(`${iso}T12:00:00Z`)-Date.parse(`${base}T12:00:00Z`))/86400000);
const activeA={id:'daily-g4-a',difficulty:'easy',meta:{contentGeneration:4}};
const activeB={id:'daily-g4-b',difficulty:'medium',meta:{contentGeneration:4}};
const archive={id:'daily-g3-archive',difficulty:'hard',meta:{contentGeneration:3}};
const state={completed:{},inProgress:{}};
const puzzleDB={
  dailyGeneration4From:'2026-08-01',
  dailyRotationBaseDate:'2026-08-01',
  daily:[activeA,activeB,archive],
  archive:{dailyWindows:[{activeFrom:'2026-07-01',activeUntil:'2026-07-31',rotationBaseDate:'2026-07-01',puzzleIds:[archive.id]}]},
};
const dailyFns=legacyFunctions(['dailyBankFor','dailyPuzzleFor','dailyResultState'],{puzzleDB,dayOffsetISO:days,getState:()=>state});
assert.strictEqual(dailyFns.dailyPuzzleFor('2026-07-15').id,archive.id,'archive Daily selection drifted');
assert.strictEqual(dailyFns.dailyPuzzleFor('2026-08-01').id,activeA.id,'Gen4 Daily rotation base drifted');
assert.strictEqual(dailyFns.dailyPuzzleFor('2026-08-02').id,activeB.id,'Gen4 Daily rotation drifted');
state.completed['daily:2026-08-01']={puzzleId:activeA.id};
assert.strictEqual(dailyFns.dailyResultState('2026-08-01').active.puzzleId,activeA.id);
assert.strictEqual(dailyFns.dailyResultState('2026-08-01').legacy,null);
state.completed['daily:2026-08-01']={puzzleId:archive.id};
assert.strictEqual(dailyFns.dailyResultState('2026-08-01').active,null);
assert.strictEqual(dailyFns.dailyResultState('2026-08-01').legacy.puzzleId,archive.id);
delete state.completed['daily:2026-08-01'];
assert.strictEqual(dailyFns.dailyResultState('2026-08-01').active,null);
assert.strictEqual(dailyFns.dailyResultState('2026-08-01').legacy,null);

const levels=[1,2,3].map(level=>({id:`easy-${level}`,difficulty:'easy',meta:{level}}));
let actual=new Set(),transferred=new Set(),resume=null;
const {freeProgress}=legacyFunctions(['freeProgress'],{
  sortedFreeBank:()=>levels,
  localFreeSlotState:()=>({actual,transferred}),
  resumableFreePuzzle:()=>resume,
});
let progress=freeProgress('easy');
assert.strictEqual(progress.nextUnsolved.id,'easy-1');
assert.strictEqual(progress.done,0);
actual=new Set([1]);
resume=levels[2];
progress=freeProgress('easy');
assert.strictEqual(progress.resume.id,'easy-3','in-progress board no longer has precedence');
assert.strictEqual(progress.nextUnsolved.id,'easy-2','completed current slot blocked the next board');
transferred=new Set([2]);
assert.strictEqual(freeProgress('easy').transferred,1,'prior-generation credit drifted');
actual=new Set([1,2,3]);resume=null;
assert.strictEqual(freeProgress('easy').nextUnsolved,null,'completed bank must enter replay selection');

for(const copy of [
  'Hrát dnešní výzvu',
  'Zobrazit dnešní výsledek',
  'Zahrát novou dnešní výzvu',
  'Pokračovat v Denní výzvě',
  'Hrát novinky',
  'Týdenní várka dohraná',
])assert(`${app}\n${home}`.includes(copy),`Daily/progression copy drifted: ${copy}`);
assert(app.includes("$('#shareDailyBtn').classList.toggle('hidden',!done)"),'Daily share visibility drifted');
assert(app.includes("if(daily.active){showDailyResult(date,daily.active);return}"),'completed Daily must open its result');
assert(app.includes("startGame(daily.puzzle,'daily',date,options)"),'fresh/legacy Daily must start the selected board');
assert(menu.includes("new MutationObserver(normalize).observe(button"),'Daily result-menu observer missing');
assert(release.includes("if(!document.querySelector('#screen-daily.active'))return false"),'release modal Daily-screen guard drifted');
assert(release.includes("localStorage.setItem(SEEN_KEY,'1')"),'release modal seen marker drifted');

if(fs.existsSync(progressionPath)||fs.existsSync(dailyPath)){
  assert(fs.existsSync(progressionPath),'progression owner missing');
  assert(fs.existsSync(dailyPath),'Daily orchestration owner missing');
  const progression=require(progressionPath),daily=require(dailyPath);
  assert.strictEqual(typeof progression.create,'function');
  assert.strictEqual(typeof daily.create,'function');
  assert(!home.includes('const baseDaily=renderDaily'),'home layout still captures renderDaily');
  assert(!home.includes('renderDaily=function'),'home layout still replaces renderDaily');
  assert(!menu.includes('new MutationObserver'),'legacy result-menu observer still owns the patch');
  assert(/function renderDaily\([^)]*\)\{return dailyOrchestration\(\)\.renderDaily/.test(app),'app renderDaily is not a thin Daily-owner adapter');
  assert(/function dailyResultState\([^)]*\)\{return progression\(\)\.dailyResultState/.test(app),'app dailyResultState is not a thin progression adapter');

  const observerCalls=[],listenerCalls=[],timeoutCalls=[];
  const nodes=new Map();
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(type){listenerCalls.push([id,type])}});
    return nodes.get(id);
  };
  const controller=daily.create({
    $:selector=>node(selector),
    documentObj:{querySelector:selector=>node(selector),querySelectorAll:()=>[]},
    MutationObserverCtor:class{constructor(){observerCalls.push('new')}observe(){observerCalls.push('observe')}},
    setTimeoutFn:(fn,ms)=>{timeoutCalls.push(ms);return timeoutCalls.length},
  });
  assert.strictEqual(controller.install(),true);
  assert.strictEqual(controller.install(),false,'Daily owner duplicate install was not rejected');
  assert(observerCalls.length<=2,'duplicate Daily install added an observer');
  assert.strictEqual(new Set(listenerCalls.map(String)).size,listenerCalls.length,'duplicate Daily install added a listener');
}

console.log('PASS: Sprint 12B.2 Daily selection, fresh/replay and release CTA are characterized');
