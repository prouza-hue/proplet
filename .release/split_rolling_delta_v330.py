from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f"{label}: expected one match, got {n}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, repl: str, label: str) -> str:
    out, n = re.subn(pattern, repl, text, count=1, flags=re.S)
    if n != 1:
        raise RuntimeError(f"{label}: expected one regex match, got {n}")
    return out


server = read("server.py")
server = replace_once(
    server,
    '    if request.url.path == "/api/puzzles":\n        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=86400"\n',
    '    if request.url.path == "/api/rolling-content":\n        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=86400"\n',
    "rolling delta cache header",
)

rolling_payload = r'''

def released_rolling_payload(as_of: date) -> dict:
    """Only the release-gated Free additions; the large base bank stays on the CDN."""
    source = load_puzzles()
    released_batches, next_release = _released_batches(as_of)
    latest = released_batches[-1] if released_batches else None
    additions = {
        d: [
            p for p in source.get("free", {}).get(d, [])
            if (p.get("meta") or {}).get("rollingContent") and is_puzzle_released(p, as_of)
        ]
        for d in ("easy", "medium", "hard", "hardcore")
    }
    rolling = dict(source.get("rollingContent") or {})
    rolling.pop("batches", None)
    return {
        "version": int(rolling.get("version") or 0),
        "asOf": as_of.isoformat(),
        "latestBatch": latest,
        "nextRelease": next_release,
        "puzzles": additions,
        "availableFreeCounts": {d: 200 + len(additions[d]) for d in additions},
        "meta": rolling,
    }
'''
server = replace_once(
    server,
    '    return payload\n\n\ndef push_preferences_schema_ready()',
    '    return payload\n' + rolling_payload + '\n\ndef push_preferences_schema_ready()',
    "rolling delta payload helper",
)
server = replace_once(
    server,
    '@app.get("/api/puzzles")\ndef public_puzzle_bank(request: Request, preview_as_of: Optional[str] = Query(default=None, max_length=10)):\n    """Release-gated puzzle bank. Future reserve content stays server-side."""\n    as_of = effective_content_date(request, preview_as_of)\n    return released_puzzle_payload(as_of)\n',
    '@app.get("/api/rolling-content")\ndef public_rolling_content(request: Request, preview_as_of: Optional[str] = Query(default=None, max_length=10)):\n    """Small release-gated delta. Future reserve content stays server-side."""\n    as_of = effective_content_date(request, preview_as_of)\n    return released_rolling_payload(as_of)\n',
    "rolling delta endpoint",
)
write("server.py", server)


