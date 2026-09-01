#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,os,socket,subprocess,sys,time,hashlib
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; PUBLIC=ROOT/"public"; MATRIX=ROOT/"tests/current/s13b-screenshot-matrix.json"
def free_port():
 s=socket.socket();s.bind(("127.0.0.1",0));p=s.getsockname()[1];s.close();return p
def wait(url):
 end=time.time()+12
 while time.time()<end:
  try:
   if urlopen(url,timeout=1).status==200:return
  except:pass
  time.sleep(.1)
 raise RuntimeError("server")
def fixture(page,state):
 page.evaluate("""(state)=>{
  document.body.classList.remove('playing','release-notes-v3331-open');
  document.documentElement.classList.add('quality-v334');
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active','home-layout-active','settings-open','settings-guest'));
  document.querySelectorAll('.modal').forEach(x=>x.classList.add('hidden'));
  document.querySelector('.release-notes-v3331-backdrop')?.remove();
  const active=id=>{const e=document.querySelector(id);if(e)e.classList.add('active');return e};
  const rows=()=>'<div class="leader-row ranking-row"><div class="leader-rank">🥇</div><div class="leader-name"><strong>🦊 PiettraWal</strong><small>🏆 Mistr</small></div><div class="leader-score"><strong>1 240 XP</strong><small>Dnes</small></div></div><div class="leader-row ranking-row me"><div class="leader-rank">2.</div><div class="leader-name"><strong>🐲 Ty</strong><small>🔥 Expert</small></div><div class="leader-score"><strong>980 XP</strong><small>Dnes</small></div></div>';
  if(state==='daily'){
   const s=active('#screen-daily');s.classList.add('home-layout-active');
   document.querySelector('#dailyDate').textContent='Úterý 1. září';
   document.querySelector('#dailyMeta').textContent='Střední · +100 XP';
   document.querySelector('#dailyWeekRhythm').innerHTML='<div class="daily-week-rhythm-head"><strong>Tento týden</strong><span>2 / 7</span></div><div class="daily-week-days"><span class="daily-week-day done"><b>Po</b><i>✓</i></span><span class="daily-week-day today"><b>Út</b><i>🧠</i></span><span class="daily-week-day"><b>St</b><i>🧠</i></span><span class="daily-week-day"><b>Čt</b><i>🧠</i></span><span class="daily-week-day"><b>Pá</b><i>🧠</i></span><span class="daily-week-day"><b>So</b><i>🔥</i></span><span class="daily-week-day"><b>Ne</b><i>🔥</i></span></div>';
   document.querySelector('#quickPlayGrid').innerHTML=['easy','medium','hard','hardcore'].map((d,i)=>'<button class="home-diff-tile" data-diff="'+d+'"><span class="home-diff-top"><span class="home-diff-icon-wrap">🧩</span><strong>'+['Snadná','Střední','Těžká','Mozkožrout'][i]+'</strong><b class="home-diff-xp">+'+[15,25,50,100][i]+' XP</b></span><span class="home-diff-meta"><b>Další: '+(i+2)+'</b><span>'+(12+i*5)+' / 200</span></span><i class="home-diff-progress"><b style="width:'+(10+i*12)+'%"></b></i></button>').join('');
   document.querySelector('#levelCard').innerHTML='<div class="home-competition-card"><div class="home-competition-head"><h2>Tvoje dnešní pozice</h2></div><div class="home-competition-self">🥈 2. místo</div></div>';
  } else if(state==='free'){
   active('#screen-free');
   document.querySelector('#difficultyCards').innerHTML=['easy','medium','hard','hardcore'].map((d,i)=>'<article class="difficulty-card" data-difficulty="'+d+'"><div class="difficulty-icon">🧩</div><h2>'+['Snadná','Střední','Těžká','Mozkožrout'][i]+'</h2><p>'+[15,25,50,100][i]+' XP za novou úroveň</p><span class="xp-chip">+'+[15,25,50,100][i]+' XP</span><button class="secondary-btn">Hrát</button></article>').join('');
  } else if(state==='rankings'){
   active('#screen-leaderboard');
   document.querySelector('#dailyLeaderboardList').innerHTML=rows();
   document.querySelector('#xpLeaderboardList').innerHTML=rows();
   document.querySelector('#rankingTeamCard').innerHTML='<div class="section-head"><div><span class="eyebrow">TVŮJ TÝM</span><h2>Propletači</h2></div></div><p>3 členové · 2 420 XP</p>';
  } else if(state==='profile'||state==='settings'){
   const s=active('#screen-profile');
   document.querySelector('#profileCard').innerHTML='<div class="profile-summary"><div class="profile-identity"><div class="profile-avatar-big">🐲</div><div><div class="profile-name">Pavel</div><div class="profile-family">Tým: Propletači</div></div></div><div class="streak-bubble"><span class="streak-icon">🔥</span><strong>12</strong><small>dní</small></div></div><div class="profile-grid"><div class="profile-stat"><span class="stat-label">XP</span><strong>4 250</strong></div><div class="profile-stat profile-rank-stat"><span class="stat-label">Hodnost</span><div class="profile-rank-value"><span>🏆</span><strong>8 · Mistr</strong></div></div><div class="profile-stat profile-stat-wide"><span class="stat-label">Hotovo</span><div class="profile-completion-grid"><span><b>82</b><small>🌱 Snadná</small></span><span><b>54</b><small>🧠 Střední</small></span></div></div></div>';
   document.querySelector('#levelRoadmap').innerHTML='<div class="level-step"><span class="level-step-icon">🏆</span><strong>Mistr</strong><small>4 000 XP</small><b class="level-num">8</b></div><div class="level-step"><span class="level-step-icon">👑</span><strong>Legenda</strong><small>6 000 XP</small><b class="level-num">9</b></div>';
   document.querySelector('#achievementSummary').innerHTML='<div class="achievement-summary-copy"><strong>18 z 30</strong><small>úspěchů odemčeno</small></div><div class="achievement-summary-icons">🏅🔥🧠</div>';
   document.querySelector('#profileBadges').innerHTML='<div class="profile-badge"><span class="emoji">🔥</span><strong>7 dní</strong><small>Série</small></div><div class="profile-badge"><span class="emoji">🏆</span><strong>Top 10</strong><small>Pořadí</small></div>';
   if(state==='settings'){
    s.classList.add('settings-open');
    let h=document.querySelector('#profileSettingsHeader');if(!h){h=document.createElement('div');h.id='profileSettingsHeader';h.className='profile-settings-header';h.innerHTML='<button class="profile-settings-back">← Já</button><div class="profile-settings-heading"><h1>Nastavení</h1><p>Hraní, vzhled, účet a soukromí.</p></div>';s.prepend(h)}
    document.querySelector('#soundToggle')?.closest('.settings-card')?.classList.add('settings-gameplay-card');
    let p=document.querySelector('#settingsPrivacyCard');if(!p){p=document.createElement('div');p.id='settingsPrivacyCard';p.className='card settings-card settings-privacy-card';p.innerHTML='<div class="settings-privacy-line"><span class="settings-privacy-icon">👀</span><div class="settings-privacy-copy"><strong>Soukromí a pořadí</strong><small>Veřejný profil · herní jméno a avatar.</small></div><button class="settings-privacy-action">Změnit</button></div>';s.appendChild(p)}
   }
  } else if(state==='onboarding'){
   const m=document.querySelector('#onboardingModal');m.classList.remove('hidden');
   document.querySelector('#onboardDots').innerHTML='<i class="active"></i><i></i><i></i>';
   document.querySelector('#onboardContent').innerHTML='<div class="onboard-content onboard-principle"><span class="eyebrow">JAK FUNGUJE PROPLET</span><h2>Jedna deska. Jedno řešení.</h2><div class="principle-board-demo"><div class="mini-demo-board"><div class="mini-board-grid">'+Array.from({length:25},(_,i)=>'<span class="mini-cell '+(i<5?'mini-target-a':'')+'">'+String.fromCharCode(65+i%8)+'</span>').join('')+'</div><div class="principle-word-chips"><span class="demo-word demo-word-a">MANGO</span><span class="demo-word demo-word-b">SALÁT</span></div></div></div><p class="principle-copy">Najdi slova, která společně vyplní celou plochu.</p></div>';
  } else if(state==='profile-modal'){
   const m=document.querySelector('#profileModal');m.classList.remove('hidden');
   let b=document.querySelector('#googlePrimaryBlock');if(!b){b=document.createElement('section');b.id='googlePrimaryBlock';b.className='google-primary-auth';b.innerHTML='<div class="google-primary-head"><span>NEJRYCHLEJŠÍ PŘIHLÁŠENÍ</span><small>pár vteřin</small></div><button class="google-auth-btn">G Přihlásit přes Google</button><small class="google-primary-note">Bez vyplňování jména a hesla.</small>';document.querySelector('#profileModalDesc').after(b)}
  } else if(state==='release-modal'){
   const b=document.createElement('div');b.className='release-notes-v3331-backdrop visible';b.innerHTML='<section class="release-notes-v3331-panel"><button class="release-notes-v3331-close">×</button><div class="release-notes-v3331-art"><span class="release-notes-v3331-tile tile-p">P</span><span class="release-notes-v3331-tile tile-l">L</span><span class="release-notes-v3331-tile tile-t">T</span></div><h2>Novinky v Propletu</h2><div class="release-notes-v3331-features"><div class="release-notes-v3331-feature feature-tajenka"><span class="release-notes-v3331-icon">🧩</span><div><strong>Tajenka</strong><span>Nová každou sobotu</span></div></div><div class="release-notes-v3331-feature feature-mozkomor"><span class="release-notes-v3331-icon">🧠</span><div><strong>Mozkomor</strong><span>100 nových úrovní</span></div></div></div><button class="release-notes-v3331-account">Jdu hrát</button></section>';document.body.appendChild(b);document.body.classList.add('release-notes-v3331-open');
  }
 }""",state)
 page.wait_for_timeout(180)
