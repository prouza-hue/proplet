/* Move existing controls, preserving listeners, navigation and the playing shell. */
(()=>{
  function mount(){
    const header=document.querySelector('.app-header'),nav=document.querySelector('.bottom-nav');
    if(header&&nav&&nav.parentElement!==header)header.append(nav);
    const hero=document.querySelector('#screen-daily .daily-hero'),week=document.getElementById('dailyWeekRhythm');
    if(hero&&week&&week.parentElement!==hero)hero.append(week);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
