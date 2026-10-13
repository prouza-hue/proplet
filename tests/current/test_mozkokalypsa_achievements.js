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
for(const a of list){
 const key=ctx.window.PropletRibbonCatalog.achievement[a.name];assert(key,a.name);assert.equal(manifest[key].name,a.name);assert(collection.items.some(x=>x.key===key));
 const image=fs.readFileSync('public/rewards/printshop/'+manifest[key].file);
 assert.equal(image.toString('ascii',0,4),'RIFF');assert.equal(image.toString('ascii',8,12),'WEBP');assert.equal(image.toString('ascii',12,16),'VP8X');
 assert(image[20]&0x10,'transparent illustration');assert.equal(image.readUIntLE(24,3)+1,512);assert.equal(image.readUIntLE(27,3)+1,512);assert(image.length<80000,'mobile asset budget');
 assert.equal(require('crypto').createHash('sha256').update(image).digest('hex'),manifest[key].source_sha256);
}
const sw=fs.readFileSync('public/sw.js','utf8');for(const a of list)assert(sw.includes('achievement-'+a.id+'.webp?v=4'));
console.log('PASS: seven boundaries, retroactive stats, separate difficulty, unique IDs, transparent illustration integrity and offline precache');

const game={mode:'free',puzzle:{difficulty:'mozkokalypsa'}},stats=n=>({freeCompleted:{mozkokalypsa:n}});
const batch=ctx.completionAchievements(stats(75),stats(76),game);assert.equal(batch.filter(a=>a.group==='mozkokalypsa').length,6);
const seen=Array.from(batch,a=>a.id);assert.equal(ctx.completionAchievements(stats(76),stats(77),game,seen).filter(a=>a.group==='mozkokalypsa').length,0);
assert.deepEqual(Array.from(ctx.completionAchievements(stats(99),stats(100),game,seen).filter(a=>a.group==='mozkokalypsa'),a=>a.id),['mozkokalypsa-100']);
for(const mode of ['daily','playtest'])assert.equal(ctx.completionAchievements(stats(75),stats(76),{...game,mode}).filter(a=>a.group==='mozkokalypsa').length,0);
assert.equal(ctx.completionAchievements(stats(100),stats(100),game).filter(a=>a.group==='mozkokalypsa').length,7,'replay celebrates existing full completion');
console.log('PASS: all retroactive badges together on next Mozkokalypsa, once per saved player state, then only future milestones');

vm.runInContext(fs.readFileSync('public/achievement-stories.js','utf8'),ctx);const stories=ctx.window.PropletAchievementStories;
assert.equal(Object.keys(stories).length,ctx.ach.length);assert.equal(new Set(Object.values(stories)).size,ctx.ach.length);
for(const a of ctx.ach){assert(stories[a.id]?.length>15,a.id);assert(stories[a.id].length<150,a.id)}
const ordered=Array.from(ctx.groups,g=>g[0]);assert.deepEqual(ordered.slice(ordered.indexOf('hardcore'),ordered.indexOf('hardcore')+3),['hardcore','mozkomor','mozkokalypsa']);
for(const asset of ['achievement-stories.js?v=1','achievement-details.js?v=3','achievement-details.css?v=3'])assert(sw.includes(asset));
console.log('PASS: all 97 unique stories, adjacent endgame difficulties and offline detail assets');
