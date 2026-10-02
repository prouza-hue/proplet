(()=>{
 const demo=new URLSearchParams(location.search).get('welcomePreview')==='1'&&location.hostname.endsWith('.vercel.app');
 const checked=new Set();
 let demoShown=false;
 async function mount(){
  if(demo&&demoShown)return;
  const screen=document.querySelector('#screen-daily');if(!screen||!screen.classList.contains('active')||document.hidden||document.querySelector('#welcomeFeedback'))return;
  const p=typeof getProfile==='function'?getProfile():null;
  if(!demo&&!p?.token)return;
  if(!demo){
   if(checked.has(p.id))return;
   checked.add(p.id);
   try{
    const result=await api('/api/account/welcome',{method:'POST'});
    if(!result.show||getProfile()?.id!==p.id)return;
   }catch{checked.delete(p.id);return}
  }
  const card=document.createElement('section');card.id='welcomeFeedback';card.className='welcome-feedback';card.setAttribute('aria-labelledby','welcomeFeedbackTitle');
  card.innerHTML=`<button type="button" class="welcome-feedback-close" aria-label="Zavřít uvítání">×</button><img class="welcome-feedback-art" src="/assets/avatars/v3/20-kniha-s-copem.svg" alt="" aria-hidden="true"><div class="welcome-feedback-copy"><h2 id="welcomeFeedbackTitle">Vítej v novém Propletu!</h2><p>Díky, že hraješ a pomáháš Proplet zlepšovat. Našel jsi chybu? Dej nám vědět — hlášení čteme a opravy se snažíme dostat ven co nejrychleji.</p><button type="button" class="welcome-feedback-report">Nahlásit chybu</button><small>Formulář najdeš kdykoli dole v patičce.</small></div>`;
  const dismiss=()=>card.remove();
  card.querySelector('.welcome-feedback-close').onclick=dismiss;
  card.querySelector('.welcome-feedback-report').onclick=()=>{openSupportReport();dismiss()};
  screen.prepend(card);
  if(demo)demoShown=true;
 }
 document.addEventListener('visibilitychange',mount);
 document.addEventListener('click',()=>setTimeout(mount,0));
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,500),{once:true});else setTimeout(mount,500);
})();
