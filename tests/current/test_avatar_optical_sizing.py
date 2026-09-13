#!/usr/bin/env python3
"""Printshop masters fill one circular viewBox, without the old two-layer zoom."""
from pathlib import Path
import json,re,struct,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]
JS=(ROOT/'public/organic-ui-v4023.js').read_text()
manifest=json.loads((ROOT/'public/assets/avatars/v3/manifest.json').read_text())
old=json.loads((ROOT/'public/assets/avatars/v2/manifest.json').read_text())
assert [(x['id'],x['name'],x['file']) for x in manifest['avatars'][:30]]==[(x['id'],x['name'],x['file']) for x in old['avatars']]
assert "AVATAR_BASE_PATH='/assets/avatars/v3/'" in JS
assert 'n.style.backgroundImage' not in JS and 'AVATAR_FOCUS_FRAMES' not in JS
ns={'s':'http://www.w3.org/2000/svg'}
for item in manifest['avatars']:
 if 'frame' in item:
  png=(ROOT/'public/assets/avatars/v3'/item['file']).read_bytes()
  assert png[:8]==b'\x89PNG\r\n\x1a\n'
  width,height=struct.unpack('>II',png[16:24]);assert (width,height)==(1536,1024)
  x,y,size=item['frame'];assert size>=280 and x>=0 and y>=0 and x+size<=width and y+size<=height
  continue
 svg=ET.parse(ROOT/'public/assets/avatars/v3'/item['file']).getroot()
 assert svg.get('viewBox')=='0 0 512 512'
 group=svg.find('s:g',ns);matrix=[float(v) for v in re.findall(r'-?\d+(?:\.\d+)?',group.get('transform','matrix(1 0 0 1 0 0)'))]
 circle=svg.find('.//s:clipPath/s:circle',ns)
 scale=matrix[0];tx=matrix[4];ty=matrix[5];cx=float(circle.get('cx'));cy=float(circle.get('cy'));radius=float(circle.get('r'))
 assert abs((cx-radius)*scale+tx)<1e-6 and abs((cy-radius)*scale+ty)<1e-6
 assert abs(radius*2*scale-512)<1e-6
 assert not svg.findall('.//s:image',ns)
app=(ROOT/'public/app.js').read_text()
tokens=json.loads(re.search(r'const AVATARS=(\[.*?\]);',app)[1])
legacy=json.loads(re.search(r'const LEGACY_AVATARS=(\[.*?\]);',JS)[1])
runtime=json.loads(re.search(r'const AVATAR_MANIFEST=(\[.*?\]);',JS)[1])
assert tokens==legacy and len(tokens)==len(set(tokens))==len(runtime)==manifest['count']==47
assert [x['id'] for x in runtime]==list(range(1,48))
assert [(x['id'],x['name'],x['file']) for x in runtime]==[(x['id'],x['name'],x['file']) for x in manifest['avatars']]
retired=set(json.loads(re.search(r'RETIRED_AVATAR_IDS=new Set\((\[.*?\])\)',JS)[1]))
assert len([x for x in runtime if x['id'] not in retired])==42
print('PASS: stable avatar identities, 42 selectable avatars, approved sprite bounds and vector bounds')