def metrics(page,case):
 return page.evaluate("""(id)=>{const r=e=>{if(!e)return null;const x=e.getBoundingClientRect();return{x:+x.x.toFixed(2),y:+x.y.toFixed(2),width:+x.width.toFixed(2),height:+x.height.toFixed(2)}};const active=document.querySelector('.screen.active'),modal=document.querySelector('.modal:not(.hidden) .modal-card,.release-notes-v3331-panel');const primary=active?.querySelector('.daily-hero,.difficulty-card,.ranking-section,.profile-card,.settings-card');return{caseId:id,theme:document.documentElement.dataset.theme||null,themePreference:document.documentElement.dataset.themePreference||null,overflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth,appShell:r(document.querySelector('.app-shell')),active:r(active),screenTitle:r(active?.querySelector('.screen-title')),primary:r(primary),modal:r(modal),firstRow:r(active?.querySelector('.leader-row,.home-diff-tile,.profile-stat,.settings-row')),loadedStyles:[...document.styleSheets].map(s=>{try{return new URL(s.href).pathname}catch{return null}}).filter(Boolean)}}""",case["id"])
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--output",type=Path,required=True);ap.add_argument("--public-root",type=Path,default=PUBLIC);args=ap.parse_args()
 out=args.output.resolve();out.mkdir(parents=True,exist_ok=True);port=free_port()
 srv=subprocess.Popen([sys.executable,"-m","http.server",str(port),"--bind","127.0.0.1","--directory",str(args.public_root.resolve())],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  base=f"http://127.0.0.1:{port}";wait(base+"/")
  matrix=json.loads(MATRIX.read_text());res={}
  with sync_playwright() as pw:
   chrome=next((p for p in ("/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium") if os.path.exists(p)),None)
   browser=pw.chromium.launch(headless=True,executable_path=chrome,args=["--no-sandbox","--disable-dev-shm-usage","--disable-font-subpixel-positioning","--font-render-hinting=none","--disable-lcd-text"] if chrome else [])
   for case in matrix["cases"]:
    w,h=case["viewport"];sw,sh=case["screen"];touch=w<900
    ctx=browser.new_context(viewport={"width":w,"height":h},screen={"width":sw,"height":sh},has_touch=touch,is_mobile=touch,service_workers="block",device_scale_factor=1,color_scheme=case["system"],reduced_motion=case["motion"])
    pref=case["theme"];ctx.add_init_script(script=f"""()=>{{localStorage.setItem('proplet-v3-settings',JSON.stringify({{theme:{json.dumps(pref)}}}));localStorage.setItem('proplet-onboarding-v1','done');localStorage.setItem('proplet-helper-onboarding-v1','done');sessionStorage.setItem('proplet-gen4-release-modal-v1','1')}}""")
    p=ctx.new_page();errs=[];p.on("pageerror",lambda e,bag=errs:bag.append(str(e)));p.goto(base,wait_until="domcontentloaded",timeout=30000);p.wait_for_timeout(900)
    p.evaluate("""()=>{document.querySelector('#qualityReleaseModal')?.classList.add('hidden');document.querySelector('.release-notes-v3331-backdrop')?.remove();document.documentElement.classList.remove('gen4-preview-booting')}""")
    p.add_style_tag(content="*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}")
    safe=case.get("safe",{});top=safe.get("top",0);bottom=safe.get("bottom",0)
    if top or bottom:p.add_style_tag(content=f"body:not(.playing) .app-shell{{padding-top:calc({top}px + 10px)!important;padding-bottom:calc({bottom}px + 12px)!important}}")
    fixture(p,case["state"]);p.evaluate("()=>document.fonts?.ready");p.wait_for_timeout(250)
    m=metrics(p,case)
    if m["overflowX"]>1:raise AssertionError(f"{case['id']} overflow {m['overflowX']}")
    shot=out/f"{case['id']}.png";p.screenshot(path=str(shot),full_page=True,animations="disabled")
    if errs:raise AssertionError(f"{case['id']} page errors {errs}")
    res[case["id"]]={"sha256":hashlib.sha256(shot.read_bytes()).hexdigest(),"metrics":m};ctx.close()
   browser.close()
  (out/"summary.json").write_text(json.dumps({"schema_version":1,"matrix":matrix,"results":res},indent=2)+"\n")
 finally:
  srv.terminate()
 return 0
if __name__=="__main__":raise SystemExit(main())
