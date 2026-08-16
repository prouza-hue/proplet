from pathlib import Path

APP = Path('public/app.js')
SW = Path('public/sw.js')
SERVER = Path('server.py')

app = APP.read_text(encoding='utf-8')
sw = SW.read_text(encoding='utf-8')
server = SERVER.read_text(encoding='utf-8')

assert "const APP_VERSION='3.28.2';" in app
assert 'async function boot(){' in app
assert "puzzleDB=await fetch('/puzzles.json',{cache:'no-store'})" in app
assert "const CACHE='proplet-v3.28.2-played-title-text-only';" in sw
assert "if(u.pathname.startsWith('/api/'))return;" in sw
assert 'APP_VERSION = "3.28.2"' in server

app = app.replace("const APP_VERSION='3.28.2';", "const APP_VERSION='3.28.3';", 1)

helper = r'''const EXPECTED_PUZZLE_DB_VERSION=9;
function showPuzzleBootLoading(){
 const dailyMeta=$('#dailyMeta');if(dailyMeta&&!dailyMeta.textContent)dailyMeta.textContent='Načítám dnešní výzvu…';
 const grid=$('#difficultyCards');if(grid&&!grid.children.length)grid.innerHTML='<div class="card" style="grid-column:1/-1;padding:24px"><strong>Načítám úrovně…</strong><p class="muted" style="margin:6px 0 0">Připravuju herní banku.</p></div>';
}
async function loadPuzzleDatabase(){
 const url='/puzzles.json';
 if('caches' in window){
  try{
   const cached=await caches.match(url,{ignoreSearch:true});
   if(cached){
    const data=await cached.clone().json();
    if(data?.version===EXPECTED_PUZZLE_DB_VERSION){
     // Start neblokujeme sítí. Aktuální banku si tiše ověříme na pozadí;
     // service worker zároveň uloží čerstvou odpověď do své cache.
     fetch(url,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(fresh=>{
      if(fresh?.version===EXPECTED_PUZZLE_DB_VERSION){puzzleDB=fresh;renderDaily();renderFree()}
     }).catch(()=>{});
     return data;
    }
   }
  }catch{}
 }
 const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('puzzle-db');
 const data=await r.json();if(data?.version!==EXPECTED_PUZZLE_DB_VERSION)throw new Error('puzzle-db-version');return data;
}

'''
app = app.replace('async function boot(){', helper + 'async function boot(){', 1)
old_boot = """async function boot(){
 applyTheme(getSettings().theme);
 try{puzzleDB=await fetch('/puzzles.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()})}catch{$('body').innerHTML='<main style=\"padding:30px;font-family:system-ui\"><h1>Proplet</h1><p>Nepodařilo se načíst databázi úloh. Spusť aplikaci přes server podle README.</p></main>';return}
"""
new_boot = """async function boot(){
 applyTheme(getSettings().theme);showPuzzleBootLoading();
 try{puzzleDB=await loadPuzzleDatabase()}catch{$('body').innerHTML='<main style=\"padding:30px;font-family:system-ui\"><h1>Proplet</h1><p>Nepodařilo se načíst databázi úloh. Zkontroluj připojení a zkus stránku obnovit.</p></main>';return}
"""
assert old_boot in app
app = app.replace(old_boot, new_boot, 1)

sw = sw.replace("const CACHE='proplet-v3.28.2-played-title-text-only';", "const CACHE='proplet-v3.28.3-fast-puzzle-boot';", 1)
old_fetch = """  if(u.pathname.startsWith('/api/'))return; // API se nikdy necachuje.
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{
    const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;
  }).catch(()=>caches.match(e.request)));
"""
new_fetch = """  if(u.pathname.startsWith('/api/'))return; // API se nikdy necachuje.
  if(u.pathname==='/puzzles.json'){
    // Herní banka je velká a mění se jen s releasem. Start aplikace proto nikdy
    // neblokujeme sítí: použijeme cache a čerstvou kopii obnovíme na pozadí.
    e.respondWith(caches.match(e.request).then(cached=>{
      const refresh=fetch(e.request,{cache:'no-store'}).then(r=>{
        if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}
        return r;
      });
      if(cached){e.waitUntil(refresh.catch(()=>{}));return cached;}
      return refresh;
    }).catch(()=>fetch(e.request,{cache:'no-store'})));
    return;
  }
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{
    const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;
  }).catch(()=>caches.match(e.request)));
"""
assert old_fetch in sw
sw = sw.replace(old_fetch, new_fetch, 1)
server = server.replace('APP_VERSION = "3.28.2"', 'APP_VERSION = "3.28.3"', 1)

APP.write_text(app, encoding='utf-8')
SW.write_text(sw, encoding='utf-8')
SERVER.write_text(server, encoding='utf-8')
print('v3.28.3 fast boot patch applied')
