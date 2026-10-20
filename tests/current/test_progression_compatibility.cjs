'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('public/app.js','utf8');
const seam=app.slice(app.indexOf('function progression(){'),app.indexOf('function dailyOrchestration(){'));
const expected={descriptor:{puzzleId:'special'},puzzle:{id:'special'},stored:{points:100},active:{points:100},progress:null};
for(const method of [undefined,'not callable',()=>expected]){
 const state={completed:{kept:{points:100}}},original=JSON.stringify(state);
 const old={dailySpecialResultState:method,dailyResultState:()=>({active:'kept'})};
 const c={window:{PropletContentProgression:{create:()=>Object.freeze(old)}},progressionController:null,
   puzzleDB:{},datedDaily:()=>({}),datedSpecial:()=>({resultState:(date,s)=>{assert.equal(date,'2026-10-20');assert.equal(s,state);return expected}}),
   getState:()=>state,dayOffsetISO(){},sortedFreeBank(){},localFreeSlotState(){},resumableFreePuzzle(){},pragueDateISO(){},addDaysISO(){},CONTENT_PREVIEW_DATE:null};
 vm.createContext(c);vm.runInContext(seam,c);
 const controller=c.progression();
 assert.equal(controller.dailySpecialResultState('2026-10-20'),expected);
 assert.equal(controller.dailyResultState,old.dailyResultState,'other legacy methods remain untouched');
 assert.equal(c.progression(),controller,'one stable controller, no retry/reload loop');
 assert.equal(JSON.stringify(state),original,'no storage/progress change');
 if(typeof method==='function')assert.equal(controller,old,'current module is not replaced');
}
const urls=['public/index.html','public/sw.js'].map(path=>fs.readFileSync(path,'utf8').match(/\/app\/content\/progression\.js\?v=([^'"\s]+)/)[1]);
assert.equal(urls[0],urls[1]);assert.notEqual(urls[0],'dailygen6-20261008','changed module must get a new cache URL');
console.log('PASS current, absent and non-callable progression method; authoritative state preserved; coordinated cache revision');
