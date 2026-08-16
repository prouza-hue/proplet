from pathlib import Path

app_path=Path('public/app.js')
css_path=Path('public/styles.css')
sw_path=Path('public/sw.js')
server_path=Path('server.py')

app=app_path.read_text()
old="const d=DIFF[diff],modal=$('#playedLevelsModal');$('#playedLevelsTitle').innerHTML=`${difficultyIconMarkup(diff,'played-levels-title-icon')}<span>${esc(d.label)} · tvoje úrovně</span>`;"
new="const d=DIFF[diff],modal=$('#playedLevelsModal');$('#playedLevelsTitle').textContent=`${d.label} · tvoje úrovně`;"
if app.count(old)!=1:
    raise SystemExit(f'Expected exactly one played-level title renderer, found {app.count(old)}')
app=app.replace(old,new,1)
if "const APP_VERSION='3.28.1';" not in app:
    raise SystemExit('Unexpected app version')
app=app.replace("const APP_VERSION='3.28.1';","const APP_VERSION='3.28.2';",1)
app_path.write_text(app)

css=css_path.read_text()
block="\n\n/* v3.28.1 — played-level modal difficulty SVG title */\n#playedLevelsTitle{display:flex;align-items:center;gap:10px;flex-wrap:wrap}\n#playedLevelsTitle .played-levels-title-icon{width:32px;height:32px;flex:0 0 32px;display:block;object-fit:contain}\n"
if block not in css:
    raise SystemExit('Expected v3.28.1 played-level title CSS block not found')
css=css.replace(block,'',1)
css_path.write_text(css)

server=server_path.read_text()
if 'APP_VERSION = "3.28.1"' not in server:
    raise SystemExit('Unexpected server version')
server=server.replace('APP_VERSION = "3.28.1"','APP_VERSION = "3.28.2"',1)
server_path.write_text(server)

sw=sw_path.read_text()
if "const CACHE='proplet-v3.28.1-played-title-fix';" not in sw:
    raise SystemExit('Unexpected SW cache key')
sw=sw.replace("const CACHE='proplet-v3.28.1-played-title-fix';","const CACHE='proplet-v3.28.2-played-title-text-only';",1)
sw_path.write_text(sw)

final=app_path.read_text()
target=next(l for l in final.splitlines() if 'tvoje úrovně' in l and 'playedLevelsTitle' in l)
if 'difficultyIconMarkup' in target or '.icon' in target or '.svg' in target:
    raise SystemExit('Played-level title still references a difficulty icon/path')
if "$('#playedLevelsTitle').textContent=`${d.label} · tvoje úrovně`" not in target:
    raise SystemExit('Text-only title renderer missing')
if 'played-levels-title-icon' in css_path.read_text():
    raise SystemExit('Obsolete played-level title icon CSS remains')
print('v3.28.2 text-only played-level title fix applied')
