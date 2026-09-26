"""Candidate vocabulary and dated, non-personal content inventory over Gen5."""
from collections import Counter
from copy import deepcopy
from datetime import date, timedelta
import hashlib
from pathlib import Path
import re
from functools import lru_cache
import subprocess

from tools.gen5.catalog import Catalog, DIFFICULTIES, ROOT, digest, norm, read_json
from tools.gen5.validation import validation_words

ALPHABET = re.compile('[a-záčďéěíňóřšťúůýž]+')
HISTORY_FILES = ('public/puzzles.json', 'data/puzzles.json',
                 'data/rolling_content_v1.json', 'data/tajenka_weekend_v1.json',
                 'data/tajenka_weekend_v2.json', 'data/playtests/mozkokalypsa-v1.json',
                 'data/playtests/mozkokalypsa-v2.json', 'data/legacy_daily_gen1.json',
                 'data/legacy_daily_gen2.json')


def board_hash(board):
    """Identity is geometry/answers, independent of runtime metadata and ordering."""
    return digest({'rows': board['rows'], 'cols': board['cols'], 'letters': board['letters'],
                   'mask': sorted(board['mask']), 'lengths': sorted(board['lengths']),
                   'answers': sorted((norm(a['word']), a['path']) for a in board['answers'])})


def additions_from(payload, existing, exclusions):
    entries = {}
    for entry in payload['entries']:
        word = norm(entry['word'])
        if word in entries or word in existing:
            raise ValueError('Duplicate candidate or v2 collision: ' + word)
        if word in exclusions or word == 'lunochod':
            raise ValueError('Explicitly excluded candidate: ' + word)
        if not ALPHABET.fullmatch(word) or not 4 <= len(word) <= 24:
            raise ValueError('Invalid candidate spelling/length: ' + word)
        if entry.get('runtime_approved') is not False:
            raise ValueError('Candidate runtime approval must remain false: ' + word)
        if entry.get('candidate_generation_allowed') is not True:
            continue  # Deferred/unapproved words never enter the generation catalog.
        if (entry.get('editorial_status') != 'accepted' or entry.get('tier') not in {'A','B','C','D'}
                or not entry.get('evidence') or not entry.get('reviewer')
                or not entry.get('reviewed_at') or not entry.get('topic')):
            raise ValueError('Incomplete explicit editorial approval: ' + word)
        date.fromisoformat(entry['reviewed_at'][:10])
        for source in entry['evidence']:
            if (not isinstance(source, dict) or source.get('verified') is not True
                    or not str(source.get('url', '')).startswith('https://')
                    or not source.get('headword') or not source.get('observation')
                    or not source.get('retrieved_at')):
                raise ValueError('Unverified or incomplete headword evidence: ' + word)
            date.fromisoformat(source['retrieved_at'][:10])
        entries[word] = {**deepcopy(entry), 'word': word, 'theme': entry['topic'],
                         'origin': 'lexicon-v3-editorial-batch-1', 'fun': entry.get('fun', 3)}
    return entries


def walk_boards(node, location=()):
    if isinstance(node, dict):
        if all(k in node for k in ('id', 'answers', 'letters', 'mask', 'rows', 'cols')):
            yield node, location
        else:
            for key, value in node.items():
                yield from walk_boards(value, location + (str(key),))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from walk_boards(value, location + (str(index),))


