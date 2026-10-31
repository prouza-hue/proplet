/* Manual visual-playtest demo. No cohort, outbound transport or game hooks. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)api.install(root);
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const KEY='proplet:ui-playtest-demo:v1',WEEK=7*24*60*60*1000;
 const choices=['better','similar','worse','unsure'];
 const labels={better:'Lepší',similar:'Podobný',worse:'Horší',unsure:'Ještě nevím'};
 const production=new Set(['hrajproplet.cz','www.hrajproplet.cz','proplet-nine.vercel.app','proplet-pavel-prouzas-projects.vercel.app','proplet-git-main-pavel-prouzas-projects.vercel.app']);
 function allowed({href,environment,live=false,isolated=false}={}){
  try{const url=new URL(href),host=url.hostname;
   return url.searchParams.get('reviewPlaytest')==='1'&&!production.has(host)&&!host.endsWith('.hrajproplet.cz')
    &&environment==='preview'&&(live===true||(isolated===true&&['localhost','127.0.0.1','[::1]'].includes(host)));
  }catch{return false;}
 }
 const fresh=()=>({shows:0,accepted:false,declined:false,snoozeUntil:0,reminded:false,feedback:null});
 function create({storage,now=Date.now}={}){
  let state=fresh(),invitationVisible=false;
  try{const saved=JSON.parse(storage?.getItem(KEY)||'null');if(saved&&typeof saved==='object'){
   state={shows:Math.min(2,Math.max(0,Math.floor(Number(saved.shows)||0))),accepted:saved.accepted===true,declined:saved.declined===true,
    snoozeUntil:Math.max(0,Number(saved.snoozeUntil)||0),reminded:saved.reminded===true,feedback:null};
   if(choices.includes(saved.feedback?.choice)&&typeof saved.feedback.comment==='string'&&saved.feedback.comment.length<=2000)
    state.feedback={choice:saved.feedback.choice,comment:saved.feedback.comment,at:Number(saved.feedback.at)||0};
  }}catch{}
  const snapshot=()=>({...state,feedback:state.feedback?{...state.feedback}:null});
  const commit=patch=>{const next={...state,...patch};try{if(!storage?.setItem)return false;storage.setItem(KEY,JSON.stringify(next));state=next;return true;}catch{return false;}};
  const result=(ok,reason='')=>({ok,reason,state:snapshot()});
  function invite(){
   if(state.declined)return result(false,'declined');
   if(state.feedback)return result(false,'answered');
   if(state.accepted)return result(false,'accepted');
   if(now()<state.snoozeUntil)return result(false,'snoozed');
   if(invitationVisible)return result(true);
   if(state.shows>=2)return result(false,'limit');
   if(!commit({shows:state.shows+1}))return result(false,'storage');
   invitationVisible=true;return result(true);
  }
  function accept(){if(!invitationVisible)return result(false,'not-shown');if(!commit({accepted:true,snoozeUntil:0}))return result(false,'storage');invitationVisible=false;return result(true);}
  function snooze(){if(!commit({snoozeUntil:now()+WEEK}))return result(false,'storage');invitationVisible=false;return result(true);}
  function decline(){if(!commit({declined:true}))return result(false,'storage');invitationVisible=false;return result(true);}
  function simulateGames(){
   if(!state.accepted)return result(false,'not-accepted');
   if(state.feedback)return result(false,'answered');
   if(state.declined)return result(false,'declined');
   if(now()<state.snoozeUntil)return result(false,'snoozed');
   if(state.reminded)return result(false,'reminded');
   return commit({reminded:true})?result(true):result(false,'storage');
  }
  function submit(choice,comment=''){
   if(!choices.includes(choice))return result(false,'choice');
   if(typeof comment!=='string'||comment.length>2000)return result(false,'comment');
   if(!commit({accepted:true,feedback:{choice,comment:comment.trim(),at:now()}}))return result(false,'storage');
   invitationVisible=false;return result(true);
  }
  function reset(){try{if(!storage?.removeItem)return result(false,'storage');storage.removeItem(KEY);state=fresh();invitationVisible=false;return result(true);}catch{return result(false,'storage');}}
  return {snapshot,invite,accept,snooze,decline,simulateGames,submit,reset};
 }

 function install(win){
  const doc=win.document;
  let mounted=false,controller,review,panel,status,dialog,form,thanks,footerButton,opener=null;
  const q=s=>doc.querySelector(s);
  const gate=()=>{let live=false;try{live=win.livePlayerPreview?.()===true;}catch{}
   return allowed({href:win.location.href,environment:win.PROPLET_RUNTIME_ENV||win.PROPLET_RUNTIME_META?.environment,live,isolated:win.PROPLET_STUDIO_PREVIEW===true});};
  // Even readiness listeners are unnecessary for ordinary visits.
  let requested=false;try{requested=new URL(win.location.href).searchParams.get('reviewPlaytest')==='1';}catch{}
  if(!requested)return;
  const messages={declined:'Pozvánka je v této ukázce odmítnutá. Znovu ji zpřístupní Reset demo.',answered:'Ukázková odpověď už je uložená. Ve formuláři si ji můžeš prohlédnout.',accepted:'Pozvánka už je přijatá. Formulář je dostupný i v patičce.',snoozed:'Ukázka je odložená na 7 dní. Pro nový průchod použij Reset demo.',limit:'Pozvánka už byla v této ukázce zobrazena dvakrát.',storage:'Uložení do tohoto prohlížeče se nepodařilo. Zkus to znovu.', 'not-shown':'Nejdřív otevři ukázkovou pozvánku.','not-accepted':'Nejdřív přijmi ukázkovou pozvánku.',reminded:'Jedna ukázková připomínka už proběhla.',choice:'Vyber prosím jednu odpověď.',comment:'Komentář může mít nejvýše 2 000 znaků.'};
  const announce=message=>{status.textContent=message;};
  function syncFooter(){
   if(!mounted)return;
   const footer=q('.app-footer .footer-links');if(!footer)return;
   if(!footerButton){footerButton=doc.createElement('button');footerButton.type='button';footerButton.id='uiPlaytestFeedbackLink';footerButton.textContent='Zpětná vazba k vzhledu';footerButton.onclick=openForm;}
   if(footerButton.parentElement!==footer)footer.append(footerButton);
   const accepted=controller.snapshot().accepted;footerButton.hidden=!accepted;
   // Native footer links use display:inline-flex!important. Keep this demo-only
   // entry absent until acceptance without changing any native footer rule.
   footerButton.style.setProperty('display',accepted?'inline-flex':'none','important');
  }
  function apply(result,message){if(!result.ok){announce(messages[result.reason]||'Zkus to znovu.');return false;}syncFooter();if(message)announce(message);return true;}
  function hidePanel(){panel.hidden=true;panel.replaceChildren();}
  function openInvitation(){
   if(!apply(controller.invite(),''))return;
   panel.innerHTML='<section class="ui-playtest-card"><button type="button" class="ui-playtest-dismiss" aria-label="Odmítnout ukázkovou pozvánku">×</button><h2>Pomůžeš mi doladit nový vzhled?</h2><p>Zkouším nový vzhled Propletu. Zajímá mě upřímně, jak ti sedne a jestli se ti hraje lépe.</p><div class="ui-playtest-actions"><button type="button" class="ui-playtest-primary" data-demo-accept>Vyzkoušet náhled</button><button type="button" class="ui-playtest-text" data-demo-later>Teď ne</button></div></section>';
   panel.hidden=false;announce('Pozvánka '+controller.snapshot().shows+' / 2 · pouze ukázka');
   panel.querySelector('[data-demo-accept]').onclick=()=>{if(apply(controller.accept(),'Díky! Zpětnou vazbu najdeš v patičce.'))hidePanel();};
   panel.querySelector('[data-demo-later]').onclick=()=>{if(apply(controller.snooze(),'Pozvánka je v ukázce odložená na 7 dní.'))hidePanel();};
   panel.querySelector('.ui-playtest-dismiss').onclick=()=>{if(apply(controller.decline(),'Pozvánka je v ukázce odmítnutá.'))hidePanel();};
  }
  function closeForm(){if(dialog.open)dialog.close();if(opener?.isConnected)opener.focus({preventScroll:true});}
  function openForm(){
   const saved=controller.snapshot().feedback;form.reset();
   if(saved){const radio=form.querySelector('input[value="'+saved.choice+'"]');if(radio)radio.checked=true;form.querySelector('textarea').value=saved.comment;}
   q('#uiPlaytestError').textContent='';form.hidden=false;thanks.hidden=true;
   if(!dialog.open){opener=doc.activeElement;dialog.showModal();}
   q('#uiPlaytestTitle').focus({preventScroll:true});
  }
  function submit(event){
   event.preventDefault();const choice=form.querySelector('input[name="ui-playtest-choice"]:checked')?.value,comment=form.querySelector('textarea').value;
   const answer=controller.submit(choice,comment);
   if(!answer.ok){q('#uiPlaytestError').textContent=messages[answer.reason];(answer.reason==='choice'?form.querySelector('input'):form.querySelector('textarea')).focus();return;}
   hidePanel();syncFooter();form.hidden=true;thanks.hidden=false;announce('Ukázková odpověď je uložená jen v tomto prohlížeči.');
   q('#uiPlaytestThanksText').textContent='Tvoje odpověď: '+labels[answer.state.feedback.choice]+(answer.state.feedback.comment?' · '+answer.state.feedback.comment:'');
   q('#uiPlaytestThanksTitle').focus({preventScroll:true});
  }
  function remind(){
   if(!apply(controller.simulateGames(),''))return;
   panel.innerHTML='<section class="ui-playtest-card ui-playtest-reminder"><h2>Jak se ti hraje s novým vzhledem?</h2><p>Stačí vybrat jednu odpověď. Komentář je na tobě.</p><div class="ui-playtest-actions"><button type="button" class="ui-playtest-primary" data-demo-feedback>Říct názor</button><button type="button" class="ui-playtest-text" data-demo-later>Později</button></div></section>';
   panel.hidden=false;announce('Nasimulovány 2 hry. Skutečný herní postup se nezměnil.');panel.querySelector('[data-demo-feedback]').onclick=openForm;
   panel.querySelector('[data-demo-later]').onclick=()=>{if(apply(controller.snooze(),'Připomínka je v ukázce odložená na 7 dní.'))hidePanel();};
  }
  function mount(){
   if(!gate())return;
   if(mounted){syncFooter();return;}
   const shell=q('.app-shell');if(!shell)return;
   let storage=null;try{storage=win.localStorage;}catch{}
   controller=create({storage});
   review=doc.createElement('aside');review.id='uiPlaytestReview';review.setAttribute('aria-label','Ovládání ukázky playtestu');
   review.innerHTML='<div class="ui-playtest-toolbar"><strong>Ukázka playtestu · nic se neodesílá</strong><div><button type="button" data-demo-invite>Pozvánka</button><button type="button" data-demo-form>Formulář</button><button type="button" data-demo-games>Nasimulovat 2 hry</button><button type="button" data-demo-reset>Reset demo</button></div><p class="ui-playtest-status" role="status"></p></div><div class="ui-playtest-panel" hidden></div>';
   shell.before(review);panel=review.querySelector('.ui-playtest-panel');status=review.querySelector('.ui-playtest-status');
   dialog=doc.createElement('dialog');dialog.id='uiPlaytestDialog';dialog.setAttribute('aria-labelledby','uiPlaytestTitle');
   dialog.innerHTML='<button type="button" class="ui-playtest-dismiss" data-demo-close aria-label="Zavřít formulář">×</button><h2 id="uiPlaytestTitle" tabindex="-1">Jak ti sedí nový vzhled?</h2><p class="ui-playtest-demo-note">Ukázka — nic se neodesílá. Odpověď zůstane jen v tomto prohlížeči.</p><form id="uiPlaytestForm" novalidate><fieldset><legend>Ve srovnání s dosavadním Propletem je pro mě…</legend><div class="ui-playtest-options">'+choices.map(choice=>'<label><input type="radio" name="ui-playtest-choice" value="'+choice+'"><span>'+labels[choice]+'</span></label>').join('')+'</div></fieldset><label class="ui-playtest-comment">Co ti sedí a co bys změnil? <span>(nepovinné)</span><textarea maxlength="2000" rows="4" placeholder="Klidně napiš jen jednu větu."></textarea></label><p id="uiPlaytestError" role="alert"></p><button type="submit" class="ui-playtest-primary">Uložit odpověď</button><button type="button" class="ui-playtest-text" data-demo-report>Nahlásit technickou chybu</button></form><section id="uiPlaytestThanks" hidden><h3 id="uiPlaytestThanksTitle" tabindex="-1">Díky za upřímný názor.</h3><p>Odpověď je uložená pouze v ukázce, nikam jsme ji neposlali.</p><p id="uiPlaytestThanksText"></p><div class="ui-playtest-actions"><button type="button" class="ui-playtest-primary" data-demo-close>Zavřít</button><button type="button" class="ui-playtest-text" data-demo-edit>Upravit odpověď</button></div></section>';
   doc.body.append(dialog);form=q('#uiPlaytestForm');thanks=q('#uiPlaytestThanks');form.onsubmit=submit;
   form.addEventListener('change',event=>{if(event.target.name==='ui-playtest-choice'&&q('#uiPlaytestError').textContent===messages.choice)q('#uiPlaytestError').textContent='';});
   form.querySelector('textarea').addEventListener('input',event=>{if(event.target.value.length<=2000&&q('#uiPlaytestError').textContent===messages.comment)q('#uiPlaytestError').textContent='';});
   dialog.querySelectorAll('[data-demo-close]').forEach(button=>button.onclick=closeForm);dialog.querySelector('[data-demo-edit]').onclick=openForm;
   dialog.addEventListener('cancel',event=>{event.preventDefault();closeForm();});
   dialog.querySelector('[data-demo-report]').onclick=()=>{closeForm();const report=q('.footer-report-link');if(report)report.click();else announce('Běžný formulář hlášení chyby teď není dostupný.');};
   review.querySelector('[data-demo-invite]').onclick=openInvitation;review.querySelector('[data-demo-form]').onclick=openForm;review.querySelector('[data-demo-games]').onclick=remind;
   review.querySelector('[data-demo-reset]').onclick=()=>{if(apply(controller.reset(),'Ukázka je resetovaná. Herní postup zůstal beze změny.')){closeForm();hidePanel();form.reset();q('#uiPlaytestThanksText').textContent='';q('#uiPlaytestError').textContent='';form.hidden=false;thanks.hidden=true;}};
   mounted=true;syncFooter();
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  doc.addEventListener('proplet:ready',mount,{once:true});win.addEventListener('proplet-ui-ready',mount,{once:true});
  doc.addEventListener('proplet:screen-changed',()=>{if(mounted)syncFooter();else mount();});
 }
 return {KEY,WEEK,allowed,create,install};
});
