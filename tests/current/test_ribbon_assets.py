"""Full runtime coverage, true SVG, old identities and protected gameplay baseline."""
from pathlib import Path
import json,re,subprocess,xml.etree.ElementTree as ET
R=Path(__file__).resolve().parents[2];P=R/'public';base='2ed41e5dc845cf8e1c144be1e2aae54459176cd3'
c=json.loads((P/'rewards/printshop/collection.json').read_text())['items'];m=json.loads((P/'rewards/printshop/manifest.json').read_text());assert len(c)==len(m)==142;assert {x['key'] for x in c}==set(m)
for key,x in m.items():
 root=ET.parse(P/'rewards/printshop'/x['file']).getroot();assert root.get('viewBox');assert root.findall('.//{http://www.w3.org/2000/svg}path');assert not root.findall('.//{http://www.w3.org/2000/svg}image')
old=json.loads(subprocess.check_output(['git','show',base+':public/rewards/printshop/manifest.json'],cwd=R))
for x in old.values():
 f='public/rewards/printshop/'+x['file'];assert (R/f).read_bytes()==subprocess.check_output(['git','show',base+':'+f],cwd=R)
for f in ['public/ribbon-ui.css','public/printshop-ui.css','public/app/game/board.js','public/app/game/input.js','public/app/game/hints.js']:
 assert (R/f).read_bytes()==subprocess.check_output(['git','show',base+':'+f],cwd=R),f
assert '/rewards/ribbons/' not in (P/'ribbon-ui.js').read_text()
print('PASS: 142 genuine SVG, complete coverage; original 12 illustrations and gameplay files unchanged')
