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


app = read("public/app.js")

# A new Monday must use a new cache key. During the rest of the week the exact key stays
# stable, so the v3.28.3 fast cached start remains intact.
app = replace_once(
    app,
    "function puzzleDatabaseUrl(){return CONTENT_PREVIEW_DATE?`/api/puzzles?preview_as_of=${encodeURIComponent(CONTENT_PREVIEW_DATE)}`:'/api/puzzles'}",
    "function contentWeekKey(iso=CONTENT_PREVIEW_DATE||pragueDateISO()){return addDaysISO(iso,-mondayWeekdayIndex(iso))}\nfunction puzzleDatabaseUrl(){const asOf=CONTENT_PREVIEW_DATE||pragueDateISO(),week=contentWeekKey(asOf),q=new URLSearchParams({week});if(CONTENT_PREVIEW_DATE)q.set('preview_as_of',CONTENT_PREVIEW_DATE);return `/api/puzzles?${q.toString()}`}",
    "weekly puzzle cache key",
)

old_loader = """async function loadPuzzleDatabase(){
 const url=puzzleDatabaseUrl(),headers=CONTENT_PREVIEW_DATE?{'X-Proplet-Preview-As-Of':CONTENT_PREVIEW_DATE}:{};
 if('caches' in window){
  try{const cached=await caches.match(url);if(cached){const data=await cached.clone().json();if(data?.version===EXPECTED_PUZZLE_DB_VERSION){fetch(url,{cache:'no-store',headers}).then(r=>r.ok?r.json():null).then(fresh=>{if(fresh?.version===EXPECTED_PUZZLE_DB_VERSION){puzzleDB=fresh;renderDaily();renderFree();renderProfile()}}).catch(()=>{});return data}}}catch{}
 }
 try{const r=await fetch(url,{cache:'no-store',headers});if(!r.ok)throw new Error('puzzle-api');const data=await r.json();if(data?.version!==EXPECTED_PUZZLE_DB_VERSION)throw new Error('puzzle-db-version');return data}catch(e){
  // Static fallback contains only the original released bank — never future reserve content.
  const r=await fetch('/puzzles.json',{cache:'no-store'});if(!r.ok)throw e;const data=await r.json();if(data?.version!==EXPECTED_PUZZLE_DB_VERSION)throw e;return data;
 }
}"""
new_loader = """async function loadPuzzleDatabase(){
 const url=puzzleDatabaseUrl(),headers=CONTENT_PREVIEW_DATE?{'X-Proplet-Preview-As-Of':CONTENT_PREVIEW_DATE}:{};
 if('caches' in window){
  try{
   const exact=await caches.match(url);
   if(exact){
    const data=await exact.clone().json();
    if(data?.version===EXPECTED_PUZZLE_DB_VERSION){
     fetch(url,{cache:'no-store',headers}).then(r=>r.ok?r.json():null).then(fresh=>{if(fresh?.version===EXPECTED_PUZZLE_DB_VERSION){puzzleDB=fresh;renderDaily();renderFree();renderProfile()}}).catch(()=>{});
     return data;
    }
   }
   // On the first open after a Monday rollover, use last week's released bank immediately
   // while the new weekly URL is fetched. Simulated preview dates deliberately skip this
   // fallback so a future test bank can never flash in a normal preview session.
   if(!CONTENT_PREVIEW_DATE){
    const previous=await caches.match('/api/puzzles',{ignoreSearch:true});
    if(previous){
     const data=await previous.clone().json();
     const safeAsOf=data?.contentStatus?.asOf;
     if(data?.version===EXPECTED_PUZZLE_DB_VERSION&&(!safeAsOf||safeAsOf<=pragueDateISO())){
      fetch(url,{cache:'no-store',headers}).then(r=>r.ok?r.json():null).then(fresh=>{if(fresh?.version===EXPECTED_PUZZLE_DB_VERSION){puzzleDB=fresh;renderDaily();renderFree();renderProfile()}}).catch(()=>{});
      return data;
     }
    }
   }
  }catch{}
 }
 try{const r=await fetch(url,{cache:'no-store',headers});if(!r.ok)throw new Error('puzzle-api');const data=await r.json();if(data?.version!==EXPECTED_PUZZLE_DB_VERSION)throw new Error('puzzle-db-version');return data}catch(e){
  // Static fallback contains only the original released bank — never future reserve content.
  const r=await fetch('/puzzles.json',{cache:'no-store'});if(!r.ok)throw e;const data=await r.json();if(data?.version!==EXPECTED_PUZZLE_DB_VERSION)throw e;return data;
 }
}"""
app = replace_once(app, old_loader, new_loader, "weekly rollover loader")

# Latest-week badges represent new UNPLAYED puzzles, not merely puzzles that were released.
app = replace_once(
    app,
    "function newContentCount(diff){return latestContentPuzzles().filter(p=>p.difficulty===diff).length}",
    "function newContentCount(diff){return latestContentUnplayed().filter(p=>p.difficulty===diff).length}",
    "unplayed new badge count",
)

