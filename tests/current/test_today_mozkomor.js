const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('public/home-layout.js','utf8');
let unlocked=false,state={inProgress:{},completed:{}},resumable=new Set();
const keys=['easy','medium','hard','hardcore','mozkomor'];
const ctx={DIFF:Object.fromEntries(keys.map(k=>[k,{label:k,xp:150}])),mozkomorUnlockState:()=>({unlocked}),getState:()=>state,freeProgress:k=>({done:0,total:150,pct:0,resume:resumable.has(k)?{meta:{level:7}}:null}),difficultyIconMarkup:()=>'',htmlEsc:x=>x};
vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('  function todayDifficultyVisible('),src.indexOf('  function renderHomeQuickPlay(')),ctx);
const cards=()=>[...ctx.difficultyTiles().matchAll(/data-home-free="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(cards(),keys.slice(0,4));
state.inProgress={m:{mode:'free',difficulty:'mozkomor',savedAt:20},e:{mode:'free',difficulty:'easy',savedAt:10}};resumable=new Set(['easy','mozkomor']);
assert.equal(ctx.latestFreeResume().difficulty,'easy','locked Mozkomor never leaks into Today');
unlocked=true;assert.deepEqual(cards(),keys);assert.equal(ctx.latestFreeResume().difficulty,'mozkomor');
state.inProgress.e.savedAt=30;assert.equal(ctx.latestFreeResume().difficulty,'easy','latest valid resume wins');
resumable.delete('easy');assert.equal(ctx.latestFreeResume().difficulty,'mozkomor','stale completed entry must not hide a valid resume');
resumable.clear();assert.equal(ctx.latestFreeResume(),null);
unlocked=false;assert.deepEqual(cards(),keys.slice(0,4),'account change re-evaluates unlock');
console.log('PASS Today: conditional fifth Mozkomor, latest valid resume, locked/account-change visibility');

// Both discovery surfaces use one renderer, with independent click targets.
const app=fs.readFileSync('public/app.js','utf8'),index=fs.readFileSync('public/index.html','utf8');
const roots=Object.fromEntries(['newContentBanner','todayNewContentBanner'].map(id=>[id,{id,innerHTML:'',hidden:true,button:{},classList:{add(){roots[id].hidden=true},remove(){roots[id].hidden=false}},querySelector(){return this.button}}]));
let fresh=true,remaining=5,started=0,tracked=0;
const bannerCtx={$:selector=>roots[selector.slice(1)],latestContentBatch:()=>({count:5}),latestContentIsFresh:()=>fresh,latestContentPuzzles:()=>Array(5),latestContentUnplayed:()=>Array(remaining),trackProductEvent:()=>tracked++,startLatestContent:()=>started++};
vm.createContext(bannerCtx);vm.runInContext(app.slice(app.indexOf('function renderNewContentBanner('),app.indexOf('\nfunction renderFree(')),bannerCtx);
for(const count of [5,2,0]){
 remaining=count;bannerCtx.renderNewContentBanner();bannerCtx.renderNewContentBanner('#todayNewContentBanner');
 assert.equal(roots.newContentBanner.innerHTML.replace('playNewContentBtn','playTodayNewContentBtn'),roots.todayNewContentBanner.innerHTML);
 assert.equal(roots.todayNewContentBanner.hidden,false);
 assert(roots.todayNewContentBanner.innerHTML.includes(count?'Hrát novinky':'Týdenní várka dohraná'));
}
roots.newContentBanner.button.onclick();roots.todayNewContentBanner.button.onclick();assert.equal(started,2);assert.equal(tracked,2);
fresh=false;bannerCtx.renderNewContentBanner();bannerCtx.renderNewContentBanner('#todayNewContentBanner');
for(const root of Object.values(roots)){assert.equal(root.hidden,true);assert.equal(root.innerHTML,'')}
assert(index.indexOf('id="todayNewContentBanner"')>index.indexOf('id="dailySyncStatus"'));
assert(index.indexOf('id="todayNewContentBanner"')<index.indexOf('id="tajenkaPreviewCard"'));
assert(!index.includes('id="openAllGamesBtn"'));assert(!index.includes('class="quick-play-head"'));
assert(app.includes("afterRender:()=>{renderNewContentBanner('#todayNewContentBanner')"));
assert(app.includes("'#todayNewContentBanner','#screen-daily .daily-hero'"));
console.log('PASS shared Today/Play news: fresh/partial/completed/expired, independent actions, placement and progress guard');
