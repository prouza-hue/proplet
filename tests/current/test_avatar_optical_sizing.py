#!/usr/bin/env python3
"""Printshop masters fill one circular viewBox, without the old two-layer zoom."""
from pathlib import Path
import json,re,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]
JS=(ROOT/'public/organic-ui-v4023.js').read_text()
manifest=json.loads((ROOT/'public/assets/avatars/v3/manifest.json').read_text())
old=json.loads((ROOT/'public/assets/avatars/v2/manifest.json').read_text())
assert [(x['id'],x['name'],x['file']) for x in manifest['avatars']]==[(x['id'],x['name'],x['file']) for x in old['avatars']]
assert "AVATAR_BASE_PATH='/assets/avatars/v3/'" in JS
assert 'n.style.backgroundImage' not in JS and 'AVATAR_FOCUS_FRAMES' not in JS
ns={'s':'http://www.w3.org/2000/svg'}
for item in manifest['avatars']:
 svg=ET.parse(ROOT/'public/assets/avatars/v3'/item['file']).getroot()
 assert svg.get('viewBox')=='0 0 512 512'
 group=svg.find('s:g',ns);matrix=[float(v) for v in re.findall(r'-?\d+(?:\.\d+)?',group.get('transform'))]
 circle=svg.find('.//s:clipPath/s:circle',ns)
 scale=matrix[0];tx=matrix[4];ty=matrix[5];cx=float(circle.get('cx'));cy=float(circle.get('cy'));radius=float(circle.get('r'))
 assert abs((cx-radius)*scale+tx)<1e-6 and abs((cy-radius)*scale+ty)<1e-6
 assert abs(radius*2*scale-512)<1e-6
 assert not svg.findall('.//s:image',ns)
print('PASS: 30 stable avatar identities, full circular bounds, no duplicate zoom layer')
