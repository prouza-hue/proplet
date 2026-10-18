/* On-demand reward detail: native modal focus/inert handling, no observer or polling. */
(function(global){
 'use strict';
 const streakStories=Object.freeze({
  "První zářez": "Dnes první zářez. Zítra bude na co navázat.",
  "Srdcař": "Třetí den. Tady už to nebude jen ze zvědavosti.",
  "Pětka": "Pět dní v řadě. Tahle pětka se doma ukazuje.",
  "Týden v plamenech": "Celý týden. Ani jeden den nevyhasl.",
  "Desítka": "Deset dní, deset návratů. Už znáš cestu.",
  "Půlměsíc": "Dva týdny po chvilkách. Pěkný kus času pro sebe.",
  "Mistr slov": "Tři týdny schůzek s písmeny. Už si tykáte.",
  "Koruna": "Každý den kousek. Až z toho byla koruna.",
  "Diamant": "Padesát dní. Tenhle kousek má vybroušenou každou hranu.",
  "Legenda": "Sto dní v řadě. Tohle se jedním šťastným tahem neuhraje."
});
 const rankStories=Object.freeze({
  "Nováček": "Jen se rozhlížíš. To jsme na začátku říkali taky.",
  "Písmenkář": "Písmenka znáš. Teď se ještě domluvit na pořadí.",
  "Hledač nití": "Začalo to jedním slovem. Teď už to nechceš nechat rozpletené.",
  "Slovolovec": "Jedno slovo uloveno. Další se tváří, že tu vůbec není.",
  "Propletač": "Tudy, tudy… ne, zpátky. Jo, tudy.",
  "Kličkař": "Rovně by to bylo moc jednoduché.",
  "Uzlovač": "Tenhle uzel naštěstí nemusíš rozmotávat zuby.",
  "Cestář": "Cesta hotová. Kužely můžeš uklidit.",
  "Stopař slov": "Tady bylo slovo. Poznáš to podle toho podezřelého Ř.",
  "Průzkumník mřížky": "Tenhle roh už znáš. Radši ho zkontroluješ ještě jednou.",
  "Labyrintník": "Zabloudit se dá i na pár políčkách. Už víš přesně kde.",
  "Slovní taktik": "Nejdřív si to promyslíš. Pak to stejně zkusíš jinudy.",
  "Krotitel zákrut": "Ta zatáčka vypadala hůř, než jaká nakonec byla.",
  "Mistr cest": "Zkratku znáš. Jen má o tři zatáčky víc.",
  "Mistr zákrut": "Na rovné čáře už ti něco chybí.",
  "Mistr šneků": "Žádný spěch. Šnek taky neřeší osobní rekord.",
  "Propletový ninja": "Nenápadný pohyb prstem. A půlka desky je pryč.",
  "Slovní alchymista": "Přidat písmeno, trochu zamíchat. Výsledek se tentokrát dá přečíst.",
  "Slovní mág": "Vypadá to jako kouzlo. To předchozí škrtání nikdo neviděl.",
  "Mřížkový mág": "Slovo zmizelo z desky. Přesně jak bylo v plánu.",
  "Slovočaroděj": "Zaklínadlo by bylo. Jen se musí vejít do mřížky.",
  "Krotitel Mozkožroutů": "Mozkožrout si dneska bude muset najít jinou svačinu.",
  "Strážce mřížky": "Všechna políčka pod dohledem. Tohle jedno obzvlášť.",
  "Architekt labyrintu": "Podle plánku to mělo být hned za rohem. Jenže za kterým.",
  "Mistr skrytých cest": "Celou dobu to bylo přímo před tebou. O tom se nemusíme bavit.",
  "Mistr nekonečna": "Ještě jednu. Tahle věta se ti nějak opakuje.",
  "Velmistr Propletu": "Už i překlep v nákupním seznamu zkoušíš propojit.",
  "Arcimistr Propletu": "Titul na vizitku už máš. Teď najít vizitku, kam se vejde.",
  "Strážce tajných cest": "Kudy dál? Víš, ale necháš ostatní ještě chvilku hledat.",
  "Strážce všech cest": "Tudy se dá taky? Ano. Už jsi tam byl.",
  "Král mřížky": "Korunu máš. Nádobí za tebe bohužel neumyje.",
  "Propletový titán": "Desku zvládneš jedním prstem. Zní to působivěji, než to vypadá.",
  "Nadslovník": "Některá slova znáš už tak dobře, že byste si mohli tykat.",
  "Hvězdný propletač": "Hvězdná kariéra. A ani ses nemusel zvednout z gauče.",
  "Orbitální luštitel": "Kolem toho slova kroužíš už potřetí. Teď přistát.",
  "Galaktický slovolovec": "Vesmír je veliký. To poslední slovo se stejně schovává v rohu.",
  "Hvězdný navigátor": "Třetí písmeno vlevo. Pak už to poznáš.",
  "Čtenář souhvězdí": "Někdo vidí Velký vůz. Ty hledáš, jestli by šel protáhnout o políčko.",
  "Strážce souhvězdí": "Hvězdy jsou na svém místě. Teď ještě kam se podělo to poslední slovo.",
  "Mistr hvězdných cest": "Přepočítávám trasu. Aha, ty už jsi tam.",
  "Architekt souhvězdí": "Tady bude zatáčka. Tady druhá. Rovnou cestu si necháme na jindy.",
  "Strážce slovního vesmíru": "Celý vesmír na starosti. Aspoň tu nikdo nechce měnit heslo.",
  "Mistr slovního vesmíru": "Vesmír se rozpíná. Tobě zatím stačí tahle obrazovka.",
  "Architekt slovního vesmíru": "Sem galaxii, tam mlhovinu. A někde nechat místo na háčky.",
  "Vládce slovního vesmíru": "Vládneš vesmíru. Doma se to zatím moc neprojevilo.",
  "Strážce nekonečna": "Konec je v nedohlednu. Aspoň nemusíš zamykat.",
  "Velmistr nekonečna": "Sto tisíc XP. A začalo to tím, že jen zkusíš, co to je.",
  "Arcimistr nekonečna": "Písmenka už znáš osobně. S některými to bylo trochu složitější.",
  "Legenda Propletu": "Tohle už se těžko vysvětluje větou „občas si zahraju“.",
  "Absolutní Propletač": "Máš to v malíku. Ale ukazováčkem se pořád hraje líp.",
  "Legenda bez konce": "Hodnosti došly. Chuť na další desku očividně ne."
});
 let dialog,opener,previousOverflow='',rankPoints=0,rankIndex=0;
 function restore(){if(!opener)return;document.body.style.overflow=previousOverflow;if(opener.isConnected&&opener.getClientRects().length)opener.focus({preventScroll:true});opener=null;}
 function close(){if(dialog?.open){dialog.close();restore()}}
 function mount(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.id='achievementDetail';
  dialog.setAttribute('aria-labelledby','achievementDetailTitle');
  dialog.setAttribute('aria-describedby','achievementDetailStory achievementDetailCondition achievementDetailStatus');
  dialog.innerHTML=`<section class="achievement-detail-card">
   <button type="button" class="achievement-detail-x" data-achievement-close aria-label="Zavřít detail"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
   <div id="achievementDetailArt" aria-hidden="true"></div>
   <h2 id="achievementDetailTitle"></h2><p id="achievementDetailStory"></p>
   <div class="achievement-detail-progress"><p id="achievementDetailCondition"></p><progress id="achievementDetailProgress" aria-label="Postup k získání úspěchu"></progress><p id="achievementDetailStatus"></p></div>
   <button type="button" class="achievement-detail-done" data-achievement-close>Zavřít detail</button>
   <nav class="rank-detail-navigation" aria-label="Procházet hodnosti" hidden><button type="button" data-rank-previous aria-label="Předchozí hodnost">← Předchozí</button><span id="rankDetailOrdinal"></span><button type="button" data-rank-next aria-label="Další hodnost">Další →</button></nav>
  </section>`;
  document.body.append(dialog);
  dialog.querySelector('[data-rank-previous]').addEventListener('click',()=>renderRank(rankIndex-1));
  dialog.querySelector('[data-rank-next]').addEventListener('click',()=>renderRank(rankIndex+1));
  dialog.querySelectorAll('[data-achievement-close]').forEach(b=>b.addEventListener('click',close));
  // Require both ends of a tap on the backdrop, so a drag out of the card does not dismiss it.
  let backdropDown=false;
  dialog.addEventListener('pointerdown',e=>{backdropDown=e.target===dialog});
  dialog.addEventListener('click',e=>{if(backdropDown&&e.target===dialog)close();backdropDown=false});
  dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
  dialog.addEventListener('close',()=>{if(!dialog.open)restore()});
 }
 function open(id,source){
  const achievement=ACHIEVEMENTS.find(a=>a.id===id);if(!achievement)return;
  mount();dialog.dataset.loyalty='false';dialog.dataset.rank='false';dialog.querySelector('.rank-detail-navigation').hidden=true;
  dialog.setAttribute('aria-labelledby','achievementDetailTitle');dialog.removeAttribute('aria-label');
  dialog.setAttribute('aria-describedby','achievementDetailStory achievementDetailCondition achievementDetailStatus');
  // One stats snapshot per explicit open, never per icon or scroll event.
  const stats=effectiveStats(),value=Math.max(0,Number(achievement.value(stats))||0),earned=achievement.test(stats);
  dialog.querySelector('#achievementDetailTitle').textContent=achievement.name;
  dialog.querySelector('#achievementDetailStory').textContent=global.PropletAchievementStories[id];
  dialog.querySelector('#achievementDetailCondition').textContent=achievement.desc;
  const progress=dialog.querySelector('progress');progress.max=achievement.target;progress.value=Math.min(value,achievement.target);progress.hidden=achievement.group==='speed';progress.setAttribute('aria-label','Postup k získání úspěchu');
  const count=new Intl.NumberFormat('cs-CZ');
  dialog.querySelector('#achievementDetailStatus').textContent=earned?'Získáno':achievement.group==='speed'?'Zatím nezískáno':`${count.format(Math.min(value,achievement.target))} / ${count.format(achievement.target)} · Zatím nezískáno`;
  dialog.dataset.earned=String(earned);dialog.dataset.achievementId=id;
  // Detail deliberately reveals the full-colour drawing even for a locked achievement.
  const art=global.PropletRibbonArt?.art(achievement.name,{category:'achievement',size:192});
  const slot=dialog.querySelector('#achievementDetailArt');slot.replaceChildren();
  if(art){art.removeAttribute('role');art.removeAttribute('aria-label');const img=art.querySelector('img');if(img){img.loading='eager';img.decoding='async'}slot.append(art)}else slot.textContent=achievement.icon;
  if(!dialog.open){opener=source||document.activeElement;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal()}
  dialog.scrollTop=0;dialog.querySelector('.achievement-detail-done').focus({preventScroll:true});
 }

 function openStreak(name,source){
  const art=global.PropletRibbonArt?.art(name,{category:'streak',size:240});if(!art)return;
  mount();dialog.dataset.loyalty='true';dialog.dataset.rank='false';dialog.querySelector('.rank-detail-navigation').hidden=true;delete dialog.dataset.achievementId;delete dialog.dataset.earned;
  dialog.setAttribute('aria-labelledby','achievementDetailTitle');dialog.removeAttribute('aria-label');
  dialog.setAttribute('aria-describedby','achievementDetailStory');
  dialog.querySelector('#achievementDetailTitle').textContent=name;
  dialog.querySelector('#achievementDetailStory').textContent=streakStories[name]||'';
  art.removeAttribute('role');art.removeAttribute('aria-label');
  const img=art.querySelector('img');if(img){img.loading='eager';img.decoding='async'}
  dialog.querySelector('#achievementDetailArt').replaceChildren(art);
  if(!dialog.open){opener=source||document.activeElement;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal()}
  dialog.scrollTop=0;dialog.querySelector('.achievement-detail-done').focus({preventScroll:true});
 }
 function renderRank(index){
  if(!Number.isInteger(index)||!LEVELS[index])return;
  rankIndex=index;const rank=LEVELS[index],current=levelFor(rankPoints),earned=rankPoints>=rank.xp,isCurrent=current.index-1===index,next=LEVELS[index+1],fmt=n=>n.toLocaleString('cs-CZ');
  dialog.dataset.rank='true';dialog.dataset.loyalty='false';dialog.dataset.earned=String(earned);delete dialog.dataset.achievementId;
  dialog.setAttribute('aria-describedby','achievementDetailStory achievementDetailCondition achievementDetailStatus');
  dialog.querySelector('#achievementDetailTitle').textContent=rank.name;
  dialog.querySelector('#achievementDetailStory').textContent=rankStories[rank.name]||'';
  const condition=dialog.querySelector('#achievementDetailCondition'),status=dialog.querySelector('#achievementDetailStatus'),progress=dialog.querySelector('progress');
  progress.hidden=earned&&!isCurrent||isCurrent&&!next;
  if(isCurrent){
   condition.textContent=`Tvoje současná hodnost · od ${fmt(rank.xp)} XP`;
   if(next){progress.max=next.xp-rank.xp;progress.value=Math.min(progress.max,rankPoints-rank.xp);progress.setAttribute('aria-label',`Postup k hodnosti ${next.name}`);status.textContent=`Ještě ${fmt(next.xp-rankPoints)} XP · ${next.name}`;}
   else status.textContent='Všechny hodnosti máš. Dál pokračují kapitoly po 5 000 XP.';
  }else if(earned){condition.textContent=`Získaná hodnost · od ${fmt(rank.xp)} XP`;status.textContent='Patří do tvé sbírky.';}
  else{condition.textContent=`Odemkne se při ${fmt(rank.xp)} XP`;progress.max=rank.xp;progress.value=rankPoints;progress.setAttribute('aria-label',`Postup k hodnosti ${rank.name}`);status.textContent=`Chybí ${fmt(rank.xp-rankPoints)} XP · Máš ${fmt(rankPoints)} XP`;}
  const slot=dialog.querySelector('#achievementDetailArt'),art=global.PropletRibbonArt?.art(rank.name,{category:'rank',size:192});slot.replaceChildren();
  if(art){art.removeAttribute('role');art.removeAttribute('aria-label');const img=art.querySelector('img');if(img){img.loading='eager';img.decoding='async'}slot.append(art);}else slot.textContent=rank.icon;
  const nav=dialog.querySelector('.rank-detail-navigation');nav.hidden=false;
  const previous=nav.querySelector('[data-rank-previous]'),following=nav.querySelector('[data-rank-next]');previous.disabled=index===0;following.disabled=index===LEVELS.length-1;
  nav.querySelector('#rankDetailOrdinal').textContent=`Hodnost ${index+1} z ${LEVELS.length}`;
  if(document.activeElement===previous&&previous.disabled||document.activeElement===following&&following.disabled)dialog.querySelector('.achievement-detail-done').focus({preventScroll:true});
  dialog.scrollTop=0;
 }
 function openRank(index,source){
  if(!Number.isInteger(index)||!LEVELS[index])return;
  // One snapshot per explicit open. Browsing ranks never recalculates history or writes progress.
  rankPoints=Math.max(0,Number(effectiveStats().points)||0);mount();renderRank(index);
  if(!dialog.open){opener=source||document.activeElement;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal()}
  dialog.querySelector('.achievement-detail-done').focus({preventScroll:true});
 }
 function activate(trigger){
  if(trigger.hasAttribute('data-rank-detail')){openRank(Number(trigger.dataset.rankDetail),trigger);return;}
  if(trigger.hasAttribute('data-streak-detail'))openStreak(trigger.dataset.streakDetail,trigger);
  else open(trigger.dataset.achievementDetail,trigger);
 }
 document.addEventListener('click',event=>{const trigger=event.target.closest('[data-achievement-detail],[data-streak-detail],[data-rank-detail]');if(trigger)activate(trigger)});
 document.addEventListener('keydown',event=>{
  if(dialog?.open&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return}
  if(dialog?.open&&event.key==='Tab'){
   const buttons=Array.from(dialog.querySelectorAll('button')).filter(b=>!b.disabled&&b.getClientRects().length),first=buttons[0],last=buttons[buttons.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
   return;
  }
  const trigger=event.target.closest('[data-achievement-detail],[data-streak-detail],[data-rank-detail]');if(trigger&&(event.key==='Enter'||event.key===' ')){event.preventDefault();if(!event.repeat)activate(trigger)}
 },true);
 document.addEventListener('proplet:account-changed',close);
 document.addEventListener('proplet:screen-changed',close);
 global.PropletAchievementDetails=Object.freeze({open,openStreak,openRank,close});
})(window);

