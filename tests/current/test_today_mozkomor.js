const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('public/home-layout.js','utf8');
let state={inProgress:{},completed:{}},resumable=new Set();
const keys=['easy','medium','hard','hardcore','mozkomor','mozkokalypsa'];
const ctx={DIFF:Object.fromEntries(keys.map(k=>[k,{label:k,xp:150}])),getState:()=>state,freeProgress:k=>({done:0,total:150,pct:0,resume:resumable.has(k)?{meta:{level:7}}:null}),difficultyIconMarkup:()=>'',htmlEsc:x=>x};
vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('  function todayDifficultyVisible('),src.indexOf('  function renderHomeQuickPlay(')),ctx);
const cards=()=>[...ctx.difficultyTiles().matchAll(/data-home-free="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(cards(),keys,'all difficulties are available with zero completions');
state.inProgress={m:{mode:'free',difficulty:'mozkomor',savedAt:20},e:{mode:'free',difficulty:'easy',savedAt:10}};resumable=new Set(['easy','mozkomor']);
assert.equal(ctx.latestFreeResume().difficulty,'mozkomor','Mozkomor can resume without prerequisite completions');
state.inProgress.e.savedAt=30;assert.equal(ctx.latestFreeResume().difficulty,'easy','latest valid resume wins');
resumable.delete('easy');assert.equal(ctx.latestFreeResume().difficulty,'mozkomor','stale completed entry must not hide a valid resume');
resumable.clear();assert.equal(ctx.latestFreeResume(),null);
state={inProgress:{},completed:{}};assert.deepEqual(cards(),keys,'a fresh account keeps every difficulty available');
assert.equal(ctx.todayDifficultyVisible('unknown'),false);
console.log('PASS Today: all difficulties at zero progress, latest valid resume, fresh-account visibility');

// Both discovery surfaces use one renderer, with independent click targets.
const app=fs.readFileSync('public/app.js','utf8'),index=fs.readFileSync('public/index.html','utf8');
const roots=Object.fromEntries(['newContentBanner','todayNewContentBanner'].map(id=>[id,{id,innerHTML:'',hidden:true,button:{},classList:{add(){roots[id].hidden=true},remove(){roots[id].hidden=false}},querySelector(){return this.button}}]));
let fresh=true,remaining=5,started=0,tracked=0;
const bannerCtx={$:selector=>roots[selector.slice(1)],latestContentBatch:()=>({count:5}),latestContentIsFresh:()=>fresh,latestContentPuzzles:()=>Array(5),latestContentUnplayed:()=>Array(remaining),trackProductEvent:()=>tracked++,startLatestContent:()=>started++};
vm.createContext(bannerCtx);vm.runInContext(app.slice(app.indexOf('function renderNewContentBanner('),app.indexOf('\nfunction renderFree(')),bannerCtx);
for(const count of [5,2,0]){
 remaining=count;bannerCtx.renderNewContentBanner();bannerCtx.renderNewContentBanner('#todayNewContentBanner');
 if(count){
  assert.equal(roots.newContentBanner.innerHTML.replace('playNewContentBtn','playTodayNewContentBtn'),roots.todayNewContentBanner.innerHTML);
  assert.equal(roots.todayNewContentBanner.hidden,false);
  assert(roots.todayNewContentBanner.innerHTML.includes('Hrát novinky'));
 }else{
  assert.equal(roots.newContentBanner.hidden,true);
  assert.equal(roots.newContentBanner.innerHTML,'');
  assert.equal(roots.todayNewContentBanner.hidden,true);
  assert.equal(roots.todayNewContentBanner.innerHTML,'');
 }
}
remaining=2;bannerCtx.renderNewContentBanner();bannerCtx.renderNewContentBanner('#todayNewContentBanner');roots.newContentBanner.button.onclick();roots.todayNewContentBanner.button.onclick();assert.equal(started,2);assert.equal(tracked,2);
fresh=false;bannerCtx.renderNewContentBanner();bannerCtx.renderNewContentBanner('#todayNewContentBanner');
for(const root of Object.values(roots)){assert.equal(root.hidden,true);assert.equal(root.innerHTML,'')}
assert(index.indexOf('id="todayNewContentBanner"')>index.indexOf('id="dailySyncStatus"'));
assert(index.indexOf('id="todayNewContentBanner"')<index.indexOf('id="tajenkaPreviewCard"'));
assert(!index.includes('id="openAllGamesBtn"'));assert(!index.includes('class="quick-play-head"'));
assert(app.includes("afterRender:()=>{renderNewContentBanner('#todayNewContentBanner')"));
assert(app.includes("'#todayNewContentBanner','#screen-daily .daily-hero'"));
assert(app.includes("FREE_ORDER_RESUME_REFRESH_MS=5*60*1000"));
assert(!app.includes("setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)refreshFreeOrder()},30000)"));
console.log('PASS shared Today/Play news with pollfix preserved');

// Play uses one native action per difficulty and one remembered history entry.
const playNodes={difficultyCards:{innerHTML:''},newContentBanner:{innerHTML:'old banner',classList:{add(){}}},playHistoryEntry:{},playedLevelsDifficulty:{focus(){}}},playStorage=new Map(),opened=[],historyOpened=[];
let playButtons=[];const progress=Object.fromEntries(keys.map(k=>[k,{total:100,done:0,pct:0,resume:null}]));progress.medium.resume={id:'resume-medium'};progress.hardcore={total:100,done:100,pct:100,resume:null};
Object.defineProperty(playNodes.difficultyCards,'innerHTML',{get:()=>playNodes.difficultyCards.html||'',set:html=>{playNodes.difficultyCards.html=html;playButtons=[...html.matchAll(/data-play-free="([^"]+)"/g)].map(m=>({dataset:{playFree:m[1]}}));}});
const playCtx={DIFF:{easy:{label:'Snadná',xp:15},medium:{label:'Střední',xp:25},hard:{label:'Těžká',xp:50},hardcore:{label:'Mozkožrout',xp:100},mozkomor:{label:'Mozkomor',xp:150},mozkokalypsa:{label:'Mozkokalypsa',xp:200}},$:q=>playNodes[q.slice(1)],$$:()=>playButtons,localStorage:{getItem:k=>playStorage.get(k),setItem:(k,v)=>playStorage.set(k,v)},renderAccountProgressStatus(){},freeProgress:k=>progress[k],newContentCount:k=>k==='hard'?2:0,esc:x=>x,difficultyIconMarkup:(k,cls)=>`<img class="${cls}" src="/${k}.svg" alt="">`,startFree:diff=>opened.push(diff),openPlayedLevels:diff=>historyOpened.push(diff),freeOrder:()=>({}),changeFreeOrder(){},renderFreeResumeCard(){},window:{}};
vm.createContext(playCtx);vm.runInContext(app.slice(app.indexOf('function lastPlayedDifficulty('),app.indexOf('async function startFree(')),playCtx);playCtx.renderFree();
assert.deepEqual(playButtons.map(b=>b.dataset.playFree),keys,'resume never reorders the six difficulties');assert.equal(playButtons.length,6);playButtons.forEach(b=>b.onclick());assert.deepEqual(opened,keys,'every whole tile delegates to the canonical startFree');
assert(!playNodes.difficultyCards.innerHTML.includes('data-played-levels'));assert(playNodes.difficultyCards.innerHTML.includes('Pokračovat'));const finished=playNodes.difficultyCards.innerHTML.split('data-diff="hardcore"')[1].split('</article>')[0];assert(finished.includes('Hotovo')&&finished.includes('Opakování bez dalších XP'));assert(!finished.includes('+100 XP'),'a completed catalogue promises no new XP');assert.equal((playNodes.difficultyCards.innerHTML.match(/class="play-tile-new"/g)||[]).length,1,'new label follows actual released availability');
playStorage.set('proplet:played-levels:difficulty','mozkomor');playNodes.playHistoryEntry.onclick();assert.deepEqual(historyOpened,['mozkomor']);assert.equal(opened.length,6,'opening the history does not start a game');playStorage.set('proplet:played-levels:difficulty','invalid');assert.equal(playCtx.lastPlayedDifficulty(),'easy');
console.log('PASS Play: six stable native actions, resume/replay semantics, actual new content and remembered global history');

(async()=>{
 const nodes=Object.fromEntries(['playedLevelsModal','playedLevelsTitle','playedLevelsMeta','playedLevelsList','playedLevelsStartBtn','playedLevelsDifficulty'].map(id=>[id,{textContent:'',innerHTML:'',value:'',classList:{hidden:true,contains(n){return n==='hidden'&&this.hidden},add(){this.hidden=true},remove(){this.hidden=false}}}])),pending=[],storage=new Map(),starts=[],restored=[];
 const opener={isConnected:true,getClientRects:()=>[{}],closest:()=>null,focus:()=>restored.push('profile-origin')};
 const c={DIFF:{easy:{label:'Snadná'},hard:{label:'Těžká'}},document:{activeElement:opener},$:q=>nodes[q.slice(1)],$$:()=>[],localStorage:{setItem:(k,v)=>storage.set(k,v)},getProfile:()=>({id:'fixture',token:'fixture'}),api:()=>new Promise(resolve=>pending.push(resolve)),accountProfileMatches:()=>true,getQueue:()=>[],mergePendingPlayedLevels:x=>x,sortedFreeBank:()=>[{}],freeProgress:()=>({resume:null}),startFree:d=>starts.push(d),esc:x=>x,fmtTime:()=>'',countCz:()=>''};
 vm.createContext(c);vm.runInContext(app.slice(app.indexOf('async function openPlayedLevels('),app.indexOf('function localLevelResult(')),c);
 const first=c.openPlayedLevels('easy');c.document.activeElement=nodes.playedLevelsDifficulty;nodes.playedLevelsDifficulty.value='hard';const second=nodes.playedLevelsDifficulty.onchange();pending[1]({levels:[],total:1});await second;pending[0]({levels:[{puzzleId:'stale-easy',level:1}],total:1});assert.equal(await first,false,'stale history signals all native decoration wrappers to skip');
 assert.equal(nodes.playedLevelsDifficulty.value,'hard');assert.equal(storage.get('proplet:played-levels:difficulty'),'hard');assert(!nodes.playedLevelsList.innerHTML.includes('stale-easy'),'a slow previous filter cannot replace current results');assert.deepEqual(starts,[]);assert.equal(nodes.playedLevelsModal.__playedLevelsOpener,opener,'filter changes preserve the original caller');c.closePlayedLevels();assert.deepEqual(restored,['profile-origin'],'close returns to the actual visible caller');for(const inactive of [{isConnected:false},{isConnected:true,getClientRects:()=>[]},{isConnected:true,getClientRects:()=>[{}],closest:()=>({hidden:true})}]){nodes.playedLevelsModal.__playedLevelsOpener={...inactive,focus(){throw Error('inactive opener received focus')}};c.closePlayedLevels();}nodes.playedLevelsStartBtn.onclick();assert.deepEqual(starts,['hard']);
 console.log('PASS Play history filter: remembered difficulty, stale-response exclusion and native empty-history entry');
})().catch(e=>{console.error(e);process.exitCode=1});

// The compact Play owner must not recreate a control that legacy polish removes.
const quality=fs.readFileSync('public/quality-v334-core-v40114.js','utf8');
for(const compact of [true,false]){let inserted=0,control=null;const grid={insertAdjacentHTML(){inserted++;control={remove(){control=null}}}},q=selector=>selector==='#difficultyCards'?grid:selector==='#screen-free'?{classList:{contains:()=>compact}}:selector==='#freeCalmQuick'?control:null;const c={q,calmControlMarkup:()=>'',bindCalmSwitch(){}};vm.createContext(c);vm.runInContext(quality.slice(quality.indexOf('function ensureQuickCalmControls('),quality.indexOf('function ensureCalmRunButton(')),c);for(let i=0;i<10;i++){c.ensureQuickCalmControls();if(compact)control?.remove();}assert.equal(inserted,compact?0:1,'compact Play has one owner; other screens retain the existing control');}
console.log('PASS compact Play control ownership settles without recreating the removed quick control');

// Both historical Play-clone producers must leave the compact owner alone.
for(const [file,name,end]of [['public/printshop-release-polish.js','syncTajenkaPlayCard','polishFreeScreen'],['public/tajenka-release-fix.js','syncExactTajenkaPlayCard','rowMarkup']]){const code=fs.readFileSync(file,'utf8');let old={remove(){old=null}},removed=0;const source={className:'card',innerHTML:'Tajenka',cloneNode(){throw Error('excluded Play Tajenka was recreated')}};const c={q:selector=>selector==='#screen-free'?{classList:{contains:n=>n==='play-compact'},appendChild(){throw Error('excluded card appended')}}:selector==='#tajenkaPreviewCard'?source:selector==='#tajenkaPlayCard'?old:null};vm.createContext(c);vm.runInContext(code.slice(code.indexOf('  function '+name+'('),code.indexOf('  function '+end+'(')),c);for(let i=0;i<20;i++)c[name]();assert.equal(old,null);}
console.log('PASS both Tajenka clone producers settle on compact Play without recreating removed cards');

(async()=>{let created=0;const c={global:{openPlayedLevels:async()=>false},document:{getElementById:()=>null,createElement(){created++;throw Error('stale history created another catalogue')}}};vm.createContext(c);const code=fs.readFileSync('public/app/content/refresh-ui.js','utf8');vm.runInContext(code.slice(code.indexOf('  function installHistoryCatalogue('),code.indexOf('  function populateNumericCatalogue(')),c);c.installHistoryCatalogue();assert.equal(await c.global.openPlayedLevels('easy'),false);assert.equal(created,0);console.log('PASS stale history cannot create a duplicate numeric catalogue through its native wrapper');})().catch(e=>{console.error(e);process.exitCode=1});
