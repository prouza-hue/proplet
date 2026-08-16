from pathlib import Path

root=Path(__file__).resolve().parents[1]
app_path=root/'public'/'app.js'
css_path=root/'public'/'styles.css'
sw_path=root/'public'/'sw.js'
server_path=root/'server.py'
app=app_path.read_text(encoding='utf-8')
css=css_path.read_text(encoding='utf-8')
sw=sw_path.read_text(encoding='utf-8')
server=server_path.read_text(encoding='utf-8')

def one(text, old, new, label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    return text.replace(old,new,1)

app=one(app,"const APP_VERSION='3.31.4-preview.1';\nconst PREVIEW_NOW_DATE='2026-08-22';","const APP_VERSION='3.31.4';",'app version/date')
app=one(app,"const CONTENT_PREVIEW_DATE=PREVIEW_NOW_DATE;","const CONTENT_PREVIEW_DATE='';",'content preview disabled')
app=one(app,"function pragueDateISO(){if(PREVIEW_NOW_DATE)return PREVIEW_NOW_DATE;return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}","function pragueDateISO(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}",'real Prague clock')
app=one(app,"function queueResult(rec){\n if(CONTENT_PREVIEW_DATE)return;","function queueResult(rec){\n if(CONTENT_PREVIEW_DATE&&rec?.mode==='free'&&Number(rec?.level||0)>200)return;",'queue production guard')
app=one(app,"async function syncQueue({announce=false}={}){\n if(CONTENT_PREVIEW_DATE)return {ok:true,left:getQueue().length,preview:true};\n const p=getProfile();","async function syncQueue({announce=false}={}){\n const p=getProfile();",'sync production behavior')
server=one(server,'APP_VERSION = "3.31.4-preview.1"','APP_VERSION = "3.31.4"','server version')
sw=one(sw,"const CACHE='proplet-v3.31.4-preview.1-hard-daily-onboarding';","const CACHE='proplet-v3.31.4-hard-daily-onboarding';",'service worker cache')
css=css.replace('/* v3.31.4 preview — equal-weight choice when the first Daily is Hard. */','/* v3.31.4 — equal-weight choice when the first Daily is Hard. */',1)

if 'PREVIEW_NOW_DATE' in app:
    raise SystemExit('preview date hook remains in production app')
if "const CONTENT_PREVIEW_DATE='';" not in app:
    raise SystemExit('production content preview must be disabled')
for needle in [
    'starter-hard-actions',
    'starterWarmupBtn',
    'starterHardDailyBtn',
    'Dnešní výzva je Těžká.',
    'Vyber si tempo.',
    'starter_easy_warmup_selected',
    'starter_hard_direct_selected',
    'starter_easy_warmup_completed',
    "startDaily({starterHardDirect:true})",
    "g.mode==='free'&&!g.postStarterWarmup",
]:
    if needle not in app and needle not in css:
        raise SystemExit(f'missing approved onboarding invariant: {needle}')

app_path.write_text(app,encoding='utf-8')
css_path.write_text(css,encoding='utf-8')
sw_path.write_text(sw,encoding='utf-8')
server_path.write_text(server,encoding='utf-8')
print('v3.31.4 productionized')
