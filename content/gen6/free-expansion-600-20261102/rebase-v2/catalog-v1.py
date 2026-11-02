"""Current immutable vocabulary, content inventory and one edition-wide ledger."""
from __future__ import annotations

from collections import Counter
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import subprocess

from tools.gen5.catalog import ROOT, Catalog, digest, norm, read_json, profile_for as base_profile_for
from tools.gen5.validation import Solver, validation_words
from tools.daily_specials.core import transformed_hash

DIFFICULTIES = ('easy', 'medium', 'hard', 'hardcore', 'mozkomor', 'mozkokalypsa')
SERIES = 'g6-expansion'
BATCH = 'free-expansion-600-20261102'
OUTPUT = ROOT / 'content/gen6' / BATCH
LEXICON_PATH = ROOT / 'content/gen6/daily-specials-36/inputs/lexicon-v3.json'
LEXICON_HASH = '7baff6af094af0331d379050a680980e9b4f880428efd0c9ea620ce80c1fc277'
GLOBAL_NEW_CAP = 5
SEED = 2026110201


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def canonical_sha(path):
    """Git's LF artifact identity, distinct from a Windows CRLF worktree hash."""
    return hashlib.sha256(Path(path).read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def walk(value):
    if isinstance(value, dict):
        if all(k in value for k in ('id', 'answers', 'letters', 'mask', 'rows', 'cols')):
            yield value
        else:
            for item in value.values():
                yield from walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)


def board_digest(board):
    return digest({'rows':board['rows'], 'cols':board['cols'], 'letters':board['letters'],
        'mask':sorted(board['mask']), 'lengths':sorted(board.get('lengths') or [len(norm(a['word'])) for a in board['answers']]),
        'answers':sorted((norm(a['word']),a['path']) for a in board['answers'])})


def profile_for(catalog, difficulty, ordinal):
    if difficulty == 'mozkokalypsa':
        from . import mk
        return mk.profile(ordinal)
    return base_profile_for(catalog, difficulty, ordinal)


