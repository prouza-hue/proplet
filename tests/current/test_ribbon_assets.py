"""Validate complete reward coverage, immutable pilot inputs and strict SVG references."""
from pathlib import Path
import re,json,subprocess,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2];assets=root/'public/rewards/ribbons'
data=json.loads((assets/'collection.json').read_text())['items']
assert len(data)==142
assert {c:sum(x['category']==c for x in data) for c in ['rank','achievement','streak','medal']}=={'rank':35,'achievement':90,'streak':10,'medal':3}
assert len({x['id'] for x in data})==142
files=list(assets.rglob('*.svg'));assert len(files)==572
for path in files:
 text=path.read_text();svg=ET.fromstring(text)
 assert svg.tag.endswith('svg') and svg.attrib['viewBox']=='0 0 128 128',path
 assert not re.search(r'<(?:image|script|foreignObject|text)\b',text),path
 ids={el.attrib['id'] for el in svg.iter() if 'id' in el.attrib}
 assert set(re.findall(r'url\(#([^)]+)\)',text))<=ids,path
 assert not re.search(r'(?:href|src)="https?://',text),path
for item in data:
 for theme in ['light','dark']:
  for size in ['small','regular']:
   p=assets/theme/(item['key']+'-'+size+'.svg');assert p.is_file(),p
   if item['pilot']:
    old=subprocess.check_output(['git','show','aff3cefe3e767d8df0e274e30be0b480ca57027e:'+str(p.relative_to(root))],cwd=root)
    assert p.read_bytes()==old,p
print('PASS: 138 rewards + 4 game symbols, 572 strict SVGs; approved pilot byte-identical')
