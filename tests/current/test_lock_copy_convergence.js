const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('public/printshop-release-polish.js','utf8');
const code=source.slice(source.indexOf('  function polishFreeScreen(){'),source.indexOf('  function polishProfileCopy(){'));
let value='🔒 Odemkne se po dokončení 100 Mozkožroutů',writes=0;
const note={get textContent(){return value},set textContent(v){value=v;writes++}};
const context={q:s=>s==='#screen-free .mozkomor-lock-note'?note:null,positionWeeklyBanner(){},installWeeklyBannerIcon(){},syncTajenkaPlayCard(){}};
vm.createContext(context);vm.runInContext(code,context);
context.polishFreeScreen();assert.equal(writes,1);assert(value.includes('200'));
// Match the visual decorator: emoji becomes an image with empty textContent.
value=value.replace('🔒','');
for(let i=0;i<1000;i++)context.polishFreeScreen();
assert.equal(writes,1,'decorated lock must not be replaced with emoji');
value='Odemkne se po dokončení 100 Mozkožroutů';context.polishFreeScreen();assert.equal(writes,2,'actual copy changes must still be corrected');
console.log('PASS: lock copy converges across 1000 decoration refreshes.');