class ExpansionCatalog(Catalog):
    def __init__(self):
        super().__init__()
        self.source_main = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
        if canonical_sha(LEXICON_PATH) != LEXICON_HASH:
            raise ValueError('Approved Lexicon v3 differs from its immutable canonical artifact')
        payload = read_json(LEXICON_PATH)
        if len(payload['entries']) != 4290 or sum(e['source_cohort']=='approved-expansion-1143' for e in payload['entries']) != 1143:
            raise ValueError('Incomplete approved Lexicon v3')
        self.entries = {norm(e['word']):deepcopy(e) for e in payload['entries']}
        self.additions = {w for w,e in self.entries.items() if e['source_cohort']=='approved-expansion-1143'}
        self.lexicon_hash = LEXICON_HASH
        self.exclusions |= {w for w,e in self.entries.items() if not e.get('target_eligible')}
        for e in self.entries.values():
            e['theme'] = e.get('capacity_topic', e.get('theme',''))
        units = {}
        for w,e in self.entries.items():
            units.setdefault(e.get('variant_unit') or w,set()).add(w)
        self.variants = {w:units[e.get('variant_unit') or w] for w,e in self.entries.items()}
        public = read_json(ROOT/'public/puzzles.json')
        rolling = read_json(ROOT/'data/rolling_content_v1.json')['puzzles']
        self.history = {d:sorted(public['free'][d]+rolling.get(d,[]),key=lambda b:b['meta']['level']) for d in DIFFICULTIES}
        self.last_level = {d:max(b['meta']['level'] for b in bs) for d,bs in self.history.items()}
        self.counts = {d:Counter(w for b in bs for w in self.words(b)) for d,bs in self.history.items()}
        patterns = ('data/puzzles.json','public/puzzles.json','data/rolling_content_v1.json',
            'data/daily_gen6_private.json','data/daily_specials*.json','data/legacy_daily_gen*.json',
            'data/playtests/*.json','data/tajenka_weekend*.json','data/tajenka_v2_approved.json',
            'data/tajenka_v2_board_candidates.json','data/*candidate*.json','data/gen5_preview*.json',
            'content/gen6/*/bank.json')
        self.inventory = {}
        self.history_sources = []
        self.historical_ids = set()
        for path in sorted({p for pattern in patterns for p in ROOT.glob(pattern)}):
            if OUTPUT in path.parents:
                continue
            boards = list(walk(read_json(path)))
            if not boards:
                continue
            relative = str(path.relative_to(ROOT)).replace('\\','/')
            self.history_sources.append({'path':relative,'sha256':sha(path),'boards':len(boards)})
            for b in boards:
                h = board_digest(b)
                record = self.inventory.setdefault(h,{'id':b['id'],'contentHash':h,'board':b,'words':sorted(self.words(b)),'sources':[]})
                record['sources'].append(relative)
                self.historical_ids.add(b['id'])
        self.historical_board_hashes = set(self.inventory)
        self.historical_shapes = {transformed_hash(r['board']) for r in self.inventory.values()}
        self.historical_words_hashes = {digest(r['words']) for r in self.inventory.values()}
        self.global_counts = Counter(w for r in self.inventory.values() for w in r['words'])

    def eligible(self, difficulty):
        if difficulty == 'mozkokalypsa':
            from . import mk
            p = mk.profile(1)
        else:
            p = self.profiles[difficulty]
        return {w:e for w,e in self.entries.items() if w not in self.exclusions
            and e.get('target_eligible') is True and e['tier'] in p['policy']['allowed']
            and p['min_len'] <= len(w) <= p['max_len'] and e.get('fun',3)>=3
            and re.fullmatch('[a-záčďéěíňóřšťúůýž]+',w)}

    def capacity(self, difficulties):
        return {d:{'words':len(self.eligible(d)), 'byTier':dict(Counter(e['tier'] for e in self.eligible(d).values()))} for d in difficulties}

    def solver(self):
        return Solver(validation_words(self))


class ExpansionExposure:
    def __init__(self, catalog, accepted=()):
        self.catalog = catalog
        self.recent = {d:[catalog.words(b) for b in bs] for d,bs in catalog.history.items()}
        self.new = {d:Counter() for d in DIFFICULTIES}
        self.global_new = Counter()
        for b in accepted:
            self.add(b)

    def add(self, board):
        d = board['difficulty']; words = self.catalog.words(board)
        self.recent[d].append(words)
        self.new[d].update(words)
        self.global_new.update(words)

    def forbidden(self, difficulty):
        if difficulty == 'mozkokalypsa':
            from . import mk
            p = mk.profile(1)
        else:
            p = self.catalog.profiles[difficulty]
        recent = self.recent[difficulty][-p['cooldown']:] if p['cooldown'] else []
        forbidden = set().union(*recent) | {w for w,n in self.new[difficulty].items() if n>=p['new_word_cap']}
        forbidden |= {w for w,n in self.global_new.items() if n>=GLOBAL_NEW_CAP}
        for w in list(forbidden):
            forbidden |= self.catalog.variants.get(w,{w})
        return forbidden

    def weight(self, difficulty, word):
        e = self.catalog.entries[word]
        p = self.catalog.profiles[difficulty]
        tier = p['policy']['weights'].get(e['tier'],1)
        novelty = 2.4 if word in self.catalog.additions else 1.0
        history = 1.5 if self.catalog.global_counts[word]==0 else 1.0
        return novelty*history*tier / ((1+self.catalog.counts[difficulty][word])**1.15
            * (1+.25*self.catalog.global_counts[word])**.5 * (1+self.global_new[word])**2)


# Stable names used by the independent final verifier.
RefreshCatalog = ExpansionCatalog
RefreshExposure = ExpansionExposure
