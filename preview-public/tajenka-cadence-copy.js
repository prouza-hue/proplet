(()=>{
  'use strict';
  if(window.__PROPLET_TAJENKA_CADENCE_COPY__)return;
  window.__PROPLET_TAJENKA_CADENCE_COPY__=true;

  function pragueWeekday(){
    try{
      return new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Prague',weekday:'short'}).format(new Date());
    }catch{
      return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
    }
  }

  function nextTajenkaCopy(){
    const day=pragueWeekday();
    return ['Sat','Sun','Mon','Tue'].includes(day)
      ? 'Další tajenka přijde ve středu.'
      : 'Další tajenka přijde v sobotu.';
  }

  function apply(){
    const text=nextTajenkaCopy();
    document.querySelectorAll('#tajenkaPreviewCard .tajenka-entry-next, #tajenkaPlayCard .tajenka-entry-next').forEach(el=>{
      if(el.textContent!==text)el.textContent=text;
    });
  }

  const observer=new MutationObserver(apply);
  const start=()=>{
    apply();
    observer.observe(document.body,{childList:true,subtree:true});
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
