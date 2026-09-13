const fs=require('fs'),vm=require('vm'),assert=require('assert');
const app=fs.readFileSync('public/app.js','utf8');
const levelsCode=app.match(/const LEVELS=\[[\s\S]*?\n\];/)[0];
const levelForCode=app.match(/function levelFor\(points\)\{[^\n]+/)[0];
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(levelsCode+'\n'+levelForCode+'\nthis.levels=LEVELS;',ctx);
vm.runInContext(fs.readFileSync('public/ribbon-catalog.js','utf8'),ctx);
const levels=ctx.levels,catalog=ctx.window.PropletRibbonCatalog.rank;
assert.equal(levels.length,35);
assert.deepEqual(Object.keys(catalog),Array.from(levels,x=>x.name));
for(let i=0;i<levels.length;i++){
 const level=levels[i];
 assert.equal(ctx.levelFor(level.xp).current.name,level.name);
 assert.equal(ctx.levelFor(level.xp).index,i+1);
 if(i){assert(level.xp>levels[i-1].xp);assert.equal(ctx.levelFor(level.xp-1).current.name,levels[i-1].name)}
 assert(fs.existsSync('public/rewards/printshop/'+catalog[level.name]+'.svg'));
}
for(const xp of [61000,63410,67352,74999])assert.equal(ctx.levelFor(xp).current.name,'Absolutní Propletač');
assert.equal(levels[34].name,'Legenda bez konce');
const source=fs.readFileSync('public/organic-ui-v4023.js','utf8');
const start=source.indexOf(" decorationAll('.ranking-rank-chip').forEach(slot=>{");
const code=source.slice(start,source.indexOf('\n });',start)+5);
let writes=0;
const slots=levels.map(level=>({textContent:level.icon+' '+level.name,artwork:null,classList:{add(){}},querySelector(){return this.artwork},replaceChildren(art,text){this.artwork=art;this.textContent=text;writes++}}));
ctx.decorationAll=()=>slots;
ctx.document={createTextNode:t=>t};
ctx.art=(name)=>({name,setAttribute(){}});
vm.runInContext(code,ctx);
slots.forEach((slot,i)=>{assert.equal(slot.textContent.trim(),levels[i].name);assert.equal(slot.artwork.name,levels[i].name)});
for(let i=0;i<100;i++)vm.runInContext(code,ctx);
assert.equal(writes,35,'decoration must converge without repeated DOM writes');
console.log('PASS: all 35 rank thresholds, catalog order, full titles and stable decoration');
