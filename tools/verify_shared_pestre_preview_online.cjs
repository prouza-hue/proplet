/* End-to-end contract for the production-shaped v3 preview, including real settings controls. */
'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const base=process.env.FREE_REFRESH_PREVIEW_URL.replace(/\/$/,''),out=process.env.FREE_REFRESH_QA_OUTPUT||'qa-free-refresh-300-online';
fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],requests=[],layouts=[];
const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw new Error(name)};
const monitor=page=>{
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
 page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
};
const ready=async page=>{await page.waitForFunction(()=>document.querySelectorAll('#freeOrderSettings select').length===4);if(await page.locator('#freeRefreshAnnouncement').isVisible())await page.locator('[data-refresh-back]').click()};
const closeGame=page=>page.evaluate(()=>{document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));const s=getState();s.inProgress={};saveState(s);currentGame=null;nav('free')});
const shot=(page,name)=>page.screenshot({path:path.join(out,'ui-v3-'+name+'.png'),fullPage:true});
(async()=>{
 const browser=await chromium.launch({headless:true});let manifestHash,storagePrefix,catalogueTotal=0;
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});monitor(page);
  await page.goto(base+'/',{waitUntil:'networkidle'});await ready(page);
  ({manifestHash,storagePrefix}=await page.evaluate(()=>({manifestHash:PROPLET_SHARED_FREE_ORDER_MANIFEST.contentHash,storagePrefix:PROPLET_FREE_REFRESH_PREVIEW.storagePrefix})));
  check('normal preview contains no reviewer catalogues, announcement controls or duplicate hub banner',await page.evaluate(()=>!document.querySelector('#refreshCatalogue,#sharedOrderCatalogue,#freeRefreshHub,[data-review-announcement]')));
  check('mixed-content difficulties default to varied; endgame retains original order',await page.evaluate(()=>['easy','medium','hard','hardcore'].every(d=>freeOrder().record(d).mode==='varied')&&['mozkomor','mozkokalypsa'].every(d=>!freeOrder().supports(d)&&freeProgress(d).nextUnsolved.id===sortedFreeBank(d)[0].id)));
  await shot(page,'today-desktop');await page.locator('[data-refresh-choose]').click();
  check('release invitation opens native Play screen',await page.locator('#screen-free').isVisible());
  check('all six cards show their actual next level without ordering controls',await page.evaluate(()=>document.querySelectorAll('#difficultyCards .order-next').length===6&&!document.querySelector('#difficultyCards .order-switch,#difficultyCards select,#difficultyCards .order-catalogue')&&Object.keys(DIFF).every(d=>document.querySelector('#difficultyCards [data-diff="'+d+'"] .order-next strong').textContent==='Úroveň '+freeProgress(d).nextUnsolved.meta.level)));
  check('bank identity and all original board bodies remain unchanged',await page.evaluate(async()=>{
   const bytes=new TextEncoder().encode(JSON.stringify(PROPLET_FREE_REFRESH_FIXTURES.puzzles.free));
   const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
   return digest===PROPLET_SHARED_FREE_ORDER_MANIFEST.sourceBanksSha256&&digest==='96a5171bc3dad1c06a9f6b471514f10ca18feff6196e8a46e55c42d47a469178';
  }));
  await shot(page,'play-desktop');
  await page.locator('#settingsHeaderBtn').click();await page.waitForSelector('#screen-profile.settings-open');
  check('ordering choices start collapsed inside native Settings',!(await page.locator('#freeOrder-easy').isVisible()));
  await page.locator('#freeOrderSettings summary').click();
  check('only four mixed-content difficulties have an opt-out',await page.evaluate(()=>[...document.querySelectorAll('[data-order-setting]')].map(n=>n.dataset.orderSetting).join()==='easy,medium,hard,hardcore'));
  const stateBefore=await page.evaluate(()=>JSON.stringify(getState()));
  for(const diff of ['easy','medium','hard','hardcore']){
   await page.locator('#freeOrder-'+diff).selectOption('numeric');
   check('settings opt-out uses numeric route: '+diff,await page.evaluate(d=>freeProgress(d).nextUnsolved.id===sortedFreeBank(d)[0].id,diff));
   await page.locator('#freeOrder-'+diff).selectOption('varied');
   check('return to varied uses fixed shared route: '+diff,await page.evaluate(d=>freeProgress(d).nextUnsolved.id===PROPLET_SHARED_FREE_ORDER_MANIFEST.routes[d][0],diff));
  }
  check('changing order leaves results, XP and attempts untouched',stateBefore===await page.evaluate(()=>JSON.stringify(getState())));
  await page.locator('#freeOrder-easy').selectOption('numeric');await page.reload({waitUntil:'networkidle'});await ready(page);
  check('deliberate opt-out survives reload',await page.evaluate(()=>freeOrder().record('easy').mode==='numeric'&&freeProgress('easy').nextUnsolved.id==='g4-e-001'));
  await page.evaluate(async()=>{await changeFreeOrder('easy','varied');nav('free')});
  for(const diff of ['easy','medium','hard','hardcore','mozkomor','mozkokalypsa']){
   await page.locator('[data-played-levels="'+diff+'"]').click();
   await page.locator('#historyNumericCatalogue summary').click();
   await page.waitForFunction(d=>document.querySelectorAll('#historyNumericCatalogue [data-shared-board]').length===puzzleDB.free[d].length,diff);
   const rows=await page.evaluate(d=>{const buttons=[...document.querySelectorAll('#historyNumericCatalogue [data-shared-board]')],bank=sortedFreeBank(d);return{count:buttons.length,exact:buttons.length===bank.length&&buttons.every((b,i)=>b.dataset.sharedBoard===bank[i].id&&Number(b.textContent)===Number(bank[i].meta.level))}},diff);
   catalogueTotal+=rows.count;check('history catalogue preserves every ID and level: '+diff,rows.exact);
   await page.locator('#closePlayedLevelsModal').click();
  }
  check('all 1750 active boards remain accessible without reserved empty slots',catalogueTotal===1750);
  await page.locator('[data-played-levels="easy"]').click();await page.locator('#historyNumericCatalogue summary').click();
  await page.locator('#historyNumericCatalogue [data-shared-board="g4-e-001"]').click();
  await page.waitForFunction(()=>currentGame?.puzzle?.id==='g4-e-001');
  const pointer=await page.evaluate(()=>currentGame.puzzle.answers[0].path),first=await page.locator('.cell[data-index="'+pointer[0]+'"]').boundingBox();
  await page.mouse.move(first.x+first.width/2,first.y+first.height/2);await page.mouse.down();
  for(const index of pointer.slice(1)){const b=await page.locator('.cell[data-index="'+index+'"]').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:2})}await page.mouse.up();
  check('catalogue launches old board and native pointer input works',await page.evaluate(()=>currentGame.found.length===1));
  await page.evaluate(async()=>{saveGameProgress();nav('free');await changeFreeOrder('easy','numeric');await changeFreeOrder('easy','varied')});
  check('play card distinguishes saved game from next board',await page.locator('[data-diff="easy"] .order-next').innerText()==='Rozehráno\nÚroveň 1');
  await page.reload({waitUntil:'networkidle'});await ready(page);await page.evaluate(()=>startFree('easy'));
  check('order changes and reload preserve original unfinished board and found word',await page.evaluate(()=>currentGame.puzzle.id==='g4-e-001'&&currentGame.found.length===1));await closeGame(page);
  for(const diff of ['hardcore','mozkomor','mozkokalypsa']){
   await page.locator('[data-play-free="'+diff+'"]').click();await page.waitForFunction(d=>currentGame?.puzzle?.difficulty===d,diff);
   const id=await page.evaluate(()=>currentGame.puzzle.id);
   check('higher-difficulty Play follows the intended route: '+diff,await page.evaluate(({d,id})=>id===PROPLET_SHARED_FREE_ORDER_MANIFEST.routes[d][0],{d:diff,id}));
   await page.evaluate(()=>{for(const a of currentGame.puzzle.answers){currentGame.path=[...a.path];submitPath()}});await page.waitForFunction(id=>!!getState().completed['free:'+id]&&currentGame.finished,id);
   check('completion keeps ID, generation and single XP reward: '+diff,await page.evaluate(({d,id})=>{const r=getState().completed['free:'+id];return r.puzzleId===id&&r.contentGeneration===4&&r.points===DIFF[d].xp},{d:diff,id}));
   await page.locator('#winPrimaryBtn').click();await page.waitForFunction(id=>currentGame?.puzzle?.id!==id,id);
   check('next button advances in the same route: '+diff,await page.evaluate(d=>currentGame.puzzle.id===PROPLET_SHARED_FREE_ORDER_MANIFEST.routes[d][1],diff));await closeGame(page);
  }
  for(const width of [320,390,840,1440]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>nav('free'));
   const layout=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,cards:[...document.querySelectorAll('#difficultyCards .cp-card')].map(c=>{const b=c.getBoundingClientRect(),title=c.querySelector('h2'),button=c.querySelector('.cp-play').getBoundingClientRect();return{diff:c.dataset.diff,height:b.height,titleFits:title.scrollWidth<=title.clientWidth+1,buttonFits:button.right<=b.right&&button.left>=b.left}})}));layouts.push(layout);
   check('compact Play cards fit width '+width,!layout.overflow&&layout.cards.every(c=>c.height<=185&&c.titleFits&&c.buttonFits));await shot(page,'play-'+width);
   await page.evaluate(()=>nav('daily'));const today=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,ctaHeight:document.querySelector('#freeRefreshToday').getBoundingClientRect().height}));layouts.push(today);check('Today and compact CTA fit width '+width,!today.overflow&&today.ctaHeight<=190);await shot(page,'today-'+width);
  }
  await page.setViewportSize({width:390,height:900});await page.locator('#settingsHeaderBtn').click();await page.waitForSelector('#screen-profile.settings-open');
  await page.locator('#freeOrderSettings summary').click();await shot(page,'settings-390');
  await page.locator('[data-theme-mode="dark"]').click();await page.evaluate(()=>nav('free'));await shot(page,'play-dark-390');
  check('dark theme keeps compact cards inside viewport',await page.evaluate(()=>document.documentElement.dataset.theme==='dark'&&document.documentElement.scrollWidth<=innerWidth+1));
  await page.evaluate(()=>nav('daily'));await page.locator('[data-refresh-dismiss]').click();await page.reload({waitUntil:'networkidle'});await ready(page);
  check('dismissed release CTA stays dismissed after reload',!(await page.locator('#freeRefreshToday').isVisible()));
  const context=await browser.newContext({viewport:{width:390,height:900}}),migrated=await context.newPage();monitor(migrated);
  const old={easy:{mode:'numeric',revision:7,plan:{version:'pestre-v1',ids:['g4-e-009','g4-e-001']},pending:{request_id:'retain-old-request'}},medium:{mode:'numeric',revision:0,offered:false,plan:null},hard:{mode:'numeric',revision:3,offered:true,plan:null}};
  await migrated.addInitScript(({prefix,old})=>{localStorage.setItem(prefix+'proplet-free-order-v1:guest',JSON.stringify(old));localStorage.setItem(prefix+'shared-refresh-preview-choice',JSON.stringify({easy:'varied'}))},{prefix:storagePrefix,old});
  await migrated.goto(base+'/',{waitUntil:'networkidle'});await ready(migrated);
  check('explicit preview choice wins; bare legacy numeric default becomes varied; real legacy opt-out survives',await migrated.evaluate(()=>freeOrder().record('easy').mode==='varied'&&freeOrder().record('medium').mode==='varied'&&freeOrder().record('hard').mode==='numeric'));
  check('legacy plan, revision and pending request remain intact for rollback',await migrated.evaluate(old=>localStorage.getItem('proplet-free-order-v1:guest')===JSON.stringify(old),old));
  check('different completion histories only skip IDs in the same shared sequence',await migrated.evaluate(()=>{const before=JSON.stringify(freeOrder().record('easy').plan.ids),s=getState();for(const id of [PROPLET_SHARED_FREE_ORDER_MANIFEST.routes.easy[0],PROPLET_SHARED_FREE_ORDER_MANIFEST.routes.easy[2]]){const p=puzzleDB.free.easy.find(p=>p.id===id);s.completed['free:'+id]={puzzleId:id,difficulty:'easy',mode:'free',level:p.meta.level,contentGeneration:4,points:15}}saveState(s);return before===JSON.stringify(freeOrder().record('easy').plan.ids)&&freeProgress('easy').nextUnsolved.id===PROPLET_SHARED_FREE_ORDER_MANIFEST.routes.easy[1]}));
  await context.close();
  check('no external or API request reaches network',!requests.some(r=>!r.url.startsWith(base+'/')||new URL(r.url).pathname.startsWith('/api/')));
  check('no browser, console or HTTP errors',errors.length===0);
  console.log(JSON.stringify({checks,errors,manifestHash,catalogueTotal,layouts},null,2));
 }catch(error){errors.push(String(error));console.log(JSON.stringify({checks,errors,layouts},null,2));throw error}
 finally{fs.writeFileSync(path.join(out,'shared-order-verification.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,requests,manifestHash,layouts},null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
