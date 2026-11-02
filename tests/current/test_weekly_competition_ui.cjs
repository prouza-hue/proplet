'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app/weekly/competition.js','utf8');
const tick=()=>new Promise(setImmediate);
const weeks=[{start:'2026-10-26',end:'2026-11-02'},{start:'2026-10-19',end:'2026-10-26'}];
const metadata={enabled:true,weeks,selectedWeek:null,teams:[],goldTeams:[
 {name:'Parta <A>',gold:3,rank:1,isMine:true},{name:'Parta B',gold:3,rank:1,isMine:false},
 {name:'Parta C',gold:1,rank:3,isMine:false}]};
function fixture(){
 const nodes=new Map(),events=new Map(),rootEvents=new Map(),pending=[];
 let profile=null,now=Date.parse('2026-11-02T12:00:00Z');
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const node=()=>({innerHTML:'',textContent:'',hidden:false,disabled:false,attrs:{},dataset:{},open:false,
  setAttribute(k,v){this.attrs[k]=v;},focus(){this.focused=true;},showModal(){this.open=true;},close(){this.open=false;}});
 const get=s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);};
 const root={querySelector:get,querySelectorAll:()=>[],prepend(){},append(){},addEventListener:(name,fn)=>rootEvents.set(name,fn)};
 const context={console,Intl,Date:Clock,URLSearchParams,location:{search:''},ROUTE_SCREENS:new Set(),currentScreen:'daily',
  getProfile:()=>profile,api:(url,opts)=>new Promise((resolve,reject)=>pending.push({url,opts,resolve,reject})),
  document:{hidden:false,createElement:()=>({...node(),attachShadow:()=>root}),
   querySelector:s=>s==='.app-footer'?{before(){}}:{classList:{add(){}}},
   addEventListener:(name,fn)=>events.set(name,fn)},
  nav:screen=>{context.currentScreen=screen;events.get('proplet:screen-changed')({detail:{screen}});},
  rankingsOrchestration:()=>({openView(){}}),openProfileModal(){},openTeamMembershipModal(){},openFamilyLeagueModal(){},
  window:{PropletRankings:{mountViewNavigation(){}}}};
 vm.runInNewContext(source,context);
 function respond(requests,data=metadata,rankingName='Aktuální tým'){
  for(const request of requests){
   if(request.url.startsWith('/api/team-victories/competition'))request.resolve(data);
   else if(request.url.startsWith('/api/rankings/xp'))request.resolve({teams:[{name:rankingName,rank:1,xp:100,memberCount:2}]});
   else request.resolve({enabled:true,team:{name:'Můj tým',totalGold:3},history:[]});
  }
 }
 return {get,pending,respond,events,context,open:()=>context.window.PropletWeeklyCompetition.open(),
  setProfile:p=>{profile=p;events.get('proplet:account-changed')();},
  retry:()=>rootEvents.get('click')({target:{closest:()=>({dataset:{},hasAttribute:key=>key==='data-retry'})}})};
}
test('guest sees exact tied gold totals and escaped names without personal trophy requests',async()=>{
 const f=fixture();f.open();f.respond(f.pending,{...metadata,goldTeams:metadata.goldTeams.map(row=>({...row,isMine:false}))});await tick();
 assert.equal(f.pending.length,2);
 const html=f.get('#medalList').innerHTML;
 assert.match(html,/Parta &lt;A&gt;/);assert.doesNotMatch(html,/Parta <A>/);
 assert.equal((html.match(/class="pos">1\./g)||[]).length,2);
 assert.match(html,/class="pos">3\./);assert.doesNotMatch(html,/váš tým/);
 assert.equal(f.get('.week-nav').hidden,false);
 f.get('#medalsTab').onclick();assert.equal(f.get('#medals').hidden,false);assert.equal(f.get('#week').hidden,true);
});
test('archive paging uses frozen standings, boundaries and return to current week',async()=>{
 const f=fixture();f.open();f.respond(f.pending);await tick();
 assert.equal(f.get('#nextWeek').disabled,true);
 let start=f.pending.length;f.get('#previousWeek').onclick();
 assert(f.pending.slice(start).some(r=>r.url.endsWith('?week=2026-10-26')));
 f.respond(f.pending.slice(start),{...metadata,selectedWeek:weeks[0],teams:[{name:'Archiv první',xp:850,rank:1}]});await tick();
 assert.match(f.get('.rank-list').innerHTML,/Archiv první/);assert.doesNotMatch(f.get('.rank-list').innerHTML,/Aktuální tým/);
 assert.equal(f.get('#teamCard').hidden,true);assert.equal(f.get('#nextWeek').disabled,false);
 start=f.pending.length;f.get('#previousWeek').onclick();
 f.respond(f.pending.slice(start),{...metadata,selectedWeek:weeks[1],teams:[]});await tick();
 assert.equal(f.get('#previousWeek').disabled,true);
 for(let i=0;i<2;i++){start=f.pending.length;f.get('#nextWeek').onclick();f.respond(f.pending.slice(start));await tick();}
 assert.match(f.get('.rank-list').innerHTML,/Aktuální tým/);assert.equal(f.get('#teamCard').hidden,false);
});
test('failed archive request keeps a working route back to the live week',async()=>{
 const f=fixture();f.open();f.respond(f.pending);await tick();
 const start=f.pending.length;f.get('#previousWeek').onclick();
 for(const r of f.pending.slice(start))r.reject(new Error('network'));
 await tick();assert.match(f.get('.rank-list').innerHTML,/nepodařilo/);
 assert.equal(f.get('.week-nav').hidden,false,'failure must not strand user in archive');
 assert.equal(f.get('#nextWeek').disabled,false);
 const next=f.pending.length;f.get('#nextWeek').onclick();f.respond(f.pending.slice(next));await tick();
 assert.match(f.get('.rank-list').innerHTML,/Aktuální tým/);
});
test('account change clears old medal identity and rejects stale response',async()=>{
 const f=fixture();f.setProfile({id:'a',token:'a',familyCode:'A'});f.open();f.respond(f.pending);await tick();
 assert.match(f.get('#medalList').innerHTML,/váš tým/);
 let start=f.pending.length;f.retry();const stale=f.pending.slice(start);
 start=f.pending.length;f.setProfile({id:'b',token:'b',familyCode:'B'});const fresh=f.pending.slice(start);
 assert.doesNotMatch(f.get('#medalList').innerHTML,/Parta &lt;A&gt;|váš tým/,'pending new account must not retain old identity');
 f.respond(stale);await tick();assert.doesNotMatch(f.get('#medalList').innerHTML,/Parta &lt;A&gt;/);
 f.respond(fresh,{...metadata,goldTeams:[{name:'Nový tým',rank:1,gold:2,isMine:true}]});await tick();
 assert.match(f.get('#medalList').innerHTML,/Nový tým/);assert.doesNotMatch(f.get('#medalList').innerHTML,/Parta &lt;A&gt;/);
});
test('rapid archive paging ignores older response that completes last',async()=>{
 const f=fixture();f.open();f.respond(f.pending);await tick();
 let start=f.pending.length;f.get('#previousWeek').onclick();const old=f.pending.slice(start);
 start=f.pending.length;f.get('#previousWeek').onclick();const newer=f.pending.slice(start);
 assert(newer.some(r=>r.url.endsWith('?week=2026-10-19')),'known archive navigation remains available during load');
 f.respond(newer,{...metadata,selectedWeek:weeks[1],teams:[{name:'Druhý archiv',rank:1,xp:500}]});await tick();
 f.respond(old,{...metadata,selectedWeek:weeks[0],teams:[{name:'Starší odpověď',rank:1,xp:300}]});await tick();
 assert.match(f.get('.rank-list').innerHTML,/Druhý archiv/);assert.doesNotMatch(f.get('.rank-list').innerHTML,/Starší odpověď/);
});
test('medal API failure is retryable and cannot invent zero awards',async()=>{
 const f=fixture();f.open();
 for(const r of f.pending){if(r.url.includes('/competition'))r.reject(new Error('network'));else f.respond([r]);}
 await tick();assert.match(f.get('#medalList').innerHTML,/nepodařilo/);assert.doesNotMatch(f.get('#medalList').innerHTML,/nebylo uděleno/);
 const start=f.pending.length;f.retry();f.respond(f.pending.slice(start),{...metadata,weeks:[],goldTeams:[]});await tick();
 assert.match(f.get('#medalList').innerHTML,/nebylo uděleno/);assert.equal(f.get('.week-nav').hidden,true);
});
test('three internal tabs support keyboard navigation and one focusable tab',async()=>{
 const f=fixture();f.open();f.respond(f.pending);await tick();
 f.get('.tabs').onkeydown({key:'ArrowRight',preventDefault(){}});
 assert.equal(f.get('#medalsTab').attrs['aria-selected'],'true');assert.equal(f.get('#medalsTab').focused,true);
 assert.equal(f.get('#weekTab').tabIndex,-1);assert.equal(f.get('#cabinetTab').tabIndex,-1);
 f.get('.tabs').onkeydown({key:'End',preventDefault(){}});assert.equal(f.get('#cabinetTab').attrs['aria-selected'],'true');
 f.get('.tabs').onkeydown({key:'Home',preventDefault(){}});assert.equal(f.get('#weekTab').attrs['aria-selected'],'true');
});
