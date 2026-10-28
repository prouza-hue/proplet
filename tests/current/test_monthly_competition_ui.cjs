'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app/monthly/competition.js','utf8');
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
function fixture(search='',catalogAvailable=true){
  const documentEvents=new Map(),windowEvents=new Map(),rootEvents=new Map(),pending=[],calls=[],nodes=new Map();
  const element=()=>({innerHTML:'',textContent:'',disabled:false,open:false,isConnected:true,attrs:{},listeners:new Map(),addEventListener(n,f){this.listeners.set(n,f);},setAttribute(k,v){this.attrs[k]=v;},focus(){this.focused=true;},showModal(){this.open=true;},close(){this.open=false;this.listeners.get('close')?.();}});
  for(const key of ['#monthLabel','#status','#content','#previousMonth','#nextMonth','#navigation','#scenarioNotice','#content [data-expand]','#awardDetail','#awardDetailBody','#awardDetailClose'])nodes.set(key,element());
  const panelButtons=['standings','awards'].map(value=>({...element(),dataset:{monthlyPanel:value}}));
  const root={innerHTML:'',querySelector:s=>nodes.get(s),querySelectorAll:s=>s==='[data-monthly-panel]'?panelButtons:[],addEventListener:(n,f)=>rootEvents.set(n,f)};
  const host={setAttribute(){},attachShadow:()=>root};
  let profile=null;
  const navs=[];
  const context={console,Intl,URLSearchParams,location:{search},navigator:{onLine:true},Date,ROUTE_SCREENS:new Set(),currentScreen:'daily',getProfile:()=>profile,fetch:async()=>{if(!catalogAvailable)throw new Error('unavailable');return {ok:true,json:async()=>approvedCatalog};},
    api:(url,options)=>{calls.push({url,options});return new Promise((resolve,reject)=>pending.push({resolve,reject}));},
    nav:s=>{context.currentScreen=s;navs.push(s);documentEvents.get('proplet:screen-changed')?.({detail:{screen:s}});},
    rankingsOrchestration:()=>({openView:v=>navs.push(v)}),openProfileModal:()=>{},
    document:{createElement:()=>host,querySelector:s=>s==='.app-footer'?{before(){}}:{classList:{add(){}}},addEventListener:(n,f)=>documentEvents.set(n,f)},
    window:{PropletRankings:{mountViewNavigation(){}},addEventListener:(n,f)=>windowEvents.set(n,f)}};
  vm.runInNewContext(source,context);
  return {context,root,nodes,pending,calls,navs,open:()=>context.window.PropletMonthlyCompetition.open(),setProfile:p=>{profile=p;documentEvents.get('proplet:account-changed')?.();},click:attribute=>rootEvents.get('click')({target:{closest:()=>({hasAttribute:n=>n===attribute})}}),clickData:dataset=>{const button={...element(),dataset,hasAttribute:()=>false};rootEvents.get('click')({target:{closest:()=>button}});return button;},content:()=>nodes.get('#content').innerHTML};
}
(async()=>{
  clockContext.acceptMonthlyPreviewClock({environment:'preview',monthlyPreview:qaClock});
  const offlineStamp=clockContext.resultCompletedAt();
  clockContext.puzzleDB={datedDaily:true};clockContext.datedDaily=()=>({refresh:async()=>({monthlyPreview:{...qaClock,qaNow:'2026-11-03T10:00:00Z'}})});
  vm.runInNewContext(appSource.match(/async function refreshDatedDaily\(\)\{[^\n]+\}/)[0],clockContext);
  await clockContext.refreshDatedDaily();
  assert.equal(clockContext.resultCompletedAt(),offlineStamp,'cached/offline descriptor cannot reset the moving completion clock to its old fetch time');
  const f=fixture();f.open();assert.equal(f.calls.length,1);assert(f.calls[0].url.startsWith('/api/competition/monthly?month='));assert.equal(f.calls[0].options.authProfile,null);
  f.pending[0].resolve({enabled:true,status:'upcoming',standings:[]});await tick();assert(f.content().includes('Začínáme 1. listopadu'));assert(!f.content().includes('player-name'),'no fictional players in first season');
  f.setProfile({id:'mine',token:'session-one'});const standings=Array.from({length:6},(_,i)=>({isMine:i===5,name:i===5?'Vlastní účet':'Hráč <'+i+'>',rank:i<2?1:i+1,points:2400-i*100,countedDays:20,validDays:21}));
  const state={enabled:true,status:'open',standings,me:{...standings[5],days:[{date:'2026-11-01',points:120,counted:true},{date:'2026-11-02',points:100,counted:false}]}};
  f.pending[1].resolve(state);await tick();assert(f.content().includes('1\u00a0900')||f.content().includes('1 900'));assert(f.content().includes('Vlastní účet'));assert(f.content().includes('mimo nejlepší dvacítku'));assert(f.content().includes('Hráč &lt;0&gt;'),'server names escaped');
  assert.equal((f.content().match(/class="player-name"/g)||[]).length,6,'top five plus distant own row');
  f.click('data-expand');assert(f.content().includes('Zobrazit první pětici'));assert.equal((f.content().match(/Vlastní účet/g)||[]).length,1,'expansion does not duplicate own row');
  f.click('data-retry');const old=f.pending.at(-1);f.setProfile({id:'new',token:'session-two'});const next=f.pending.at(-1);old.resolve(state);await tick();assert(!f.content().includes('Vlastní účet'),'previous account inflight data cannot repaint new account');
  next.resolve({enabled:true,status:'closed',standings:[],me:{points:0,countedDays:0,validDays:0,days:[]}});await tick();assert(f.content().includes('konečné výsledky'));assert(!f.content().includes('Vlastní účet'));
  f.context.navigator.onLine=false;f.click('data-retry');f.pending.at(-1).reject(new Error('offline'));await tick();assert(f.content().includes('Jsi offline'));assert.equal(f.nodes.get('#content').attrs['aria-busy'],'false');assert(!f.content().includes('player-name'));
  f.context.navigator.onLine=true;f.click('data-retry');f.pending.at(-1).resolve({enabled:false,reason:'non-production'});await tick();assert(f.content().includes('Pořadí nyní není dostupné'));assert(!f.content().includes('personal-score'));
  const isolated=fixture('?monthlyScenario=ties');isolated.open();assert(isolated.calls[0].url.endsWith('&scenario=ties'));
  isolated.pending[0].resolve({...state,month:'2026-10',scenarioViewer:true,isolatedScenario:'ties',truncated:true,limit:100,me:{...state.me,sharedRank:true}});await tick();
  assert(isolated.content().includes('personal-score'),'server-approved isolated viewer can inspect own card without saving a fake account');assert(isolated.content().includes('společné umístění'),'authoritative shared rank survives bounded standings');
  assert.equal(isolated.nodes.get('#scenarioNotice').hidden,false);assert(isolated.nodes.get('#scenarioNotice').textContent.includes('ukázkoví hráči'));assert(isolated.content().includes('prvních 100 míst a tvoje'));
  assert.equal(isolated.nodes.get('#previousMonth').disabled,true);assert.equal(isolated.nodes.get('#nextMonth').disabled,true);
  const unapproved=fixture('?monthlyScenario=ties');unapproved.open();unapproved.pending[0].resolve(state);await tick();assert(unapproved.content().includes('data-account'),'URL alone does not enable own synthetic identity');assert.equal(unapproved.nodes.get('#scenarioNotice').hidden,true);
  const gallery=fixture('?open=monthly&panel=awards&collection=2026-12');gallery.open();await tick();
  assert(gallery.content().includes('Král prosince')&&gallery.content().includes('Rytíř prosince')&&gallery.content().includes('Kníže prosince'),'approved December deep link works before monthly API answers');
  assert.equal((gallery.content().match(/Náhled odznaku/g)||[]).length,3);assert(!gallery.content().includes('Získáno'),'catalog never fabricates ownership');
  gallery.pending[0].resolve({enabled:false,reason:'disabled'});await tick();assert(gallery.content().includes('/rewards/monthly/2026-12/knight-v1.webp'),'disabled backend cannot bury approved gallery');
  const opener=gallery.clickData({awardMonth:'2026-12',awardRank:'2'});await tick();assert.equal(gallery.nodes.get('#awardDetail').open,true);assert(gallery.nodes.get('#awardDetailBody').innerHTML.includes('Letos hlídám cukroví. Zatím chybí šest kousků.'));
  gallery.click('data-close-award');assert.equal(gallery.nodes.get('#awardDetail').open,false);assert.equal(opener.focused,true,'dialog restores keyboard focus');
  gallery.nodes.get('#previousMonth').onclick();assert(gallery.content().includes('Král listopadu'));assert(!gallery.content().includes('Král prosince'));
  const unavailable=fixture('',false);unavailable.setProfile({id:'mine',token:'session'});unavailable.open();unavailable.pending[0].resolve(state);await tick();assert(unavailable.content().includes('personal-score'),'catalog failure leaves scores functional');unavailable.clickData({monthlyPanel:'awards'});assert(unavailable.content().includes('Odznaky se nepodařilo načíst'));
  console.log('PASS monthly UI: server-only data, first season, own distant rank, best20 details, escaping, account races, offline and disabled backend');
})().catch(error=>{console.error(error);process.exitCode=1;});
