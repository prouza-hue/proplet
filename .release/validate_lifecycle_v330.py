from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
app = (ROOT / 'public' / 'app.js').read_text(encoding='utf-8')
vercel = json.loads((ROOT / 'vercel.json').read_text(encoding='utf-8'))

assert "extras=Object.fromEntries(Object.keys(DIFF).map" in app
assert "filter(p=>p.meta?.rollingContent)" in app
assert "window.addEventListener('online',()=>{syncQueue({announce:false});refreshRollingContent().catch(()=>{})})" in app
assert "if(now!==lastKnownDate){lastKnownDate=now;if(currentScreen==='daily')renderDaily();refreshRollingContent().catch(()=>{})}" in app
assert any(row.get('path') == '/api/cron/content-push' and row.get('schedule') == '0 9 * * 1' for row in vercel.get('crons', []))
print('WEEKLY LIFECYCLE PASS')
