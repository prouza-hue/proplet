"""Complete unpublished v3 targets and the current finite recognition snapshot.

This is a deliberate manufacturing scope change, not a runtime vocabulary change.
The immutable v3 output and original input guards remain active in FullCatalog.
Current main changed server/game integration after that editorial snapshot, but
did not change any guarded lexical inputs. Recognition is independently rebuilt
from the actual current runtime index and pinned complete wordfreq table.
"""
from __future__ import annotations

from collections import Counter
from copy import deepcopy
from functools import lru_cache
import hashlib
from importlib.metadata import version
import json
from pathlib import Path
import subprocess

from tools.gen5.catalog import ROOT, digest, norm, read_json
from .catalog import ALPHABET, HISTORY_FILES, board_hash, classify, walk_boards
from .full_catalog import FullCatalog, WORKING, sha

DIRECTORY = ROOT / 'content/gen6/mozkokalypsa-100'
LEXICON_SHA256 = '7baff6af094af0331d379050a680980e9b4f880428efd0c9ea620ce80c1fc277'
WORDFREQ_VERSION = '3.1.1'
HANDOVER_SOURCE_SHA = 'a9e5bd9dfde0524312fd610118f3bcbcedc16ee8'
VERIFIED_MAIN_SHA = '174e0fa2a3e8befd0fe01ac8ba7771f4ece25558'
CURRENT_HISTORY_FILES = HISTORY_FILES + ('data/playtests/mozkokalypsa-v3.json',)


def _git_sha(ref='HEAD'):
    return subprocess.check_output(['git', 'rev-parse', ref], cwd=ROOT, text=True).strip()


def _git_input(path, ref):
    """A Git blob checksum is evidence about bytes, not remote production state."""
    result = subprocess.run(['git', 'show', f'{ref}:{path}'], cwd=ROOT,
                            capture_output=True)
    return hashlib.sha256(result.stdout).hexdigest() if result.returncode == 0 else None


