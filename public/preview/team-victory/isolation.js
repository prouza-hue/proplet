/* Preview-only boundary. Loaded BEFORE every production script. No real identity or persistent storage. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const NativeDate = Date, started = NativeDate.now(), simulated = NativeDate.parse('2026-09-28T09:00:00+02:00');
  class PreviewDate extends NativeDate { constructor(...args) { super(...(args.length ? args : [simulated + NativeDate.now() - started])); } static now() { return simulated + NativeDate.now() - started; } }
  window.Date = PreviewDate;
  const memoryStorage = () => { const values = new Map(); return {getItem:k=>values.get(String(k))??null,setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(String(k)),clear:()=>values.clear(),key:i=>[...values.keys()][i]??null,get length(){return values.size}}; };
  Object.defineProperty(window,'localStorage',{value:memoryStorage()});
  Object.defineProperty(window,'sessionStorage',{value:memoryStorage()});
  localStorage.setItem('proplet-v3-7-required-onboarding','done');
  localStorage.setItem('proplet-v3-settings',JSON.stringify({theme:params.get('theme')||'light',sound:false,haptics:false,wakeLock:false}));
  localStorage.setItem('proplet-v3-16-2-helper-mode','none');
  localStorage.setItem('proplet:content-release:g5-r1','1');
  localStorage.setItem('proplet-release-notes-seen:4.01.32','1');
  localStorage.setItem('proplet-release-notes-seen:3.32.3:preview-kupkovi','1');
  const demoProfile = {id:'preview-kupkovi',name:'Hráč',avatar:'🦊',token:'DEMONSTRATION-NOT-A-CREDENTIAL',familyCode:'PREVIEW',familyName:'Kupkovi',publicRankings:true,stats:{points:600,totalCompleted:20,currentStreak:0,longestStreak:0,freeCompleted:{easy:0,medium:0,hard:0,hardcore:0}}};
  localStorage.setItem('proplet-v2-profile',JSON.stringify(demoProfile));
  window.PROPLET_RUNTIME_ENV='preview';
  const audit={staticReads:[],mockReads:[],blockedWrites:[],blockedExternal:[]};
  window.PROPLET_VICTORY_PREVIEW = {audit,demoProfile,wonDate:'27. 9. 2026',today:'28. 9. 2026'};
  // A query switch exercises the exact reduced-motion branch, in addition to OS preference.
  const nativeMatch=window.matchMedia.bind(window);
  window.matchMedia=q=>q.includes('prefers-reduced-motion')&&params.get('motion')==='reduce' ? {matches:true,media:q,onchange:null,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},dispatchEvent(){return true}} : nativeMatch(q);
  if(params.get('motion')==='reduce')document.documentElement.classList.add('tv-reduced');
  if(navigator.serviceWorker)navigator.serviceWorker.register=()=>Promise.reject(new Error('Service worker disabled in visual preview'));
  navigator.sendBeacon=()=>false;
  window.WebSocket=class {constructor(){throw new Error('Network disabled in visual preview')}};
  window.EventSource=window.WebSocket;
  XMLHttpRequest.prototype.open=function(){throw new Error('XHR disabled in visual preview')};
  const nativeFetch=window.fetch.bind(window);
  const json=(value,status=200)=>Promise.resolve(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}));
  const emptyRank={players:[],teams:[],period:'today',date:'2026-09-28'};
  window.fetch=(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
    if(url.origin!==location.origin){audit.blockedExternal.push(url.pathname);return json({detail:'Pouze lokální simulace.'},403)}
    if(method!=='GET'&&method!=='HEAD'){
      audit.blockedWrites.push(url.pathname);
      if(/event|analytics|claim|attempt|client-error/.test(url.pathname))return json({preview:true,ignored:true});
      return json({detail:'V preview se změny účtů ani výsledky neodesílají.'},409);
    }
    if(['/puzzles.json','/puzzles-bootstrap.json'].includes(url.pathname)){
      audit.staticReads.push(url.pathname);return nativeFetch('/puzzles.json',{method:'GET',credentials:'omit'});
    }
    audit.mockReads.push(url.pathname);
    if(url.pathname==='/api/me')return json({profile:demoProfile,...demoProfile});
    if(url.pathname==='/api/progress')return json({completed:[],rescues:[],inProgress:[],dailyDates:[],stats:demoProfile.stats});
    if(url.pathname.startsWith('/api/rankings/')||url.pathname.includes('leaderboard'))return json(emptyRank);
    if(url.pathname==='/api/rescue-status')return json({eligible:false,state:'none'});
    if(url.pathname==='/api/free-order/config'||url.pathname==='/api/free-order')return json({enabled:false,records:{}});
    if(url.pathname==='/api/rolling-content')return json({version:1,free:{},releases:[]});
    if(url.pathname==='/api/tajenka')return json(window.PROPLET_VICTORY_TAJENKA);
    if(url.pathname.includes('push'))return json({enabled:false,available:false,subscribed:false});
    if(url.pathname.includes('config'))return json({environment:'preview',version:'5.0.0',pushAvailable:false});
    if(url.pathname==='/sw.js')return Promise.resolve(new Response(''));
    return json({preview:true,rows:[],members:[],enabled:false});
  };
  // These APIs cannot escape the static-only deployment either; keep the UI honest.
  document.addEventListener('click',e=>{const a=e.target.closest('a');if(a&&new URL(a.href,location.href).origin!==location.origin){e.preventDefault();}},true);
})();
