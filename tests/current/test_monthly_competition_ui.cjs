'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app/monthly/competition.js','utf8');
const monthlyV2=require('../../tools/studio-preview/monthly-v2-fixture.js');
const approvedCatalog=JSON.parse(fs.readFileSync('public/rewards/monthly/collections.json','utf8'));
const tick=()=>new Promise(setImmediate);
// The trusted isolated clock changes completion timestamps, never Date/performance
// globally or production results. Its moving offset is retained for offline play.
const appSource=fs.readFileSync('public/app.js','utf8');
const clockSource=appSource.slice(appSource.indexOf('let monthlyPreviewClockOffsetMs='),appSource.indexOf('function acceptRuntimeCapabilities'));
let deviceNow=Date.parse('2026-10-28T12:00:00Z');
class DeviceDate extends Date{constructor(...args){super(...(args.length?args:[deviceNow]));}static now(){return deviceNow;}}
const clockContext={Date:DeviceDate};vm.runInNewContext(clockSource,clockContext);
const qaClock={isolated:true,databaseRef:'eanzztstmwlamwfdskbf',branch:'codex/monthly-competition-202611',qaNow:'2026-11-03T12:00:00Z'};
assert.equal(clockContext.acceptMonthlyPreviewClock({environment:'production',monthlyPreview:qaClock}),false);
assert.equal(clockContext.resultCompletedAt(),'2026-10-28T12:00:00.000Z');
assert.equal(clockContext.acceptMonthlyPreviewClock({environment:'preview',monthlyPreview:{...qaClock,databaseRef:'iopyhluayfszskyqqpuc'}}),false);
assert.equal(clockContext.acceptMonthlyPreviewClock({environment:'preview',monthlyPreview:{...qaClock,branch:'codex/today-one-screen'}}),false);
assert.equal(clockContext.acceptMonthlyPreviewClock({environment:'preview',monthlyPreview:qaClock}),true);
assert.equal(clockContext.resultCompletedAt(),'2026-11-03T12:00:00.000Z');deviceNow+=5000;
assert.equal(clockContext.resultCompletedAt(),'2026-11-03T12:00:05.000Z');
assert.equal(DeviceDate.now(),Date.parse('2026-10-28T12:00:05Z'),'device/global clock is unchanged');
assert.equal(clockContext.acceptMonthlyPreviewClock({environment:'production'}),false);
assert.equal(clockContext.resultCompletedAt(),'2026-10-28T12:00:05.000Z');
// A real cold offline restart must keep the *moving* trusted offset, not reset
// completion to the physical device's October date or replay a frozen qaNow.
const persistedClock=new Map(),origin='https://proplet-git-codex-monthly-competi-a7b681-pavel-prouzas-projects.vercel.app';
function coldClock(storage=persistedClock,isPreview=true,currentOrigin=origin){
 const context={Date:DeviceDate,previewRuntime:()=>isPreview,location:{origin:currentOrigin},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
 vm.runInNewContext(clockSource,context);return context;
}
const warmClock=coldClock();warmClock.acceptMonthlyPreviewClock({environment:'preview',monthlyPreview:qaClock});
const trustedRecord=new Map(persistedClock);deviceNow+=3000;
assert.equal(coldClock().resultCompletedAt(),'2026-11-03T12:00:03.000Z','cold restart retains advancing server-relative time');
assert.equal(coldClock(new Map(trustedRecord),false).resultCompletedAt(),new DeviceDate().toISOString(),'production never restores QA clock');
assert.equal(coldClock(new Map(trustedRecord),true,'https://hrajproplet.cz').resultCompletedAt(),new DeviceDate().toISOString(),'clock cannot cross origins');
for(const change of [{branch:'codex/today-one-screen'},{databaseRef:'iopyhluayfszskyqqpuc'},{receivedAt:deviceNow-86400001},{receivedAt:deviceNow+1000},{offsetMs:Infinity}]){
 const record=new Map(trustedRecord),key=[...record.keys()][0];record.set(key,JSON.stringify({...JSON.parse(record.get(key)),...change}));
 assert.equal(coldClock(record).resultCompletedAt(),new DeviceDate().toISOString(),'invalid or stale stored QA clock is ignored');
}
const productionClock=coldClock();productionClock.acceptMonthlyPreviewClock({environment:'production'});assert.equal(persistedClock.size,0,'fresh production metadata clears stored QA time');
function fixture(search='',catalogAvailable=true,now='2026-11-02T12:00:00Z'){
  const documentEvents=new Map(),windowEvents=new Map(),rootEvents=new Map(),pending=[],calls=[],nodes=new Map();
  const element=()=>({innerHTML:'',textContent:'',disabled:false,open:false,isConnected:true,attrs:{},listeners:new Map(),addEventListener(n,f){this.listeners.set(n,f);},setAttribute(k,v){this.attrs[k]=v;},focus(){this.focused=true;},showModal(){this.open=true;},close(){this.open=false;this.listeners.get('close')?.();}});
  for(const key of ['.month-nav','#monthLabel','#status','#content','#previousMonth','#nextMonth','#navigation','#scenarioNotice','#content [data-expand]','#awardDetail','#awardDetailBody','#awardDetailClose','#awardDetailOwnership'])nodes.set(key,element());
  let detailWrites=0,detailHtml='';
  Object.defineProperty(nodes.get('#awardDetailBody'),'innerHTML',{get:()=>detailHtml,set:html=>{detailWrites++;detailHtml=html;nodes.get('#awardDetailOwnership').textContent=html.match(/id="awardDetailOwnership"[^>]*>([^<]*)/)?.[1]||'';}});
  const panelButtons=['standings','awards'].map(value=>({...element(),dataset:{monthlyPanel:value}}));
  const root={innerHTML:'',querySelector:s=>nodes.get(s),querySelectorAll:s=>s==='[data-monthly-panel]'?panelButtons:[],addEventListener:(n,f)=>rootEvents.set(n,f)};
  const host={setAttribute(){},attachShadow:()=>root};
  let profile=null;
  const navs=[],location=new URL('https://hrajproplet.cz/'+search),history={state:{proplet:true,screen:'daily'},replaceState(state,title,url){this.state=state;location.href=new URL(url,location).href;}};
  const context={console,Intl,URL,URLSearchParams,location,history,navigator:{onLine:true},monthlyPreviewNow:()=>new Date(now),Date,ROUTE_SCREENS:new Set(),currentScreen:'daily',getProfile:()=>profile,fetch:async()=>{if(!catalogAvailable)throw new Error('unavailable');return {ok:true,json:async()=>approvedCatalog};},
    api:(url,options)=>{calls.push({url,options});return new Promise((resolve,reject)=>pending.push({resolve,reject}));},
    nav:s=>{context.currentScreen=s;navs.push(s);documentEvents.get('proplet:screen-changed')?.({detail:{screen:s}});},
    rankingsOrchestration:()=>({openView:v=>navs.push(v)}),openProfileModal:()=>{},
    document:{createElement:()=>host,querySelector:s=>s==='.app-footer'?{before(){}}:{classList:{add(){}}},addEventListener:(n,f)=>documentEvents.set(n,f)},
    window:{PropletRankings:{mountViewNavigation(){}},addEventListener:(n,f)=>windowEvents.set(n,f)}};
  vm.runInNewContext(source,context);
  return {context,root,nodes,pending,calls,navs,detailWrites:()=>detailWrites,open:()=>context.window.PropletMonthlyCompetition.open(),setProfile:p=>{profile=p;documentEvents.get('proplet:account-changed')?.();},click:attribute=>rootEvents.get('click')({target:{closest:()=>({hasAttribute:n=>n===attribute})}}),clickData:dataset=>{const button={...element(),dataset,hasAttribute:()=>false};rootEvents.get('click')({target:{closest:()=>button}});return button;},content:()=>nodes.get('#content').innerHTML};
}
(async()=>{
  // Browsing competition views must not leave a launch instruction behind for refresh.
  const browsing=fixture('?utm_source=refresh-check#today',true,'2026-12-02T12:00:00Z');
  const entryUrl=browsing.context.location.href;
  browsing.open();browsing.clickData({monthlyPanel:'awards'});await tick();
  browsing.nodes.get('#nextMonth').onclick();await tick();
  assert(browsing.content().includes('Král prosince'),'month navigation still changes the displayed collection');
  browsing.clickData({monthlyPanel:'standings'});
  browsing.context.nav('daily');
  assert.equal(browsing.context.location.href,entryUrl,'panel/month navigation leaves no stale monthly startup URL and preserves unrelated query/hash');
  clockContext.acceptMonthlyPreviewClock({environment:'preview',monthlyPreview:qaClock});
  const offlineStamp=clockContext.resultCompletedAt();
  clockContext.puzzleDB={datedDaily:true};clockContext.datedDaily=()=>({refresh:async()=>({monthlyPreview:{...qaClock,qaNow:'2026-11-03T10:00:00Z'}})});
  vm.runInNewContext(appSource.match(/async function refreshDatedDaily\(\)\{[^\n]+\}/)[0],clockContext);
  await clockContext.refreshDatedDaily();
  assert.equal(clockContext.resultCompletedAt(),offlineStamp,'cached/offline descriptor cannot reset the moving completion clock to its old fetch time');
  const f=fixture();f.open();assert.equal(f.calls.length,1);assert(f.calls[0].url.startsWith('/api/competition/monthly?month='));assert.equal(f.calls[0].options.authProfile,null);
  assert.equal(f.nodes.get('.month-nav').hidden,true,'first season has no month arrows');
  f.pending[0].resolve({enabled:true,status:'upcoming',standings:[]});await tick();assert(f.content().includes('Začínáme 1. listopadu'));assert(!f.content().includes('player-name'),'no fictional players in first season');
  f.setProfile({id:'mine',token:'session-one'});const standings=Array.from({length:6},(_,i)=>({isMine:i===5,name:i===5?'Vlastní účet':'Hráč <'+i+'>',rank:i<2?1:i+1,points:2400-i*100,countedDays:20,validDays:21}));
  const state={enabled:true,status:'open',standings,me:{...standings[5],days:[{date:'2026-11-01',points:120,counted:true},{date:'2026-11-02',points:100,counted:false}]}};
  f.pending[1].resolve(state);await tick();assert(f.content().includes('1\u00a0900')||f.content().includes('1 900'));assert(f.content().includes('Vlastní účet'));assert(f.content().includes('mimo nejlepší dvacítku'));assert(f.content().includes('Hráč &lt;0&gt;'),'server names escaped');
  assert.equal(f.nodes.get('#status').textContent,'');assert(f.content().includes('class="player-meta" hidden'));f.click('data-breakdown');assert(!f.content().includes('class="player-meta" hidden'));
  assert.equal((f.content().match(/class="player-name"/g)||[]).length,6,'top five plus distant own row');
  f.click('data-expand');assert(f.content().includes('Zobrazit první pětici'));assert.equal((f.content().match(/Vlastní účet/g)||[]).length,1,'expansion does not duplicate own row');
  f.click('data-retry');const old=f.pending.at(-1);f.setProfile({id:'new',token:'session-two'});const next=f.pending.at(-1);old.resolve(state);await tick();assert(!f.content().includes('Vlastní účet'),'previous account inflight data cannot repaint new account');
  next.resolve({enabled:true,status:'closed',standings:[],me:{points:0,countedDays:0,validDays:0,days:[]}});await tick();assert.equal(f.nodes.get('#status').textContent,'Konečné výsledky');assert(!f.content().includes('Vlastní účet'));
  f.context.navigator.onLine=false;f.click('data-retry');f.pending.at(-1).reject(new Error('offline'));await tick();assert(f.content().includes('Jsi offline'));assert.equal(f.nodes.get('#content').attrs['aria-busy'],'false');assert(!f.content().includes('player-name'));
  f.context.navigator.onLine=true;f.click('data-retry');f.pending.at(-1).resolve({enabled:false,reason:'non-production'});await tick();assert(f.content().includes('Pořadí nyní není dostupné'));assert(!f.content().includes('personal-score'));
  const isolated=fixture('?monthlyScenario=ties');isolated.open();assert(isolated.calls[0].url.endsWith('&scenario=ties'));
  isolated.pending[0].resolve({...state,month:'2026-10',scenarioViewer:true,isolatedScenario:'ties',truncated:true,limit:100,me:{...state.me,sharedRank:true}});await tick();
  assert(isolated.content().includes('personal-score'),'server-approved isolated viewer can inspect own card without saving a fake account');assert(!isolated.content().includes('společné umístění'),'legacy shared rank is not presented as a final v2 tie outcome');
  assert.equal(isolated.nodes.get('#scenarioNotice').hidden,false);assert(isolated.nodes.get('#scenarioNotice').textContent.includes('ukázkoví hráči'));assert(isolated.content().includes('prvních 100 míst a tvoje'));
  assert.equal(isolated.nodes.get('#previousMonth').disabled,true);assert.equal(isolated.nodes.get('#nextMonth').disabled,true);
  const unapproved=fixture('?monthlyScenario=ties');unapproved.open();unapproved.pending[0].resolve(state);await tick();assert(unapproved.content().includes('data-account'),'URL alone does not enable own synthetic identity');assert.equal(unapproved.nodes.get('#scenarioNotice').hidden,true);
  const november=fixture('?open=monthly&panel=awards&collection=2026-12');november.open();await tick();assert(november.content().includes('Král listopadu'));assert.equal(november.nodes.get('.month-nav').hidden,true,'future award months are not available in November');
  const gallery=fixture('?open=monthly&panel=awards&collection=2026-12',true,'2026-12-02T12:00:00Z');gallery.open();await tick();
  assert(gallery.content().includes('Král prosince')&&gallery.content().includes('Rytíř prosince')&&gallery.content().includes('Kníže prosince'),'December deep link works once December has started');
  assert.equal((gallery.content().match(/Náhled odznaku/g)||[]).length,3);assert(!gallery.content().includes('Získáno'),'catalog never fabricates ownership');
  gallery.pending[0].resolve({enabled:false,reason:'disabled'});await tick();assert(gallery.content().includes('/rewards/monthly/2026-12/knight-v1.webp'),'disabled backend cannot bury approved gallery');
  const opener=gallery.clickData({awardMonth:'2026-12',awardRank:'2'});await tick();assert.equal(gallery.nodes.get('#awardDetail').open,true);assert(gallery.nodes.get('#awardDetailBody').innerHTML.includes('Letos hlídám cukroví. Zatím chybí šest kousků.'));
  gallery.click('data-close-award');assert.equal(gallery.nodes.get('#awardDetail').open,false);assert.equal(opener.focused,true,'dialog restores keyboard focus');
  gallery.nodes.get('#previousMonth').onclick();assert(gallery.content().includes('Král listopadu'));assert(!gallery.content().includes('Král prosince'));
  const ownership=fixture('?open=monthly&panel=awards&collection=2026-11');ownership.setProfile({id:'owner',token:'owner-token'});ownership.open();await tick();
  ownership.clickData({awardMonth:'2026-11',awardRank:'1'});await tick();assert.equal(ownership.nodes.get('#awardDetailOwnership').textContent,'Náhled odznaku');
  ownership.pending[0].resolve({enabled:true,status:'closed',standings:[],badges:[{month:'2026-11',rank:1}]});await tick();
  assert.equal(ownership.nodes.get('#awardDetailOwnership').textContent,'✓ Získáno','already-open detail updates when server ownership arrives');
  assert.equal(ownership.nodes.get('#awardDetail').open,true);assert.equal(ownership.detailWrites(),1,'ownership refresh preserves original artwork, detail nodes and focus');
  ownership.click('data-retry');ownership.pending.at(-1).resolve({enabled:true,status:'closed',standings:[],badges:[]});await tick();
  assert.equal(ownership.nodes.get('#awardDetailOwnership').textContent,'Náhled odznaku','authoritative removal also updates the open detail');
  ownership.click('data-retry');ownership.pending.at(-1).resolve({enabled:true,status:'closed',standings:[],badges:[{month:'2026-11',rank:1}]});await tick();
  ownership.click('data-retry');ownership.pending.at(-1).reject(new Error('offline'));await tick();assert.equal(ownership.nodes.get('#awardDetailOwnership').textContent,'Náhled odznaku','unverified ownership is cleared on fetch failure');assert.equal(ownership.detailWrites(),1);
  ownership.setProfile({id:'other',token:'other-token'});assert.equal(ownership.nodes.get('#awardDetail').open,false,'account change still closes private ownership detail');
  const clarity=fixture();clarity.setProfile({id:'studio-review',token:'fixture-only'});clarity.open();clarity.pending[0].resolve(monthlyV2.response('clarity'));await tick();
  assert(clarity.content().includes('Denní výzvy: 90 bodů'));assert(clarity.content().includes('1 z 20 dnů'));assert(clarity.content().includes('Další hraní: 412,5 bodu'));assert(clarity.content().includes('Zatím bez Denní výzvy'));assert(clarity.content().includes('Další hraní: 16,7 bodu'));assert(!clarity.content().includes('0 + 16,7'));assert(!clarity.content().includes('90 + 412,5'));assert(!clarity.content().includes('0 z 20 dnů'),'zero Daily must not look like zero games played');
  for(const kind of ['ready','provisional','ties','closed']){
    const preview=fixture();preview.setProfile({id:'studio-review',token:'fixture-only'});preview.open();preview.pending[0].resolve(monthlyV2.response(kind));await tick();
    const html=preview.content();assert(html.includes('/ 2 500 bodů'));assert(html.includes('<dt>Denní výzvy</dt>'));assert(html.includes('<dt>Další hraní</dt>'));assert(html.includes('/ 2 000'));assert(html.includes('/ 500'));assert(html.includes(kind==='ties'?'55 + 25 + 20':'55 + 25 + 10'));assert(html.includes('6 000 XP'));assert(!html.includes('2 400'));assert(!html.includes('1–1–3'));assert(!html.includes('Rychlost ani XP nerozhodují'));
    if(kind==='ready'){assert(html.includes('Rozhodl počet čistých řešení'));assert.match(html,/day-components">55 \+ 20 \+ 20<\/small><\/span><b>95 bodů/);assert.match(html,/day-components">55 \+ 25 \+ 10<\/small><\/span><b>90 bodů/);assert(html.includes('Každý den: dokončení + samostatnost + ověřená rychlost.'));assert(html.includes('25 bodů bez nápovědy, 20 s jednou, 15 se dvěma, 10 se třemi, 5 se čtyřmi a 0 s pěti či více nápovědami.'));assert(!html.includes('7 s jednou'));assert(!html.includes('čisté řešení + nápovědy'));}
    if(kind==='provisional'){assert(html.includes('3. 12.'));assert(html.includes('platná offline dokončení'));}
    if(kind==='ties'){assert(html.includes('čeká na závěrečný los'));assert(html.includes('místo předběžné'));assert(!html.includes('rank-number" aria-label="1. místo'));assert(!html.includes('award-rank="1"'),'unresolved podium does not promise an award');}
    if(kind==='closed'){assert(html.includes('Rozhodl závěrečný los'));assert(!html.includes('místo předběžné'));}
  }
  for(const [hints,independence] of [25,20,15,10,5,0].entries()){
    const curve=fixture();curve.setProfile({id:'curve-player',token:'fixture-only'});curve.open();const receipt=monthlyV2.response();receipt.me.days=[{date:'2026-11-01',points:55+independence+20,counted:true,completionPoints:55,independencePoints:independence,cleanPoints:99,hintPoints:99,speedPoints:20,hints,clean:hints===0,verifiedTimeMs:180000}];curve.pending[0].resolve(receipt);await tick();assert(curve.content().includes(`day-components">55 + ${independence} + 20</small></span><b>${55+independence+20} bodů`),`authoritative independencePoints must win for ${hints} hints, including zero`);
  }
  for(const version of [{scoringVersion:2},{rulesVersion:'monthly-quality-v2'}]){
    const previous=fixture();previous.setProfile({id:'historic-quality',token:'fixture-only'});previous.open();const value=monthlyV2.response('closed',2);delete value.scoringVersion;delete value.rulesVersion;previous.pending[0].resolve({...value,...version});await tick();assert(previous.content().includes('25 bodů bez nápovědy, 7 s jednou, 4 se dvěma, 1 se třemi a 0 se čtyřmi či více nápovědami.'));assert.match(previous.content(),/day-components">55 \+ 7 \+ 20<\/small><\/span><b>82 bodů/);assert(!previous.content().includes('20 s jednou'),'explicit v2 history retains its original rules');
  }
  for(const version of [{scoringVersion:1},{rulesVersion:'monthly-basic-v1'}]){
    const history=fixture();history.setProfile({id:'historic-player',token:'fixture-only'});history.open();history.pending[0].resolve({...state,...version,status:'closed',month:'2026-11',me:{points:2400,dailyPoints:2400,otherPoints:0,otherEarnedXp:99999,rank:1,sharedRank:true,countedDays:20,validDays:20,days:[{date:'2026-11-01',points:120,counted:true},{date:'2026-11-02',points:100,counted:true}]}});await tick();
    const html=history.content();assert(html.includes('/ 2 400 bodů'));assert(html.includes('společné umístění'));assert(html.includes('100 soutěžních bodů a dalších 20 bez nápovědy'));assert(html.includes('Rychlost ani XP nerozhodují'));assert(html.includes('1–1–3'));assert(html.includes('Bez nápovědy'));assert(!html.includes('80 % maxima'));assert(!html.includes('ověřená rychlost'));
    history.clickData({monthlyPanel:'awards'});await tick();assert(history.content().includes('Při shodě získá stejný odznak každý'));assert(!history.content().includes('tři různí hráči'));
    history.clickData({monthlyPanel:'standings'});history.click('data-retry');history.pending.at(-1).resolve(monthlyV2.response());await tick();assert(history.content().includes('/ 2 500 bodů'));assert(!history.content().includes('Rychlost ani XP nerozhodují'),'a subsequent v2 response clears the legacy policy');
  }
  const unknownTime=fixture();unknownTime.setProfile({id:'studio-review',token:'fixture-only'});unknownTime.open();const unknown=monthlyV2.response();unknown.me.days[0].verifiedTimeMs=null;unknown.me.days[0].speedPoints=0;unknownTime.pending[0].resolve(unknown);await tick();assert(unknownTime.content().includes('čas neověřen'),'missing verified timing is explicitly visible');
  const unavailable=fixture('',false);unavailable.setProfile({id:'mine',token:'session'});unavailable.open();unavailable.pending[0].resolve(state);await tick();assert(unavailable.content().includes('personal-score'),'catalog failure leaves scores functional');unavailable.clickData({monthlyPanel:'awards'});assert(unavailable.content().includes('Odznaky se nepodařilo načíst'));
  console.log('PASS monthly UI: server-only data, first season, own distant rank, best20 details, escaping, account races, offline and disabled backend');
})().catch(error=>{console.error(error);process.exitCode=1;});
