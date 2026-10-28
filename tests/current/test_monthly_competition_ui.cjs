'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app/monthly/competition.js','utf8');
const tick=()=>new Promise(setImmediate);
function fixture(search=''){
  const documentEvents=new Map(),windowEvents=new Map(),rootEvents=new Map(),pending=[],calls=[],nodes=new Map();
  const element=()=>({innerHTML:'',textContent:'',disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v;},focus(){}});
  for(const key of ['#monthLabel','#status','#content','#previousMonth','#nextMonth','#navigation','#scenarioNotice','#content [data-expand]'])nodes.set(key,element());
  const root={innerHTML:'',querySelector:s=>nodes.get(s),addEventListener:(n,f)=>rootEvents.set(n,f)};
  const host={setAttribute(){},attachShadow:()=>root};
  let profile=null;
  const navs=[];
  const context={console,Intl,URLSearchParams,location:{search},navigator:{onLine:true},Date,ROUTE_SCREENS:new Set(),currentScreen:'daily',getProfile:()=>profile,
    api:(url,options)=>{calls.push({url,options});return new Promise((resolve,reject)=>pending.push({resolve,reject}));},
    nav:s=>{context.currentScreen=s;navs.push(s);documentEvents.get('proplet:screen-changed')?.({detail:{screen:s}});},
    rankingsOrchestration:()=>({openView:v=>navs.push(v)}),openProfileModal:()=>{},
    document:{createElement:()=>host,querySelector:s=>s==='.app-footer'?{before(){}}:{classList:{add(){}}},addEventListener:(n,f)=>documentEvents.set(n,f)},
    window:{PropletRankings:{mountViewNavigation(){}},addEventListener:(n,f)=>windowEvents.set(n,f)}};
  vm.runInNewContext(source,context);
  return {context,root,nodes,pending,calls,navs,open:()=>context.window.PropletMonthlyCompetition.open(),setProfile:p=>{profile=p;documentEvents.get('proplet:account-changed')?.();},click:attribute=>rootEvents.get('click')({target:{closest:()=>({hasAttribute:n=>n===attribute})}}),content:()=>nodes.get('#content').innerHTML};
}
(async()=>{
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
  console.log('PASS monthly UI: server-only data, first season, own distant rank, best20 details, escaping, account races, offline and disabled backend');
})().catch(error=>{console.error(error);process.exitCode=1;});
