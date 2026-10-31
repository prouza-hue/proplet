'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/valid-word-feedback-v3330.js','utf8');
let shown=false,created=0,opened=0,focus=0,button;
const context={failsafeShown:()=>shown,markFailsafeShown:()=>shown=true,track:()=>{},ensureXpStyle:()=>{},
 document:{querySelector:()=>({after:e=>button=e}),createElement:()=>{created++;return {focus(){focus++}}}},
 ensureModal:()=>({openBonusWords:b=>{assert.equal(b,button);opened++}})};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('  const showFailsafe=()=>{'),source.indexOf('  const install=()=>{'))+';showFailsafe();showFailsafe();',context);
assert.equal(created,1);assert.equal(opened,0);assert.equal(focus,0);assert.equal(button.textContent,'Jak fungují slova navíc?');
button.onclick();assert.equal(opened,1,'only explicit click opens explanation');
assert(!source.includes('JEN PŘIPOMENUTÍ'));
assert(source.includes('aria-labelledby'));
console.log('PASS bonus help: once-only nonblocking offer, no auto modal/focus, explicit opener');
