"""Build a native-shell, entirely isolated review on Vercel Preview only."""
import os
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'public/design/refinements'
TARGET.mkdir(parents=True, exist_ok=True)
if os.environ.get('VERCEL_ENV') == 'preview':
    source = (ROOT / 'public/index.html').read_text()
    assert source.count('<html lang="cs">') == 1, 'Native shell root changed'
    source = source.replace('<html lang="cs">', '<html lang="cs" data-refinements-review>', 1)
    # Isolation is installed before runtime-meta, transport, theme or application.
    marker = '<head>'
    assert source.count(marker) == 1, 'Native shell head changed'
    source = source.replace(marker, marker + '\n  <script src="/design/refinements/review.js"></script>', 1)
    (TARGET / 'index.html').write_text(source)
    shutil.copyfile(ROOT / 'tools/refinements-review.js', TARGET / 'review.js')
    print('Native refinements review: /design/refinements/?review=hints|rankings|bonus')
else:
    (TARGET / 'index.html').write_text('<!doctype html><html lang="cs"><meta charset="utf-8"><title>Náhled Propletu</title><p>Náhled je dostupný jen v testovací verzi.</p></html>')
    (TARGET / 'review.js').write_text('// Refinements review disabled outside Preview.\n')
