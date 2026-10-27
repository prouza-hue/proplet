'use strict';
// Exercise the shipped chooser and capture-phase forwarding without opening a
// browser share sheet, making an invitation or submitting any player data.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/referrals.js','utf8');
let intercepted=null,eligible=true,nativeShares=0,closed=0,focus=0;const opened=[];
const invite={entrySource:'win'},profileInvite={entrySource:'profile'},board={},closeButton={},sheet={innerHTML:'',classList:{remove(){}}};
const dialog={hidden:true,classList:{remove(){dialog.hidden=false;}},querySelectorAll:selector=>selector==='[data-ref-open]'?[invite]:[]};
const nodes=new Map([['#referralDialog',dialog],['#referralDialog .ref-sheet',sheet],['#referralDialog [data-ref-close]',closeButton],['#refShareBoard',board],['#refDialogTitle',{focus(){focus++;}}]]);
const ctx={$:s=>nodes.get(s),canInvite:()=>eligible,forwardingShare:false,sourceFor:b=>b.entrySource,close:()=>{closed++;dialog.hidden=true;},document:{addEventListener:(event,fn,capture)=>{assert.equal(event,'click');assert.equal(capture,true);intercepted=fn;}}};
vm.createContext(ctx);
// Exact artwork/reward strings and wire() are shared with Profile and real invite
// flow. Only open() itself is stubbed to avoid invitation creation/network calls.
vm.runInContext(source.slice(source.indexOf(' const artwork='),source.indexOf(' const heading=')),ctx);
vm.runInContext(source.slice(source.indexOf(' function wire(root){'),source.indexOf(' async function open(')),ctx);
vm.runInContext("function openChoice(shareSource){const kind='choice';"+source.slice(source.indexOf("  if(kind==='choice'){"),source.indexOf("  const accept=kind==='accept';"))+'}',ctx);
ctx.open=(kind,shareSource,entry)=>{opened.push({kind,entry});if(kind==='choice')return ctx.openChoice(shareSource);};
vm.runInContext(source.match(/  document\.addEventListener\('click',event=>\{const source=[^\r\n]+/)[0],ctx);
const share={disabled:false,click(){let stopped=false;intercepted({target:{closest:()=>share},preventDefault(){},stopImmediatePropagation(){stopped=true;}});if(!stopped)nativeShares++;}};
share.click();assert.equal(nativeShares,0);assert.equal(opened.length,1);assert.equal(opened[0].kind,'choice');assert.equal(focus,1);assert.equal(dialog.hidden,false);
assert(sheet.innerHTML.includes('Poslat tuhle desku')&&sheet.innerHTML.includes('Pozvat nového hráče'));
assert(sheet.innerHTML.includes('referral-jezek.webp')&&sheet.innerHTML.includes('referral-liska.webp'),'existing character artwork is retained');
assert(sheet.innerHTML.includes('+1 000 XP')&&sheet.innerHTML.includes('pro každého'),'both-player reward remains explicit');
board.onclick();assert.equal(closed,1);assert.equal(nativeShares,1,'board choice delegates to native sharing exactly once');assert.equal(opened.length,1,'forwarded click must bypass the chooser');assert.equal(ctx.forwardingShare,false);
share.click();assert.equal(opened.length,2,'guard resets for the next deliberate share');invite.onclick();assert.equal(opened.at(-1).kind,'invite');assert.equal(opened.at(-1).entry,'win');assert.equal(nativeShares,1);
const count=opened.length;eligible=false;share.click();assert.equal(nativeShares,2,'guest/ineligible player keeps native sharing');assert.equal(opened.length,count);
eligible=true;share.disabled=true;intercepted({target:{closest:()=>share},preventDefault(){throw Error('disabled source intercepted');},stopImmediatePropagation(){throw Error('disabled source intercepted');}});assert.equal(opened.length,count);share.disabled=false;
ctx.wire({querySelectorAll:selector=>selector==='[data-ref-open]'?[profileInvite]:[]});profileInvite.onclick();assert.equal(opened.at(-1).kind,'invite');assert.equal(opened.at(-1).entry,'profile','explicit Profile entry stays direct');
// Even a native callback failure cannot leave all future shares in bypass mode.
ctx.openChoice({click(){throw Error('native failure');}});assert.throws(()=>board.onclick(),/native failure/);assert.equal(ctx.forwardingShare,false);
console.log('PASS invitation chooser: canonical board forwarding once, artwork/reward, guest fallback, disabled guard and direct Profile invitation');
