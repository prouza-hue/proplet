const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/app.js','utf8'),ctx={};vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('const ACHIEVEMENT_GROUPS=['),source.indexOf('function achievementCard('))+';globalThis.ach=ACHIEVEMENTS;globalThis.groups=ACHIEVEMENT_GROUPS;',ctx);
const list=ctx.ach.filter(a=>a.group==='mozkokalypsa');
assert.deepEqual(Array.from(list,a=>a.target),[1,5,10,25,50,75,100]);
assert.equal(ctx.groups.filter(g=>g[0]==='mozkokalypsa').length,1);
assert.equal(new Set(ctx.ach.map(a=>a.id)).size,ctx.ach.length);
for(const a of list){assert(!a.test({}));assert(!a.test({mozkomorCompleted:100,freeCompleted:{hardcore:100}}));assert(!a.test({freeCompleted:{mozkokalypsa:a.target-1}}));assert(a.test({freeCompleted:{mozkokalypsa:a.target}}));assert(a.test({freeCompleted:{mozkokalypsa:100}}));}
ctx.window={};vm.runInContext(fs.readFileSync('public/ribbon-catalog.js','utf8'),ctx);
const manifest=JSON.parse(fs.readFileSync('public/rewards/printshop/manifest.json')),collection=JSON.parse(fs.readFileSync('public/rewards/printshop/collection.json'));
for(const a of list){const key=ctx.window.PropletRibbonCatalog.achievement[a.name];assert(key,a.name);assert.equal(manifest[key].name,a.name);assert(collection.items.some(x=>x.key===key));const svg=fs.readFileSync('public/rewards/printshop/'+manifest[key].file,'utf8');assert(svg.includes('viewBox="0 0 320 320"'));assert(svg.includes('<title'));assert(!/<(?:image|script|animate|filter)\b/.test(svg));assert(Buffer.byteLength(svg)<16000);}
const sw=fs.readFileSync('public/sw.js','utf8');for(const a of list)assert(sw.includes('achievement-'+a.id+'.svg?v=3'));
console.log('PASS: seven boundaries, retroactive stats, separate difficulty, unique IDs, original static SVG assets and offline precache');
