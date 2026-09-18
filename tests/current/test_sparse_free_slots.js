const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const code=source.slice(source.indexOf('function sortedFreeBank('),source.indexOf('function reconcileLocalGen4Rewards('));
const data=JSON.parse(fs.readFileSync(path.join(root,'data/puzzles.json'),'utf8'));
const rolling=JSON.parse(fs.readFileSync(path.join(root,'data/rolling_content_v1.json'),'utf8'));
const {create}=require('../../public/app/content/progression.js');
for(const diff of ['easy','medium','hard','hardcore','mozkomor']){
 const bank=[...data.free[diff],...(rolling.puzzles[diff]||[]).filter(p=>p.meta.availableFrom<='2026-09-18')];
 const completed=Object.fromEntries(bank.map(p=>[`free:${p.id}`,{mode:'free',difficulty:diff,puzzleId:p.id,level:p.meta.level,contentGeneration:4}]));
 const snapshot=JSON.stringify(completed);
 const ctx={puzzleDB:{...data,free:{...data.free,[diff]:bank}},DIFF:{[diff]:{}},getState:()=>({completed})};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const progress=create({sortedFreeBank:ctx.sortedFreeBank,localFreeSlotState:ctx.localFreeSlotState});
 assert.equal(progress.freeProgress(diff).done,bank.length,`${diff}: all released slots count, including numbers above bank length`);
 assert.equal(progress.freeProgress(diff).nextUnsolved,null,`${diff}: completed high slots are not offered again`);
 const last=bank.reduce((a,b)=>a.meta.level>b.meta.level?a:b);
 delete completed[`free:${last.id}`];
 assert.equal(progress.freeProgress(diff).nextUnsolved.id,last.id);
 completed[`free:${last.id}`]=JSON.parse(snapshot)[`free:${last.id}`];
 assert.deepEqual(completed,JSON.parse(snapshot),'counting does not rewrite player progress');
 const unavailable=(rolling.puzzles[diff]||[]).find(p=>p.meta.availableFrom>'2026-09-18');
 if(unavailable){
  completed.reserved={mode:'free',difficulty:diff,puzzleId:unavailable.id,level:unavailable.meta.level,contentGeneration:4};
  assert.equal(progress.freeProgress(diff).done,bank.length,'unreleased gaps do not inflate current completion count');
 }
}
console.log('PASS sparse released slots: count, next puzzle, schedule, immutable progress for all difficulties');
