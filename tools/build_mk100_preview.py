"""Build the isolated playable hundred from verified data and native game modules.

No production assets, accounts, analytics, service worker or API are modified.
The complete frozen recognition set is embedded as a static same-origin script.
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
CONTENT = ROOT / 'content/gen6/mozkokalypsa-100'
STYLES = (
    'styles.css', 'quality-v334.css', 'organic-ui-v4023.css', 'ribbon-ui.css',
    'printshop-ui.css', 'mozkokalypsa.css', 'app-play.css',
    'gesture-guard-v3325.css', 'desktop-layout-v3330.css', 'game.css',
    'typography-readability-v1.css', 'brand-wordmark-fraunces.css',
    'game-release-polish.css',
)
RUNTIME = tuple('app/game/' + name + '.js' for name in ('state', 'board', 'input', 'hints')) + ('game-layout-v3330.js',)
ART = ('difficulty/printshop/mozkokalypsa-v2.svg', 'rewards/printshop/calm.svg', 'favicon.svg', 'brand/wordmark.svg', 'tajenka.svg')
REPRESENTATIVE_LEVELS = (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 20)
CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def board_digest(board):
    return digest({'rows': board['rows'], 'cols': board['cols'], 'letters': board['letters'],
                   'mask': sorted(board['mask']), 'lengths': sorted(board['lengths']),
                   'answers': sorted((unicodedata.normalize('NFC', a['word']).strip().casefold(), a['path']) for a in board['answers'])})


def verify_bank(bank, allow_representative=False):
    statuses = {'technically-verified-unpublished', 'verified-unpublished', 'candidate-technically-verified-awaiting-editorial'}
    if allow_representative:
        statuses.add('representative-internally-verified')
    if bank.get('kind') != 'gen6-unpublished-preview' or bank.get('status') not in statuses:
        raise ValueError('Preview requires an internally verified unpublished candidate package')
    if (bank.get('publicationAuthorized') is not False or bank.get('playtestActivationAuthorized') is not False
            or bank.get('generatorGeneration') != 6 or bank.get('runtimeFreeGeneration') != 4):
        raise ValueError('Preview isolation / generation metadata is invalid')
    if not re.fullmatch(r'[0-9a-f]{40}', bank.get('sourceSha', '')):
        raise ValueError('Missing source revision')
    boards = bank.get('boards', [])
    if len(boards) != 100 and not (allow_representative and len(boards) == 12):
        raise ValueError('The final preview requires exactly 100 verified boards')
    if bank.get('contentHash') != digest(boards):
        raise ValueError('Bank content hash mismatch')
    dictionary_hash = bank.get('validationDictionary', {}).get('sha256')
    if not re.fullmatch(r'[0-9a-f]{64}', dictionary_hash or ''):
        raise ValueError('Missing frozen validation dictionary hash')
    hashes, identities, levels = set(), set(), set()
    for board in boards:
        meta = board.get('meta', {})
        if (board.get('rows') != 10 or board.get('cols') != 10 or board.get('difficulty') != 'mozkomor'
                or len(board.get('answers', [])) != 14 or sorted(board.get('mask', [])) != list(range(100))
                or len(board.get('letters', [])) != 100 or meta.get('candidateOnly') is not True
                or meta.get('playtestOnly') is not True or meta.get('generatorGeneration') != 6
                or meta.get('contentGeneration') != 4):
            raise ValueError('Board parameters changed: ' + str(board.get('id')))
        proof = meta.get('validation', {})
        if (proof.get('status') != 'unique' or proof.get('targetPathsUnique') is not True
                or proof.get('dictionaryHash') != dictionary_hash):
            raise ValueError('Missing frozen-dictionary proof: ' + board['id'])
        content_hash = meta.get('contentHash')
        if content_hash != board_digest(board) or content_hash in hashes:
            raise ValueError('Missing, repeated or stale board content hash: ' + board['id'])
        if board['id'] in identities or meta.get('level') in levels:
            raise ValueError('Repeated candidate identity / ordinal')
        hashes.add(content_hash); identities.add(board['id']); levels.add(meta.get('level'))
        covered = []
        for answer in board['answers']:
            path, word = answer['path'], answer['word']
            if (len(path) != len(word) or len(path) != len(set(path))
                    or any(type(i) is not int or not 0 <= i < 100 for i in path)):
                raise ValueError('Invalid answer path')
            if ''.join(board['letters'][i] for i in path) != word:
                raise ValueError('Answer letters do not match path')
            if any(abs(a // 10 - b // 10) + abs(a % 10 - b % 10) != 1 for a, b in zip(path, path[1:])):
                raise ValueError('Answer path is not orthogonal')
            covered.extend(path)
        if sorted(covered) != list(range(100)) or sorted(board['lengths']) != sorted(len(a['word']) for a in board['answers']):
            raise ValueError('Answers must exactly cover the board and match lengths')
    if len(boards) == 100 and ([b['meta']['level'] for b in boards] != list(range(1, 101))):
        raise ValueError('The hundred must be ordered 1–100')
    if len(boards) == 100:
        profiles = {p: sum(b['meta'].get('profile') == p for b in boards) for p in ('relief', 'main', 'challenge', 'summit')}
        if profiles != {'relief': 20, 'main': 60, 'challenge': 15, 'summit': 5}:
            raise ValueError('Final dramaturgy does not match 20/60/15/5')


def build(bank_path=None, recognition_path=None, output=None, allow_representative=False):
    if os.environ.get('VERCEL_ENV', '').lower() == 'production':
        raise RuntimeError('Candidate-only preview: production build forbidden')
    bank_path = Path(bank_path or CONTENT / 'bank.json')
    bank = json.loads(bank_path.read_text(encoding='utf-8'))
    verify_bank(bank, allow_representative)
    lexicon_hash = hashlib.sha256((ROOT / 'content/lexicon-v3/working/lexicon.json').read_bytes()).hexdigest()
    if lexicon_hash != bank.get('lexiconHash'):
        raise ValueError('The complete working Lexikon v3 differs from the recorded source')
    recognition_path = Path(recognition_path or CONTENT / 'recognition-words.txt')
    raw = recognition_path.read_bytes()
    normalized = sorted({unicodedata.normalize('NFC', w).strip().casefold() for w in raw.decode('utf-8').splitlines() if w.strip()})
    if digest(normalized) != bank['validationDictionary']['sha256'] or len(normalized) != bank['validationDictionary']['size']:
        raise ValueError('Recognition data differs from the complete validation dictionary')
    recognized = set(normalized)
    if any(a['word'].casefold() not in recognized for b in bank['boards'] for a in b['answers']):
        raise ValueError('Target missing from frozen recognition data')
    static = Path(output or ROOT / 'dist-mk100').resolve()
    if static != ROOT / 'dist-mk100' and not (ROOT / 'work') in static.parents:
        raise ValueError('Build output must be dist-mk100 or under the checked workspace work/')
    assets = (*STYLES, *RUNTIME, *ART)
    for name in assets:
        if not (ROOT / 'public' / name).is_file():
            raise FileNotFoundError('Missing native runtime asset: ' + name)
    if static.exists():
        # Only an explicitly checked build output is removed; never source files.
        shutil.rmtree(static)
    static.mkdir(parents=True)
    fingerprints = {}
    for name in assets:
        src, target = ROOT / 'public' / name, static / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, target)
        fingerprints['public/' + name] = hashlib.sha256(src.read_bytes()).hexdigest()
    for name in ('index.html', 'preview.css', 'preview.js'):
        shutil.copyfile(ROOT / 'preview/mk100' / name, static / name)
    bank['representativeIds'] = [b['id'] for b in bank['boards'] if b['meta']['level'] in REPRESENTATIVE_LEVELS]
    if len(bank['representativeIds']) != 12:
        raise ValueError('Representative twelve is incomplete')
    representative_profiles = {p: sum(b['meta'].get('profile') == p for b in bank['boards'] if b['id'] in bank['representativeIds'])
                               for p in ('relief', 'main', 'challenge', 'summit')}
    if representative_profiles != {'relief': 3, 'main': 6, 'challenge': 2, 'summit': 1}:
        raise ValueError('Representative dramaturgy must match 3/6/2/1')
    bank['previewScope'] = 'hundred' if len(bank['boards']) == 100 else 'development-representative'
    payload = json.dumps(bank, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    words = json.dumps([w.upper() for w in normalized], ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    (static / 'bank.js').write_text('window.PROPLET_MK100_PREVIEW=' + payload + ';\n', encoding='utf-8')
    (static / 'recognition.js').write_text('window.PROPLET_MK100_RECOGNITION=' + words + ';\n', encoding='utf-8')
    (static / 'robots.txt').write_text('User-agent: *\nDisallow: /\n', encoding='utf-8')
    (static / '404.html').write_text('<!doctype html><html lang="cs"><meta charset="utf-8"><title>Proplet preview</title><p>Tato adresa není součástí izolovaného náhledu.</p></html>', encoding='utf-8')
    report = {'kind': 'mk100-static-preview-build', 'sourceSha': bank['sourceSha'],
              'bankContentHash': bank['contentHash'], 'bankStatus': bank['status'], 'previewScope': bank['previewScope'],
              'lexiconHash': lexicon_hash,
              'recognitionWords': len(normalized), 'recognitionDictionaryHash': digest(normalized),
              'recognitionFileSha256': hashlib.sha256(raw).hexdigest(), 'boards': len(bank['boards']),
              'representativeIds': bank['representativeIds'], 'serverFunctions': 0, 'accounts': False,
              'productionWrites': False, 'gameplayNetworkConnections': False,
              'externalFonts': 'Original Google Fonts Fraunces / Outfit', 'runtimeAssets': fingerprints,
              'nativeAdapterProvenance': '553fb3578c958004b831068dfd268dbcb2a423ab preview/gen6'}
    (static / 'preview-build.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bank', type=Path, default=CONTENT / 'bank.json')
    parser.add_argument('--recognition', type=Path, default=CONTENT / 'recognition-words.txt')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--allow-representative', action='store_true', help='Explicit development-only twelve-board build; never the final delivery.')
    args = parser.parse_args()
    result = build(args.bank, args.recognition, args.output, args.allow_representative)
    print(json.dumps({k: v for k, v in result.items() if k != 'runtimeAssets'}, ensure_ascii=False))