@lru_cache(maxsize=1)
def recognition_snapshot():
    """Enumerate the full current single-token recognizer, with no API/DB calls.

    wordfreq can assign frequencies compositionally to multiple tokens, but every
    acceptable Czech alphabetic word is a single tokenizer token. We assert this
    for the entire table and enumerate every accepted form, not a target subset.
    """
    import word_recognition_v3330 as runtime
    from wordfreq import available_languages, get_frequency_dict, tokenize, zipf_frequency

    if version('wordfreq') != WORDFREQ_VERSION:
        raise ValueError('Manufacturing requires exactly wordfreq 3.1.1')
    frequency_table = get_frequency_dict('cs')
    accepted_fallback = set()
    tokenization_failures = []
    for original in frequency_table:
        word = runtime._normalize(original)
        if not runtime._acceptable(word):
            continue
        if tokenize(word, 'cs') != [word]:
            tokenization_failures.append(word)
            continue
        threshold = (runtime.WORDFREQ_ZIPF_THRESHOLD_DIACRITIC
                     if any(ch in runtime._CZECH_DIACRITICS for ch in word)
                     else runtime.WORDFREQ_ZIPF_THRESHOLD_PLAIN)
        if zipf_frequency(word, 'cs') >= threshold:
            accepted_fallback.add(word)
    if tokenization_failures:
        raise ValueError('Alphabetic tokenization assumptions changed: '
                         + repr(tokenization_failures[:20]))

    runtime_static = set(runtime._recognition_index())
    working_static = {norm(w) for w in (WORKING / 'recognition-words.txt')
                      .read_text(encoding='utf-8').splitlines()}
    variant_groups = read_json(WORKING / 'variant-groups.json')['groups']
    variants = {norm(w) for group in variant_groups for w in group['members']}
    targets = {norm(e['word']) for e in read_json(WORKING / 'lexicon.json')['entries']}
    words = sorted(w for w in working_static | runtime_static | variants | targets | accepted_fallback
                   if runtime._acceptable(w))
    raw = ('\n'.join(words) + '\n').encode('utf-8')
    old_frequency = read_json(ROOT / 'content/gen6/round3-eight/wordfreq-manifest.json')
    fallback_raw = ('\n'.join(sorted(accepted_fallback)) + '\n').encode('utf-8')
    fallback_hash = hashlib.sha256(fallback_raw).hexdigest()
    # The old table export is only a comparison. It cannot override current policy.
    old_policy_unchanged = (
        old_frequency['version'] == WORDFREQ_VERSION
        and old_frequency['thresholds']['WORDFREQ_ZIPF_THRESHOLD_DIACRITIC']
        == runtime.WORDFREQ_ZIPF_THRESHOLD_DIACRITIC
        and old_frequency['thresholds']['WORDFREQ_ZIPF_THRESHOLD_PLAIN']
        == runtime.WORDFREQ_ZIPF_THRESHOLD_PLAIN)
    if old_policy_unchanged and fallback_hash != old_frequency['sha256']:
        raise ValueError('Pinned full-table reconstruction differs from historical export')
    input_paths = ('word_recognition_v3330.py', 'requirements.txt', 'data/words.txt',
                   'public/valid-words-v3328.txt', 'data/lexicon_v2.json',
                   'data/lexicon_v2_wikidata_raw.json',
                   'content/lexicon-v3/working/manifest.json',
                   'content/lexicon-v3/working/lexicon.json',
                   'content/lexicon-v3/working/recognition-words.txt',
                   'content/lexicon-v3/working/variant-groups.json')
    source_hashes = {p: sha(ROOT / p) for p in input_paths}
    frequency_source = Path(available_languages('best')['cs'])
    # A replay must not silently substitute a future origin/main snapshot.
    current_main_sha = _git_sha(VERIFIED_MAIN_SHA)
    reference_deltas = []
    # Server constants determine dated content inventory but are not v3 editorial
    # input bytes. Their permitted integration update is preserved as a Git-proven
    # old -> new delta, never used to disable the immutable lexicon guards.
    for path in (*CURRENT_HISTORY_FILES, 'server.py', 'word_recognition_v3330.py'):
        before = _git_input(path, HANDOVER_SOURCE_SHA)
        current = sha(ROOT / path)
        if before != current:
            current_main_hash = _git_input(path, current_main_sha)
            if current != current_main_hash:
                raise ValueError('Updated reference input does not match verified main: ' + path)
            reference_deltas.append({'path': path, 'oldSha256': before, 'newSha256': current,
                                     'oldCommit': HANDOVER_SOURCE_SHA,
                                     'newCommit': current_main_sha,
                                     'basis': 'exact Git main blob; integration update, no lexicon regeneration'})
    manifest = {
        'schemaVersion': 1, 'version': 'mk100-recognition-20261001-v1',
        'runtimeRecognitionVersion': runtime.RECOGNITION_VERSION,
        'currentCheckoutShaAtSnapshot': _git_sha(),
        'currentMainShaAtSnapshot': current_main_sha,
        'referenceInputDeltas': reference_deltas,
        'immutableWorkingLexiconSha256': LEXICON_SHA256,
        'sourceSha256': source_hashes,
        'sourceCounts': {'workingV3Static': len(working_static),
                         'currentRuntimeStatic': len(runtime_static),
                         'workingV3Targets': len(targets),
                         'orthographicVariants': len(variants),
                         'currentRuntimeOverlay': len(runtime.RECOGNITION_OVERLAY),
                         'wordfreqAccepted': len(accepted_fallback)},
        'runtimeOverlay': sorted(runtime.RECOGNITION_OVERLAY),
        'wordfreq': {'package': 'wordfreq', 'version': WORDFREQ_VERSION,
                     'language': 'cs', 'tableEntries': len(frequency_table),
                     'frequencySourceFile': frequency_source.name,
                     'frequencySourceSha256': sha(frequency_source),
                     'acceptedEntries': len(accepted_fallback),
                     'sha256': fallback_hash,
                     'thresholds': {'diacritic': runtime.WORDFREQ_ZIPF_THRESHOLD_DIACRITIC,
                                    'plain': runtime.WORDFREQ_ZIPF_THRESHOLD_PLAIN},
                     'nonSingleTokenAlphabeticEntries': tokenization_failures,
                     'historicalExportReproduced': fallback_hash == old_frequency['sha256']},
        'acceptedEntries': len(words), 'sha256': hashlib.sha256(raw).hexdigest(),
        'blocklist': sorted(runtime.RECOGNITION_BLOCKLIST), 'minimumLength': 4,
        'maximumLength': 24, 'alphabet': 'a-záčďéěíňóřšťúůýž',
        'recognitionOnly': True, 'productionChanged': False,
        'limitations': [
            'Frozen offline snapshot of current static and single-token frequency recognition; no production endpoint queried.',
            'Working v3 targets and spelling variants are included for unpublished candidate validation; this does not add them to runtime.',
            'Recognition presence is not lexical editorial approval and does not make a word a generation target.',
            'Existing v3 source-depth limitations remain preserved; inherited legacy-v2 approvals are not newly re-certified.',
            'Future runtime/library/input changes require a new snapshot and complete revalidation.',
        ],
    }
    return words, manifest


