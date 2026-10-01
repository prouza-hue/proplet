"""Use the complete, owner-approved v3 foundation without changing production.

The existing CandidateCatalog supplies the unchanged dated history loader; its
first-batch lexical view is then replaced, never used for eight-board selection.
"""
from collections import Counter
from copy import deepcopy
import hashlib
from pathlib import Path
from tools.gen5.catalog import ROOT, norm, read_json
from tools.build_lexicon_v3_working import validated_reviews
from .catalog import CandidateCatalog, ALPHABET

WORKING = ROOT/'content/lexicon-v3/working'
BASELINE = '84d2e75076d8422db03c8f229db19523da039acf'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class FullCatalog(CandidateCatalog):
    def __init__(self, as_of='2026-09-27'):
        manifest = read_json(WORKING/'manifest.json')
        for name, expected in manifest['outputs_sha256'].items():
            if sha(WORKING/name) != expected:
                raise ValueError('Full v3 output differs from its manifest: '+name)
        for name, expected in manifest['provenance']['input_sha256'].items():
            if sha(ROOT/name) != expected:
                raise ValueError('Full v3 input changed; explicitly rebuild before manufacture: '+name)
        reviews = validated_reviews(read_json(WORKING/'editorial-reviews.json')['records'])
        if len(reviews) != 1143 or any(not r['candidate_generation_allowed'] for r in reviews):
            raise ValueError('The full approved expansion must be resolved before manufacture')
        super().__init__(ROOT/'content/lexicon-v3/candidate-lexicon.json', as_of)
        payload = read_json(WORKING/'lexicon.json')
        self.lexicon_path = WORKING/'lexicon.json'
        self.source_sha = BASELINE
        self.lexicon_hash = sha(self.lexicon_path)
        self.entries = {norm(e['word']):deepcopy(e) for e in payload['entries']}
        if len(self.entries) != 4290 or payload.get('runtime_approved') is not False:
            raise ValueError('Expected complete unpublished v3, not the old 155-word batch')
        by_id = {r['candidate_id']:r for r in reviews}
        for e in self.entries.values():
            e['topic'] = e['capacity_topic']
            if e['source_cohort'] == 'approved-expansion-1143':
                r = by_id[e['candidate_id']]
                e['evidence_depth'] = r['evidence_depth']
                e['family'] = r.get('family')
        for group in read_json(WORKING/'variant-groups.json')['groups']:
            identity = '|'.join(sorted(norm(w) for w in group['members']))
            for word in group['members']:
                if norm(word) in self.entries:
                    self.entries[norm(word)]['variant_group'] = identity
        self.additions = {w:e for w,e in self.entries.items() if e['source_cohort']=='approved-expansion-1143'}
        if len(self.additions) != 1143:
            raise ValueError('Missing approved expansion words')
        self.exclusions |= {w for w,e in self.entries.items() if not e['target_eligible']}
        self.policy = read_json(ROOT/'content/gen6/round3-eight/selection-policy.json')
        self.legacy_c_pool = set(self.policy['legacy_c_words'])

    def available_for_round3(self):
        return {w:e for w,e in self.entries.items()
                if w not in self.exclusions and e['target_eligible']
                and e['tier'] in {'A','B','C'} and 5 <= len(w) <= 9 and ALPHABET.fullmatch(w)
                and (w in self.additions or w in self.legacy_c_pool)}

    def full_dictionary(self):
        from .recognition_snapshot import full_words
        return full_words()

    def input_hashes(self):
        paths=set(read_json(WORKING/'manifest.json')['provenance']['input_sha256'])
        paths |= {str(p.relative_to(ROOT)) for p in WORKING.glob('*') if p.is_file()}
        paths |= {'tools/mozkokalypsa_lab.py','tools/measure_gen4_ambiguity.py','server.py'}
        paths |= {str(p.relative_to(ROOT)) for folder in ('tools/gen5','tools/gen6') for p in (ROOT/folder).glob('*.py')}
        paths |= {'content/gen6/round3-eight/'+n for n in ('selection-policy.json','wordfreq-manifest.json')}
        return {p:sha(ROOT/p) for p in sorted(paths)}
