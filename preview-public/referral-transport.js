/* Real referral transport. No local game or reward simulation. */
(()=>{
'use strict';
const key='proplet:pending-referral:v1';
const valid=s=>/^[A-Za-z0-9_-]{8,80}$/.test(s||'');
const preferences={getItem(k){try{return localStorage.getItem(k)}catch{return null}},setItem(k,v){try{localStorage.setItem(k,v)}catch{}}};
function pendingCode(){try{const entry=JSON.parse(sessionStorage.getItem(key)||'null');return entry&&valid(entry.code)&&Date.now()-entry.at<30*86400000?entry.code:null}catch{return null}}
const inbound=new URLSearchParams(location.search).get('invite');
if(valid(inbound)){try{sessionStorage.setItem(key,JSON.stringify({code:inbound,at:Date.now()}))}catch{}}
function profile(){try{return typeof getProfile==='function'?getProfile():null}catch{return null}}
const emptyModel=availability=>({availability,ready:false,incoming:false,accepted:false,paid:false,count:0,inviterName:'',inviterCode:'',referrals:[],inviteUrl:'',rewardDismissed:false});
const model=emptyModel('idle');
let flight=null,loadedAt=0,owner,ownerCode=null,generation=0,invalidNoticeShown=false;
function resetOwner(identity,code){
 owner=identity;ownerCode=code;generation++;flight=null;loadedAt=0;
 Object.assign(model,emptyModel('idle'));
}
async function load(force=false){
 const identity=profile()?.id||null,code=identity?null:pendingCode();
 if(owner!==identity||ownerCode!==code)resetOwner(identity,code);
 if(!identity&&!code){Object.assign(model,emptyModel('guest'));return model}
 if(flight)return flight;
 if(!force&&loadedAt&&Date.now()-loadedAt<30000)return model;
 const requestOwner=identity,requestCode=code,requestGeneration=++generation;
 const isCurrent=()=>owner===requestOwner&&generation===requestGeneration&&(profile()?.id||null)===requestOwner;
 model.availability='loading';
 flight=(async()=>{
  try{
   let d;
   if(identity){d=await api('/api/referrals');if(!isCurrent())return model;
    if(d.enabled===false){Object.assign(model,emptyModel('disabled'));loadedAt=Date.now();return model}
    const i=d.incoming;
    Object.assign(model,{availability:'ready',ready:true,incoming:!!i,accepted:!!i,paid:!!i?.paid,count:i?.completedBoards||0,inviterName:i?.inviter?.name||'',inviterCode:i?.id||'',rewardDismissed:!!i?.rewardDismissed,inviteUrl:d.invite?.url||'',referrals:(d.referrals||[]).map(r=>({...r,count:r.completedBoards||0,accepted:true}))});
    try{sessionStorage.removeItem(key)}catch{}
   }else{
    const code=requestCode;
    d=await api('/api/referrals/invite/'+encodeURIComponent(code));
    if(!isCurrent()||pendingCode()!==requestCode)return model;
    if(d.enabled===false){Object.assign(model,emptyModel('disabled'));loadedAt=Date.now();return model}
    Object.assign(model,{availability:'ready',ready:true,incoming:true,accepted:false,paid:false,count:0,inviterName:d.inviter?.name||'Kamarád',inviterCode:code,referrals:[],inviteUrl:'',rewardDismissed:false});
    // Local deduplication only: the invitation code is never part of telemetry.
    const landingKey='proplet:referral-landing-seen:v1:'+code;
    try{if((window.PROPLET_RUNTIME_ENV||window.PROPLET_RUNTIME_META?.environment)==='production'&&!sessionStorage.getItem(landingKey)&&typeof trackProductEvent==='function'){
     sessionStorage.setItem(landingKey,'1');trackProductEvent('referral_landing_validated',{entry_source:'landing'});
    }}catch{}
   }
   loadedAt=Date.now();
  }catch(e){
   if(isCurrent()){
    // Keep this owner's confirmed progress/history available through transient outages.
    // A first load remains not ready; another identity never inherits these fields.
    model.availability='error';loadedAt=0;
    if(Number(e.status)===404&&!requestOwner&&requestCode&&pendingCode()===requestCode){
     try{sessionStorage.removeItem(key)}catch{}
     Object.assign(model,emptyModel('error'));
     if(inbound===requestCode&&!invalidNoticeShown&&typeof showToast==='function'){
      invalidNoticeShown=true;showToast('Tahle pozvánka už není dostupná. Proplet si můžeš zahrát i bez ní.');
     }
    }
   }
  }
  return model;
 })().finally(()=>{if(owner===requestOwner&&generation===requestGeneration)flight=null});
 return flight;
}
async function ensureInvite(){
 if(!profile()?.id)throw new Error('Nejdřív si vytvoř účet nebo se přihlas.');
 const identity=profile().id;
 const d=await api('/api/referrals/invite',{method:'POST',body:'{}'});
 if(profile()?.id!==identity)throw new Error('Účet se mezitím změnil.');
 if(!d.url)throw new Error('Pozvánku se nepodařilo připravit.');
 model.inviteUrl=d.url;return d.url;
}
async function dismiss(){const identity=profile()?.id;if(!identity)throw new Error('Nejdřív se přihlas.');await api('/api/referrals/dismiss',{method:'POST',body:'{}'});if(profile()?.id!==identity)throw new Error('Účet se mezitím změnil.');model.rewardDismissed=true}
window.PropletReferrals={model,profile,preferences,pendingCode,load,ensureInvite,dismiss};
document.addEventListener('proplet:account-changed',()=>{
 const identity=profile()?.id||null,code=identity?null:pendingCode();
 if(owner!==identity||ownerCode!==code)resetOwner(identity,code);
});
})();
