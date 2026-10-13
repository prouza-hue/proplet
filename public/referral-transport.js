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
const model={ready:false,incoming:false,accepted:false,paid:false,count:0,inviterName:'',inviterCode:'',referrals:[],inviteUrl:'',rewardDismissed:false};
let flight=null,loadedAt=0,owner=null,invalidNoticeShown=false;
async function load(force=false){
 const identity=profile()?.id||null;
 if(flight&&owner===identity)return flight;
 if(!force&&owner===identity&&Date.now()-loadedAt<30000)return model;
 if(owner!==identity)Object.assign(model,{ready:false,incoming:false,accepted:false,paid:false,count:0,inviterName:'',inviterCode:'',referrals:[],inviteUrl:'',rewardDismissed:false});
 owner=identity;
 const requestOwner=identity,requestCode=identity?null:pendingCode();
 flight=(async()=>{
  try{
   let d;
   if(identity){d=await api('/api/referrals');if((profile()?.id||null)!==requestOwner)return model;
    if(d.enabled===false){model.ready=false;return model}
    const i=d.incoming;
    Object.assign(model,{ready:true,incoming:!!i,accepted:!!i,paid:!!i?.paid,count:i?.completedBoards||0,inviterName:i?.inviter?.name||'',inviterCode:i?.id||'',rewardDismissed:!!i?.rewardDismissed,inviteUrl:d.invite?.url||'',referrals:(d.referrals||[]).map(r=>({...r,count:r.completedBoards||0,accepted:true}))});
    try{sessionStorage.removeItem(key)}catch{}
   }else{
    const code=requestCode;
    if(!code){Object.assign(model,{ready:false,incoming:false,referrals:[],inviteUrl:''});return model}
    d=await api('/api/referrals/invite/'+encodeURIComponent(code));
    if((profile()?.id||null)!==requestOwner)return model;
    Object.assign(model,{ready:true,incoming:true,accepted:false,paid:false,count:0,inviterName:d.inviter?.name||'Kamarád',inviterCode:code,referrals:[],inviteUrl:'',rewardDismissed:false});
    // Local deduplication only: the invitation code is never part of telemetry.
    const landingKey='proplet:referral-landing-seen:v1:'+code;
    try{if(!sessionStorage.getItem(landingKey)&&typeof trackProductEvent==='function'){
     sessionStorage.setItem(landingKey,'1');trackProductEvent('referral_landing_validated',{entry_source:'landing'});
    }}catch{}
   }
   loadedAt=Date.now();
  }catch(e){
   if(owner===requestOwner&&Number(e.status)===404){
    model.ready=false;
    if(!requestOwner&&requestCode&&pendingCode()===requestCode){
     try{sessionStorage.removeItem(key)}catch{}
     model.incoming=false;
     if(inbound===requestCode&&!invalidNoticeShown&&typeof showToast==='function'){
      invalidNoticeShown=true;showToast('Tahle pozvánka už není dostupná. Proplet si můžeš zahrát i bez ní.');
     }
    }
   }
  }
  return model;
 })().finally(()=>{if(owner===requestOwner)flight=null});
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
})();
