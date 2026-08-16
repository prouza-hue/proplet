from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

app_path = ROOT / 'public' / 'app.js'
app = app_path.read_text(encoding='utf-8')
old = "fetch(url,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(fresh=>{if(fresh?.version===EXPECTED_PUZZLE_DB_VERSION){const content=puzzleDB?.contentStatus;puzzleDB=fresh;if(content)puzzleDB.contentStatus=content;renderDaily();renderFree()}}).catch(()=>{});return data"
new = "fetch(url,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(fresh=>{if(fresh?.version===EXPECTED_PUZZLE_DB_VERSION){const content=puzzleDB?.contentStatus,rolling=puzzleDB?.rollingContent,extras=Object.fromEntries(Object.keys(DIFF).map(d=>[d,(puzzleDB?.free?.[d]||[]).filter(p=>p.meta?.rollingContent)]));puzzleDB=fresh;for(const d of Object.keys(DIFF)){const seen=new Set((puzzleDB.free?.[d]||[]).map(p=>p.id));for(const p of extras[d]||[])if(!seen.has(p.id)){puzzleDB.free[d].push(p);seen.add(p.id)}}if(rolling)puzzleDB.rollingContent=rolling;if(content)puzzleDB.contentStatus=content;renderDaily();renderFree()}}).catch(()=>{});return data"
if app.count(old) != 1:
    raise SystemExit(f'base refresh block count={app.count(old)}')
app = app.replace(old, new, 1)

old = "window.addEventListener('online',()=>syncQueue({announce:false}));"
new = "window.addEventListener('online',()=>{syncQueue({announce:false});refreshRollingContent().catch(()=>{})});"
if app.count(old) != 1:
    raise SystemExit(f'online refresh block count={app.count(old)}')
app = app.replace(old, new, 1)

old = "let lastKnownDate=pragueDateISO();setInterval(()=>{const now=pragueDateISO();if(now!==lastKnownDate){lastKnownDate=now;if(currentScreen==='daily')renderDaily()}if(getQueue().length&&navigator.onLine)syncQueue({announce:false})},60000);"
new = "let lastKnownDate=pragueDateISO();setInterval(()=>{const now=pragueDateISO();if(now!==lastKnownDate){lastKnownDate=now;if(currentScreen==='daily')renderDaily();refreshRollingContent().catch(()=>{})}if(getQueue().length&&navigator.onLine)syncQueue({announce:false})},60000);"
if app.count(old) != 1:
    raise SystemExit(f'date rollover block count={app.count(old)}')
app = app.replace(old, new, 1)
app_path.write_text(app, encoding='utf-8')

vercel_path = ROOT / 'vercel.json'
vercel = json.loads(vercel_path.read_text(encoding='utf-8'))
for row in vercel.get('crons', []):
    if row.get('path') == '/api/cron/content-push':
        # 09:00 UTC = 11:00 CEST / 10:00 CET. It stays clearly separate from the
        # 07:00 UTC Daily reminder and gives the Monday drop a daytime rhythm.
        row['schedule'] = '0 9 * * 1'
vercel_path.write_text(json.dumps(vercel, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('v3.30 final polish applied')
