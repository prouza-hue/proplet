"""Build a native-shell reward demonstration on Preview deployments only."""
import os
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
target = ROOT / 'public/design/team-rewards'
target.mkdir(parents=True, exist_ok=True)
if os.environ.get('VERCEL_ENV') == 'preview':
    html = (ROOT / 'public/index.html').read_text()
    html = html.replace('<html lang="cs">', '<html lang="cs" data-archive-preview>')
    html = html.replace('  <script src="/theme-init.js',
        '  <script src="/app/archive/preview-isolation.js"></script>\n'
        '  <script src="/design/team-rewards/review.js"></script>\n'
        '  <script src="/theme-init.js', 1)
    (target / 'index.html').write_text(html)
    shutil.copyfile(ROOT / 'tools/weekly-rewards-review.js', target / 'review.js')
    print('Native reward review: /design/team-rewards/?teamRewards=victory')
else:
    (target / 'index.html').write_text('<!doctype html><html lang="cs"><meta charset="utf-8"><title>Náhled Propletu</title><p>Náhled je dostupný jen v testovací verzi.</p></html>')
    (target / 'review.js').write_text('// Team reward review disabled outside Preview.\n')
