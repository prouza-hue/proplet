'use strict';
// Loopback guests only. Exercise the actual veteran ceiling and appended IDs.
const {chromium}=require(process.env.PROPLET_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8000',out='qa-free-expansion';
const prefix='g6-expansion-',diffs=['easy','medium','hard','hardcore','mozkomor','mozkokalypsa'];
const bank=JSON.parse(fs.readFileSync('public/puzzles.json','utf8'));
const checks=[],errors=[];
const check=(name,pass)=>{assert(pass,name);checks.push(name)};
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch(process.env.PROPLET_BROWSER_EXECUTABLE?{executablePath:process.env.PROPLET_BROWSER_EXECUTABLE}:{});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  // This fixture checks content/progression. Production lease economics stay in
  // their database acceptance gate; no account or external result is used here.
  await page.route('**/api/play-session/config',r=>r.fulfill({json:{enabled:false}}));
  const old={};
  for(const d of diffs)for(const p of bank.free[d].filter(p=>!p.id.startsWith(prefix))){
   old['free:'+p.id]={mode:'free',difficulty:d,puzzleId:p.id,level:p.meta.level,contentGeneration:4,
    elapsedMs:120000,moves:p.answers.length,hintsUsed:0,points:0,completedAt:'2026-11-01T12:00:00Z'};
  }
  await context.addInitScript(({old})=>{
   if(localStorage.getItem('expansion-fixture'))return;
   localStorage.setItem('expansion-fixture','1');
   for(const k of ['proplet-v3-7-required-onboarding','proplet-v3-16-2-helper-onboarding'])localStorage.setItem(k,'done');
   localStorage.setItem('proplet-v3-16-2-helper-mode','none');
   localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
   localStorage.setItem('proplet-v2-state:guest',JSON.stringify({completed:old,rescues:{},inProgress:{},dailyDates:[],statsVersion:5}));
  },{old});
  await page.goto(base+'/?open=free',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof freeProgress==='function'&&document.querySelectorAll('[data-play-free]').length===6);
  await page.evaluate(()=>window.__PROPLET_ENSURE_FULL_PUZZLE_DB());
  const veteranIds=await page.evaluate(async prefix=>{
   await refreshRollingContent();closeTransientModals();
   const state=getState();
   for(const [d,boards] of Object.entries(puzzleDB.free))for(const p of boards){
    if(p.id.startsWith(prefix)||state.completed['free:'+p.id])continue;
    state.completed['free:'+p.id]={mode:'free',difficulty:d,puzzleId:p.id,level:p.meta.level,
     contentGeneration:4,elapsedMs:120000,moves:p.answers.length,hintsUsed:0,points:0,completedAt:'2026-11-01T12:00:00Z'};
   }
   saveState(state);nav('free');return Object.keys(state.completed);
  },prefix);
  check('all 600 fresh IDs available in the native full bank',await page.evaluate(prefix=>Object.values(puzzleDB.free).flat().filter(p=>p.id.startsWith(prefix)).length===600,prefix));
  for(const d of diffs){
   const first=`${prefix}${d}-001`,last=`${prefix}${d}-100`;
   check(`veteran continues at ${first}`,await page.evaluate(({d,first})=>freeProgress(d).nextUnsolved?.id===first,{d,first}));
   await page.evaluate(()=>{closeTransientModals();nav('free')});
   await page.locator(`#difficultyCards [data-play-free="${d}"]`).click();
   await page.waitForFunction(id=>currentGame?.puzzle.id===id,first);
   check(`${first} uses normal free-game identity`,await page.evaluate(()=>currentGame.mode==='free'&&currentGame.puzzle.meta.contentGeneration===4));
   if(d==='easy')await page.screenshot({path:`${out}/easy-phone.png`});
   if(d==='mozkokalypsa'){
    await page.setViewportSize({width:690,height:900});
    await page.screenshot({path:`${out}/mozkokalypsa-fold-viewport.png`});
    check('Fold viewport has no horizontal page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }
   const complete=async()=>{
    await page.evaluate(async()=>{
     const g=currentGame;g.baseElapsedMs=120000;
     for(const a of g.puzzle.answers){g.path=[...a.path];submitPath()}
    });
    await page.locator('#winModal:not(.hidden)').waitFor();
    await page.waitForFunction(()=>currentGame.finished===true);
   };
   await complete();
   const saved=await page.evaluate(id=>getState().completed['free:'+id],first);
   check(`${first} records a new completion and expected XP`,saved?.puzzleId===first&&saved.points===await page.evaluate(d=>DIFF[d].xp,d));
   check(`${d} advances to the second appended board`,await page.evaluate(d=>freeProgress(d).nextUnsolved?.id===`g6-expansion-${d}-002`,d));
   await page.evaluate(async({d,first})=>{closeTransientModals();await startGame(puzzleDB.free[d].find(p=>p.id===first),'free',null)},{d,first});
   await complete();
   check(`${first} replay gives no duplicate base XP`,await page.evaluate(()=>currentGame.winBaseXpAwarded===0));
   await page.evaluate(async({d,last})=>{closeTransientModals();await startGame(puzzleDB.free[d].find(p=>p.id===last),'free',null);currentGame.path=[...currentGame.puzzle.answers[0].path];submitPath();nav('free')},{d,last});
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(id=>typeof freeProgress==='function'&&freeProgress(id.split('-')[2])?.resume?.id===id,last);
   await page.evaluate(()=>closeTransientModals());
   await page.locator(`#difficultyCards [data-play-free="${d}"]`).click();
   await page.waitForFunction(id=>currentGame?.puzzle.id===id&&currentGame.found.length===1,last);
   check(`${last} retains its saved board and found word across reload`,true);
   await page.evaluate(()=>{nav('free');const state=getState();state.inProgress={};saveState(state);currentGame=null});
  }
  check('all old completion IDs survived the expansion and reloads',await page.evaluate(ids=>ids.every(id=>getState().completed[id]),veteranIds));
  check('no browser runtime errors',errors.length===0);
 }finally{
  fs.writeFileSync(`${out}/report.json`,JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({passed:checks.length,errors}));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
