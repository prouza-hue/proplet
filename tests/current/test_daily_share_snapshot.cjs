'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const ref=process.env.TEST_SOURCE_REF,app=ref?execFileSync('git',['show',ref+':public/app.js'],{encoding:'utf8'}):fs.readFileSync('public/app.js','utf8');
const nodes=new Map(),$=s=>{if(!nodes.has(s))nodes.set(s,{classList:{add(){},remove(){},toggle(){}},style:{setProperty(){}},dataset:{}});return nodes.get(s)};
const p={id:'daily-fixture',difficulty:'easy',answers:[{word:'PES',path:[0,1,2]}]},rec={elapsedMs:1000,moves:1};
const c={currentGame:null,COLORS:['red'],DIFF:{easy:{label:'Easy'}},$: $,pragueDateISO:()=> '2026-10-10',dailyResultState:()=>({puzzle:p,active:rec}),shareDaily(){},renderTimingStatus(){},renderTajenkaPhrase(){},renderMagnifierControls(){},getState:()=>({completed:{}}),countCz:String,esc:String};
vm.createContext(c);
if(!ref)vm.runInContext(app.slice(app.indexOf('function dailyResultSnapshot('),app.indexOf('async function showDailyResult(')),c);
const bind=app.match(/\$\('#shareDailyBtn'\)\.onclick=([^\r\n]*?);\r?\n/);
assert(bind);vm.runInContext("$('#shareDailyBtn').onclick="+bind[1]+';',c);$('#shareDailyBtn').onclick();
vm.runInContext(app.slice(app.indexOf('function updateGameFeel(){'),app.indexOf('function sleep(')),c);
vm.runInContext(app.slice(app.indexOf('function renderGameHUD(){'),app.indexOf('function fitGameBoard(')),c);
if(ref){assert.throws(()=>c.updateGameFeel(),/length/);assert.throws(()=>c.renderGameHUD(),/length/);console.log('REPRODUCED remaining Daily share snapshot: both actual consumers throw undefined.length');}
else{assert.doesNotThrow(()=>c.updateGameFeel());assert.doesNotThrow(()=>c.renderGameHUD());assert.equal(c.currentGame.isReplay,true);assert.equal(c.currentGame.found.length,1);assert.equal(c.currentGame.path.length,0);console.log('PASS Daily sharing retains complete replay state for actual HUD/game-feel consumers');}
