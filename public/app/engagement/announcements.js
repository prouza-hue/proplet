/* One automatic discovery dialog per tab session. User-opened dialogs do not use this queue. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root?.document)root.PropletAnnouncements=api.browser(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SESSION_KEY='proplet:announcements:session:v1';
  const RECEIPT_PREFIX='proplet:announcement:';
  const receiptKey=(id,account)=>RECEIPT_PREFIX+id+':account:'+account;
  const automaticAllowed=c=>!!c?.ready&&!!c.account&&c.authenticated===true&&c.completed>=5
    &&c.onboarded===true&&!c.quiet&&!c.blocked&&!c.hidden&&!c.incoming
    &&['daily','free'].includes(c.screen);
  function create(deps){
    const entries=new Map(),receipts=new Set();
    let consumed=false,busy=null,active=null,rerun=false;
    const read=(storage,key)=>{try{return storage?.getItem(key)}catch{return null}};
    const write=(storage,key)=>{try{storage?.setItem(key,'1')}catch{}};
    function seen(id,account=deps.context()?.account){
      if(!account)return false;
      const key=receiptKey(id,account);
      return receipts.has(key)||read(deps.storage,key)==='1';
    }
    function hasPending(id,context=deps.context()){
      const entry=entries.get(id);
      try{return !!entry&&!!context.account&&(entry.repeatable===true||!seen(id,context.account))&&entry.eligible(context)}
      catch(error){deps.onError?.(error);return false}
    }
    function acknowledge(id,account=deps.context()?.account){
      const entry=entries.get(id);if(!entry||!account||entry.repeatable===true||seen(id,account))return false;
      const key=receiptKey(id,account);receipts.add(key);write(deps.storage,key);
      entry.onShown?.(account);
      return true;
    }
    function sessionUsed(){return consumed||read(deps.sessionStorage,SESSION_KEY)==='1'}
    function cancelStale(context){
      if(busy&&busy.account!==context.account){busy=null;}
      if(active&&active.account!==context.account){const previous=active;active=null;previous.entry.close?.();}
    }
    const nextEntry=context=>[...entries.values()].sort((a,b)=>(b.priority||0)-(a.priority||0)).find(entry=>hasPending(entry.id,context));
    async function kick(){
      const context=deps.context();cancelStale(context);
      if(busy){rerun=true;return false}
      if(sessionUsed()||!automaticAllowed(context))return false;
      const entry=nextEntry(context);
      if(!entry)return false;
      const ticket={account:context.account,entry};busy=ticket;
      // Async preparation (e.g. avatar decoding) must recheck this immediately
      // before opening. Navigation/account changes must never open a stale dialog.
      const isCurrent=()=>{
        const fresh=deps.context();
        return busy===ticket&&fresh.account===ticket.account&&!sessionUsed()
          &&automaticAllowed(fresh)&&nextEntry(fresh)?.id===entry.id;
      };
      try{
        const displayed=await entry.show({account:ticket.account,isCurrent});
        if(displayed!==true||busy!==ticket||deps.context().account!==ticket.account)return false;
        consumed=true;write(deps.sessionStorage,SESSION_KEY);
        active=ticket;acknowledge(entry.id,ticket.account);deps.onShown?.(entry.id,ticket.account);
        return true;
      }catch(error){deps.onError?.(error);return false}
      finally{if(busy===ticket){busy=null;if(rerun){rerun=false;void kick();}}}
    }
    function register(entry){
      if(!entry?.id||typeof entry.show!=='function'||typeof entry.eligible!=='function')throw Error('Invalid announcement');
      entries.set(entry.id,entry);
      return ()=>entries.delete(entry.id);
    }
    return {register,kick,seen,hasPending,sessionUsed,acknowledge};
  }
  function browser(root){
    const document=root.document;
    let ready=false,scheduled=false;
    const storage=name=>{try{return root[name]}catch{return null}};
    function context(){
      let profile=null;try{profile=typeof getProfile==='function'?getProfile():null}catch{}
      const account=profile?.token&&profile?.id?String(profile.id):'';
      const screen=typeof currentScreen==='string'?currentScreen:'';
      const hidden=!!document.hidden;
      const blocked=!!document.querySelector('dialog[open],.modal:not(.hidden),.quality-modal:not(.hidden)')
        ||(typeof onboardingMandatory!=='undefined'&&onboardingMandatory);
      let onboarded=false;try{onboarded=root.localStorage.getItem(typeof ONBOARD_KEY==='string'?ONBOARD_KEY:'proplet-v3-7-required-onboarding')==='done'}catch{}
      let completed=Number(profile?.stats?.totalCompleted)||0;
      // Do not parse the history on taps while playing or inside a modal.
      if(account&&completed<5&&ready&&!queue.sessionUsed()&&!hidden&&!blocked&&['daily','free'].includes(screen)){
        try{completed=Math.max(completed,Object.values(getState()?.completed||{}).filter(row=>row&&['free','daily','daily_special','tajenka'].includes(row.mode)).length)}catch{}
      }
      return {ready,account,authenticated:!!account,completed,screen,hidden,blocked,onboarded,
        quiet:!!root.PropletFirstSteps?.quiet(),
        incoming:!!root.PropletReferrals?.pendingCode?.()||!!(root.PropletReferrals?.model?.incoming&&!root.PropletReferrals.model.paid)};
    }
    const queue=create({context,storage:storage('localStorage'),sessionStorage:storage('sessionStorage')});
    function schedule(){if(scheduled)return;scheduled=true;root.setTimeout(()=>{scheduled=false;queue.kick()},0)}
    document.addEventListener('proplet:ready',()=>{ready=true;schedule()},{once:true});
    for(const event of ['proplet:screen-changed','proplet:content-ready','proplet:profile-refreshed','proplet:account-changed','proplet:returning-player','visibilitychange','click'])document.addEventListener(event,schedule);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')schedule()});
    // A blocked offer remains pending and retries after programmatic modal closure.
    // Only dialog visibility changes matter; board and history mutations are ignored.
    if(typeof root.MutationObserver==='function')new root.MutationObserver(changes=>{
      if(changes.some(change=>change.target.matches?.('.modal,.quality-modal,dialog')))schedule();
    }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','open','hidden']});
    return {...queue,kick:schedule};
  }
  return {create,browser,automaticAllowed,receiptKey,SESSION_KEY};
});
