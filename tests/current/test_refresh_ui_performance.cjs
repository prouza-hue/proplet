const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const fixedPath=require('node:path').join(__dirname,'../../public/app/content/refresh-ui.js');
function measure(source){
  let reads=0,completed={};
  for(let i=0;i<1500;i++)completed['free:history-'+i]={puzzleId:'history-'+i,mode:'free',difficulty:'hard',elapsedMs:60000+i,moves:12,hints:0,cleanSolve:true,points:40,completedAt:'2026-10-03T20:00:00Z'};
  completed['free:g6-refresh-hard-0']={mode:'free'};
  let serialized=JSON.stringify({completed,inProgress:{'free:g6-refresh-hard-18':{mode:'free',difficulty:'hard',puzzleId:'g6-refresh-hard-18',found:[],elapsedMs:10000}}});
  const counters={},buttons=Array.from({length:300},(_,i)=>({dataset:{sharedBoard:'g6-refresh-hard-'+i},classList:{toggle(_,done){this.done=done}},setAttribute(){}}));
  const root={querySelector:()=>({}),set innerHTML(value){this.html=value}};
  const cards=Object.fromEntries(['easy','medium','hard'].map(diff=>[diff,{querySelector(selector){if(selector==='.refresh-count')return null;return {append(counter){counters[diff]=counter.textContent}}}}]));
  const document={addEventListener(){},getElementById(id){return id==='freeRefreshToday'?root:null},querySelector(selector){return cards[selector.match(/data-diff="([^"]+)"/)?.[1]]||null},querySelectorAll(){return buttons},createElement(){return {}}};
  const context={window:{},document,getState(){reads++;return JSON.parse(serialized)},getProfile:()=>({id:'test'}),localStorage:{getItem:()=>null},puzzleDB:{free:Object.fromEntries(['easy','medium','hard'].map(diff=>[diff,Array.from({length:100},(_,i)=>({id:'g6-refresh-'+diff+'-'+i,difficulty:diff}))]))}};
  vm.createContext(context);
  // Expose the existing closures only in this isolated harness; shipping code stays private.
  vm.runInContext(source.replace('  function install(){','  global.__test={refresh,updateCatalogue};\n  function install(){'),context);
  const started=performance.now();context.window.__test.refresh();const elapsed=performance.now()-started,refreshReads=reads;
  assert.deepEqual(counters,{},'retired new-board counts must not be recreated');assert.equal(buttons[0].classList.done,true);assert.equal(buttons[1].classList.done,false);
  // Account/history changes must be reflected by a new standalone catalogue pass.
  serialized=JSON.stringify({completed:{'free:g6-refresh-hard-1':{mode:'free'}}});reads=0;context.window.__test.updateCatalogue();
  assert.equal(buttons[0].classList.done,false);assert.equal(buttons[1].classList.done,true);
  return {refreshReads,catalogueReads:reads,elapsedMs:+elapsed.toFixed(1)};
}
const fixed=measure(fs.readFileSync(fixedPath,'utf8'));
assert.equal(fixed.refreshReads,1);assert.equal(fixed.catalogueReads,1);
console.log('fixed',fixed);
if(process.argv[2]){const baseline=measure(fs.readFileSync(process.argv[2],'utf8'));assert.equal(baseline.refreshReads,900);assert.equal(baseline.catalogueReads,300);console.log('baseline',baseline);}
