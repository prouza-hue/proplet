(()=>{
  'use strict';
  const canonicalOrigin=window.PROPLET_RUNTIME_META?.canonicalOrigin||'https://hrajproplet.cz';
  const isCanonical=location.origin===canonicalOrigin;
  const dailyBtn=()=>document.querySelector('#pushToggleBtn');
  const dailyText=()=>document.querySelector('#pushStatusText');

  const readPushIntent=()=>{
    try{return JSON.parse(localStorage.getItem('proplet-v3-8-2-push-nudge')||'{}')}catch{return {}}
  };
  const writePushIntent=value=>{
    try{localStorage.setItem('proplet-v3-8-2-push-nudge',JSON.stringify(value))}catch{}
  };
  const localSubscription=async()=>{
    try{
      const reg=await navigator.serviceWorker?.ready;
      return await reg?.pushManager?.getSubscription?.()||null;
    }catch{return null}
  };

  const renderPreviewState=()=>{
    const d=dailyBtn(),dt=dailyText();
    if(!d)return;
    d.disabled=true;
    d.textContent='Jen na produkci';
    if(dt)dt.textContent='Preview má vlastní webový origin. Produkční notifikace na hrajproplet.cz se tu nemění.';
  };

  const renderCanonicalState=async()=>{
    const d=dailyBtn(),dt=dailyText();
    if(!d||!dt)return;
    const profile=typeof getProfile==='function'?getProfile():null;
    if(!profile?.token){
      dt.textContent='Zapnutí platí pro konkrétní zařízení a prohlížeč. Nejdřív si ulož postup.';
      return;
    }
    const sub=await localSubscription();
    const intent=readPushIntent();
    const deliberatelyOff=!!intent.disabledByUser||!!intent.done&&intent.accepted!==true&&!intent.repairNeeded;
    const wantsPush=(intent.accepted===true||intent.repairNeeded===true)&&!deliberatelyOff;
    const permission=typeof Notification!=='undefined'?Notification.permission:'default';

    // A service worker/browser can lose or rotate a subscription while notification permission
    // remains granted. Preserve the user's intent and offer a one-tap repair instead of silently
    // presenting the setting as if the user had switched it off.
    if(permission==='granted'&&wantsPush&&(!sub||d.textContent==='Zapnout')){
      writePushIntent({...intent,accepted:false,repairNeeded:true,lastRepairDetectedAt:new Date().toISOString()});
      d.disabled=false;
      d.textContent='Obnovit';
      dt.textContent='Prohlížeč ztratil push registraci. Proplet ji automaticky obnovuje; případně klepni na Obnovit.';
      return;
    }

    if(sub&&d.textContent==='Vypnout')dt.textContent='Zapnuto na tomto zařízení · Daily i pondělní novinky.';
    else if(!sub&&permission!=='denied'&&d.textContent==='Zapnout')dt.textContent='Vypnuto na tomto zařízení.';
  };

  const baseUpdate=typeof updatePushUI==='function'?updatePushUI:null;
  if(baseUpdate){
    window.updatePushUI=async function(...args){
      const result=await baseUpdate.apply(this,args);
      if(isCanonical)await renderCanonicalState();else renderPreviewState();
      return result;
    };
    Promise.resolve(window.updatePushUI()).catch(()=>{});
  }else if(!isCanonical){
    // Defensive fallback if loader ordering changes in a future release.
    setTimeout(renderPreviewState,0);
  }
})();
