from pathlib import Path

app=Path('public/app.js')
s=app.read_text()
repls=[
("const APP_VERSION='3.29.0-preview.1';","const APP_VERSION='3.29.0-preview.2';"),
("cta:'Ukázat mi, jak se hraje'","cta:'Jak hrát'"),
('<span class="eyebrow">VÍTEJ V PROPLETU</span><h2>Spojuj písmena do slov</h2>','<h2>Spojuj písmena do slov</h2>'),
]
for old,new in repls:
    if s.count(old)!=1:
        raise SystemExit(f'Expected exactly one match for {old!r}, got {s.count(old)}')
    s=s.replace(old,new)
app.write_text(s)

server=Path('server.py')
s=server.read_text()
old='APP_VERSION = "3.29.0-preview.1"'
new='APP_VERSION = "3.29.0-preview.2"'
if s.count(old)!=1:
    raise SystemExit(f'server version match count {s.count(old)}')
server.write_text(s.replace(old,new))

sw=Path('public/sw.js')
s=sw.read_text()
old="const CACHE='proplet-v3.29.0-preview.1-onboarding-modes';"
new="const CACHE='proplet-v3.29.0-preview.2-onboarding-copy';"
if s.count(old)!=1:
    raise SystemExit(f'sw cache match count {s.count(old)}')
sw.write_text(s.replace(old,new))

print('family preview copy v2 applied')