# Turn the banner into a coherent five-puzzle flow. The ordinary Free progression remains
# sequential and unchanged; only a player who explicitly entered via Hrát nové follows the batch.
app = replace_once(
    app,
    "function startLatestContent(){const list=latestContentUnplayed(),all=latestContentPuzzles(),p=list[0]||all[0];if(p)startGame(p,'free')}",
    "function startLatestContent(){const batch=latestContentBatch(),list=latestContentUnplayed(),all=latestContentPuzzles(),p=list[0]||all[0];if(p)startGame(p,'free',null,{contentBatchId:batch?.id||null})}\nfunction continueLatestContent(){const batch=latestContentBatch(),p=latestContentUnplayed()[0];if(p&&currentGame?.contentBatchId===batch?.id)startGame(p,'free',null,{contentBatchId:batch.id});else nav('free',{replace:true})}",
    "content batch start/continue",
)
app = replace_once(
    app,
    "helperOffered:!!restored?.helperOffered,helperHintUsed:!!restored?.helperHintUsed,nextHintSource:'manual',isReplay:!!getState().completed[challengeKey(mode,puzzle,dailyDate)],starterHintUsed:false",
    "helperOffered:!!restored?.helperOffered,helperHintUsed:!!restored?.helperHintUsed,nextHintSource:'manual',isReplay:!!getState().completed[challengeKey(mode,puzzle,dailyDate)],contentBatchId:options.contentBatchId||null,starterHintUsed:false",
    "game content batch context",
)
app = replace_once(
    app,
    "if(action==='continue'){if(mode==='free')startFree(diff);else if(mode==='rescue')nav('daily',{replace:true});else nav('free',{replace:true});return}",
    "if(action==='continue'){if(mode==='free'&&currentGame?.contentBatchId){continueLatestContent();return}if(mode==='free')startFree(diff);else if(mode==='rescue')nav('daily',{replace:true});else nav('free',{replace:true});return}",
    "post win content continuation",
)
app = replace_once(
    app,
    "$('#winPrimaryBtn').textContent=g.mode==='daily'?'Vybrat další hru':'Hraj další úroveň';",
    "$('#winPrimaryBtn').textContent=g.mode==='daily'?'Vybrat další hru':g.mode==='free'&&g.contentBatchId?(latestContentUnplayed().length?'Hrát další nový':'Zpět k Volné hře'):'Hraj další úroveň';",
    "content win CTA",
)

# A public preview may simulate future Mondays while sharing the production Supabase project.
# Future-preview gameplay therefore stays fully local to the preview origin and must never
# submit results, attempts, hint/helper telemetry or feedback into production analytics.
app = replace_once(
    app,
    "function trackProductEvent(eventType){api('/api/product-event',{method:'POST',body:JSON.stringify({event_type:eventType})}).catch(()=>{})}",
    "function trackProductEvent(eventType){if(CONTENT_PREVIEW_DATE)return;api('/api/product-event',{method:'POST',body:JSON.stringify({event_type:eventType})}).catch(()=>{})}",
    "preview product telemetry suppression",
)
app = replace_once(
    app,
    "async function startAttemptTelemetry(g){if(!g||g.mode==='rescue'||g.mode==='starter')return;",
    "async function startAttemptTelemetry(g){if(CONTENT_PREVIEW_DATE||!g||g.mode==='rescue'||g.mode==='starter')return;",
    "preview attempt start suppression",
)
app = replace_once(
    app,
    " const g=currentGame;if(!g||g.mode==='rescue'||g.mode==='starter'||g.finished)return;",
    " const g=currentGame;if(CONTENT_PREVIEW_DATE||!g||g.mode==='rescue'||g.mode==='starter'||g.finished)return;",
    "preview checkpoint suppression",
)
app = replace_once(
    app,
    " if(!rec?.attemptId||rec.mode==='rescue'||rec.mode==='starter')return;",
    " if(CONTENT_PREVIEW_DATE||!rec?.attemptId||rec.mode==='rescue'||rec.mode==='starter')return;",
    "preview attempt finish suppression",
)
app = replace_once(
    app,
    "function queueResult(rec){\n const q=getQueue();",
    "function queueResult(rec){\n if(CONTENT_PREVIEW_DATE&&rec?.mode==='free'&&Number(rec?.level||0)>200)return;\n const q=getQueue();",
    "preview result queue suppression",
)
# Helper/hint events share the same compact guard shape in current runtime.
app = replace_once(
    app,
    " const g=currentGame;if(!g||g.mode==='rescue'||g.mode==='starter')return;\n const elapsed=Math.max(0,Math.round(gameElapsed(g))),idle=",
    " const g=currentGame;if(CONTENT_PREVIEW_DATE||!g||g.mode==='rescue'||g.mode==='starter')return;\n const elapsed=Math.max(0,Math.round(gameElapsed(g))),idle=",
    "preview helper telemetry suppression",
)
app = replace_once(
    app,
    " const g=currentGame;if(!g||g.mode==='rescue'||g.mode==='starter')return;\n try{await api('/api/hint-event'",
    " const g=currentGame;if(CONTENT_PREVIEW_DATE||!g||g.mode==='rescue'||g.mode==='starter')return;\n try{await api('/api/hint-event'",
    "preview hint telemetry suppression",
)
app = replace_once(
    app,
    " const g=currentGame;if(!g?.puzzle||g.mode==='rescue')throw new Error('Tuhle úlohu teď nejde hodnotit.');",
    " const g=currentGame;if(!g?.puzzle||g.mode==='rescue')throw new Error('Tuhle úlohu teď nejde hodnotit.');if(CONTENT_PREVIEW_DATE)throw new Error('V simulovaném content preview hodnocení neodesíláme.');",
    "preview feedback suppression",
)

write("public/app.js", app)

# Service worker already caches full request URLs, so the week query above gives a fresh key
# each Monday. Add an explicit comment/invariant marker to make this future-proof.
sw = read("public/sw.js")
sw = replace_once(
    sw,
    "  if(u.pathname==='/api/puzzles'||u.pathname==='/puzzles.json'){",
    "  if(u.pathname==='/api/puzzles'||u.pathname==='/puzzles.json'){\n    // /api/puzzles carries a Monday week= cache key; a new content week therefore cannot be shadowed by last week's response.",
    "sw weekly cache marker",
)
write("public/sw.js", sw)

print("v3.30 hardening patch applied")
