#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'../..');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');
const boardPath=path.join(root,'public/app/game/board.js');
const inputPath=path.join(root,'public/app/game/input.js');
const hintsPath=path.join(root,'public/app/game/hints.js');

function has(source,pattern,label){assert(pattern.test(source),label)}

if(!fs.existsSync(boardPath)||!fs.existsSync(inputPath)||!fs.existsSync(hintsPath)){
  has(app,/function fitGameBoard\(\)/,'legacy board fit missing');
  has(app,/gridTemplateColumns=`repeat\(\$\{p\.cols\},minmax\(0,1fr\)\)`/,'2D board columns drifted');
  has(app,/gridTemplateRows=`repeat\(\$\{p\.rows\},minmax\(0,1fr\)\)`/,'2D board rows drifted');
  has(app,/targetH=cell\*p\.rows\+rowGap\*\(p\.rows-1\)/,'2D board height fit drifted');
  has(app,/function renderGameBoard\(\)/,'legacy board renderer missing');
  has(app,/addEventListener\('pointerdown',pointerDown\)/,'board pointerdown binding missing');
  has(app,/addEventListener\('pointerenter',pointerEnter\)/,'board pointerenter binding missing');
  has(app,/function pNeighbours\(i\)/,'legacy neighbour policy missing');
  has(app,/function extendPath\(i\)/,'legacy path extension missing');
  has(app,/i===path\.at\(-2\).*path\.pop\(\)/s,'backtrack contract missing');
  has(app,/!pNeighbours\(last\)\.includes\(i\)/,'orthogonal neighbour guard missing');
  has(app,/Math\.ceil\(dist\/6\)/,'pointer sampling density drifted');
  has(app,/function pointerDown\(e\)/,'pointerDown missing');
  has(app,/g\.used\.has\(i\)\|\|g\.wrongPath\?\.length/,'pointerDown blocked-cell guard missing');
  has(app,/showTouchMagnifier\(i\)/,'magnifier start missing');
  has(app,/function pointerUp\(\).*submitPath\(\)/s,'pointerUp submit missing');
  has(app,/\['hard','hardcore','mozkomor'\]\.includes\(g\.puzzle\?\.difficulty\)/,'magnifier difficulty policy missing');
  has(app,/shortSide<=600/,'magnifier device width policy missing');
  has(app,/function pickHintTarget\(\)/,'hint target selection missing');
  has(app,/sort\(\(x,y\)=>\(x\.a\.turns\|\|0\)-\(y\.a\.turns\|\|0\)\|\|x\.a\.word\.length-y\.a\.word\.length\)/,'hint target ordering drifted');
  has(app,/function applySmartHint\(level\)/,'hint application missing');
  has(app,/g\.hints=\(g\.hints\|\|0\)\+1/,'hint count contract missing');
  has(app,/g\.maxHintLevel=Math\.max\(g\.maxHintLevel\|\|0,level\)/,'max hint level contract missing');
  has(app,/g\.cleanSolve=false/,'hint clean-solve contract missing');
  has(app,/if\(source==='helper'\)g\.helperHintUsed=true/,'helper hint attribution missing');
  console.log('PASS: Sprint 11B.2 board/input/hint legacy behavior characterized');
  process.exit(0);
}

const board=require(boardPath), input=require(inputPath), hints=require(hintsPath);
assert.strictEqual(typeof board.create,'function');
assert.strictEqual(typeof input.create,'function');
assert.strictEqual(typeof hints.create,'function');

has(index,/\/app\/game\/board\.js/,'board module not loaded');
has(index,/\/app\/game\/input\.js/,'input module not loaded');
has(index,/\/app\/game\/hints\.js/,'hints module not loaded');
has(sw,/\/app\/game\/board\.js/,'board module not in shell');
has(sw,/\/app\/game\/input\.js/,'input module not in shell');
has(sw,/\/app\/game\/hints\.js/,'hints module not in shell');
has(app,/function gameBoard\(\)/,'board adapter missing');
has(app,/function gameInput\(\)/,'input adapter missing');
has(app,/function gameHints\(\)/,'hints adapter missing');
has(app,/function renderGameBoard\(\)\{return gameBoard\(\)\?\.render\(\)\}/,'board render adapter missing');
has(app,/function pointerDown\(e\)\{return gameInput\(\)\?\.pointerDown\(e\)\}/,'pointer adapter missing');
has(app,/function pickHintTarget\(\)\{return gameHints\(\)\?\.pickTarget\(\)\|\|null\}/,'hint target adapter missing');

