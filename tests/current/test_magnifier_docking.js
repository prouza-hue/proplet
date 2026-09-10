'use strict';
const assert=require('node:assert/strict');
const input=require('../../public/app/game/input.js');
const styles=new Map(),hidden=new Set(['hidden']);
let dock={left:20,top:180,width:350,height:84};
const el={style:{setProperty:(k,v)=>styles.set(k,v)},classList:{add:k=>hidden.add(k),remove:k=>hidden.delete(k)},querySelector:()=>({innerHTML:''})};
const game={puzzle:{difficulty:'hardcore',rows:1,cols:3,mask:[0,1,2],letters:['A','B','C']},path:[0],used:new Map()};
const controller=input.create({getGame:()=>game,neighbours:()=>[0,1,2],windowObj:{innerWidth:390,innerHeight:844,matchMedia:()=>({matches:true})},navigatorObj:{maxTouchPoints:1},query:s=>s==='#touchMagnifier'?el:s==='#magnifierDock'?{getBoundingClientRect:()=>dock}:null});
assert(controller.showMagnifier(0));
assert(!hidden.has('hidden'));
const oldTop=parseFloat(styles.get('--magnifier-top'));
// A word wraps during an ongoing gesture. Re-rendering must follow its new safe slot.
dock={...dock,top:240};controller.extendPath(1);
assert(parseFloat(styles.get('--magnifier-top'))>=240);
assert.notEqual(parseFloat(styles.get('--magnifier-top')),oldTop);
// Reposition into the Fold rail without keeping a phone offset.
dock={left:540,top:300,width:84,height:100};controller.renderMagnifier(1);
assert(parseFloat(styles.get('--magnifier-left'))>=540);
assert(parseFloat(styles.get('--magnifier-top'))+84<=400);
controller.pointerUp();assert(hidden.has('hidden'));
console.log('PASS magnifier follows the safe dock across wrapping and layout changes');
