/* Explicit live-preview announcement. No receipts, campaign state or transport. */
(function(win,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(win?.document)api.install(win);})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const productionHosts=new Set(['hrajproplet.cz','www.hrajproplet.cz','proplet-nine.vercel.app','proplet-pavel-prouzas-projects.vercel.app','proplet-git-main-pavel-prouzas-projects.vercel.app']);
 function allowed(href,environment){try{const host=new URL(href).hostname;return environment==='preview'&&!productionHosts.has(host)&&!host.endsWith('.hrajproplet.cz');}catch{return false;}}
 function install(win){
  const doc=win.document,q=selector=>doc.querySelector(selector);
  const gate=()=>allowed(win.location.href,win.PROPLET_RUNTIME_ENV||win.PROPLET_RUNTIME_META?.environment);
  if(!gate())return;
  let requested=new URL(win.location.href).searchParams.get('showNews')==='1',ready=false,dialog=null,opener=null,frame=0;
  const blocked=()=>doc.body.classList.contains('playing')||!!q('.modal:not(.hidden),dialog[open]');
  const onToday=()=>!!q('#screen-daily.active');
  const visible=node=>node?.isConnected&&node.getClientRects().length>0&&!node.closest('[hidden],.hidden,[inert]');
  function restoreFocus(){const target=visible(opener)?opener:q('#oneScreenToday .os-feature')||q('#playDailyBtn');if(visible(target))target.focus({preventScroll:true});opener=null;}
  function close(restore=true){if(dialog?.open)dialog.close();if(restore)restoreFocus();else opener=null;}
  function build(){
   dialog=doc.createElement('dialog');dialog.id='releaseNewsDialog';dialog.setAttribute('aria-labelledby','releaseNewsTitle');
   dialog.innerHTML='<button type="button" class="release-news-close" data-news-close aria-label="Zavřít novinky">×</button><div class="release-news-intro"><img class="release-news-art" src="/assets/navigation/competitions-v1.webp" alt="" width="168" height="168"><h2 id="releaseNewsTitle" tabindex="-1">Každý měsíc nová soutěž o&nbsp;vládce Propletu.</h2></div><div class="release-news-copy"><p>Hraj Denní výzvu a&nbsp;sbírej soutěžní body. Počítá se tvých nejlepších 20&nbsp;dnů — rychlost nerozhoduje. Na nejlepší čekají originální odznaky. A&nbsp;to vše v&nbsp;čistším designu, kde je vše po ruce a&nbsp;lépe vypadá na mobilu, tabletu i&nbsp;monitoru.</p></div><div class="release-news-actions"><button type="button" class="release-news-primary" data-news-monthly>Prohlédnout měsíční soutěž <span aria-hidden="true">→</span></button><button type="button" class="release-news-secondary" data-news-close>Jdu hrát</button></div>';
   doc.body.append(dialog);
   dialog.querySelectorAll('[data-news-close]').forEach(button=>button.onclick=()=>close());
   dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
   dialog.querySelector('[data-news-monthly]').onclick=()=>{if(!gate()||typeof win.PropletMonthlyCompetition?.open!=='function')return;close(false);win.PropletMonthlyCompetition.open();};
  }
  function open(manual=false){
   if(!gate()||!ready||blocked())return false;
   if(manual&&!onToday()){if(typeof win.nav!=='function')return false;win.nav('daily');}
   if(!onToday()||blocked())return false;
   if(!dialog)build();opener=doc.activeElement===doc.body?null:doc.activeElement;requested=false;
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
  doc.addEventListener('proplet:ready',()=>{ready=true;schedule();},{once:true});
  doc.addEventListener('proplet:screen-changed',schedule);
  const observer=new win.MutationObserver(records=>{if(records.some(record=>!record.target.closest?.('#releaseNewsDialog,#releaseNewsSettings')))schedule();});
  observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open']});
  reconcile();
  win.PropletReleaseNews=Object.freeze({open:()=>open(true)});
 }
 return {allowed,install};
});
