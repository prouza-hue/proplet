(()=>{
  'use strict';
  const PROFILE_KEY='proplet-v2-profile';

  // Account recovery rotates all old sessions. Persist the fresh server-issued profile/token
  // before the legacy account UI gets a chance to do any optional rendering or guest-data work.
  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const response=await originalFetch(input,init);
    try{
      const url=new URL(typeof input==='string'?input:input?.url||'',location.href);
      const profileEndpoints=new Set([
        '/api/auth/recovery/reset',
        '/api/auth/google/complete',
        '/api/account/email/verify'
      ]);
      if(response.ok&&profileEndpoints.has(url.pathname)){
        const data=await response.clone().json();
        const incoming=data?.profile;
        if(incoming?.id&&incoming?.token){
          let current={};
          try{current=JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')||{}}catch{}
          localStorage.setItem(PROFILE_KEY,JSON.stringify({...current,...incoming}));
        }
      }
    }catch{}
    return response;
  };

  // The same field is used for a 24-character game nickname and for email login. The base HTML
  // still carries the historical nickname limit, so switch it according to the active auth mode.
  const syncIdentifierLimit=()=>{
    const input=document.querySelector('#playerNameInput');
    if(!input)return;
    const create=document.querySelector('#profileModeCreate')?.classList.contains('active');
    input.maxLength=create?24:254;
  };
  const attach=()=>{
    syncIdentifierLimit();
    const create=document.querySelector('#profileModeCreate');
    const login=document.querySelector('#profileModeLogin');
    if(create&&!create.dataset.authLimitGuard){
      create.dataset.authLimitGuard='1';
      new MutationObserver(syncIdentifierLimit).observe(create,{attributes:true,attributeFilter:['class']});
      create.addEventListener('click',()=>setTimeout(syncIdentifierLimit,0));
      login?.addEventListener('click',()=>setTimeout(syncIdentifierLimit,0));
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});
  else attach();
})();
