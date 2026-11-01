/* Small, server-eligible pilot entry. No cohort, credentials in links or game hooks. */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)api.install(root);
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const ENDPOINT='/api/visual-playtest';
 const PREVIEW='https://proplet-git-codex-today-one-screen-pavel-prouzas-projects.vercel.app/';
 const RATINGS={better:'Lepší',similar:'Podobný',worse:'Horší',unsure:'Ještě nevím'};
 const BODY='Zkouším nový vzhled Propletu. Zajímá mě upřímně, jak ti sedne a jestli se ti hraje lépe.';
 const ERRORS={choice:'Vyber prosím jednu odpověď.',comment:'Komentář může mít nejvýše 2 000 znaků.',network:'Uložení se nepodařilo. Odpověď zůstala ve formuláři. Zkus to prosím znovu.',action:'Změnu se nepodařilo uložit. Zkus to prosím znovu.'};
 function safeUrl(value){
  try{const url=new URL(value);if(url.origin+url.pathname!==PREVIEW||url.username||url.password||url.hash)return '';
   if([...url.searchParams.keys()].some(key=>key!=='playtest')||!url.searchParams.get('playtest'))return '';
   return url.href;
  }catch{return '';}
 }
 function presentation(data,preview){
  const eligible=data?.eligible===true&&!!safeUrl(data.previewUrl)&&data.status!=='declined';
  return {eligible,invite:eligible&&!preview&&data.role!=='reviewer'&&data.canShowInvite===true,
   feedback:eligible&&preview,returnLink:eligible&&!preview};
 }
 function create({request,getProfile,onChange=()=>{}}){
  let identity='',revision=0,data=null,busy=false,loading=false;
  const key=p=>p?.id&&p?.token?String(p.id)+'\n'+String(p.token):'';
  function sync(){const next=key(getProfile());if(next!==identity){identity=next;revision++;data=null;busy=false;loading=false;onChange(null);}return !!identity;}
  function snapshot(){sync();return {data,busy,loading};}
  async function perform(action,payload){
   if(!sync())return {ok:false,reason:'auth'};
   if(busy||loading)return {ok:false,reason:'busy'};
   const profile={...getProfile()},captured=identity,ticket=revision;
   if(action)busy=true;else loading=true;
   try{
    const response=await request(ENDPOINT,{...(action?{method:'POST',body:JSON.stringify({action,...payload})}:{}),authProfile:profile});
    sync();if(captured!==identity||ticket!==revision)return {ok:false,reason:'stale'};
    data=response?.eligible===true?response:{eligible:false};onChange(data);
    return {ok:true,data};
   }catch(error){
    sync();if(captured!==identity||ticket!==revision)return {ok:false,reason:'stale'};
    if(!action||error?.status===401||error?.status===403||error?.status===409){data=null;onChange(null);}
    return {ok:false,reason:'network'};
   }finally{if(captured===identity&&ticket===revision){busy=false;loading=false;}}
  }
  function act(action,payload={}){
   sync();if(data?.eligible!==true||data.status==='declined')return Promise.resolve({ok:false,reason:'auth'});
   if(!['shown','accept','snooze','decline','feedback'].includes(action))return Promise.resolve({ok:false,reason:'action'});
   if(action==='shown'&&(data.role==='reviewer'||data.canShowInvite!==true))return Promise.resolve({ok:false,reason:'not-offered'});
   if(action==='feedback'){
    if(!Object.hasOwn(RATINGS,payload.rating))return Promise.resolve({ok:false,reason:'choice'});
    if(typeof payload.comment!=='string'||payload.comment.length>2000)return Promise.resolve({ok:false,reason:'comment'});
    payload={rating:payload.rating,comment:payload.comment.trim()};
   }else payload={};
   return perform(action,payload);
  }
  return {snapshot,sync,load:()=>perform(),act};
 }
 function install(win){
  const doc=win.document,q=selector=>doc.querySelector(selector);
  let controller,card,dialog,footerLink,footerNotice,observer,frame=0,grant=false,reserving=false,reservationFailed=false,opener=null,lastLoad=0;
  const preview=()=> (win.PROPLET_RUNTIME_ENV||win.PROPLET_RUNTIME_META?.environment)==='preview';
  const profile=()=>{try{return win.getProfile?.()||null;}catch{return null;}};
  const safeScreen=()=>!!q('#screen-daily.active')&&!doc.body.classList.contains('playing')&&!q('.modal:not(.hidden),dialog[open]');
  function discard(){grant=false;reservationFailed=false;card?.remove();card=null;footerLink?.remove();footerLink=null;footerNotice?.remove();footerNotice=null;
   if(dialog){if(dialog.open)dialog.close();dialog.remove();dialog=null;}observer?.disconnect();observer=null;}
  function schedule(){if(!frame)frame=win.requestAnimationFrame(()=>{frame=0;render();});}
  function watch(){if(observer)return;observer=new win.MutationObserver(records=>{
   if(records.some(record=>!record.target.closest?.('#visualPlaytestInvite,#visualPlaytestDialog,#visualPlaytestFooter')))schedule();
  });observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','style']});}
  function footer(data,view){
   if(!view.feedback&&!view.returnLink){footerLink?.remove();footerLink=null;return;}
   const host=q('.app-footer .footer-links');if(!host)return;
   const tag=view.feedback?'BUTTON':'A';if(footerLink?.tagName!==tag){footerLink?.remove();footerLink=doc.createElement(tag.toLowerCase());footerLink.id='visualPlaytestFooter';}
   if(view.feedback){footerLink.type='button';footerLink.textContent='Zpětná vazba k vzhledu';footerLink.onclick=openForm;}
   else{footerLink.textContent='Nový vzhled';footerLink.href=safeUrl(data.previewUrl);footerLink.target='_blank';footerLink.rel='noopener noreferrer';
    footerLink.onclick=async()=>{if(controller.snapshot().data?.status!=='invited')return;
     const entry=footerLink,result=await controller.act('accept');if(entry!==footerLink||result.reason==='stale')return;
     if(!result.ok){if(!footerNotice){footerNotice=doc.createElement('span');footerNotice.className='vp-footer-status';footerNotice.setAttribute('role','status');host.append(footerNotice);}footerNotice.textContent=ERRORS.action;}
     else{grant=false;footerNotice?.remove();footerNotice=null;render();}
    };
   }
   if(footerLink.parentElement!==host)host.append(footerLink);
  }
  async function reserve(){
   reserving=true;const result=await controller.act('shown');reserving=false;
   if(result.ok&&result.data.displayGranted===true)grant=true;
   else if(result.reason!=='stale')reservationFailed=true;
   render();
  }
  async function invitationAction(action){
   if(!card)return;const current=card;
   current.setAttribute('aria-busy','true');current.querySelectorAll('button').forEach(button=>button.disabled=true);
   const result=await controller.act(action);
   if(current!==card)return;
   current.removeAttribute('aria-busy');current.querySelectorAll('button').forEach(button=>button.disabled=false);
   if(result.ok){grant=false;current.remove();card=null;render();}
   else if(result.reason!=='stale')current.querySelector('[role=status]').textContent=ERRORS.action;
  }
  function render(){
   if(!controller)return;const {data}=controller.snapshot(),view=presentation(data,preview());
   if(!view.eligible){discard();return;}
   watch();footer(data,view);
   if(!preview()&&grant&&data.status==='invited'){
    if(!card){
     card=doc.createElement('aside');card.id='visualPlaytestInvite';card.setAttribute('aria-labelledby','visualPlaytestInviteTitle');
     card.innerHTML='<button type="button" class="vp-dismiss" aria-label="Odmítnout pozvánku">×</button><h2 id="visualPlaytestInviteTitle">Pomůžeš mi doladit nový vzhled?</h2><p>'+BODY+'</p><div class="vp-actions"><a class="vp-primary" data-vp-accept target="_blank" rel="noopener noreferrer">Vyzkoušet náhled</a><button type="button" class="vp-text" data-vp-later>Teď ne</button></div><p class="vp-account-note">V náhledu se přihlas svým běžným účtem. Výsledky a XP se ukládají jako obvykle.</p><p role="status" class="vp-status"></p>';
     card.querySelector('[data-vp-accept]').href=safeUrl(data.previewUrl);
     // A real link opens synchronously; the authenticated save never places a token in its URL.
     card.querySelector('[data-vp-accept]').onclick=()=>{invitationAction('accept');};
     card.querySelector('[data-vp-later]').onclick=()=>invitationAction('snooze');
     card.querySelector('.vp-dismiss').onclick=()=>invitationAction('decline');
    }
    // Archive's canonical home ordering reserves this same optional position.
    const daily=q('#screen-daily');if(daily){const hero=daily.querySelector('.daily-hero');if(hero){if(hero.nextElementSibling!==card)hero.after(card);}else if(daily.firstElementChild!==card)daily.prepend(card);}
    const hidden=!safeScreen();if(card.hidden!==hidden)card.hidden=hidden;
   }else{card?.remove();card=null;}
   if(view.invite&&!grant&&!reserving&&!reservationFailed&&safeScreen())reserve();
  }
  function closeForm(){if(dialog?.open)dialog.close();if(opener?.isConnected)opener.focus({preventScroll:true});}
  function openForm(){
   const data=controller.snapshot().data;if(!presentation(data,preview()).feedback)return;
   if(!dialog)buildDialog();
   const form=dialog.querySelector('form'),saved=data.feedback;form.reset();
   if(saved&&Object.hasOwn(RATINGS,saved.rating)){form.querySelector('input[value="'+saved.rating+'"]').checked=true;form.querySelector('textarea').value=saved.comment||'';}
   form.hidden=false;dialog.querySelector('.vp-thanks').hidden=true;dialog.querySelector('[role=alert]').textContent='';
   if(!dialog.open){opener=doc.activeElement;dialog.showModal();}
   dialog.querySelector('h2').focus({preventScroll:true});
  }
  function buildDialog(){
   dialog=doc.createElement('dialog');dialog.id='visualPlaytestDialog';dialog.setAttribute('aria-labelledby','visualPlaytestTitle');
   dialog.innerHTML='<button type="button" class="vp-dismiss" data-vp-close aria-label="Zavřít formulář">×</button><h2 id="visualPlaytestTitle" tabindex="-1">Jak ti sedí nový vzhled?</h2><form novalidate><fieldset aria-describedby="visualPlaytestError"><legend>Ve srovnání s dosavadním Propletem je pro mě…</legend><div class="vp-options">'+Object.entries(RATINGS).map(([rating,label])=>'<label><input type="radio" name="visual-playtest-rating" value="'+rating+'" required><span>'+label+'</span></label>').join('')+'</div></fieldset><label class="vp-comment">Co ti sedí a co bys změnil? <span>(nepovinné)</span><textarea maxlength="2000" rows="4" placeholder="Klidně napiš jen jednu větu."></textarea></label><p id="visualPlaytestError" role="alert"></p><button type="submit" class="vp-primary">Odeslat odpověď</button><button type="button" class="vp-text" data-vp-report>Nahlásit technickou chybu</button></form><section class="vp-thanks" hidden><h3 tabindex="-1">Díky za upřímný názor.</h3><p>Odpověď je uložená. Můžeš se k ní vrátit a upravit ji.</p><p class="vp-answer"></p><div class="vp-actions"><button type="button" class="vp-primary" data-vp-close>Zavřít</button><button type="button" class="vp-text" data-vp-edit>Upravit odpověď</button></div></section>';
   doc.body.append(dialog);const form=dialog.querySelector('form'),error=form.querySelector('[role=alert]');
   dialog.querySelectorAll('[data-vp-close]').forEach(button=>button.onclick=closeForm);
   dialog.addEventListener('cancel',event=>{event.preventDefault();closeForm();});
   dialog.querySelector('[data-vp-edit]').onclick=openForm;
   form.addEventListener('change',()=>{if(error.textContent===ERRORS.choice)error.textContent='';});
   form.querySelector('textarea').addEventListener('input',()=>{if(error.textContent===ERRORS.comment)error.textContent='';});
   form.querySelector('[data-vp-report]').onclick=()=>{const report=q('.footer-report-link');if(report){closeForm();report.click();}else error.textContent='Formulář hlášení chyby teď není dostupný. Zkus to prosím později.';};
   form.onsubmit=async event=>{
    event.preventDefault();const current=dialog,rating=form.querySelector('input:checked')?.value,comment=form.querySelector('textarea').value;
    if(controller.snapshot().busy)return;
    form.setAttribute('aria-busy','true');form.querySelector('button[type=submit]').disabled=true;error.textContent='';
    const result=await controller.act('feedback',{rating,comment});
    if(dialog!==current)return;
    form.removeAttribute('aria-busy');form.querySelector('button[type=submit]').disabled=false;
    if(!result.ok){error.textContent=ERRORS[result.reason]||ERRORS.network;
     if(result.reason==='choice')form.querySelector('input').focus();else if(result.reason==='comment')form.querySelector('textarea').focus();return;}
    if(!result.data.feedback){error.textContent=ERRORS.network;return;}
    form.hidden=true;const thanks=current.querySelector('.vp-thanks'),saved=result.data.feedback;thanks.hidden=false;
    thanks.querySelector('.vp-answer').textContent=RATINGS[saved.rating]+(saved.comment?' · '+saved.comment:'');thanks.querySelector('h3').focus({preventScroll:true});
   };
  }
  async function refresh(){
   if(!controller){if(typeof win.api!=='function'||typeof win.getProfile!=='function')return;
    controller=create({request:(path,opts)=>win.api(path,opts),getProfile:profile,onChange:data=>{if(!data)discard();else schedule();}});}
   controller.sync();if(!profile()?.token){discard();return;}
   // A background status failure must not erase this account's draft. The
   // explicit submit still verifies eligibility, and account changes discard it.
   if(dialog?.open)return;
   lastLoad=Date.now();await controller.load();render();
  }
  doc.addEventListener('proplet:ready',refresh);
  doc.addEventListener('proplet:account-changed',()=>{controller?.sync();discard();refresh();});
  doc.addEventListener('proplet:screen-changed',()=>{if(controller)render();else refresh();});
  win.addEventListener('focus',()=>{if(Date.now()-lastLoad>60000)refresh();});
  win.addEventListener('online',refresh);
  if(doc.readyState!=='loading')refresh();else doc.addEventListener('DOMContentLoaded',refresh,{once:true});
 }
 return {create,presentation,safeUrl,install};
});