class Mk100Catalog(FullCatalog):
    def __init__(self, as_of='2026-10-01'):
        super().__init__(as_of=as_of)
        if self.lexicon_hash != LEXICON_SHA256:
            raise ValueError('The completed working v3 lexicon is immutable for this manufacture')
        self.selection_scope = 'all-working-v3-eligible-A-B-C-D-5-to-9'
        # FullCatalog's history predates the third playtest. Rebuild the same
        # dated, non-personal inventory with III added; do not mutate old banks.
        self.inventory = {}
        self.inventory_boards = {}
        for path in CURRENT_HISTORY_FILES:
            document = read_json(ROOT / path)
            for board, location in walk_boards(document):
                raw_id, content_hash = board['id'], board_hash(board)
                key = ('retired-tajenka-v1:' + raw_id
                       if path.endswith('tajenka_weekend_v1.json') else raw_id)
                record = self.inventory.setdefault(key, {
                    'id': raw_id, 'inventoryKey': key, 'contentHash': content_hash,
                    'words': sorted(self.words(board)), 'sources': []})
                if record['contentHash'] != content_hash:
                    raise ValueError('Conflicting historical board identity: ' + key)
                record['sources'].append(classify(board, path, location, document, self.as_of))
                self.inventory_boards[key] = board
        self.historical_ids = {r['id'] for r in self.inventory.values()}
        self.historical_words_hashes = {digest(r['words']) for r in self.inventory.values()}
        self.historical_board_hashes = {r['contentHash'] for r in self.inventory.values()}
        self.global_counts = Counter(w for r in self.inventory.values() for w in r['words'])
        self.released_counts, self.reserved_counts = Counter(), Counter()
        self.playtest_words = set()
        for record in self.inventory.values():
            statuses = {s['availabilityStatus'] for s in record['sources']}
            target = self.released_counts if 'released-or-available' in statuses else self.reserved_counts
            target.update(record['words'])
            if any(s['scope'] == 'restricted-playtest' for s in record['sources']):
                self.playtest_words.update(record['words'])

    def available_for_mk100(self):
        """Eligibility is separate from per-board editorial rarity constraints."""
        return {w: e for w, e in self.entries.items()
                if w not in self.exclusions and e['target_eligible']
                and e['tier'] in {'A', 'B', 'C', 'D'} and 5 <= len(w) <= 9
                and ALPHABET.fullmatch(w)}

    def full_dictionary(self):
        return list(recognition_snapshot()[0])

    def capacity(self):
        def stats(entries):
            pairs = Counter((len(w), e['tier']) for w, e in entries.items())
            return {'total': len(entries),
                    'byLength': dict(sorted(Counter(map(len, entries)).items())),
                    'byTier': dict(sorted(Counter(e['tier'] for e in entries.values()).items())),
                    'byLengthAndTier': {str(n): {t: pairs[n, t] for t in 'ABCD'} for n in range(5, 10)},
                    'byTopic': dict(sorted(Counter(e.get('topic', e.get('theme', 'unknown'))
                                                  for e in entries.values()).items()))}
        eligible = self.available_for_mk100()
        return {'asOf': self.as_of.isoformat(), 'selectionScope': self.selection_scope,
                'lexiconHash': self.lexicon_hash, 'workingEntries': len(self.entries),
                'mk100Eligible': stats(eligible),
                'mk100EligibleOutsidePlaytests': stats({w: e for w, e in eligible.items()
                                                      if w not in self.playtest_words}),
                'newApproved': stats(self.additions), 'historyBoards': len(self.inventory),
                'historySources': list(CURRENT_HISTORY_FILES),
                'personalExposure': 'unknown-not-inferred',
                'policyDelta': {'old': 'round3 additions or limited legacy_c_pool; tiers A/B/C',
                                'new': 'all approved target-eligible v3; tiers A/B/C/D; lengths5–9',
                                'reason': '100-board manufacture explicitly expands the pilot scope; board-level rarity review still required'},
                'inventoryStatusCounts': dict(Counter(s['availabilityStatus'] for r in self.inventory.values()
                                                     for s in r['sources']))}

    def input_hashes(self):
        paths = set(super().input_hashes()) | set(CURRENT_HISTORY_FILES)
        paths |= {'word_recognition_v3330.py', 'requirements.txt', 'tools/gen6/mk100_catalog.py'}
        return {p: sha(ROOT / p) for p in sorted(paths)}

    def write_recognition_snapshot(self, directory=DIRECTORY):
        words, source_manifest = recognition_snapshot()
        manifest = deepcopy(source_manifest)
        directory = Path(directory)
        directory.mkdir(parents=True, exist_ok=True)
        v3_manifest = read_json(WORKING / 'manifest.json')
        input_deltas = []
        for path, old_hash in v3_manifest['provenance']['input_sha256'].items():
            new_hash = sha(ROOT / path)
            if old_hash != new_hash:
                # Normally empty: FullCatalog hard-fails any unapproved input delta.
                input_deltas.append({'path': path, 'oldSha256': old_hash, 'newSha256': new_hash})
        manifest['historicalV3InputDeltas'] = input_deltas
        manifest['historicalV3OutputsVerified'] = v3_manifest['outputs_sha256']
        manifest['capacity'] = self.capacity()
        (directory / 'recognition-words.txt').write_text('\n'.join(words) + '\n', encoding='utf-8')
        (directory / 'recognition-manifest.json').write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        return manifest


if __name__ == '__main__':
    catalog = Mk100Catalog()
    snapshot = catalog.write_recognition_snapshot()
    print(json.dumps({'capacity': catalog.capacity(), 'recognitionEntries': snapshot['acceptedEntries'],
                      'recognitionSha256': snapshot['sha256']}, ensure_ascii=False, indent=2))