app = read("public/app.js")
loader_and_delta = r'''const EXPECTED_PUZZLE_DB_VERSION=10;
const CONTENT_PREVIEW_DATE=typeof location!=='undefined'?String(new URLSearchParams(location.search).get('contentPreview')||'').slice(0,10):'';
function contentWeekKey(iso=CONTENT_PREVIEW_DATE||pragueDateISO()){return addDaysISO(iso,-mondayWeekdayIndex(iso))}
function rollingContentUrl(){const asOf=CONTENT_PREVIEW_DATE||pragueDateISO(),week=contentWeekKey(asOf),q=new URLSearchParams({week});if(CONTENT_PREVIEW_DATE)q.set('preview_as_of',CONTENT_PREVIEW_DATE);return `/api/rolling-content?${q.toString()}`}
function showPuzzleBootLoading(){
 const dailyMeta=$('#dailyMeta');if(dailyMeta&&!dailyMeta.textContent)dailyMeta.textContent='Načítám dnešní výzvu…';
 const grid=$('#difficultyCards');if(grid&&!grid.children.length)grid.innerHTML='<div class="card" style="grid-column:1/-1;padding:24px"><strong>Načítám úrovně…</strong><p class="muted" style="margin:6px 0 0">Připravuju herní banku.</p></div>';
}
async function loadPuzzleDatabase(){
 const url='/puzzles.json';
 if('caches' in window){
  try{const cached=await caches.match(url,{ignoreSearch:true});if(cached){const data=await cached.clone().json();if(data?.version===EXPECTED_PUZZLE_DB_VERSION){fetch(url,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(fresh=>{if(fresh?.version===EXPECTED_PUZZLE_DB_VERSION){const content=puzzleDB?.contentStatus;puzzleDB=fresh;if(content)puzzleDB.contentStatus=content;renderDaily();renderFree()}}).catch(()=>{});return data}}}catch{}
 }
 const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('puzzle-db');const data=await r.json();if(data?.version!==EXPECTED_PUZZLE_DB_VERSION)throw new Error('puzzle-db-version');return data;
}
function mergeRollingContent(delta){
 if(!puzzleDB||Number(delta?.version||0)!==1)return false;
 for(const diff of Object.keys(DIFF)){
  const base=puzzleDB.free?.[diff]||[],incoming=delta.puzzles?.[diff]||[],seen=new Set(base.map(p=>p.id));
  for(const p of incoming)if(!seen.has(p.id)){base.push(p);seen.add(p.id)}
  base.sort((a,b)=>(Number(a.meta?.level)||9999)-(Number(b.meta?.level)||9999));puzzleDB.free[diff]=base;
 }
 puzzleDB.rollingContent={...(puzzleDB.rollingContent||{}),...(delta.meta||{})};
 puzzleDB.contentStatus={asOf:delta.asOf,latestBatch:delta.latestBatch||null,nextRelease:delta.nextRelease||null,availableFreeCounts:delta.availableFreeCounts||{}};
 return true;
}
function renderAfterRollingContent(){renderDaily();renderFree();renderProfile()}
async function refreshRollingContent(){
 const url=rollingContentUrl(),headers=CONTENT_PREVIEW_DATE?{'X-Proplet-Preview-As-Of':CONTENT_PREVIEW_DATE}:{};
 if('caches' in window){
  try{
   const exact=await caches.match(url);
   if(exact){const data=await exact.clone().json();if(mergeRollingContent(data))renderAfterRollingContent()}
   else if(!CONTENT_PREVIEW_DATE){
    const previous=await caches.match('/api/rolling-content',{ignoreSearch:true});
    if(previous){const data=await previous.clone().json(),safeAsOf=data?.asOf;if((!safeAsOf||safeAsOf<=pragueDateISO())&&mergeRollingContent(data))renderAfterRollingContent()}
   }
  }catch{}
 }
 try{const r=await fetch(url,{cache:'no-store',headers});if(!r.ok)throw new Error('rolling-content');const fresh=await r.json();if(mergeRollingContent(fresh))renderAfterRollingContent();return fresh}catch{return null}
}

async function boot(){'''
app = regex_once(
    app,
    r'const EXPECTED_PUZZLE_DB_VERSION=10;.*?\n\nasync function boot\(\)\{',
    loader_and_delta,
    "split base and rolling loader",
)
app = replace_once(
    app,
    'renderDaily();renderFree();renderProfile();renderInstallUI();syncQueue({announce:false});refreshRescueStatus();',
    'renderDaily();renderFree();renderProfile();renderInstallUI();refreshRollingContent().catch(()=>{});syncQueue({announce:false});refreshRescueStatus();',
    "refresh rolling after base render",
)
write("public/app.js", app)


sw = read("public/sw.js")
sw = replace_once(
    sw,
    "  if(u.pathname==='/api/puzzles'||u.pathname==='/puzzles.json'){\n    // /api/puzzles carries a Monday week= cache key; a new content week therefore cannot be shadowed by last week's response.",
    "  if(u.pathname==='/api/rolling-content'||u.pathname==='/puzzles.json'){\n    // /api/rolling-content carries a Monday week= cache key; a new content week therefore cannot be shadowed by last week's response.",
    "sw rolling delta path",
)
write("public/sw.js", sw)

print("v3.30 split rolling delta patch applied")
