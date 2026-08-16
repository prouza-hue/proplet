from pathlib import Path
import re

app_path=Path('public/app.js')
css_path=Path('public/styles.css')
sw_path=Path('public/sw.js')
server_path=Path('server.py')

app=app_path.read_text()
lines=app.splitlines()
targets=[(i,l) for i,l in enumerate(lines) if 'tvoje úrovně' in l]
if len(targets)!=1:
    raise SystemExit(f'Expected exactly 1 title target, found {len(targets)}')
i,line=targets[0]
print('TARGET LINE:', i+1, line)
if '${d.icon}' not in line or '${d.label}' not in line:
    raise SystemExit('Expected raw difficulty icon/title pattern not found')

# Replace only the played-level modal title assignment: path string -> actual SVG markup.
m=re.search(r"\$\('#([^']+)'\)\.textContent=`\$\{d\.icon\} \$\{d\.label\} · tvoje úrovně`", line)
if not m:
    raise SystemExit('Could not safely identify played-level title assignment')
el_id=m.group(1)
old=m.group(0)
new=f"$('#{el_id}').innerHTML=`${{difficultyIconMarkup(diff,'played-levels-title-icon')}}<span>${{esc(d.label)}} · tvoje úrovně</span>`"
line=line.replace(old,new,1)
lines[i]=line
app='\n'.join(lines)+('\n' if app.endswith('\n') else '')

if "const APP_VERSION='3.28.0';" not in app:
    raise SystemExit('Unexpected app version')
app=app.replace("const APP_VERSION='3.28.0';","const APP_VERSION='3.28.1';",1)
app_path.write_text(app)

css=css_path.read_text()
marker='/* v3.28.1 — played-level modal difficulty SVG title */'
if marker in css:
    raise SystemExit('CSS patch already present')
css += f"\n\n{marker}\n#{el_id}{{display:flex;align-items:center;gap:10px;flex-wrap:wrap}}\n#{el_id} .played-levels-title-icon{{width:32px;height:32px;flex:0 0 32px;display:block;object-fit:contain}}\n"
css_path.write_text(css)

server=server_path.read_text()
if 'APP_VERSION = "3.28.0"' not in server:
    raise SystemExit('Unexpected server version')
server=server.replace('APP_VERSION = "3.28.0"','APP_VERSION = "3.28.1"',1)
server_path.write_text(server)

sw=sw_path.read_text()
if "const CACHE='proplet-v3.28.0-profile-compact';" not in sw:
    raise SystemExit('Unexpected SW cache key')
sw=sw.replace("const CACHE='proplet-v3.28.0-profile-compact';","const CACHE='proplet-v3.28.1-played-title-fix';",1)
sw_path.write_text(sw)

# Regression assertions.
final=app_path.read_text()
title=next(l for l in final.splitlines() if 'tvoje úrovně' in l)
if '${d.icon}' in title or '.textContent=`${d.icon}' in title:
    raise SystemExit('Raw difficulty icon path still leaks in title')
if "difficultyIconMarkup(diff,'played-levels-title-icon')" not in title:
    raise SystemExit('SVG title markup missing')
print('Patched title element:', el_id)
