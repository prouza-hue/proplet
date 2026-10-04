/* PREVIEW ONLY. No production server, database, tokens or outbound API traffic. */
(() => {
 'use strict';
 const q=new URLSearchParams(location.search), fixture=window.PROPLET_REFERRAL_FIXTURES;
 const nativeFetch=window.fetch.bind(window);
 const memory=()=>{const m=new Map();return {getItem:k=>m.get(String(k))??null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>[...m.keys()][i]??null,get length(){return m.size}}};
 Object.defineProperty(window,'localStorage',{value:memory()});
 Object.defineProperty(window,'sessionStorage',{value:memory()});
 const NativeDate=Date,started=NativeDate.now(),fixed=NativeDate.parse('2026-10-04T12:00:00+02:00');
 window.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:[fixed+NativeDate.now()-started]))}static now(){return fixed+NativeDate.now()-started}};
 const incoming=q.has('invite')||['new','four','reward'].includes(q.get('view'));
 const view=incoming?(q.get('view')||'new'):'inviter';
 const model={view,incoming,accepted:incoming&&view!=='new',paid:incoming&&view==='reward',count:incoming?(view==='four'?4:view==='reward'?5:0):0,seen:new Set(),inviterName:'Katka',name:incoming?'Eliška':'Katka',base:incoming?500:2150,weeklyBase:incoming?0:230,gameXp:0,referrals:[{name:'Eliška',count:3,accepted:true,paid:false},{name:'Honza',count:0,accepted:false,paid:false},{name:'Petr',count:5,accepted:true,paid:true}]};
 const audit={fixtureReads:[],fixtureWrites:[],blockedExternal:[],staticRequests:[]};
 const api=window.PropletReferralPreview={model,audit,database:false,productionApi:false,revision:3};
 const ownBonus=()=>incoming?(model.paid?1000:0):model.referrals.filter(r=>r.paid).length*1000;
 api.stats=()=>{
   let rows=[];try{rows=Object.values(JSON.parse(localStorage.getItem('proplet-v2-state:'+api.profile().id)||'{}').completed||{})}catch{}
   const tajenkas=typeof window.tajenkaState==='function'?Object.values(window.tajenkaState()?.completions||{}):[];
   const gameXp=rows.reduce((n,r)=>n+(Number(r.points)||0),0)+tajenkas.reduce((n,r)=>n+(Number(r.rewardXp)||0),0);
   return {points:model.base+gameXp+ownBonus(),totalCompleted:rows.length+tajenkas.length,dailyCompleted:rows.filter(r=>r.mode==='daily').length,freeCompleted:{easy:rows.filter(r=>r.mode==='free'&&r.difficulty==='easy').length},currentStreak:0,longestStreak:0,cleanSolves:rows.length,accountCreationBonusXp:incoming?500:0,referralBonusXp:ownBonus(),weeklyXp:model.weeklyBase+gameXp,weeklyTeamXp:model.weeklyBase+gameXp};
 };
 api.profile=()=>({id:incoming?'preview-elis':'preview-katka',token:'PREVIEW-LOCAL-ONLY',name:model.name,avatar:incoming?'🦊':'🦉',familyCode:null,leagueName:null,hasPassword:true,publicRankings:true,supportMode:'none'});
 api.snapshot=()=>({...api.profile(),stats:api.stats(),completed:[],cursor:new Date().toISOString()});
 api.complete=(game)=>{
   if(!incoming||!model.accepted||game.isReplay||!['daily','free','tajenka'].includes(game.mode)||!(Number(game.winBaseXpAwarded)>0||game.mode==='tajenka'&&game.justCompleted))return false;
   const id=game.puzzle.id;if(model.seen.has(id))return false;model.seen.add(id);model.count=Math.min(5,model.count+1);
   const newlyPaid=model.count===5&&!model.paid;if(newlyPaid)model.paid=true;return newlyPaid;
 };
 api.seed=()=>{
   const completed={};const n=incoming?model.count:0;
   for(let i=0;i<n;i++){
    const id='g4-e-'+String(i+1).padStart(3,'0');model.seen.add(id);
    completed['free:'+id]={puzzleId:id,challengeKey:'free:'+id,mode:'free',difficulty:'easy',level:i+1,contentGeneration:4,points:15,elapsedMs:90000,moves:4,hintsUsed:0,cleanSolve:true,completedAt:new Date().toISOString()};
   }
   localStorage.setItem('proplet-v2-state:'+api.profile().id,JSON.stringify({completed,inProgress:{},rescues:{},dailyDates:[],statsVersion:5}));
   if(!incoming||model.accepted)localStorage.setItem('proplet-v2-profile',JSON.stringify({...api.profile(),stats:api.stats()}));
 };
 localStorage.setItem('proplet-v3-settings',JSON.stringify({theme:q.get('theme')||'light',sound:false,haptics:false,wakeLock:false}));
 for(const key of ['proplet-v3-7-required-onboarding','proplet-v3-16-2-helper-onboarding'])localStorage.setItem(key,'done');
 for(const key of ['proplet-v3-32-8-rule-principle-seen','proplet:content-release:g5-r1','proplet:content-release:mk100-v2','proplet:content-release:refresh300-v1'])localStorage.setItem(key,'1');
 localStorage.setItem('proplet-v3-16-2-helper-mode','none');
 localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));
 localStorage.setItem('proplet-v3-26-install-nudge',JSON.stringify({done:true,installed:true}));
 localStorage.setItem('proplet-v3-8-2-push-nudge',JSON.stringify({done:true,dismissedAt:Date.now()}));
 localStorage.setItem('proplet-v3-5-account-nudge',JSON.stringify({shown:[1,2,3]}));
 api.seed();
 for(const id of ['preview-katka','preview-elis'])localStorage.setItem('proplet:content-release:refresh300-v1:account:'+id,'1');
 window.PropletContentAnnouncementShown=api.profile().id;
 window.PROPLET_RUNTIME_ENV='preview';window.PROPLET_MK100_INTEGRATED_PREVIEW=true;window.PROPLET_FIRST_STEPS_ENABLED=false;
 const json=(value,status=200)=>Promise.resolve(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}));
 window.fetch=(input,options={})=>{
  const url=new URL(typeof input==='string'||input instanceof URL?String(input):input.url,location.href);
  const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  if(url.origin!==location.origin){audit.blockedExternal.push(url.hostname);return json({detail:'Externí spojení je v náhledu vypnuté.'},403)}
  if(!url.pathname.startsWith('/api/')){
   if(method!=='GET'&&method!=='HEAD')return json({preview:true},410);
   if(url.pathname==='/sw.js')return json({},410);
   audit.staticRequests.push(url.pathname);return nativeFetch(input,options);
  }
  (method==='GET'?audit.fixtureReads:audit.fixtureWrites).push(url.pathname);
  if(url.pathname==='/api/config')return json(fixture.config);
  if(url.pathname==='/api/tajenka')return json(fixture.tajenka);
  if(url.pathname==='/api/player'&&method==='POST'){
   if(model.accepted||!incoming)return json({detail:'Použij nový testovací scénář.'},409);
   let body={};try{body=JSON.parse(options.body||'{}')}catch{}
   model.name=String(body.name||'Eliška').slice(0,24);model.accepted=true;
   // Password is ignored, never stored, logged, sent or persisted.
   queueMicrotask(()=>document.dispatchEvent(new CustomEvent('proplet:referral-accepted')));
   return json({...api.profile(),stats:api.stats(),accountCreated:true});
  }
  if(url.pathname==='/api/account/snapshot'||url.pathname==='/api/me')return json(api.snapshot());
  if(url.pathname==='/api/rankings/xp'){
   const stats=api.stats(),period=url.searchParams.get('period'),all=period==='all';
   const mine={...api.profile(),xp:all?stats.points:stats.weeklyXp,lifetimePoints:stats.points,isMine:true,rank:2};
   const other={name:incoming?'Katka':'Eliška',avatar:'🦉',xp:all?(incoming?3150+(model.paid?1000:0):1560):230,lifetimePoints:3150,isMine:false,rank:1};
   const players=[other,mine].sort((a,b)=>b.xp-a.xp).map((p,i)=>({...p,rank:i+1}));
   return json({players,teams:[{name:'Slovní parta',memberCount:3,rank:1,xp:stats.weeklyTeamXp,isMine:true}],visibilityReady:true});
  }
  if(url.pathname.includes('rankings')||url.pathname.includes('leaderboard'))return json({players:[],teams:[],rows:[],total:0,myRank:null});
  if(url.pathname==='/api/rolling-content')return json({version:2,asOf:'2026-10-04',puzzles:{},latestBatch:null,nextRelease:null,availableFreeCounts:{}});
  if(url.pathname==='/api/free-order/config'||url.pathname==='/api/play-session/config'||url.pathname==='/api/free-order')return json({enabled:false,records:{}});
  if(url.pathname==='/api/rescue-status')return json({eligible:false,state:'none'});
  if(url.pathname==='/api/team-victories')return json({enabled:false,team:null,intro:{eligible:false,seen:true},pendingAward:null,history:[]});
  if(url.pathname==='/api/progress')return json({completed:[],rescues:[],inProgress:[],dailyDates:[]});
  if(url.pathname.includes('push'))return json({enabled:false,available:false,subscribed:false});
  if(url.pathname.includes('claim')||/event|analytics|client-error|attempt/.test(url.pathname))return json({preview:true,ignored:true,claimed:true,ok:true,events:[]});
  if(url.pathname==='/api/admin/access')return json({allowed:false});
  if(method!=='GET'&&method!=='HEAD')return json({preview:true,detail:'Tato akce je v náhledu vypnutá.'},409);
  return json({preview:true,rows:[],members:[],leagues:[],enabled:false});
 };
 navigator.sendBeacon=()=>false;
 window.WebSocket=class{constructor(){throw new Error('External network disabled in referral preview')}};
 window.EventSource=window.WebSocket;
 XMLHttpRequest.prototype.open=function(){throw new Error('XHR disabled in referral preview')};
 if(navigator.serviceWorker)navigator.serviceWorker.register=()=>Promise.resolve({waiting:null,installing:null,active:null,addEventListener(){},update:()=>Promise.resolve()});
 window.open=()=>null;
 document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation()},true);
 document.addEventListener('click',e=>{
  const link=e.target.closest('a');
  if(link&&!link.hasAttribute('download')){
   const url=new URL(link.href,location.href);
   if(url.origin!==location.origin||url.pathname.startsWith('/api/')){e.preventDefault();e.stopImmediatePropagation()}
  }
  if(e.target.closest('#googleLoginBtn,#googleRegisterBtn,#linkGoogleBtn,#progressGuardGoogleBtn,.google-auth-btn,[data-auth-google],[data-auth-open]')){
   e.preventDefault();e.stopImmediatePropagation();window.showToast?.('V náhledu použij testovací účet.');
  }
 },true);
})();
