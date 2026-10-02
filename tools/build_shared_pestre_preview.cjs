/* Publish one deterministic, history-independent route per difficulty. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),context={window:{}};
vm.runInNewContext(zlib.gunzipSync(fs.readFileSync(path.join(root,'online-preview/free-refresh-fixtures.js.gz'))).toString(),context);
const fixtures=context.window.PROPLET_FREE_REFRESH_FIXTURES;
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const numeric=rows=>[...rows].sort((a,b)=>Number(a.meta.level)-Number(b.meta.level));
// Only use these markers for the four mixed-content banks. Endgame series are frozen below.
const generation=p=>p.id.startsWith('g6-refresh-')?6:p.id.startsWith('g5-r1-')?5:4;
const wordCache=new Map();
const words=p=>{if(!wordCache.has(p.id))wordCache.set(p.id,new Set(p.answers.map(a=>a.word.normalize('NFC').toLocaleUpperCase('cs-CZ'))));return wordCache.get(p.id)};
function mixedRoute(rows){
 const pools=Object.fromEntries([6,5,4].map(g=>[g,numeric(rows.filter(p=>generation(p)===g))]));
 const result=[],recent=[];
 function take(g){
  const pool=pools[g];if(!pool.length)throw new Error('Exhausted generation '+g);
  // Look locally within a series, prioritizing fewer repeated target words in the previous three boards.
  const overlap=p=>recent.reduce((sum,q,i)=>sum+[...words(p)].filter(w=>words(q).has(w)).length*(i+1),0);
  const best=pool.slice(0,8).map((p,i)=>({i,score:overlap(p)})).sort((a,b)=>a.score-b.score||a.i-b.i)[0];
  const [next]=pool.splice(best.i,1);result.push(next);recent.push(next);if(recent.length>3)recent.shift();
 }
 if(pools[6].length){
  // First 100: 50 Gen6 + 30 Gen5 + 20 Gen4. The first ten already include all three series.
  const opening=[6,6,5,6,4,6,5,6,5,4];for(let i=0;i<100;i++)take(opening[i%opening.length]);
 }else{
  // Mozkožrout: Gen5 arrives immediately, still alternating with its earlier series.
  for(let i=0;i<75;i++)take([5,5,4][i%3]);
 }
 // Smoothly distribute the remaining boards, so fresh content also appears later in the route.
 const weights=Object.fromEntries(Object.entries(pools).map(([g,p])=>[g,p.length]));
 const total=Object.values(weights).reduce((sum,n)=>sum+n,0),scores={6:0,5:0,4:0};
 for(let i=0;i<total;i++){
  const available=[6,5,4].filter(g=>pools[g].length);
  for(const g of available)scores[g]+=weights[g];
  const next=available.reduce((best,g)=>scores[g]>scores[best]?g:best,available[0]);
  take(next);scores[next]-=total;
 }
 return result;
}
const routes={},catalogRoutes={},policies={},openingMix={};
for(const [diff,rows]of Object.entries(fixtures.puzzles.free)){
 const catalogue=numeric(rows);catalogRoutes[diff]=catalogue.map(p=>p.id);
 if(['mozkomor','mozkokalypsa'].includes(diff)){
  routes[diff]=[...catalogRoutes[diff]];
  policies[diff]=diff==='mozkokalypsa'?'Approved mk100-v2 editorial waves unchanged; varied ordering dormant until a future series.':'Current published Gen5 series order unchanged; varied ordering dormant until a future series.';
 }else{
  const route=mixedRoute(catalogue);routes[diff]=route.map(p=>p.id);
  openingMix[diff]=Object.fromEntries([10,30,100].map(n=>[n,Object.fromEntries([6,5,4].map(g=>[g,route.slice(0,n).filter(p=>generation(p)===g).length]))]));
  policies[diff]=diff==='hardcore'?'First 75 contain 50 Gen5 and 25 Gen4; remaining content spread throughout the route.':'First 100 contain 50 Gen6, 30 Gen5 and 20 Gen4; remaining content spread throughout the route.';
 }
 if(new Set(routes[diff]).size!==rows.length||routes[diff].some(id=>!catalogRoutes[diff].includes(id)))throw new Error('Invalid route: '+diff);
}
const manifest={
 schemaVersion:1,version:'shared-pestre-preview-v3',asOf:'2026-10-02',status:'preview-only',
 bankContentHash:fixtures.build.bankContentHash,sourceMain:fixtures.build.sourceMain,
 sourceBanksSha256:hash(fixtures.puzzles.free),runtimeGeneration:fixtures.puzzles.freeGeneration,
 variedDifficulties:['easy','medium','hard','hardcore'],
 counts:Object.fromEntries(Object.entries(routes).map(([d,ids])=>[d,ids.length])),routes,catalogRoutes,policies,openingMix,
 selectionPriority:['saved unfinished board in the chosen difficulty','first incomplete ID in the selected shared or numeric route'],
 modePolicy:'Varied by default in the four mixed-content difficulties. Preserve explicit preview choices and legacy choices with offered, pending or positive revision evidence. A bare legacy numeric default is not an opt-out. No control for Mozkomor or Mozkokalypsa.',
 presentation:'Next/resumed board beside Play. Opt-out only in collapsed Settings > Board order. Numeric catalogue inside progress/history. Reviewer tools only with ?review=1.',
 onboarding:'Retain native first-board-v1 assignment before shared ordering.',
 updatePolicy:'Only route ID order changes. Bank bodies, ID, level, contentGeneration, saved attempts, results and XP remain untouched. Old pestre-v1 plans remain stored for rollback.',
 productionChanged:false,databaseWrites:false,accountSync:false
};
manifest.contentHash=hash(manifest);
const content=JSON.stringify(manifest,null,2)+'\n',directory=path.join(root,'online-preview/content/free-order');
fs.mkdirSync(directory,{recursive:true});
fs.writeFileSync(path.join(directory,manifest.version+'.json'),content);
fs.writeFileSync(path.join(directory,manifest.version+'.js'),'window.PROPLET_SHARED_FREE_ORDER_MANIFEST = '+content.trim()+';\n');
console.log(JSON.stringify({version:manifest.version,counts:manifest.counts,contentHash:manifest.contentHash,sourceBanksSha256:manifest.sourceBanksSha256,openingMix}));
