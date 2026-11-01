(function(root,factory){
  'use strict';
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PropletInAppBrowserHelp=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  // A generic Android WebView signature does not identify Instagram or Facebook.
  function context(userAgent=root.navigator?.userAgent||''){
    const ua=String(userAgent);
    const app=/\bInstagram(?:\s|\/)[\d.]+/i.test(ua)?'Instagram':
      /\b(?:FBAN\/(?:FB4A|FBIOS)|FB_IAB\/FB4A)\b/i.test(ua)?'Facebook':null;
    return app?{app,browser:/\b(?:iPhone|iPad|iPod)\b|FBAN\/FBIOS/i.test(ua)?'Safari':'Chrome'}:null;
  }

  function markup(info){
    return '<summary>Snazší přihlášení přes Google</summary>'+
      '<div class="in-app-browser-help-body"><p>Proplet máš otevřený uvnitř '+info.app+'u. Google tu může chtít znovu zadat přihlašovací údaje. Pro jednodušší přihlášení zkus svůj běžný prohlížeč.</p>'+
      '<ol><li>V horní liště aplikace klepni na menu <b aria-label="tři tečky">⋮</b>.</li>'+
      '<li>Zvol <b>Otevřít v prohlížeči</b>, případně <b>Otevřít v '+info.browser+'</b>. Název a umístění volby se mohou lišit.</li></ol>'+
      '<p class="in-app-browser-progress-note"><strong>Rozpracovaná hra a postup bez účtu se automaticky nepřenesou.</strong> Postup bez účtu si nejdřív ulož přezdívkou a heslem tady. V běžném prohlížeči se pak přihlas stejnou přezdívkou a heslem. Google můžeš propojit až ve svém uloženém účtu.</p></div>';
  }

  function mount(button,{id,hidden=false,userAgent}={}){
    if(!button?.id||!button.parentElement)return null;
    const info=context(userAgent),document=button.ownerDocument||root.document;
    const helpId=id||button.id+'BrowserHelp';
    let help=document.getElementById(helpId);
    if(!info){help?.remove();return null}
    if(!help){
      help=document.createElement('details');help.id=helpId;
      help.className='in-app-browser-help';help.innerHTML=markup(info);
    }
    help.classList.toggle('hidden',hidden);
    // The profile UI moves its Google button; keep the optional help beside it.
    if(button.nextElementSibling!==help)button.insertAdjacentElement('afterend',help);
    return help;
  }

  return Object.freeze({context,mount});
});