const game={
  puzzle:{rows:2,cols:3,mask:[0,1,2,4],letters:['A','B','C','X','D','X'],answers:[
    {word:'LONG',path:[0,1,2,4],turns:2},
    {word:'BETA',path:[1,2,4,0],turns:1},
    {word:'OMEGA',path:[2,1,0,4],turns:1},
  ]},
  found:[],used:new Map(),path:[0],wrongPath:[],dragging:true,lastPointer:null,
  mode:'free',finished:false,hints:0,maxHintLevel:0,cleanSolve:true,nextHintSource:'manual',isReplay:false,
};
const b=board.create({getGame:()=>game});
assert.deepStrictEqual(b.neighbours(1),[4,0,2]);
assert.deepStrictEqual(b.neighbours(4),[1]);

const events=[];
const inp=input.create({
  getGame:()=>game,
  neighbours:i=>b.neighbours(i),
  updateActive:()=>events.push('active'),
  renderMagnifier:i=>events.push('mag:'+i),
  fx:name=>events.push('fx:'+name),
});
assert.strictEqual(inp.extendPath(1),true);
assert.deepStrictEqual(game.path,[0,1]);
assert.strictEqual(inp.extendPath(0),true);
assert.deepStrictEqual(game.path,[0]);
game.path=[0,1];
assert.strictEqual(inp.extendPath(4),true);
assert.deepStrictEqual(game.path,[0,1,4]);
assert.strictEqual(inp.extendPath(2),false);

function fakeClassList(){
  const values=new Set();
  return {add:(...names)=>names.forEach(name=>values.add(name)),remove:(...names)=>names.forEach(name=>values.delete(name)),contains:name=>values.has(name)};
}
function fakeStyle(){
  const values=new Map();
  return {setProperty:(name,value)=>values.set(name,value),removeProperty:name=>values.delete(name),get:name=>values.get(name)};
}
const zoomWrap={classList:fakeClassList(),style:fakeStyle(),getBoundingClientRect:()=>({left:10,top:20,width:240,height:240})};
const zoomStage={classList:fakeClassList()};
const zoomCell={getBoundingClientRect:()=>({left:58,top:68,width:24,height:24})};
const zoomGame={puzzle:{difficulty:'hard'},finished:false};
const zoomInput=input.create({
  getGame:()=>zoomGame,
  query:selector=>selector==='#boardWrap'?zoomWrap:selector==='#boardStage'?zoomStage:selector==='.cell[data-index="7"]'?zoomCell:null,
  windowObj:{matchMedia:()=>({matches:true}),visualViewport:{width:390,height:844},innerWidth:390,innerHeight:844},
  navigatorObj:{maxTouchPoints:5},
  getSettings:()=>({magnifier:true}),
});
assert.strictEqual(zoomInput.showMagnifier(7,86,104),true,'touch zoom should activate on supported hard board');
assert.strictEqual(zoomWrap.classList.contains('touch-board-zoom'),true,'board zoom class missing');
assert.strictEqual(zoomStage.classList.contains('touch-board-zoom-active'),true,'board stage clipping class missing');
assert.strictEqual(zoomWrap.style.get('--touch-zoom-x'),'76px','zoom anchor x should stay under the pointer');
assert.strictEqual(zoomWrap.style.get('--touch-zoom-y'),'84px','zoom anchor y should stay under the pointer');
assert.strictEqual(zoomWrap.style.get('--touch-zoom-scale'),'1.8','zoom scale drifted');
zoomInput.hideMagnifier();
assert.strictEqual(zoomWrap.classList.contains('touch-board-zoom'),false,'board zoom should reset on release');
assert.strictEqual(zoomStage.classList.contains('touch-board-zoom-active'),false,'board stage clipping state should reset on release');

const h=hints.create({getGame:()=>game,supportMode:()=> 'standard'});
let target=h.pickTarget();
assert.strictEqual(target.i,1,'hint should prefer fewer turns then shorter word');
let plan=h.applyState(2);
assert.strictEqual(plan.level,2);
assert.strictEqual(game.hints,1);
assert.strictEqual(game.maxHintLevel,2);
assert.strictEqual(game.cleanSolve,false);
game.nextHintSource='helper';
plan=h.applyState(1);
assert.strictEqual(game.helperHintUsed,true);
assert.strictEqual(plan.source,'helper');

game.mode='starter';game.found=[];game.hints=0;game.maxHintLevel=0;game.cleanSolve=true;
target=h.pickTarget();
assert.strictEqual(target.i,2,'starter third answer target contract');
plan=h.applyState(1);
assert.strictEqual(game.hints,0,'starter hint does not increment scored hints');
assert.strictEqual(game.starterHintUsed,true);

console.log('PASS: Sprint 11B.2 board/input/hints modules preserve interaction policies');
