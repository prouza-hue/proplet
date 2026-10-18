/* Generated Preview page only. The preceding archive adapter owns all storage/API isolation. */
(()=>{
'use strict';
if(!window.PROPLET_ARCHIVE_PREVIEW)return;
const params=new URLSearchParams(location.search),mode=params.get('teamRewards')||'victory';
const gold=mode==='victory'?1:3;
localStorage.setItem('proplet:announcement:archive-extra-v1:account:archive-review','1');
sessionStorage.setItem('proplet:announcements:session:v1','1');
const history=[{id:'00000000-0000-0000-0000-000000000103',weekStart:'2026-10-12',weekEnd:'2026-10-19',teamName:'Sazeči',totalGold:gold,previousGold:gold-1,xp:27155,sharedFirst:false},
{id:'00000000-0000-0000-0000-000000000102',weekStart:'2026-10-05',weekEnd:'2026-10-12',teamName:'Sazeči',xp:24390,sharedFirst:true},
{id:'00000000-0000-0000-0000-000000000101',weekStart:'2026-09-28',weekEnd:'2026-10-05',teamName:'Písmáci',xp:21900,sharedFirst:false}].slice(0,gold);
const profile=JSON.parse(localStorage.getItem('proplet-v2-profile'));
if(profile){profile.familyCode=mode==='no-team'?null:'review-team';profile.leagueName=mode==='no-team'?null:'Sazeči';localStorage.setItem('proplet-v2-profile',JSON.stringify(profile));}
// Runtime gates are exercised only behind an adapter intercepting every API request.
Object.defineProperty(window,'PROPLET_RUNTIME_ENV',{configurable:true,get:()=> 'production',set(){}});
let seen=false;
const native=window.fetch;
window.fetch=(input,options={})=>{
 const u=new URL(typeof input==='string'?input:input.url,location.href),method=String(options.method||'GET').toUpperCase();
 const json=data=>Promise.resolve(new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}));
 if(u.origin===location.origin&&u.pathname==='/api/team-victories'&&method==='GET')return json({enabled:true,launchDate:'2026-09-28',team:mode==='no-team'?null:{code:'review-team',name:'Sazeči',totalGold:gold,competitionEligible:true},intro:{eligible:false,seen:true},pendingAward:mode==='victory'&&!seen?history[0]:null,history,previousWeekWinner:mode==='victory'});
 if(u.origin===location.origin&&u.pathname==='/api/team-victories/personal'&&method==='GET')return json({enabled:true,totalGold:gold,history});
 if(u.origin===location.origin&&u.pathname==='/api/team-victories/seen'&&method==='POST'){seen=true;return json({ok:true,firstSeen:true});}
 return native(input,options);
};
document.addEventListener('proplet:ready',()=>{
 const note=document.createElement('aside');note.className='tv-review-note';note.style.cssText='font:15px/1.4 system-ui;padding:12px;margin:0 0 12px;border:1px dashed currentColor;border-radius:12px;color:var(--td-muted)';
 note.innerHTML='<strong>Ukázková data · bez skutečných účtů</strong><br><a href="?teamRewards=victory">Oslava výhry</a> · <a href="?teamRewards=profile">Profil a trofeje</a> · <a href="?teamRewards=no-team">Po odchodu z týmu</a>';
 document.querySelector('.app-header').after(note);
 if(mode!=='victory')nav('profile');
},{once:true});
})();
