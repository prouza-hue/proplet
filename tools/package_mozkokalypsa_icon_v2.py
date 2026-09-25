"""Package approved painted v2 source; no client generation or external requests.

Usage: python tools/package_mozkokalypsa_icon_v2.py
The original v1 generator remains untouched for provenance.
"""
import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/difficulty/printshop/mozkokalypsa-v2.webp'
TARGET = ROOT / 'public/difficulty/printshop/mozkokalypsa-v2.svg'

def package(source: Path, target: Path) -> None:
    data = source.read_bytes()
    if data[:4] != b'RIFF' or data[8:12] != b'WEBP':
        raise ValueError('Expected the approved WebP source')
    encoded = base64.b64encode(data).decode('ascii')
    target.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
        'role="img" aria-labelledby="mk-v2-title">'
        '<title id="mk-v2-title">Mozkokalypsa — roztržený vír</title>'
        f'<image href="data:image/webp;base64,{encoded}" width="512" height="512"/>'
        '</svg>\n', encoding='utf-8')

if __name__ == '__main__':
    package(SOURCE, TARGET)
