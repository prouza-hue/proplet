'use strict';
// Real final Tajenka owner plus result deduplication; fetch/sync are isolated
// in-memory fixtures. No game completion or player persistence is invoked.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/tajenka-release-fix.js','utf8'),cta=fs.readFileSync('public/challenge-cta-v3333.js','utf8');
const nodes=new Map();let board;
class Element{
 constructor(){this.classes=new Set();this.hidden=false;this.textContent='';this.children=[];this._html='';this.classList={contains:n=>this.classes.has(n),add:(...ns)=>ns.forEach(n=>this.classes.add(n)),remove:(...ns)=>ns.forEach(n=>this.classes.delete(n)),toggle:(n,on)=>on?this.classes.add(n):this.classes.delete(n)};}
 set innerHTML(value){this._html=value;if(this===board){this.rows=[...value.matchAll(/<div class="mini-leader-row result-player-row ([^"]*)"([^>]*)>/g)].filter(m=>m[1].split(/\s+/).includes('me')).map(m=>{const dataset={};for(const a of m[2].matchAll(/data-result-([a-z]+)="([^"]*)"/g))dataset['result'+a[1][0].toUpperCase()+a[1].slice(1)]=a[2];return {dataset,visible:true,getClientRects(){return this.visible?[{}]:[];},closest:()=>null};});}}
 get innerHTML(){return this._html;}
 querySelector(selector){return nodes.get(selector)||null;}
 querySelectorAll(selector){return selector==='.result-player-row.me'?this.rows||[]:[];}
 insertAdjacentElement(_position,node){if(node.className==='tajenka-result-source')nodes.set('.tajenka-result-source',node);}
 remove(){for(const [key,value] of nodes)if(value===this)nodes.delete(key);}
}
for(const key of ['#winModal','#levelLeaderboardBox','#winTitle','#winPraise','#tajenkaWinPhrase','#tajenkaWinPhrase strong','#winText','.win-summary-chips','#winXp','#winClean','#winShareBtn','#winPrimaryBtn','#winDetails','#winWords','#winTimingNotice','#winRewardStatus'])nodes.set(key,new Element());
board=nodes.get('#levelLeaderboardBox');const modal=nodes.get('#winModal');
let profile={id:'player',token:'fixture-token'},pending=[];
const ctx={window:{PropletSharing:{shareTajenka(){throw Error('No share in this test');}}},document:{querySelector:s=>nodes.get(s)||null,createElement:()=>new Element()},currentGame:{mode:'daily',finished:true,postStarterWarmup:true,puzzle:{id:'stale-daily'}},tajenkaRecapOpen:true,
 tajenkaPuzzle:{id:'tajenka-a',tajenka:{phrase:'PŮVODNÍ TAJENKA'},source:{url:'https://example.test/source',author:'Autor',work:'Dílo'}},getProfile:()=>profile,syncQueue:async()=>({ok:true}),navigator:{onLine:true},fetch:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),setClass:(el,name,on)=>el.classList.toggle(name,on),$:s=>nodes.get(s)||null};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  const q='),source.indexOf('  function install(){')),ctx);
vm.runInContext(cta.slice(cta.indexOf('  function ownRowRepresentsResult('),cta.indexOf('  function referralChoiceAvailable(')),ctx);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const row=(changes={})=>({isMine:true,rank:1,name:'Ukázkový hráč',elapsedMs:94200,moves:8,hintsUsed:0,cleanSolve:true,...changes});
const payload=rows=>({rows,total:rows.length,myRank:rows.some(r=>r.isMine)?1:null,topPercent:1});
const result={puzzleId:'tajenka-a',elapsedMs:94999,moves:8,hints:0,found:[]};
const duplicate=()=>modal.classList.contains('result-metrics-in-ranking');
function prepare(rec=result,options={recap:true}){
 nodes.get('#tajenkaWinPhrase strong').textContent='PŮVODNÍ TAJENKA';
 nodes.get('#winTimingNotice').textContent='Čas se nepodařilo ověřit.';
 nodes.get('#winRewardStatus').textContent='Odměna čeká na potvrzení.';
 ctx.prepareTajenkaDailyResult(rec,rec.puzzleId,options);ctx.syncResultMetrics();
}
async function resolve(rows){await tick();assert(pending.length);pending.shift().resolve({ok:true,json:async()=>payload(rows)});await tick();ctx.syncResultMetrics();}
(async()=>{
 prepare();assert.equal(board.resultContext,null);assert(!duplicate(),'loading has a visible performance fallback');
 assert.equal(nodes.get('#winTitle').textContent,'Původní tajenka');const byline=nodes.get('.tajenka-result-source').innerHTML;
 assert(byline.includes('Autor · Dílo')&&byline.includes('https://example.test/source'));
 await resolve([row()]);assert(duplicate(),'saved Tajenka recap uses its own identity even with stale Daily currentGame');
 assert.equal(board.resultContext.result,result);assert.equal(board.resultContext.kind,'tajenka');
 assert.equal(nodes.get('#winTitle').textContent,'Původní tajenka');assert.equal(nodes.get('.tajenka-result-source').innerHTML,byline);
 assert.equal(nodes.get('#winTimingNotice').textContent,'Čas se nepodařilo ověřit.');assert.equal(nodes.get('#winTimingNotice').hidden,false);
 assert.equal(nodes.get('#winRewardStatus').textContent,'Odměna čeká na potvrzení.');assert.equal(nodes.get('#winRewardStatus').hidden,false);
 assert.equal(result.elapsedMs,94999,'presentation must not normalize or mutate the stored completion');
 board.rows[0].visible=false;ctx.syncResultMetrics();assert(!duplicate(),'hidden own rows cannot replace the summary');board.rows[0].visible=true;
 ctx.navigator.onLine=false;ctx.syncResultMetrics();assert(!duplicate(),'offline keeps fallback');ctx.navigator.onLine=true;
 for(const change of [{moves:9},{hintsUsed:1,cleanSolve:false},{elapsedMs:95000}]){prepare();await resolve([row(change)]);assert(!duplicate(),'different first result must not hide this completion');}
 prepare();await resolve([row({isMine:false})]);assert(!duplicate(),'absent own row keeps fallback');
 prepare();await tick();pending.shift().reject(Error('fixture unavailable'));await tick();ctx.syncResultMetrics();assert(!duplicate());assert.equal(board.resultContext,null);assert(board.innerHTML.includes('fixture unavailable'));

 // Historical local completions predate both hint fields. The canonical clean
 // label renders zero hints, so compare that presentation without migrating data.
 const legacy={puzzleId:'tajenka-a',elapsedMs:103000,moves:9,completedAt:'2026-10-26T10:00:00Z',rewarded:true,rewardXp:200};
 const legacyBefore=JSON.stringify(legacy);prepare(legacy);await resolve([row({elapsedMs:103000,moves:9})]);
 assert(duplicate(),'legacy completion with omitted hint fields matches its rendered zero-hint own row');
 assert.equal(board.resultContext.record.hintsUsed,0);assert.equal(board.resultContext.record.cleanSolve,true);assert.equal(JSON.stringify(legacy),legacyBefore,'legacy source data stays untouched');
 assert.equal(nodes.get('#winTitle').textContent,'Původní tajenka');assert.equal(nodes.get('.tajenka-result-source').innerHTML,byline);
 prepare(legacy);await tick();pending.shift().reject(Error('legacy fixture unavailable'));await tick();ctx.syncResultMetrics();assert(!duplicate());assert.equal(board.resultContext,null);assert(board.innerHTML.includes('legacy fixture unavailable'));

 // Real finished Tajenka uses the captured game; an actual replay remains safe
 // even when its formatted performance happens to equal an earlier first result.
 const game={mode:'tajenka',finished:true,isReplay:false,puzzle:{id:'tajenka-a'},elapsedMs:94999,moves:8,hints:0};
 ctx.currentGame=game;ctx.tajenkaRecapOpen=false;prepare(result,{game});await resolve([row()]);assert(duplicate());
 game.isReplay=true;ctx.syncResultMetrics();assert(!duplicate());game.isReplay=false;
 ctx.currentGame={...game};ctx.syncResultMetrics();assert(!duplicate(),'another current run invalidates actual-finish context');

 // An older response must not replace a newly opened recap or another account.
 ctx.tajenkaRecapOpen=true;prepare();await tick();const old=pending.shift();
 const newer={...result,puzzleId:'tajenka-b',moves:10};prepare(newer);await tick();const fresh=pending.shift();
 fresh.resolve({ok:true,json:async()=>payload([row({moves:10})])});await tick();const loadedHtml=board.innerHTML,loadedView=board.resultContext;
 old.resolve({ok:true,json:async()=>payload([row({moves:99})])});await tick();assert.equal(board.innerHTML,loadedHtml);assert.equal(board.resultContext,loadedView);
 prepare();await tick();const switched=pending.shift();profile={id:'another',token:'other-token'};switched.resolve({ok:true,json:async()=>payload([row()])});await tick();assert.equal(board.resultContext,null);assert(board.innerHTML.includes('Načítám'));
 profile={id:'player',token:'fixture-token'};prepare();await tick();const superseded=pending.shift();board.postWinRequest={daily:true};superseded.resolve({ok:true,json:async()=>payload([row()])});await tick();assert.equal(board.resultContext,null,'another result owner invalidates the request');
 ctx.resetTajenkaDailyResult();assert.equal(board.tajenkaResultView,null);assert(!modal.classList.contains('tajenka-daily-result'));
 console.log('PASS Tajenka result identity: actual/saved recap, matching own row, warnings/source, replay/error/offline fallback and stale-response guards');
})().catch(error=>{console.error(error);process.exitCode=1;});
