const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../../public/app/content/free-order-engine.js');
const Store=require('../../public/app/content/free-order-store.js');
const old=Array.from({length:20},(_,i)=>({id:'old-'+i,difficulty:'easy',meta:{level:i+1},answers:[{word:'OLD'+i}]}));
const modern=Array.from({length:12},(_,i)=>({id:'g5-r1-'+i,difficulty:'easy',meta:{level:i+218,contentGeneration:4},answers:[{word:'GEN'+i}]}));
const bank=[...old,...modern],original=JSON.stringify(bank);
const newcomer=E.buildPlan({bank,difficulty:'easy',newcomer:true});
assert.deepEqual(newcomer.ids.slice(0,10).map(i=>i.startsWith('g5-')),[false,true,false,true,false,true,false,true,false,true]);
assert.equal(new Set(newcomer.ids).size,bank.length);
const plan=E.buildPlan({bank,difficulty:'easy',completedIds:['old-0','g5-r1-0']});
assert.equal(plan.ids[0],'g5-r1-1');assert.deepEqual(plan.ids.slice(1,3),['old-1','old-2']);
assert.equal(E.next({bank,difficulty:'easy',mode:'varied',plan,completedIds:['old-0'],resumeId:'old-8'}).puzzle.id,'old-8');
const release={id:'batch-new',difficulty:'easy',meta:{level:21},answers:[]};
assert.deepEqual(E.reconcilePlan(newcomer,{bank:[...bank,release],difficulty:'easy'}).ids,[...newcomer.ids,'batch-new']);
assert.deepEqual(E.reconcilePlan(newcomer,{bank:bank.slice(1),difficulty:'easy'}).ids,newcomer.ids,'temporary bank gaps retain ordering tombstones');
assert.equal(JSON.stringify(bank),original);
for(const diff of ['medium','hard','hardcore','mozkomor']){
 const b=bank.map(p=>({...p,difficulty:diff})),p=E.buildPlan({bank:b,difficulty:diff});
 if(diff==='mozkomor')assert.equal(p.kind,'numeric');else{assert.equal(p.kind,'varied');if(diff!=='medium'){const fresh=E.buildPlan({bank:b,difficulty:diff,newcomer:true});assert.deepEqual(fresh.ids.slice(0,3),['g5-r1-0','old-0','old-1'],'higher difficulties have no beginner intro')}}
 assert.equal(new Set(p.ids).size,b.length);
}
function fixture(){
 const memory=new Map(),remote={},notices=[];let profile=null,enabled=true,n=0,fail=false,bankNow=bank,configCalls=0;
 const api=async(path,opts={})=>{
  if(fail)throw new Error('offline');
  if(path.endsWith('/config')){configCalls++;return {enabled}};
  if(!opts.method)return {enabled,records:structuredClone(remote)};
  const b=JSON.parse(opts.body),r=remote[b.difficulty];
  if(r&&(b.import_guest||r.last===b.request_id))return {record:structuredClone(r)};
  if(r&&r.revision!==b.expected_revision)return {conflict:true,record:structuredClone(r)};
  const ids=[...new Set([...(r?.plan?.ids||[]),...b.ids])];
  remote[b.difficulty]={difficulty:b.difficulty,mode:b.mode,revision:(r?.revision||0)+1,offered:true,newcomer:b.newcomer,plan:{version:E.VERSION,difficulty:b.difficulty,kind:'varied',ids},last:b.request_id};
  return {record:structuredClone(remote[b.difficulty])};
 };
 const deps={engine:E,storage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},profile:()=>profile,bank:diff=>bankNow.map(p=>({...p,difficulty:diff})),completed:()=>[],hasHistory:()=>false,uuid:()=>`test-request-${++n}`,api,notice:s=>notices.push(s)};
 return {make:()=>Store.create(deps),remote,memory,notices,setProfile:p=>profile=p,setEnabled:b=>enabled=b,setFail:b=>fail=b,setBank:b=>bankNow=b,getConfigCalls:()=>configCalls};
}
(async()=>{
 const f=fixture(),s=f.make();await s.configure();await s.configure();assert.equal(f.getConfigCalls(),1,'successful capability config is cached within one app lifetime');assert.equal(s.record('easy').mode,'numeric','empty installation is unknown, not newcomer');
 await s.change('easy','varied');const ids=s.record('easy').plan.ids;assert.equal(ids[0],'g5-r1-0');
 f.setFail(true);const offlineReload=f.make();await offlineReload.configure();assert.equal(offlineReload.enabled(),true);assert.equal(offlineReload.next('easy',old[0]).id,ids[0],'cold offline reload retains verified varied ordering');f.setFail(false);
 const reload=f.make();await reload.configure();assert.deepEqual(reload.record('easy').plan.ids,ids);
 await reload.change('easy','numeric');await reload.change('easy','varied');assert.deepEqual(reload.record('easy').plan.ids,ids);
 s.adopt('account-a');f.setProfile({id:'account-a',token:'a'});await s.sync();assert.deepEqual(f.remote.easy.plan.ids,ids,'guest plan imported');
 const device=f.make();await device.configure();await device.sync();assert.deepEqual(device.record('easy').plan.ids,ids,'fresh account device loads exact plan');
 f.setFail(true);await assert.rejects(device.change('easy','numeric'));assert(device.record('easy').pending,'offline write remains pending');
 f.setFail(false);f.remote.easy={...f.remote.easy,revision:f.remote.easy.revision+1,mode:'varied'};await device.sync();assert.equal(device.record('easy').mode,'varied');assert.equal(f.notices.length,1,'concurrent server revision wins visibly');
 f.setBank([...bank,release]);await device.sync();await device.sync();assert.deepEqual(f.remote.easy.plan.ids,[...ids,'batch-new']);
 f.setProfile({id:'account-b',token:'b'});assert.equal(device.record('easy').mode,'numeric','account switch never leaks choice');
 f.setEnabled(false);await device.configure({force:true});assert.equal(device.next('easy',old[2]),old[2],'kill switch keeps canonical fallback');f.setFail(true);assert.equal(f.make().enabled(),false,'received kill switch persists through offline reload');
 const n=fixture(),ns=n.make();await ns.configure();n.setProfile({id:'new',token:'n',freeOrderNewAccount:true});await ns.newAccount({id:'new',token:'n',freeOrderNewAccount:true});assert.equal(ns.record('easy').mode,'varied');assert.equal(ns.record('easy').plan.ids[0],'old-0');
 const g=fixture(),gs=g.make();await gs.configure();await gs.change('easy','varied');g.setBank([...bank,release]);gs.next('easy',old[0]);assert.equal(gs.record('easy').plan.ids.at(-1),'batch-new','guest persists appended batch before account adoption');
 // Lost/stale authentication response may not write another account's state.
 const before=JSON.stringify([...f.memory]);await device.sync();assert.equal(JSON.stringify([...f.memory]),before);
 const app=fs.readFileSync('public/app.js','utf8');
 assert(!app.includes("setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)refreshFreeOrder()},30000)"),'free-order background polling must stay removed');
 assert(app.includes("window.addEventListener('online',()=>refreshFreeOrder({forceConfig:true,minAgeMs:0}))"),'online recovery must refresh free-order state');
 assert(app.includes("document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshFreeOrderAfterResume()})"),'resume must refresh free-order state without a timer');
 assert(app.includes("if(!navigator.onLine||currentScreen==='game')return false"),'free-order refresh must not compete with active gameplay');
 console.log('PASS free ordering: identity, cadence, resume, persistence, guest import, cross-device CAS, batches, cached config, event-driven refresh, account switch, kill switch');
})().catch(e=>{console.error(e);process.exitCode=1});
