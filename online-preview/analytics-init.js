(()=>{
  'use strict';
  window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};
  window.va('beforeSend',event=>{
    try{
      const url=new URL(event.url);
      url.search='';
      url.hash='';
      return {...event,url:url.toString()};
    }catch{return event}
  });
  window.si=window.si||function(){(window.siq=window.siq||[]).push(arguments)};
})();
