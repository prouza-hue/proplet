"""Frozen inputs, exposure history and deterministic vocabulary allocation."""
from __future__ import annotations

from collections import Counter
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path
import random
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[2]
DIFFICULTIES = ('easy', 'medium', 'hard', 'hardcore', 'mozkomor')
FROZEN = ('public/puzzles.json', 'data/puzzles.json', 'data/rolling_content_v1.json',
          'data/lexicon_v2.json', 'data/answer_tiers.json', 'data/words.txt',
          'public/valid-words-v3328.txt', 'data/lexicon_v2_wikidata_raw.json',
          'data/target_generation_exclusions_v334.json', 'content/generation-manifest.json',
          'word_recognition_v3330.py')


def norm(word):
    return unicodedata.normalize('NFC', str(word)).strip().casefold()


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True,
                                    separators=(',', ':')).encode()).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def fingerprint(paths):
    return {str(p.relative_to(ROOT)).replace('\\', '/'): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(paths)}


def input_fingerprint():
    paths = [ROOT / p for p in FROZEN]
    paths += [ROOT / 'content/gen5/profiles.json', ROOT / 'tools/gen5_lab.py']
    paths += list((ROOT / 'tools/gen5').glob('*.py'))
    paths += [ROOT / 'tools/generate_v334_calibration.py', ROOT / 'tools/generate_v334_calibration_v3.py',
              ROOT / 'tools/generate_gen4_candidates.py', ROOT / 'tools/generate_puzzles.py',
              ROOT / 'tools/measure_gen4_ambiguity.py']
    return fingerprint(paths)


class Catalog:
    def __init__(self):
        self.entries = {norm(e['word']): e for e in read_json(ROOT / 'data/lexicon_v2.json')['entries']}
        decisions = read_json(ROOT / 'data/target_generation_exclusions_v334.json')
        self.exclusions = {norm(w) for w in decisions['remove_from_target_generation']}
        self.exclusions |= {'červodíra', 'blockchain', 'pulsar', 'tensor'}  # Existing MUST_REVIEW.
        self.profiles = read_json(ROOT / 'content/gen5/profiles.json')['profiles']
        bank = read_json(ROOT / 'public/puzzles.json')
        rolling = read_json(ROOT / 'data/rolling_content_v1.json')['puzzles']
        # All reserved rolling boards precede Gen5 conservatively; release ordering must
        # be finalized separately. Never infer chronology from puzzle IDs alone.
        self.history = {d: bank['free'][d] + rolling.get(d, []) for d in DIFFICULTIES}
        self.base = bank['free']
        self.global_counts = Counter()
        self.counts = {d: Counter() for d in DIFFICULTIES}
        seen = {}
        for d, boards in self.history.items():
            for b in boards:
                words = self.words(b)
                if b['id'] in seen and seen[b['id']] != digest(b):
                    raise ValueError('Conflicting history ID: ' + b['id'])
                if b['id'] not in seen:
                    self.counts[d].update(words)
                    self.global_counts.update(words)
                    seen[b['id']] = digest(b)
        for b in bank['daily'] + bank['rescue'] + [bank['starter']]:
            if b['id'] not in seen:
                self.global_counts.update(self.words(b))
                seen[b['id']] = digest(b)
        self.historical_ids = set(seen)
        self.historical_words_hashes = {digest(sorted(self.words(b))) for bs in self.history.values() for b in bs}

    @staticmethod
    def words(board):
        return {norm(a['word']) for a in board['answers']}

    def eligible(self, difficulty):
        p = self.profiles[difficulty]
        return {w: e for w, e in self.entries.items()
                if w not in self.exclusions and e['tier'] in p['policy']['allowed']
                and p['min_len'] <= len(w) <= p['max_len'] and e.get('fun', 3) >= 3
                and re.fullmatch('[a-záčďéěíňóřšťúůýž]+', w)}


class Exposure:
    """One central ledger for all difficulties and resumed batches; never per-worker."""
    def __init__(self, catalog, accepted=()):
        self.catalog = catalog
        self.recent = {d: [catalog.words(b) for b in bs] for d, bs in catalog.history.items()}
        self.new = {d: Counter() for d in DIFFICULTIES}
        self.global_new = Counter()
        for b in accepted:
            self.add(b)

    def add(self, board):
        d, words = board['difficulty'], self.catalog.words(board)
        self.recent[d].append(words)
        self.new[d].update(words)
        self.global_new.update(words)

    def forbidden(self, d):
        p = self.catalog.profiles[d]
        recent=self.recent[d][-p['cooldown']:] if p['cooldown'] else []
        return set().union(*recent) | {
            w for w, n in self.new[d].items() if n >= p['new_word_cap']}

    def weight(self, d, word):
        e = self.catalog.entries[word]
        tier_weight = self.catalog.profiles[d]['policy']['weights'].get(e['tier'], 1)
        # No fun bonus or forced fun >=4 anchor. Penalize actual player exposure.
        return tier_weight / ((1 + self.catalog.counts[d][word]) ** 1.15
                              * (1 + .25 * self.catalog.global_counts[word]) ** .5
                              * (1 + self.global_new[word]) ** 2)


