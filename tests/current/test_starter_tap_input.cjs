'use strict';
const assert=require('node:assert/strict');
const input=require(process.env.INPUT_MODULE||'../../public/app/game/input.js');
const paths=[[0,1,2],[3,6,7],[4,5,8]];
function harness(mode='starter',version=3){
 let game;const submissions=[],feedback=[];
 const reset=()=>game={mode,puzzle:{meta:{starterVersion:version},cols:3,letters:[...'PESLČAESJ'],answers:paths.map(path=>({path}))},found:[],used:new Map(),path:[],dragging:false};reset();
 const cell=index=>({dataset:{index:String(index)},setPointerCapture(){},closest(){return this}});
 const xy=index=>({clientX:(index%3)*50+25,clientY:Math.floor(index/3)*50+25});
 const event=(index,id=1)=>({currentTarget:cell(index),pointerId:id,isPrimary:true,button:0,preventDefault(){},...xy(index)});
 const api=input.create({getGame:()=>game,neighbours:i=>[i-3,i+3,i-1,i+1].filter(j=>j>=0&&j<9&&Math.abs(j%3-i%3)+Math.abs(Math.floor(j/3)-Math.floor(i/3))===1),documentObj:{elementFromPoint:(x,y)=>cell(Math.floor(y/50)*3+Math.floor(x/50))},feedback:s=>feedback.push(s),submit:()=>{submissions.push([...game.path]);const ai=paths.findIndex(p=>JSON.stringify(p)===JSON.stringify(game.path));if(ai>=0){game.found.push({answerIndex:ai});game.path.forEach(i=>game.used.set(i,ai))}game.path=[];}});
 const tap=i=>{api.pointerDown(event(i));api.pointerUp(event(i));};
 const drag=path=>{api.pointerDown(event(path[0]));for(const i of path.slice(1))api.pointerMove(event(i));api.pointerUp(event(path.at(-1)));};
 return {api,tap,drag,event,submissions,feedback,game:()=>game,restart:reset};
}
for(const kinds of [['tap','tap','tap'],['drag','drag','drag'],['tap','drag','tap'],['drag','tap','drag']]){
 const h=harness();paths.forEach((path,i)=>{if(kinds[i]==='tap')path.forEach(h.tap);else h.drag(path);assert.equal(h.game().found.length,i+1);assert.deepEqual(h.game().path,[]);assert.equal(h.game().starterPointer,null)});assert.deepEqual(h.submissions,paths);h.api.pointerUp();assert.equal(h.submissions.length,3);
}
{
 const h=harness();h.tap(0);assert.deepEqual(h.game().path,[0]);assert.equal(h.submissions.length,0);
 h.tap(4);assert.deepEqual(h.game().path,[]);assert.equal(h.feedback.length,1);
 h.tap(0);h.tap(1);h.tap(1);assert.deepEqual(h.game().path,[],'repeated non-start resets');
 h.tap(0);h.tap(1);h.tap(0);assert.deepEqual(h.game().path,[0],'first cell starts over');
 h.api.pointerDown(h.event(1));h.api.pointerCancel(h.event(1));h.api.pointerUp(h.event(1));assert.deepEqual(h.game().path,[]);assert.equal(h.submissions.length,0);
 h.tap(0);h.api.resetStarter();h.tap(1);assert.equal(h.submissions.length,0);assert.deepEqual(h.game().path,[]);
 h.tap(0);h.restart();h.tap(1);assert.deepEqual(h.game().path,[],'new run cannot inherit prefix');
 paths[0].forEach(h.tap);h.tap(3);h.tap(0);assert.deepEqual(h.game().path,[],'used cell resets pending prefix');
}
{
 const h=harness();h.api.pointerDown(h.event(0));h.api.pointerDown(h.event(1,2));h.api.pointerUp(h.event(1,2));h.api.pointerCancel(h.event(1,2));assert(h.game().dragging,'other finger cannot submit or cancel');
 h.api.pointerMove({...h.event(0),clientX:28});h.api.pointerUp(h.event(0));assert.deepEqual(h.game().path,[0],'small finger jitter stays tap');h.tap(1);h.tap(2);assert.equal(h.submissions.length,1);
}
{
 const h=harness();h.tap(0);h.drag(paths[0]);assert.deepEqual(h.submissions,[paths[0]],'drag from pending tap starts a fresh route');
 const j=harness();j.api.pointerDown(j.event(0));j.api.pointerEnter(j.event(1));j.api.pointerEnter(j.event(2));j.api.pointerUp(j.event(2));assert.deepEqual(j.submissions,[paths[0]]);
}
for(const [mode,version] of [['free',3],['daily',3],['starter',2]]){const h=harness(mode,version);h.tap(0);assert.deepEqual(h.submissions,[[0]],'legacy/non-starter input unchanged');}
console.log('PASS real input adapter: all words tap/drag/mixed, invalid/repeat/restart/cancel, pointer ownership, jitter, scope and exactly-once submission');
