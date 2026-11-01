/* Manual previews never claim a receipt. Automatic delivery uses the shared queue and server claim. */
(function(win,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(win?.document)api.install(win);})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const productionHosts=new Set(['hrajproplet.cz','www.hrajproplet.cz','proplet-nine.vercel.app','proplet-pavel-prouzas-projects.vercel.app','proplet-git-main-pavel-prouzas-projects.vercel.app']);
 const CAMPAIGN='november-2026-release-v1';
 function allowed(href,environment,enabled=false){try{const host=new URL(href).hostname;return (environment==='preview'&&!productionHosts.has(host)&&!host.endsWith('.hrajproplet.cz'))||(environment==='production'&&enabled===true);}catch{return false;}}
 function delivery({getProfile,request,online=()=>true,now=Date.now}){
  let scope='',version=0,state=null,loading=null,claiming=null,retryAt=0,loadedAt=0;
  const key=p=>p?.id&&p?.token?JSON.stringify([String(p.id),p.token]):'';
  function sync(){const next=key(getProfile());if(next!==scope){scope=next;version++;state=null;loading=null;claiming=null;retryAt=0;loadedAt=0;}return scope;}
  const snapshot=()=>{sync();return {state,pending:!!loading,retryAt,loadedAt};};
  const valid=value=>value?.campaignId===CAMPAIGN&&typeof value.enabled==='boolean'&&typeof value.eligible==='boolean'&&typeof value.canShowAutomatically==='boolean';
  function load(force=false){
   if(!sync()||!online())return Promise.resolve(null);
   if(loading)return loading;
   if(!force&&state)return Promise.resolve(state);
   if(now()<retryAt&&!force)return Promise.resolve(null);
   const p={...getProfile()},captured=scope,ticket=version;
   const current=()=>sync()===captured&&version===ticket;
   const promise=(async()=>{try{const value=await request('/api/release-news',{authProfile:p});if(!current())return null;if(!valid(value))throw Error('release-status');state=value;loadedAt=now();retryAt=0;return state;}catch{if(current()){retryAt=now()+30000;}return null;}})().finally(()=>{if(loading===promise)loading=null;});loading=promise;return promise;
  }
  function canOffer(account){sync();const p=getProfile();return !!scope&&String(p.id)===String(account)&&online()&&now()>=retryAt&&(!state||(state.enabled&&state.eligible&&state.canShowAutomatically));}
  async function show(permit,open){
   if(!sync()||claiming||!online()||!permit.isCurrent())return false;
   const p={...getProfile()},captured=scope,ticket=version;
   const current=()=>sync()===captured&&version===ticket&&online()&&permit.isCurrent();
   const status=await load();if(!current()||!status?.enabled||!status.eligible||!status.canShowAutomatically)return false;
   const claim={};claiming=claim;
   try{
    const value=await request('/api/release-news/claim',{method:'POST',authProfile:p});
    if(sync()!==captured||version!==ticket)return false;
    if(!valid(value)||typeof value.displayGranted!=='boolean')throw Error('release-claim');
    // Keep the pre-claim offer eligible until the queue's final permit recheck.
    // The server has already made the atomic cross-device decision.
    const displayed=value.enabled&&value.eligible&&value.displayGranted===true&&current()&&open()===true;
    state=value;loadedAt=now();return displayed;
   }catch{if(sync()===captured&&version===ticket){state=null;retryAt=now()+30000;}return false;}
   finally{if(claiming===claim)claiming=null;}
  }
  return {sync,snapshot,load,canOffer,show};
 }
 function install(win){
  const doc=win.document,q=selector=>doc.querySelector(selector);
  const environment=()=>win.PROPLET_RUNTIME_ENV||win.PROPLET_RUNTIME_META?.environment;
  const preview=()=>allowed(win.location.href,environment());
  const reviewRequested=new URL(win.location.href).searchParams.get('showNews')==='1';
  const controller=delivery({getProfile:()=>{try{return win.getProfile?.()||null;}catch{return null;}},request:(path,options)=>win.api(path,options),online:()=>win.navigator?.onLine!==false});
  const gate=()=>allowed(win.location.href,environment(),controller.snapshot().state?.enabled===true);
  let requested=reviewRequested,manualUsed=false,ready=false,dialog=null,opener=null,frame=0,registered=false,displayScope='';
  const blocked=()=>doc.body.classList.contains('playing')||!!q('.modal:not(.hidden),dialog[open],.quality-modal:not(.hidden)');
  const onToday=()=>!!q('#screen-daily.active');
  const visible=node=>node?.isConnected&&node.getClientRects().length>0&&!node.closest('[hidden],.hidden,[inert]');
  function restoreFocus(){const target=visible(opener)?opener:q('#oneScreenToday .os-feature')||q('#playDailyBtn');if(visible(target))target.focus({preventScroll:true});opener=null;}
  function close(restore=true){if(dialog?.open)dialog.close();if(restore)restoreFocus();else opener=null;}
  function build(){
   dialog=doc.createElement('dialog');dialog.id='releaseNewsDialog';dialog.setAttribute('aria-labelledby','releaseNewsTitle');
   dialog.innerHTML='<button type="button" class="release-news-close" data-news-close aria-label="Zavřít novinky">×</button><div class="release-news-intro"><img class="release-news-art" src="/assets/navigation/competitions-v1.webp" alt="" width="168" height="168"><h2 id="releaseNewsTitle" tabindex="-1">Každý měsíc nová soutěž o&nbsp;vládce Propletu.</h2></div><div class="release-news-copy"><p>Hraj Denní výzvy i&nbsp;další hry. Nejlepších 20&nbsp;Denních výzev tvoří 80&nbsp;% maxima, další hraní 20&nbsp;%. Rozhoduje kvalita řešení i&nbsp;ověřená rychlost. Na první tři čekají originální odznaky.</p><p>A&nbsp;to vše v&nbsp;čistším designu, kde je vše po ruce a&nbsp;lépe vypadá na mobilu, tabletu i&nbsp;monitoru.</p></div><div class="release-news-actions"><button type="button" class="release-news-primary" data-news-monthly>Prohlédnout měsíční soutěž <span aria-hidden="true">→</span></button><button type="button" class="release-news-secondary" data-news-close>Jdu hrát</button></div>';
   doc.body.append(dialog);
   dialog.querySelectorAll('[data-news-close]').forEach(button=>button.onclick=()=>close());
   dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
   dialog.querySelector('[data-news-monthly]').onclick=()=>{if(!gate()||typeof win.PropletMonthlyCompetition?.open!=='function')return;close(false);win.PropletMonthlyCompetition.open();};
  }
  function open(manual=false,automatic=false){
   if(!gate()||!ready||blocked())return false;
   if(manual&&!onToday()){if(typeof win.nav!=='function')return false;win.nav('daily');}
   if(!onToday()||blocked())return false;
   if(!dialog)build();opener=doc.activeElement===doc.body?null:doc.activeElement;requested=false;if(!automatic)manualUsed=true;displayScope=controller.sync();
   dialog.querySelector('[data-news-monthly]').disabled=typeof win.PropletMonthlyCompetition?.open!=='function';
   dialog.showModal();dialog.querySelector('h2').focus({preventScroll:true});return true;
  }
  function reconcile(){
   if(!gate()){close(false);dialog?.remove();dialog=null;q('#releaseNewsSettings')?.remove();return;}
   const settings=q('#profileSettingsHeader .profile-settings-heading');
   if(settings&&!q('#releaseNewsSettings')){const link=doc.createElement('button');link.id='releaseNewsSettings';link.type='button';link.textContent='Co je nového';link.onclick=()=>open(true);settings.append(link);}
   if(dialog?.open)dialog.querySelector('[data-news-monthly]').disabled=typeof win.PropletMonthlyCompetition?.open!=='function';
   if(requested&&ready&&!blocked()&&onToday())open();
  }
  const schedule=()=>{if(!frame)frame=win.requestAnimationFrame(()=>{frame=0;reconcile();});};
  function register(){
   const queue=win.PropletAnnouncements;if(registered||!queue)return;registered=true;
   queue.register({id:CAMPAIGN,priority:120,
    eligible:context=>ready&&!reviewRequested&&!manualUsed&&onToday()&&!blocked()&&controller.canOffer(context.account),
    show:async permit=>{try{return await controller.show(permit,()=>open(false,true));}finally{schedule();queue.kick();}},
    close:()=>close(false)
   });
  }
  async function refresh(force=false){
   register();const scope=controller.sync();if(dialog?.open&&displayScope!==scope)close(false);
   if(ready&&!(preview()&&reviewRequested))await controller.load(force);
   schedule();win.PropletAnnouncements?.kick();
  }
  doc.addEventListener('proplet:ready',()=>{ready=true;register();void refresh();schedule();},{once:true});
  doc.addEventListener('proplet:screen-changed',()=>{schedule();register();win.PropletAnnouncements?.kick();});
  doc.addEventListener('proplet:account-changed',()=>{close(false);void refresh();});
  doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)void refresh(true);});
  win.addEventListener?.('online',()=>{void refresh(true);});
  // This observer only mounts the manual Settings entry and services an explicit
  // showNews preview. Automatic timing belongs exclusively to PropletAnnouncements.
  const observer=new win.MutationObserver(records=>{if(records.some(record=>!record.target.closest?.('#releaseNewsDialog,#releaseNewsSettings'))&&(!q('#releaseNewsSettings')||(requested&&reviewRequested)))schedule();});
  observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open']});
  register();reconcile();
  win.PropletReleaseNews=Object.freeze({open:()=>open(true)});
 }
 return {CAMPAIGN,allowed,delivery,install};
});
