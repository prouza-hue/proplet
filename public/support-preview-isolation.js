/* Preview-only boundary, loaded before any game script. All state is in memory. */
(() => {
  'use strict';
  const fixture = window.PROPLET_SUPPORT_FIXTURES;
  const q = new URLSearchParams(location.search);
  const NativeDate = Date, started = NativeDate.now(), fixed = NativeDate.parse('2026-10-03T12:00:00+02:00');
  window.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [fixed + NativeDate.now() - started])); }
    static now() { return fixed + NativeDate.now() - started; }
  };
  const memory = () => { const values = new Map(); return {getItem:k=>values.get(String(k))??null,setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(String(k)),clear:()=>values.clear(),key:i=>[...values.keys()][i]??null,get length(){return values.size}}; };
  Object.defineProperty(window, 'localStorage', {value:memory()});
  Object.defineProperty(window, 'sessionStorage', {value:memory()});
  localStorage.setItem('proplet-v3-settings', JSON.stringify({theme:q.get('theme')||'light',sound:false,haptics:false,wakeLock:false}));
  for (const key of ['proplet-v3-7-required-onboarding','proplet-v3-16-2-helper-onboarding']) localStorage.setItem(key,'done');
  for (const key of ['proplet-v3-32-8-rule-principle-seen','proplet:content-release:g5-r1','proplet:content-release:mk100-v2','proplet:content-release:refresh300-v1']) localStorage.setItem(key,'1');
  localStorage.setItem('proplet-v3-16-2-helper-mode','none');
  localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
  localStorage.setItem('proplet-v3-26-install-nudge',JSON.stringify({done:true,installed:true}));
  localStorage.setItem('proplet-v3-8-2-push-nudge',JSON.stringify({done:true,dismissedAt:Date.now()}));
  const completed = {};
  (fixture.puzzles.free.easy||[]).slice(0,5).forEach((p,i) => {
    completed['free:'+p.id] = {puzzleId:p.id,mode:'free',difficulty:'easy',points:15,elapsedMs:90000+i*3000,moves:p.answers.length,hintsUsed:0,cleanSolve:true,contentGeneration:4,completedAt:`2026-09-${28+Math.floor(i/2)}T12:00:00Z`};
  });
  localStorage.setItem('proplet-v2-state:guest',JSON.stringify({completed,rescues:{},inProgress:{},dailyDates:[],statsVersion:5}));
  window.PROPLET_RUNTIME_ENV='preview';
  window.PROPLET_MK100_INTEGRATED_PREVIEW=true;
  window.PROPLET_FIRST_STEPS_ENABLED=false;
  const audit={mockReads:[],blockedWrites:[],blockedExternal:[],networkRequests:[]};
  window.PROPLET_SUPPORT_ISOLATION={audit,fixtureDate:'2026-10-03',payments:false,database:false};
  const json=(value,status=200)=>Promise.resolve(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}));
  window.fetch=(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
    if(url.origin!==location.origin){audit.blockedExternal.push(url.pathname);return json({preview:true,detail:'External network disabled'},403)}
    if(method!=='GET'&&method!=='HEAD'){
      audit.blockedWrites.push(url.pathname);
      if(/event|analytics|client-error|claim/.test(url.pathname))return json({preview:true,ignored:true});
      return json({preview:true,detail:'V náhledu jsou zápisy a přihlášení vypnuté.'},409);
    }
    audit.mockReads.push(url.pathname);
    if(['/puzzles.json','/puzzles-bootstrap.json','/api/puzzle-database'].includes(url.pathname))return json(fixture.puzzles);
    if(url.pathname==='/api/config')return json(fixture.config);
    if(url.pathname==='/api/tajenka')return json(fixture.tajenka);
    if(url.pathname==='/api/rolling-content')return json({version:2,asOf:'2026-10-03',puzzles:{},latestBatch:null,nextRelease:null,availableFreeCounts:{}});
    if(url.pathname==='/api/free-order/config'||url.pathname==='/api/play-session/config')return json({enabled:false});
    if(url.pathname==='/api/free-order')return json({enabled:false,records:{}});
    if(url.pathname==='/api/rescue-status')return json({eligible:false,state:'none'});
    if(url.pathname==='/api/team-victories')return json({enabled:false,team:null,intro:{eligible:false,seen:true},pendingAward:null,history:[]});
    if(url.pathname.includes('rankings')||url.pathname.includes('leaderboard'))return json({players:[],teams:[],rows:[],total:0,myRank:null});
    if(url.pathname.includes('push'))return json({enabled:false,available:false,subscribed:false});
    if(url.pathname==='/api/progress')return json({completed:[],rescues:[],inProgress:[],dailyDates:[]});
    if(url.pathname.includes('auth')||url.pathname==='/api/me'||url.pathname.includes('account'))return json({preview:true,detail:'Přihlášení je v náhledu vypnuté.'},401);
    if(url.pathname==='/sw.js')return Promise.resolve(new Response(''));
    return json({preview:true,rows:[],members:[],enabled:false});
  };
  navigator.sendBeacon=()=>false;
  window.WebSocket=class {constructor(){throw new Error('Network disabled in support preview')}};
  window.EventSource=window.WebSocket;
  XMLHttpRequest.prototype.open=function(){throw new Error('XHR disabled in support preview')};
  if(navigator.serviceWorker)navigator.serviceWorker.register=()=>Promise.resolve({waiting:null,installing:null,active:null,addEventListener(){},update:()=>Promise.resolve()});
  window.open=()=>null;
  document.addEventListener('submit',event=>{event.preventDefault();event.stopImmediatePropagation()},true);
  document.addEventListener('click',event=>{
    const link=event.target.closest('a');
    if(link&&!link.hasAttribute('download')){const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname.startsWith('/api/')){event.preventDefault();event.stopImmediatePropagation()}}
    const auth=event.target.closest('#loginBtn,#registerBtn,#googleLoginBtn,#googleRegisterBtn,#linkGoogleBtn,#progressGuardGoogleBtn,.google-auth-btn,[data-auth-google],[data-auth-open]');
    if(auth){event.preventDefault();event.stopImmediatePropagation();if(typeof toast==='function')toast('Přihlášení je v tomto náhledu vypnuté.');}
  },true);
})();
