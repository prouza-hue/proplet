const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{},document:{documentElement:{classList:{add(){}}}}};vm.createContext(context);
for(const file of ['public/ribbon-catalog.js','public/ribbon-ui.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const id=context.window.PropletRibbonArt.identity;
assert.equal(id('Blesk').key,null,'Ambiguous reward must not silently choose a category');
assert.equal(id('Blesk','streak').key,'streak-06');assert.equal(id('Blesk','achievement').key,'achievement-speed-60');
assert.equal(id('Nový odznak · Blesk','streak').key,'streak-06');assert.equal(id('18 · Slovní alchymista','rank').key,'alchymista');
const source=fs.readFileSync('public/app.js','utf8');
for(const [section,category] of [['LEVELS','rank'],['BADGES','streak'],['ACHIEVEMENTS','achievement']]){
 const body=source.split('const '+section+'=[')[1].split('];')[0];
 for(const match of body.matchAll(/name:'([^']+)'/g))assert(id(match[1],category).key,category+': '+match[1]);
}
console.log('PASS: all actual reward names covered; duplicate names resolve by category');
