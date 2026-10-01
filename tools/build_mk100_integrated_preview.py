"""Build the unpublished hundred inside the complete, isolated Proplet UI.

Only public assets and explicit content fixtures are exported. No server,
credentials, account data, production proxy or publishing action is included.
"""
from __future__ import annotations

import copy
from datetime import date
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import unicodedata

from build_mk100_preview import CONTENT, ROOT, REPRESENTATIVE_LEVELS, digest, verify_bank

sys.path.insert(0, str(ROOT))
from backend.content import released_free_bank

AS_OF = date.fromisoformat(os.environ.get('MK100_PREVIEW_AS_OF', '2026-10-01'))
OUTPUT = ROOT / 'dist-mk100-integrated'


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def build():
    if os.environ.get('VERCEL_ENV', '').lower() == 'production':
        raise RuntimeError('Unpublished integrated preview: production build forbidden')
    bank = json.loads((CONTENT / 'bank.json').read_text(encoding='utf-8'))
    verify_bank(bank)
    if bank['contentHash'] != '84d32ca0600f27f13cc57bd497bd553af41c1b1cd68023379f26997e92c58dab':
        raise ValueError('This preview must preserve the approved candidate hundred')
    lexicon_sha = hashlib.sha256((ROOT / 'content/lexicon-v3/working/lexicon.json').read_bytes()).hexdigest()
    if lexicon_sha != bank['lexiconHash']:
        raise ValueError('Frozen Lexikon v3 changed')
    raw = (CONTENT / 'recognition-words.txt').read_bytes()
    words = sorted({unicodedata.normalize('NFC', w).strip().casefold() for w in raw.decode('utf-8').splitlines() if w.strip()})
    if digest(words) != bank['validationDictionary']['sha256'] or len(words) != bank['validationDictionary']['size']:
        raise ValueError('Complete recognition dictionary changed')
    source = json.loads((ROOT / 'public/puzzles.json').read_text(encoding='utf-8'))
    rolling = json.loads((ROOT / 'data/rolling_content_v1.json').read_text(encoding='utf-8'))
    puzzles = copy.deepcopy(source)
    puzzles['free'] = {d: released_free_bank(source, rolling, d, AS_OF) for d in source['free']}
    puzzles['free']['mozkokalypsa'] = copy.deepcopy(bank['boards'])
    for board in puzzles['free']['mozkokalypsa']:
        # UI namespace only: letters, paths, identities and ordinals stay exact.
        board['difficulty'] = 'mozkokalypsa'
        board['meta']['integratedPreview'] = True
        board['meta']['sourceDifficulty'] = 'mozkomor'
    puzzles['freeLevelCounts']['mozkokalypsa'] = 100
    tajenka_bank = json.loads((ROOT / 'data/tajenka_weekend_v2.json').read_text(encoding='utf-8'))
    offset = (AS_OF - date(2026, 9, 12)).days
    week = 3 + offset // 7 * 2 + (offset % 7 >= 4)
    tajenka = next((p for p in tajenka_bank['puzzles'] if p['week'] == week), None)
    try:
        sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        sha = os.environ.get('VERCEL_GIT_COMMIT_SHA', 'local')
    report = {
        'kind': 'mk100-integrated-static-preview', 'gitSha': sha,
        'normalPropletBaseSha': '174e0fa2a3e8befd0fe01ac8ba7771f4ece25558',
        'asOf': AS_OF.isoformat(), 'bankContentHash': bank['contentHash'],
        'bankSourceSha': bank['sourceSha'], 'boards': 100,
        'representativeLevels': list(REPRESENTATIVE_LEVELS),
        'recognitionWords': len(words), 'recognitionDictionaryHash': digest(words),
        'recognitionFileSha256': hashlib.sha256(raw).hexdigest(), 'lexiconHash': lexicon_sha,
        'existingMozkomorGate': 'unchanged: 200 actual current hardcore completions; earned unlock persists',
        'newMozkokalypsaGate': None, 'publicationAuthorized': False,
        'playtest': False, 'serverFunctions': 0, 'productionWrites': False,
        'accounts': False, 'localPreviewProgressOnly': True,
        'launchAnnouncement': 'explicit reviewer-only draft; never automatically displayed',
    }
    # Only this checked, fixed build directory can be replaced.
    if OUTPUT.resolve() != ROOT.resolve() / 'dist-mk100-integrated':
        raise ValueError('Unsafe output directory')
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    shutil.copytree(ROOT / 'public', OUTPUT)
    for name in ('sw.js', 'manifest.webmanifest'):
        (OUTPUT / name).unlink(missing_ok=True)
    fixtures = {'puzzles': puzzles, 'recognitionWords': [w.upper() for w in words],
                'tajenka': tajenka, 'build': report}
    payload = json.dumps(fixtures, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    (OUTPUT / 'mk100-fixtures.js').write_text('window.PROPLET_MK100_FIXTURES=' + payload + ';\n', encoding='utf-8')
    write_json(OUTPUT / 'puzzles.json', puzzles)
    html = (OUTPUT / 'index.html').read_text(encoding='utf-8')
    marker = '  <script src="/theme-init.js?v=flowcontext1"></script>'
    if html.count(marker) != 1:
        raise ValueError('Native bootstrap location changed; review injection')
    html = html.replace(marker, '  <script src="/mk100-fixtures.js"></script>\n'
                        '  <script src="/app/mk100-integrated-preview.js"></script>\n' + marker)
    html = html.replace('</head>', '  <meta name="robots" content="noindex, nofollow">\n'
                        '  <link rel="stylesheet" href="/mozkokalypsa-difficulty-preview.css">\n'
                        '  <link rel="stylesheet" href="/mozkokalypsa-launch-preview.css">\n</head>')
    html = html.replace('</body>', '  <script src="/app/mk100-launch-preview.js"></script>\n</body>')
    html = re.sub(r'\s*<script defer src="/_vercel/(?:insights|speed-insights)/script\.js"></script>', '', html)
    html = html.replace('  <link rel="manifest" href="/manifest.webmanifest?v=share20260912" />', '')
    (OUTPUT / 'index.html').write_text(html, encoding='utf-8')
    (OUTPUT / 'robots.txt').write_text('User-agent: *\nDisallow: /\n', encoding='utf-8')
    write_json(OUTPUT / 'integrated-preview-build.json', report)
    print(json.dumps(report, ensure_ascii=False))
    return report


if __name__ == '__main__':
    build()
