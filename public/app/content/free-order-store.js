/* Account-scoped ordering. No ownership of completion, XP or running games. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PropletFreeOrderStore=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function create(d){
 const E=d.engine, prefix='proplet-free-order-v1:', busy=new Map();
 let enabled=false, loadedIdentity=null, resumeIds={};
 try{const c=JSON.parse(d.storage.getItem(prefix+'capability')||'null');enabled=c?.version===E.VERSION&&c.enabled===true}catch{}
 const scope=()=>d.profile()?.id||'guest';
 const identity=p=>p?.id&&p?.token?p.id+':'+p.token:'guest';
 const read=s=>{try{return JSON.parse(d.storage.getItem(prefix+s)||'{}')}catch{return {}}};
 const write=(s,v)=>{d.storage.setItem(prefix+s,JSON.stringify(v));return v};
 const empty=()=>({mode:'numeric',revision:0,offered:false,newcomer:false,plan:null});
 const record=diff=>({...empty(),...read(scope())[diff]});
 const changed=()=>d.changed?.();
 function plan(diff,r){
  if(r.plan?.ids?.length)return E.reconcilePlan(r.plan,{bank:d.bank(diff),difficulty:diff});
  const bank=d.bank(diff),intro=bank.filter(E.isGen5).slice(0,25).sort((a,b)=>(Number(a.meta?.difficultyScore)||0)-(Number(b.meta?.difficultyScore)||0)).map(p=>p.id);
  return E.buildPlan({bank,difficulty:diff,completedIds:d.completed(diff),recentIds:d.completed(diff).slice(-2),newcomer:r.newcomer,introIds:intro});
 }
 function save(diff,r,s=scope()){const all=read(s);all[diff]=r;write(s,all);return r}
 function queue(diff,r,{importGuest=false}={}){
  if(r.mode==='varied'||r.plan?.ids?.length)r.plan=plan(diff,r);
  r.offered=true;
  r.pending={difficulty:diff,mode:r.mode,expected_revision:r.revision||0,request_id:d.uuid(),
    ids:r.plan?.ids||[],import_guest:importGuest,newcomer:!!r.newcomer};
  return save(diff,r);
 }
 async function configure(){
  try{const c=await d.api('/api/free-order/config');enabled=c.enabled===true;d.storage.setItem(prefix+'capability',JSON.stringify({version:E.VERSION,enabled}));if(c.isolatedPreview)d.isolated?.();}
  catch{} // Keep a previously verified capability during a transient disconnect.
  if(enabled)try{await newAccount(d.profile())}catch{}
  changed();return enabled;
 }
 async function sync(){
  const p=d.profile(),id=identity(p);if(!enabled||!p?.token)return;
  if(busy.has(id))return busy.get(id);
  const job=(async()=>{
   const remote=await d.api('/api/free-order',{authProfile:p});
   if(identity(d.profile())!==id)return;
   if(!remote.enabled){enabled=false;d.storage.setItem(prefix+'capability',JSON.stringify({version:E.VERSION,enabled:false}));changed();return}
   resumeIds=remote.resumeIds||{};
   const local=read(p.id);
   for(const diff of E.SUPPORTED){
    let r=local[diff]||empty(),server=remote.records[diff];
    if(r.pending){
     const result=await d.api('/api/free-order',{method:'POST',body:JSON.stringify(r.pending),authProfile:p});
     if(identity(d.profile())!==id)return;
     // A later local click must survive an older in-flight acknowledgement.
     const latest=read(p.id)[diff];
     if(latest?.pending?.request_id!==r.pending.request_id)continue;
     r=result.record;save(diff,r,p.id);
     if(result.conflict)d.notice?.('Pořadí se mezitím změnilo na jiném zařízení. Načetli jsme aktuální volbu.');
    }else if(server){r=server;save(diff,r,p.id)}
    else if(local[diff]?.importGuest){queue(diff,r,{importGuest:true});continue}
    if(r.plan?.ids?.length){
     const updated=plan(diff,r);
     if(JSON.stringify(updated.ids)!==JSON.stringify(r.plan.ids))queue(diff,{...r,plan:updated});
    }
   }
   loadedIdentity=id;changed();
  })().finally(()=>busy.delete(id));
  busy.set(id,job);return job;
 }
 async function change(diff,mode){
  if(!enabled||!E.SUPPORTED.includes(diff))return;
  const startedIdentity=identity(d.profile());await d.prepare?.();if(startedIdentity!==identity(d.profile()))return;
  // Establish server revision before explicit edits; never mistake an empty cache for an account.
  if(d.profile()?.token&&loadedIdentity!==identity(d.profile()))await sync();
  const r=record(diff);r.mode=mode;queue(diff,r);changed();
  if(d.profile()?.token)await sync();
 }
 function next(diff,fallback){
  if(!enabled||!E.SUPPORTED.includes(diff))return fallback;
  const r=record(diff);const remote=loadedIdentity===identity(d.profile())&&d.bank(diff).find(p=>p.id===resumeIds[diff]&&!d.completed(diff).includes(p.id));if(remote)return remote;
  if(r.mode!=='varied'||!r.plan)return fallback;
  const stable=plan(diff,r);
  if(scope()==='guest'&&JSON.stringify(stable.ids)!==JSON.stringify(r.plan.ids))queue(diff,{...r,plan:stable});
  return E.next({bank:d.bank(diff),difficulty:diff,completedIds:d.completed(diff),mode:r.mode,plan:stable}).puzzle;
 }
 function adopt(profileId){
  const guest=read('guest'),target=read(profileId);
  for(const diff of E.SUPPORTED)if(guest[diff]&&!target[diff]){
   const r={...guest[diff],revision:0,importGuest:true};
   r.pending={difficulty:diff,mode:r.mode,expected_revision:0,request_id:d.uuid(),ids:r.plan?.ids||[],import_guest:true,newcomer:!!r.newcomer};target[diff]=r;
  }
  write(profileId,target);d.storage.removeItem(prefix+'guest');
 }
 async function newAccount(p){
  if(!enabled||p?.freeOrderNewAccount!==true)return;
  await d.prepare?.();if(identity(p)!==identity(d.profile()))return;
  const all=read(p.id);
  // Only a server-confirmed registration with no guest history qualifies.
  if(d.hasHistory(p.id)||Object.keys(all).length)return;
  for(const diff of E.SUPPORTED)queue(diff,{...empty(),mode:'varied',newcomer:['easy','medium'].includes(diff)},{importGuest:true});
 }
 return {configure,sync,change,next,record,adopt,newAccount,enabled:()=>enabled,
  ready:()=>!d.profile()?.token||loadedIdentity===identity(d.profile())};
}
return {create};
});
