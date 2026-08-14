#!/usr/bin/env python3
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/'public/app.js').read_text()
css=(ROOT/'public/styles.css').read_text()
server=(ROOT/'server.py').read_text()
assert "const APP_VERSION='3.22.2'" in app
assert '"darkFoundChipTextHotfix": True' in server
# Found-row chips must expose the same palette variable as solved cells.
assert 'class="found-word-chip" style="--word-color:${COLORS[f.colorIndex%COLORS.length]};background:color-mix(in srgb,var(--word-color) 58%,white)' in app
# Light mode keeps the existing pastel chip background.
assert '.found-word-chip{display:inline-flex' in css
# Dark mode must use richer route colour + dark ink, matching v3.22.1 solved-cell strategy.
rule='html[data-theme="dark"] .found-word-chip{background:color-mix(in srgb,var(--word-color,#72d9b7) 70%,#211f2c)!important;color:#0c0b10;'
assert rule in css
print('PASS: v3.22.2 found-row chips use theme-aware word colours and dark ink')
