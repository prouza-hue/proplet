"""Build only an isolated static preview; no API functions, accounts or database.

Existing public runtime files and released banks are read, never rewritten.
The output implements Vercel Build Output API v3; do not point this build at
production. Production Vercel builds fail before reading or writing output.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
STYLES = (
    'styles.css', 'quality-v334.css', 'organic-ui-v4023.css', 'ribbon-ui.css',
    'printshop-ui.css', 'mozkokalypsa.css', 'app-play.css',
    'gesture-guard-v3325.css', 'desktop-layout-v3330.css', 'game.css',
    'typography-readability-v1.css', 'brand-wordmark-fraunces.css',
    'game-release-polish.css',
)
RUNTIME = tuple('app/game/' + name + '.js' for name in ('board', 'input', 'state', 'hints')) + ('game-layout-v3330.js',)
ART = ('difficulty/printshop/mozkokalypsa-v2.svg', 'favicon.svg')
CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'"


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def verify_bank(bank):
    if bank.get('kind') != 'gen6-unpublished-preview' or bank.get('status') != 'verified-unpublished':
        raise ValueError('Only a verified unpublished Gen6 package may be previewed')
    if bank.get('publicationAuthorized') is not False or bank.get('generatorGeneration') != 6 or bank.get('runtimeFreeGeneration') != 4:
        raise ValueError('Invalid preview isolation / generation metadata')
    if not re.fullmatch(r'[0-9a-f]{40}', bank.get('sourceSha', '')):
        raise ValueError('Missing exact source revision')
    boards = bank.get('boards', [])
    if len(boards) != 12 or [b.get('id') for b in boards] != [f'mk3-{i:02d}' for i in range(1, 13)]:
        raise ValueError('Preview requires all 12 stable round-three board IDs')
    if bank.get('contentHash') != digest(boards):
        raise ValueError('Bank content hash mismatch')
    hashes = set()
    dictionary_hash = bank.get('validationDictionary', {}).get('sha256')
    if not re.fullmatch(r'[0-9a-f]{64}', dictionary_hash or ''):
        raise ValueError('Missing frozen validation dictionary hash')
    for board in boards:
        meta = board.get('meta', {})
        if (board.get('rows') != 10 or board.get('cols') != 10 or board.get('difficulty') != 'mozkomor'
                or len(board.get('answers', [])) != 14 or sorted(board.get('mask', [])) != list(range(100))
                or len(board.get('letters', [])) != 100 or meta.get('playtestOnly') is not True
                or meta.get('generatorGeneration') != 6 or meta.get('contentGeneration') != 4):
            raise ValueError('Board parameters changed: ' + board['id'])
        proof = meta.get('validation', {})
        if proof.get('status') != 'unique' or proof.get('targetPathsUnique') is not True or proof.get('dictionaryHash') != dictionary_hash:
            raise ValueError('Board has not passed frozen-dictionary validation: ' + board['id'])
        content_hash = meta.get('contentHash')
        if not re.fullmatch(r'[0-9a-f]{64}', content_hash or '') or content_hash in hashes:
            raise ValueError('Missing or repeated board content hash: ' + board['id'])
        geometry_hash = digest({'rows': board['rows'], 'cols': board['cols'], 'letters': board['letters'],
                                'mask': sorted(board['mask']), 'lengths': sorted(board['lengths']),
                                'answers': sorted((unicodedata.normalize('NFC', a['word']).strip().casefold(), a['path']) for a in board['answers'])})
        if content_hash != geometry_hash:
            raise ValueError('Board content hash does not match its geometry: ' + board['id'])
        hashes.add(content_hash)
        covered = []
        for answer in board['answers']:
            path = answer['path']
            if len(path) != len(answer['word']) or len(path) != len(set(path)) or any(type(i) is not int or not 0 <= i < 100 for i in path):
                raise ValueError('Invalid answer path')
            if ''.join(board['letters'][i] for i in path) != answer['word']:
                raise ValueError('Answer letters do not match path')
            if any(abs(a//10 - b//10) + abs(a%10 - b%10) != 1 for a, b in zip(path, path[1:])):
                raise ValueError('Answer path is not orthogonal')
            covered.extend(path)
        if sorted(covered) != list(range(100)):
            raise ValueError('Answers must exactly cover the board')


def build(bank_path, recognition_path=None, output=None):
    if os.environ.get('VERCEL_ENV') == 'production':
        raise RuntimeError('Gen6 candidate preview cannot build as production')
    bank = json.loads(bank_path.read_text(encoding='utf-8'))
    verify_bank(bank)
    if recognition_path is None:
        raise ValueError('Preview requires the exact frozen recognition dictionary')
    raw = recognition_path.read_bytes()
    normalized = sorted({unicodedata.normalize('NFC', w).strip().casefold() for w in raw.decode('utf-8').splitlines() if w.strip()})
    if digest(normalized) != bank['validationDictionary']['sha256']:
        raise ValueError('Recognition file differs from validation dictionary')
    words = [w.upper() for w in normalized]
    output = (output or ROOT/'.vercel/output').resolve()
    if output == ROOT or ROOT in output.parents and not (ROOT/'.vercel') in output.parents:
        raise ValueError('Output inside source must be under .vercel')
    for name in (*STYLES, *RUNTIME, *ART):
        if not (ROOT/'public'/name).is_file():
            raise FileNotFoundError('Missing exact-source runtime asset: ' + name)
    output.mkdir(parents=True, exist_ok=True)
    static = output/'static'
    if static.exists():
        shutil.rmtree(static)
    static.mkdir()
    if (output/'functions').exists():
        raise ValueError('Preview output must not contain server functions')
    fingerprints = {}
    for name in (*STYLES, *RUNTIME, *ART):
        src = ROOT/'public'/name
        target = static/name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, target)
        fingerprints['public/' + name] = hashlib.sha256(src.read_bytes()).hexdigest()
    for name in ('index.html', 'preview.css', 'preview.js', 'layout-check.html', 'layout-check.js'):
        shutil.copyfile(ROOT/'preview/gen6'/name, static/name)
    # Data as same-origin script allows connect-src 'none': no fetch, XHR, beacon,
    # WebSocket or service-worker path can send gameplay data anywhere.
    payload = json.dumps(bank, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    recognition = json.dumps(words, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    (static/'bank.js').write_text('window.PROPLET_GEN6_PREVIEW=' + payload + ';\nwindow.PROPLET_GEN6_RECOGNITION=' + recognition + ';\n', encoding='utf-8')
    (static/'404.html').write_text('<!doctype html><html lang="cs"><meta charset="utf-8"><title>Proplet preview</title><p>Tato adresa není součástí izolovaného náhledu.</p></html>', encoding='utf-8')
    config = {'version': 3, 'routes': [
        {'src': '/api(?:/.*)?', 'status': 404},
        {'src': '/(.*)', 'headers': {'Content-Security-Policy': CSP, 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}},
        {'handle': 'filesystem'},
        {'src': '/(.*)', 'dest': '/404.html', 'status': 404},
    ]}
    (output/'config.json').write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
    report = {'kind': 'gen6-static-preview-build', 'sourceSha': bank['sourceSha'], 'bankContentHash': bank['contentHash'], 'recognitionWords': len(words), 'recognitionFileSha256': hashlib.sha256(raw).hexdigest(), 'boards': 12, 'serverFunctions': 0, 'accounts': False, 'productionWrites': False, 'gameplayNetworkConnections': False, 'externalFonts': 'Google Fonts: original Fraunces / Outfit styles', 'runtimeAssets': fingerprints}
    (output/'preview-build.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bank', type=Path, default=ROOT/'content/gen6/mozkokalypsa-v3-preview.json')
    parser.add_argument('--recognition', type=Path, required=True)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    report = build(args.bank, args.recognition, args.output)
    print(json.dumps({k:v for k,v in report.items() if k!='runtimeAssets'}, ensure_ascii=False))
