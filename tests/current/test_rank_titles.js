const fs=require('fs'),vm=require('vm'),assert=require('assert');
const app=fs.readFileSync('public/app.js','utf8');
const levelsCode=app.match(/const LEVELS=\[[\s\S]*?\n\];/)[0];
const levelForCode=app.match(/function levelFor\(points\)\{[^\n]+/)[0];
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(levelsCode+'\n'+levelForCode+'\nthis.levels=LEVELS;',ctx);
vm.runInContext(fs.readFileSync('public/ribbon-catalog.js','utf8'),ctx);
const levels=ctx.levels,catalog=ctx.window.PropletRibbonCatalog.rank;
assert.equal(levels.length,51);
assert.deepEqual(Object.keys(catalog),Array.from(levels,x=>x.name));
for(let i=0;i<levels.length;i++){
 const level=levels[i];
 assert.equal(ctx.levelFor(level.xp).current.name,level.name);
 assert.equal(ctx.levelFor(level.xp).index,i+1);
 if(i){assert(level.xp>levels[i-1].xp);assert.equal(ctx.levelFor(level.xp-1).current.name,levels[i-1].name)}
 assert(fs.existsSync('public/rewards/printshop/'+catalog[level.name]+'.svg'));
}
for(const xp of [115000,117500,119999])assert.equal(ctx.levelFor(xp).current.name,'Absolutní Propletač');
assert.equal(ctx.levelFor(61000).current.name,'Strážce souhvězdí');
assert.equal(ctx.levelFor(67352).current.name,'Mistr hvězdných cest');
const plan=JSON.parse(fs.readFileSync('design/rank-progression/plan.json','utf8'));
for(const previous of plan.old)assert(levels.some(x=>x.xp===previous.xp),'Every existing XP threshold remains');
assert.deepEqual(Array.from(levels,x=>x.name),plan.levels.map(x=>x.name));
assert.equal(Math.max(...levels.slice(1).map((x,i)=>x.xp-levels[i].xp)),5000);
assert.equal(new Set(levels.map(x=>x.name)).size,51);
for(const xp of [...plan.old,...levels].flatMap(x=>[Math.max(0,x.xp-1),x.xp])){
 const before=plan.old.filter(x=>x.xp<=xp).length;
 assert(ctx.levelFor(xp).index>=before,'Existing players must not lose numeric levels');
 const oldNext=plan.old.find(x=>x.xp>xp),newNext=ctx.levelFor(xp).next;
 if(oldNext)assert(newNext && newNext.xp<=oldNext.xp,'No player should have a farther next XP milestone');
}
assert.equal(levels[50].name,'Legenda bez konce');
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
assert.equal(writes,51,'decoration must converge without repeated DOM writes');
console.log('PASS: all 51 rank thresholds, catalog order, full titles and stable decoration');
