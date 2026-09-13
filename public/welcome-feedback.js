(()=>{
 const demo=new URLSearchParams(location.search).get('welcomePreview')==='1'&&location.hostname.endsWith('.vercel.app');
 function mount(){
  const screen=document.querySelector('#screen-daily');if(!screen||document.querySelector('#welcomeFeedback'))return;
  const p=typeof getProfile==='function'?getProfile():null;
  if(!demo&&!p?.token)return;
  const key='proplet-welcome-printshop-v1:'+String(p?.id||'preview');
  try{if(!demo&&localStorage.getItem(key))return}catch{}
  const card=document.createElement('section');card.id='welcomeFeedback';card.className='welcome-feedback';card.setAttribute('aria-labelledby','welcomeFeedbackTitle');
  card.innerHTML=`<button type="button" class="welcome-feedback-close" aria-label="Zavřít uvítání">×</button><img class="welcome-feedback-art" src="/assets/avatars/v3/20-kniha-s-copem.svg" alt="" aria-hidden="true"><div class="welcome-feedback-copy"><h2 id="welcomeFeedbackTitle">Vítej v novém Propletu!</h2><p>Díky, že hraješ a pomáháš Proplet zlepšovat. Našel jsi chybu? Dej nám vědět — hlášení čteme a opravy se snažíme dostat ven co nejrychleji.</p><button type="button" class="welcome-feedback-report">Nahlásit chybu</button><small>Formulář najdeš kdykoli dole v patičce.</small></div>`;
  const dismiss=()=>{try{localStorage.setItem(key,'1')}catch{}card.remove()};
  card.querySelector('.welcome-feedback-close').onclick=dismiss;
  card.querySelector('.welcome-feedback-report').onclick=()=>{openSupportReport();dismiss()};
  screen.prepend(card);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,500),{once:true});else setTimeout(mount,500);
})();
