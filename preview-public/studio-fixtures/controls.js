/* Review tools are outside .app-shell and never replace game controls. */
(()=>{'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 const q=new URLSearchParams(location.search),bar=document.createElement('aside');bar.id='studioPreviewTools';
 bar.innerHTML='<details><summary>Studio Edition · testovací náhled</summary><p>Skutečná hra, izolovaný postup. Denní a Extra používají zveřejněné volné desky. Žádný skutečný účet ani serverové výsledky.</p><div class="studio-controls"><label>Vzhled<select data-studio="theme"><option value="light">Světlý</option><option value="dark">Tmavý</option></select></label><label>Hráč<select data-studio="account"><option value="member">Ukázkový hráč</option><option value="guest">Host</option><option value="incoming">Bonus z pozvánky</option></select></label><label>Výchozí stav<select data-studio="state"><option value="ready">Před výzvou</option><option value="done">Denní hotová</option><option value="complete">Denní i Extra hotovy</option></select></label><label>Extra<select data-studio="extra"><option value="hardcore">Mozkožrout</option><option value="mozkomor">Mozkomor</option><option value="mozkokalypsa">Mozkokalypsa</option><option value="none">Není dostupná</option></select></label><button id="studioReset" type="button">Smazat jen ukázkový postup</button></div></details>';
 const period=q.get('patronPeriod'),periods=['first','current','grace','expired','reinstated','oneoff','private'];
 if(periods.includes(period)){
  bar.querySelector('summary').textContent='Náhled podpory · ukázková data';
  const notice=document.createElement('p');notice.className='studio-patron-notice';notice.textContent='Značky a potvrzené převody jsou syntetické ukázky. Náhled nevytváří skutečný účet, QR platbu ani bankovní potvrzení. Ukázková splatnost 1. 12.: červená značka zůstává do konce 8. 12., od 9. 12. ji nahrazuje modrá.';
  bar.querySelector('details').append(notice);
  const fields=document.createElement('div');fields.className='studio-controls';fields.innerHTML='<label>Podpora<select data-studio="patronPeriod"><option value="first">První potvrzená měsíční platba</option><option value="current">Pravidelná podpora</option><option value="grace">Čekání na další platbu · 8. 12.</option><option value="expired">Po lhůtě · 9. 12.</option><option value="reinstated">Obnovená podpora</option><option value="oneoff">Jednorázové poděkování</option><option value="private">Soukromá pravidelná značka</option></select></label><label>Zobrazení<select data-studio="patronView"><option value="result">Výsledek a porovnání značek</option><option value="thanks">Vlastní poděkování</option><option value="offer">Nabídka podpory</option><option value="settings">Soukromí v nastavení</option></select></label>';
  bar.querySelector('details').append(fields);
 }
 document.body.prepend(bar);
 for(const select of bar.querySelectorAll('select')){select.value=q.get(select.dataset.studio)||({theme:'light',account:'member',state:'ready',extra:'hardcore',patronView:'result'})[select.dataset.studio];select.onchange=()=>{if(select.dataset.studio==='theme'&&typeof applyTheme==='function'){applyTheme(select.value,{persist:true});q.set('theme',select.value);history.replaceState(null,'','?'+q);diagnose();return}q.set(select.dataset.studio,select.value);location.search=q.toString();};}
 bar.querySelector('#studioReset').onclick=()=>window.PropletStudioFixture.reset();
 const status=document.createElement('output');status.id='studioFixtureDiagnostics';status.hidden=true;bar.append(status);
 function diagnose(){const value=window.PropletStudioFixture?.diagnostics();if(!value)return;status.textContent=JSON.stringify(value);for(const [key,item]of Object.entries(value))if(item!=null)status.dataset[key]=String(item);}
 diagnose();document.addEventListener('proplet:ready',()=>{diagnose();setTimeout(diagnose,250)},{once:true});
});
})();
