"""Strict browser-compatible SVG validation for the approved ribbon pilot."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET
root = Path(__file__).resolve().parents[2] / 'public/rewards/ribbons'
files = list(root.rglob('*.svg'))
assert len(files) == 32, 'Eight designs × two themes × two optical variants'
for path in files:
    text = path.read_text()
    svg = ET.fromstring(text)
    assert svg.tag.endswith('svg') and svg.attrib['viewBox'] == '0 0 128 128', path
    assert not re.search(r'<(?:image|script|foreignObject|text)\b', text), path
    ids = {el.attrib['id'] for el in svg.iter() if 'id' in el.attrib}
    assert set(re.findall(r'url\(#([^)]+)\)', text)) <= ids, path
    assert not re.search(r'(?:href|src)="https?://', text), path
print('PASS: all 32 reward assets are well-formed, self-contained SVGs')
