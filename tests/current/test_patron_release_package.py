"""Release deployment cannot accidentally publish the isolated payment demo."""
import json
import re
from pathlib import Path
from tools.release_contract import assert_release_contract

ROOT = Path(__file__).resolve().parents[2]
config = json.loads((ROOT / 'vercel.json').read_text())
assert config['buildCommand'] == 'python tools/build_vercel.py'
assert 'builds' not in config and 'routes' not in config, 'native backend routing must remain intact'
assert config.get('env', {}).get('PROPLET_PATRONS_ENABLED', '').lower() not in {'1', 'true', 'yes'}
assert any(c['path'] == '/api/cron/monthly-competition' for c in config['crons'])
for path in ('patron-preview.html', 'patron-preview.js', 'patron-preview.css',
             'patron-admin-preview.html', 'patron-admin-preview.js',
             'patron-fixtures', 'vendor/qrcode-generator'):
    assert not (ROOT / 'public' / path).exists(), f'payment demo must not ship: {path}'
assert 'tests/fixtures/patrons/**' in (ROOT / '.vercelignore').read_text()
assert_release_contract(ROOT)
index = (ROOT / 'public/index.html').read_text()
shell = (ROOT / 'public/sw.js').read_text()
offline = json.loads((ROOT / 'public/offline-assets.json').read_text())['assets']
for asset in ('/app/patrons.js', '/patrons.css'):
    path = re.search(re.escape(asset) + r"\?v=[^\s\"'<>]+", index).group(0)
    assert path in shell and path in offline, f'Patron asset cache mismatch: {path}'
client = (ROOT / 'public/app/patrons.js').read_text()
assert 'PROPLET_PATRON_PREVIEW' not in client and 'PropletPatronApi' not in client
assert 'TEST-NEODESILAT' not in client
print('PASS patron release package: native backend/crons, default OFF, no public or deployable model QR, coordinated PWA assets')