def classify(board, path, location, document, as_of):
    meta = board.get('meta') or {}
    released = meta.get('availableFrom') or board.get('date') or meta.get('date')
    if released:
        released = str(released)[:10]
        date.fromisoformat(released)
    scope = 'catalog'
    if 'playtests/' in path:
        # The frozen bank proves membership, not deployment or personal exposure.
        scope = 'restricted-playtest'
        released = None
    elif 'tajenka' in path:
        scope = 'tajenka'
        released = released or meta.get('weekend') or board.get('weekend')
        if path.endswith('_v2.json'):
            # Exact current-main server.py cadence, read without importing the server.
            constants = tajenka_constants()
            week = int(board['week'])
            released = ((constants['TAJENKA_FIRST_SATURDAY'] + timedelta(days=(week-1)*7)) if week < 3
                        else (constants['TAJENKA_TWICE_WEEKLY_START'] + timedelta(days=((week-3)//2)*7 + (4 if (week-3)%2 else 0)))).isoformat()
    elif 'daily' in location and not any(k.startswith('legacy') for k in location):
        scope = 'daily'
        base = document.get('dailyRotationBaseDate')
        if meta.get('contentGeneration', document.get('dailyGeneration')) != document.get('dailyGeneration'):
            scope = 'legacy-daily-snapshot'
            released = None
        elif base:
            position = int(location[location.index('daily') + 1])
            released = (date.fromisoformat(base) + timedelta(days=position)).isoformat()
    elif any(k.startswith('legacy') for k in location):
        scope = 'legacy-catalog'
    elif 'legacy_daily' in path:
        scope = 'legacy-daily-snapshot'
    if 'rolling' in path and document.get('releaseEnabled') is False:
        status = 'reserved-disabled'
    elif released and released[:10] > as_of.isoformat():
        status = 'reserved-future'
    else:
        status = 'released-or-available'
    if scope == 'tajenka' and not released:
        status = 'retired-snapshot-date-unresolved'
    if scope == 'legacy-daily-snapshot':
        status = 'retired-snapshot-not-personal-exposure'
    return {'source': path, 'location': '/'.join(location), 'scope': scope,
            'availabilityStatus': status, 'availableFrom': released,
            'observedAsOf': as_of.isoformat(), 'personalExposure': 'unknown-not-inferred'}


@lru_cache(maxsize=1)
def tajenka_constants():
    import ast
    tree = ast.parse((ROOT/'server.py').read_text(encoding='utf-8'))
    constants = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in {'TAJENKA_FIRST_SATURDAY', 'TAJENKA_TWICE_WEEKLY_START'}:
                    constants[target.id] = date(*(ast.literal_eval(a) for a in node.value.args))
    return constants


class CandidateCatalog(Catalog):
    def __init__(self, lexicon_path, as_of):
        super().__init__()
        self.lexicon_path = Path(lexicon_path).resolve()
        self.as_of = date.fromisoformat(as_of) if isinstance(as_of, str) else as_of
        payload = read_json(self.lexicon_path)
        self.source_sha = verify_candidate_provenance(self.lexicon_path, payload)
        self.additions = additions_from(payload, self.entries, self.exclusions)
        self.entries.update(self.additions)
        # Only explicit editorial mappings, never automatic stemming. Meaningful
        # derivations share a soft family penalty; orthographic variants are stricter.
        for addition in self.additions.values():
            for key in ('family', 'variant_group'):
                group = addition.get(key)
                if group:
                    for member in re.split(r'[|/]', group):
                        if norm(member) in self.entries:
                            self.entries[norm(member)][key] = group
        self.inventory = {}
        self.inventory_boards = {}
        for path in HISTORY_FILES:
            document = read_json(ROOT / path)  # Missing history is a hard failure.
            for board, location in walk_boards(document):
                raw_id, content_hash = board['id'], board_hash(board)
                # Retired v1 Tajenka reused v2 IDs; preserve that historical fact
                # explicitly without allowing it to hide a collision in active banks.
                key = 'retired-tajenka-v1:' + raw_id if path.endswith('tajenka_weekend_v1.json') else raw_id
                record = self.inventory.setdefault(key, {'id': raw_id, 'inventoryKey': key, 'contentHash': content_hash,
                    'words': sorted(self.words(board)), 'sources': []})
                if record['contentHash'] != content_hash:
                    raise ValueError('Conflicting historical board ID: ' + key)
                record['sources'].append(classify(board, path, location, document, self.as_of))
                self.inventory_boards[key] = board
        self.historical_ids = {r['id'] for r in self.inventory.values()}
        self.historical_words_hashes = {digest(record['words']) for record in self.inventory.values()}
        self.historical_board_hashes = {record['contentHash'] for record in self.inventory.values()}
        self.global_counts = Counter(w for r in self.inventory.values() for w in r['words'])
        self.released_counts = Counter()
        self.reserved_counts = Counter()
        self.playtest_words = set()
        for record in self.inventory.values():
            statuses = {s['availabilityStatus'] for s in record['sources']}
            target = self.released_counts if 'released-or-available' in statuses else self.reserved_counts
            target.update(record['words'])
            if any(s['scope'] == 'restricted-playtest' for s in record['sources']):
                self.playtest_words.update(record['words'])

    def available_for_round3(self):
        # Keep v2 approval provenance as legacy; do not assert fresh source verification.
        return {w: e for w, e in self.entries.items() if w not in self.exclusions
                and e['tier'] in {'A', 'B', 'C'} and 5 <= len(w) <= 9
                and e.get('fun', 3) >= 3 and ALPHABET.fullmatch(w)
                and (w in self.additions or e.get('origin') != 'wikidata_frequency_candidate')}

    def capacity(self):
        def stats(entries):
            return {'total': len(entries), 'byLength': dict(sorted(Counter(map(len, entries)).items())),
                    'byTier': dict(sorted(Counter(e['tier'] for e in entries.values()).items())),
                    'byTopic': dict(sorted(Counter(e.get('topic', e.get('theme', 'unknown')) for e in entries.values()).items()))}
        eligible = self.available_for_round3()
        return {'asOf': self.as_of.isoformat(), 'newApproved': stats(self.additions),
                'round3Eligible': stats(eligible),
                'round3EligibleOutsidePlaytests': stats({w:e for w,e in eligible.items() if w not in self.playtest_words}),
                'historyBoards': len(self.inventory), 'personalExposure': 'unknown-not-inferred',
                'historySources': list(HISTORY_FILES),
                'inventoryStatusCounts': dict(Counter(s['availabilityStatus'] for r in self.inventory.values() for s in r['sources']))}


def frozen_validation_words(catalog):
    """Broader static recognizer union + additions, never dynamic wordfreq claims."""
    words = set(validation_words(catalog))
    words |= {norm(w) for w in (ROOT/'public/valid-words-v3328.txt').read_text(encoding='utf-8').splitlines()}
    return sorted(w for w in words if 4 <= len(w) <= 24 and w != 'negr' and ALPHABET.fullmatch(w))


def frozen_inputs(catalog):
    paths = {ROOT / path for path in HISTORY_FILES}
    paths |= {ROOT / p for p in ('data/lexicon_v2.json', 'data/words.txt',
        'public/valid-words-v3328.txt', 'data/lexicon_v2_wikidata_raw.json',
        'word_recognition_v3330.py', 'data/target_generation_exclusions_v334.json',
        'content/gen5/profiles.json', 'server.py', 'tools/mozkokalypsa_lab.py', 'tools/measure_gen4_ambiguity.py')}
    paths |= set((ROOT/'tools/gen5').glob('*.py')) | set((ROOT/'tools/gen6').glob('*.py'))
    paths.add(catalog.lexicon_path)
    paths |= {catalog.lexicon_path.parent/p for p in ('candidate-seeds.json','editorial-batch-001.json')}
    paths.add(ROOT/'tools/build_lexicon_v3_candidates.py')
    return {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)}


def verify_candidate_provenance(path, payload):
    provenance = payload['provenance']
    parent = path.parent
    files = {'seeds_sha256': parent/'candidate-seeds.json',
             'review_sha256': parent/'editorial-batch-001.json',
             'legacy_v2_sha256': ROOT/'data/lexicon_v2.json'}
    for key, source in files.items():
        if hashlib.sha256(source.read_bytes()).hexdigest()!=provenance[key]:
            raise ValueError('Candidate provenance input changed: '+key)
    review = read_json(files['review_sha256'])
    if review['source_main_sha'] != provenance['source_main_sha']:
        raise ValueError('Candidate source SHA differs from editorial review')
    ids = {}
    for wave, groups in read_json(files['seeds_sha256']).items():
        index=0
        for text in groups.values():
            for word in text.split():
                index+=1; ids[word]=f'L3-W{wave}-{index:04d}'
    approved = [{**r, 'candidate_id':ids[norm(r['original_word'])], 'word':norm(r['word']).upper(),
                 'editorial_status':'accepted','original_decision':r['editorial_status']}
                for r in review['records'] if r['editorial_status'] in {'accepted','corrected'}]
    if payload['entries'] != approved:
        raise ValueError('Candidate entries do not reproduce the signed editorial input')
    return provenance['source_main_sha']


def verify_source_snapshot(source_sha, inputs):
    """Verify actual read-only inputs against the locally available Git commit."""
    if subprocess.check_output(['git','cat-file','-t',source_sha],cwd=ROOT,text=True).strip()!='commit':
        raise ValueError('Source SHA is not a local commit')
    for path in inputs:
        if path.startswith(('tools/gen6/','content/lexicon-v3/')) or path=='tools/build_lexicon_v3_candidates.py':
            continue
        expected=subprocess.check_output(['git','rev-parse',f'{source_sha}:{path}'],cwd=ROOT,text=True).strip()
        actual=subprocess.check_output(['git','hash-object',path],cwd=ROOT,text=True).strip()
        if actual!=expected:
            raise ValueError('Source snapshot mismatch: '+path)
