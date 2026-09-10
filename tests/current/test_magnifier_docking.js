'use strict';
const assert=require('node:assert/strict');
const input=require('../../public/app/game/input.js');
for(const width of [390,560,760,1024]){
 const hidden=new Set(['hidden']),dock={appendChild(el){el.parentNode=this}};
 const el={classList:{add:k=>hidden.add(k),remove:k=>hidden.delete(k)},querySelector:()=>({innerHTML:''})};
 const game={puzzle:{difficulty:'hardcore',rows:1,cols:3,mask:[0,1,2],letters:['A','B','C']},path:[],used:new Map()};
 let enabled=true,submitted=0;
 const controller=input.create({getGame:()=>game,neighbours:()=>[0,1,2],getSettings:()=>({magnifier:enabled}),submit:()=>submitted++,windowObj:{innerWidth:width,innerHeight:900,matchMedia:()=>({matches:false})},navigatorObj:{maxTouchPoints:5},query:s=>s==='#touchMagnifier'?el:s==='#magnifierDock'?dock:null});
 const down=()=>controller.pointerDown({preventDefault(){},currentTarget:{dataset:{index:'0'}},clientX:10,clientY:10});
 assert(down());assert(!hidden.has('hidden'),`pointerDown must show magnifier at ${width}`);assert.equal(el.parentNode,dock);
 controller.extendPath(1);assert.deepEqual(game.path,[0,1]);assert(!hidden.has('hidden'));
 controller.pointerUp();assert(hidden.has('hidden'));assert.equal(submitted,1);
 enabled=false;down();assert(hidden.has('hidden'),'respect the off preference');
}
console.log('PASS magnifier pointer lifecycle on phone, Fold and touch tablet');
