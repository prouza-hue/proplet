/* Immutable-board ordering policy. Storage, rewards and network are not owned here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PropletFreeOrder=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='pestre-v1',SUPPORTED=['easy','medium','hard','hardcore'];
// Gen5 manufacturing did not migrate player history to a new contentGeneration.
const isGen5=p=>String(p?.id||'').startsWith('g5-r1-')||Number(p?.meta?.contentGeneration)===5;
function canonicalBank(bank,difficulty){
 if(!Array.isArray(bank))throw new TypeError('Bank must be an array');const ids=new Set();
 for(const p of bank){if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id)||p.difficulty!==difficulty||!Number.isFinite(Number(p.meta?.level))||Number(p.meta.level)<1)throw new Error('Invalid or duplicate immutable board');ids.add(p.id)}
 return [...bank].sort((a,b)=>Number(a.meta.level)-Number(b.meta.level)||a.id.localeCompare(b.id));
}
const defaultWords=p=>(p?.answers||p?.words||[]).map(w=>typeof w==='string'?w:w.word).filter(Boolean);
function overlap(p,recent,getWords){const words=new Set(getWords(p).map(w=>String(w).normalize('NFC').toLocaleUpperCase('cs-CZ')));return recent.reduce((n,q,i)=>n+getWords(q).filter(w=>words.has(String(w).normalize('NFC').toLocaleUpperCase('cs-CZ'))).length*(i+1),0)}
function buildPlan({bank,difficulty,completedIds=[],newcomer=false,recentIds=[],introIds=[],getWords=defaultWords}){
 newcomer=newcomer&&['easy','medium'].includes(difficulty);
 const list=canonicalBank(bank,difficulty),completed=new Set(completedIds),pending=list.filter(p=>!completed.has(p.id));
 if(!SUPPORTED.includes(difficulty))return {version:VERSION,difficulty,kind:'numeric',ids:pending.map(p=>p.id)};
 const old=pending.filter(p=>!isGen5(p)),modern=pending.filter(isGen5),byId=new Map(list.map(p=>[p.id,p])),recent=recentIds.slice(-2).map(id=>byId.get(id)).filter(Boolean),intro=new Map(introIds.map((id,i)=>[id,i])),ids=[];
 while(old.length||modern.length){
  const i=ids.length,wantModern=newcomer&&i<10?i%2===1:newcomer?(i-10)%3===0:i%3===0;let pool=wantModern?modern:old;if(!pool.length)pool=pool===modern?old:modern;let at=0;
  if(pool===modern){const curated=newcomer&&i<10&&pool.some(p=>intro.has(p.id));const options=pool.map((p,j)=>({p,j})).filter(x=>curated?intro.has(x.p.id):x.j<8);options.sort((a,b)=>(curated?intro.get(a.p.id)-intro.get(b.p.id):0)||overlap(a.p,recent,getWords)-overlap(b.p,recent,getWords)||a.j-b.j);at=options[0].j}
  const [p]=pool.splice(at,1);ids.push(p.id);recent.push(p);if(recent.length>2)recent.shift();
 }
 return {version:VERSION,difficulty,kind:'varied',ids};
}
function reconcilePlan(plan,{bank,difficulty}){
 if(!plan||plan.version!==VERSION||plan.difficulty!==difficulty||!Array.isArray(plan.ids))throw new Error('Incompatible saved plan');
 const list=canonicalBank(bank,difficulty),seen=new Set(),ids=[];
 for(const id of plan.ids)if(typeof id==='string'&&!seen.has(id)){ids.push(id);seen.add(id)}
 for(const p of list)if(!seen.has(p.id)){ids.push(p.id);seen.add(p.id)}
 return {...plan,ids};
}
function next({bank,difficulty,completedIds=[],resumeId=null,mode='numeric',plan=null}){
 const list=canonicalBank(bank,difficulty),done=new Set(completedIds),pending=new Map(list.filter(p=>!done.has(p.id)).map(p=>[p.id,p]));
 if(resumeId&&pending.has(resumeId))return {puzzle:pending.get(resumeId),reason:'resume'};
 if(mode==='varied'&&SUPPORTED.includes(difficulty)){const id=reconcilePlan(plan,{bank,difficulty}).ids.find(id=>pending.has(id));return {puzzle:pending.get(id)||null,reason:id?'varied':'done'}}
 const puzzle=pending.values().next().value||null;return {puzzle,reason:puzzle?'numeric':'done'};
}
function progress({bank,difficulty,completedIds=[]}){const list=canonicalBank(bank,difficulty),doneIds=new Set(completedIds),done=list.filter(p=>doneIds.has(p.id)).length;return {done,total:list.length,percent:list.length?Math.round(100*done/list.length):0}}
return Object.freeze({VERSION,SUPPORTED,isGen5,canonicalBank,buildPlan,reconcilePlan,next,progress});
});