@lru_cache(maxsize=128)
def length_shapes(low, high, count_low, count_high, cells_low, cells_high, max_four):
    """Exact feasible multisets, avoiding the old 'fill remainder with 4s' bias."""
    out = []
    def walk(prefix, minimum, remaining, total, fours):
        if not remaining:
            if cells_low <= total <= cells_high:
                out.append(tuple(prefix))
            return
        for length in range(minimum, high + 1):
            new_four = fours + (length == 4)
            if new_four > max_four or total + length * remaining > cells_high:
                continue
            if total + length + high * (remaining - 1) < cells_low:
                continue
            walk(prefix + [length], length, remaining - 1, total + length, new_four)
    for count in range(count_low, count_high + 1):
        walk([], low, count, 0, 0)
    return tuple(out)


def tier_mix_ok(words, entries, policy):
    counts = Counter(entries[w]['tier'] for w in words)
    return (all(counts[t] + 1e-9 >= len(words) * v for t, v in policy.get('min_fraction', {}).items())
            and all(counts[t] <= len(words) * v + 1e-9 for t, v in policy.get('max_fraction', {}).items()))


def choose_words(catalog, exposure, d, rng: random.Random):
    p = catalog.profiles[d]
    forbidden=exposure.forbidden(d)
    available = {w: e for w, e in catalog.eligible(d).items() if w not in forbidden}
    buckets = {n: sorted(w for w in available if len(w) == n) for n in range(p['min_len'], p['max_len'] + 1)}
    shapes = [s for s in length_shapes(p['min_len'], p['max_len'], *p['words'], *p['cells'], p['max_four_words'])
              if all(len(buckets[n]) >= k for n, k in Counter(s).items())]
    if not shapes:
        raise ValueError('Vocabulary capacity exhausted for ' + d)
    for _ in range(80):
        shape = list(rng.choice(shapes))
        rng.shuffle(shape)
        tiers = assign_tiers(shape, available, p['policy'], rng)
        if tiers is None:
            continue
        words = []
        themes = Counter()
        for length,tier in zip(shape,tiers):
            options = [w for w in buckets[length] if w not in words and available[w]['tier']==tier]
            weights = [exposure.weight(d, w) / (1 + themes[available[w].get('theme', '')]) for w in options]
            w = rng.choices(options, weights=weights, k=1)[0]
            words.append(w)
            themes[available[w].get('theme', '')] += 1
        if tier_mix_ok(words, available, p['policy']) and digest(sorted(words)) not in catalog.historical_words_hashes:
            return words
    raise ValueError('Cannot satisfy lexical tier mix for ' + d)


def assign_tiers(shape, entries, policy, rng):
    """Prove a feasible length/tier allocation before drawing individual words.

    This avoids hundreds of blind re-draws as exposure penalties change. The
    cached search sees finite bucket capacities, so it cannot invent vocabulary.
    """
    tiers=sorted({e['tier'] for e in entries.values()})
    pairs=[(n,t) for n in sorted(set(shape)) for t in tiers]
    slots={pair:i for i,pair in enumerate(pairs)}
    capacity=Counter((len(w),e['tier']) for w,e in entries.items())
    total=len(shape)
    minimum={t:math.ceil(total*policy.get('min_fraction',{}).get(t,0)-1e-9) for t in tiers}
    maximum={t:math.floor(total*policy.get('max_fraction',{}).get(t,1)+1e-9) for t in tiers}
    if any(t not in tiers and v>0 for t,v in policy.get('min_fraction',{}).items()):
        return None
    if sum(minimum.values())>total or sum(maximum.values())<total:
        return None
    @lru_cache(maxsize=None)
    def feasible(index,used):
        counts={t:sum(used[i] for i,(_,pt) in enumerate(pairs) if pt==t) for t in tiers}
        remaining=total-index
        if any(counts[t]>maximum[t] or counts[t]+remaining<minimum[t] for t in tiers):
            return False
        if sum(max(0,minimum[t]-counts[t]) for t in tiers)>remaining:
            return False
        if not remaining:
            return True
        for t in tiers:
            slot=slots[(shape[index],t)]
            if used[slot]<capacity[(shape[index],t)] and counts[t]<maximum[t]:
                updated=list(used);updated[slot]+=1
                if feasible(index+1,tuple(updated)):
                    return True
        return False
    used=(0,)*len(pairs)
    if not feasible(0,used):
        return None
    result=[]
    for index,n in enumerate(shape):
        viable=[]
        for t in tiers:
            slot=slots[(n,t)]
            if used[slot]>=capacity[(n,t)]:
                continue
            updated=list(used);updated[slot]+=1
            if feasible(index+1,tuple(updated)):
                viable.append((t,tuple(updated)))
        choice=rng.choices(viable,weights=[policy['weights'].get(t,1) for t,_ in viable],k=1)[0]
        result.append(choice[0]);used=choice[1]
    return result
