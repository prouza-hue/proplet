"""Offline refreshed Mozkokalypsa III: extend Gen5 selection, geometry and proof.

python -m tools.gen6.round3 --lexicon content/lexicon-v3/candidate-lexicon.json \
  --output lab-output/gen6/round3-20260926 --source-sha <verified-main>
This module has no network/database/publication path.
"""
from collections import Counter
from copy import deepcopy
import argparse
import json
from pathlib import Path
import random
import time

from tools.gen5.catalog import ROOT, Exposure, assign_tiers, digest, norm, tier_mix_ok, length_shapes
from tools.gen5.validation import Solver, structural, geometry_errors
from tools.mozkokalypsa_lab import SHAPE, full_profile, generate_full
from tools import mozkokalypsa_lab as geometry_lab
from .catalog import CandidateCatalog, board_hash, frozen_inputs, frozen_validation_words, verify_source_snapshot

POLICY = {'allowed':['A','B','C'], 'weights':{'A':3,'B':4,'C':2},
          'min_fraction':{'A':3/14,'B':4/14}, 'max_fraction':{'C':4/14}}
EXPERIMENT = 'mozkokalypsa-round3-preview-20260926'
RECOGNITION_SCOPE = 'frozen-static-recognition-union-plus-candidates'
PREFERRED_SHAPE = tuple(SHAPE)


def write(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix+'.tmp')
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    temporary.replace(path)


def family(entry):
    return entry.get('family') or None


def topic(entry):
    return entry.get('topic') or entry.get('theme') or 'unknown'


class RefreshedExposure(Exposure):
    """Static catalog uses, not personal player exposures; one ledger for the run."""
    def __init__(self, catalog):
        super().__init__(catalog)
        self.families = Counter()
        self.topics = Counter()
        self.variants = set()

    def add(self, board):
        super().add(board)
        for word in sorted(self.catalog.words(board)):
            e = self.catalog.entries[word]
            if family(e): self.families[family(e)] += 1
            self.topics[topic(e)] += 1
            if e.get('variant_group'): self.variants.add(e['variant_group'])

    def weight(self, d, word):
        e = self.catalog.entries[word]
        # V3 novelty is rewarded after approval, never by accepting weak words.
        novelty = 4 if word in self.catalog.additions else 1
        old_uses = self.catalog.released_counts[word] + .5*self.catalog.reserved_counts[word]
        related = self.families[family(e)] if family(e) else 0
        return (POLICY['weights'][e['tier']] * novelty
                / ((1 + old_uses)**.72 * (1 + related)**.8
                   * (1 + self.global_new[word])**3 * (1 + .08*self.topics[topic(e)])))


def choose_refreshed_words(catalog, exposure, rng):
    # Absolute no-repeat across this series and both earlier playtests.
    forbidden = catalog.playtest_words | set(exposure.global_new)
    available = {w:e for w,e in catalog.available_for_round3().items()
                 if w not in forbidden and e.get('variant_group') not in exposure.variants}
    remaining = 12 - sum(exposure.global_new.values())//14
    capacities = Counter(map(len,available))
    shapes = [s for s in length_shapes(5,9,14,14,100,100,0)
              if all(capacities[n] >= count*remaining for n,count in Counter(s).items())]
    # Length capacity alone is insufficient: e.g. five remaining 8-letter words
    # may all be C while the policy permits at most four. Probe the existing
    # Gen5 exact tier allocator before choosing the closest sustainable shape.
    shapes = [s for s in shapes if assign_tiers(s,available,POLICY,random.Random(0)) is not None]
    if not shapes:
        raise ValueError('Approved full-series length capacity exhausted; no weak-word fallback')
    distance = lambda s:sum(abs(Counter(s)[n]-Counter(PREFERRED_SHAPE)[n]) for n in range(5,10))
    closest = min(map(distance,shapes))
    shapes = [s for s in shapes if distance(s)==closest]
    for _ in range(200):
        shape = list(rng.choice(shapes)); rng.shuffle(shape)
        tiers = assign_tiers(shape, available, POLICY, rng)
        if tiers is None:
            raise ValueError('Insufficient approved length/tier capacity; no quality fallback')
        words, themes, families, variants = [], Counter(), Counter(), set()
        for length, tier in zip(shape, tiers):
            options = sorted(w for w,e in available.items() if len(w)==length and e['tier']==tier
                             and w not in words and (not e.get('variant_group') or e['variant_group'] not in variants))
            if not options:
                break
            weights = [exposure.weight('mozkomor', w)
                       / ((1 + themes[topic(available[w])])**1.25
                          * (1 + families[family(available[w])])**2 if family(available[w])
                          else (1 + themes[topic(available[w])])**1.25) for w in options]
            word = rng.choices(options, weights=weights, k=1)[0]
            words.append(word); e = available[word]
            themes[topic(e)] += 1
            if family(e): families[family(e)] += 1
            if e.get('variant_group'): variants.add(e['variant_group'])
        if len(words)==14 and tier_mix_ok(words, available, POLICY) and digest(sorted(words)) not in catalog.historical_words_hashes:
            return words
    raise ValueError('Cannot allocate reviewed words without repetition or variant duplication')


class Round3Validator:
    def __init__(self, catalog, solver):
        self.catalog, self.solver = catalog, solver
        self.profile = full_profile(catalog)
        self.ids = set(catalog.historical_ids)
        self.geometry = set(catalog.historical_board_hashes)
        self.wordsets = set(catalog.historical_words_hashes)
        self.words, self.variants, self.count = set(), set(), 0

    def add(self, board):
        expected = f'mk3-{self.count+1:02d}'
        if board.get('id') != expected or board['id'] in self.ids:
            raise ValueError('Identity collision/order error: '+str(board.get('id')))
        meta = board.get('meta', {})
        if (meta.get('generatorGeneration') != 6 or meta.get('contentGeneration') != self.catalog.free_generation
                or meta.get('experimentId') != EXPERIMENT or meta.get('playtestOnly') is not True):
            raise ValueError('Candidate/runtime separation failed')
        geometry = structural(board)
        errors = geometry_errors(geometry, self.profile)
        if errors or len(board['lengths'])!=14 or sum(board['lengths'])!=100:
            raise ValueError('Geometry/length contract: '+str(errors))
        words = self.catalog.words(board)
        if not words <= set(self.catalog.available_for_round3()):
            raise ValueError('Unapproved target vocabulary')
        if words & (self.words | self.catalog.playtest_words):
            raise ValueError('Repeat in preview or earlier playtests')
        variants = [self.catalog.entries[w].get('variant_group') for w in words]
        variants = [v for v in variants if v]
        if len(variants) != len(set(variants)) or set(variants) & self.variants:
            raise ValueError('Spelling variant group repeated')
        if not tier_mix_ok(list(words), self.catalog.entries, POLICY):
            raise ValueError('Refreshed tier policy failed')
        content_hash, signature = board_hash(board), digest(sorted(words))
        if content_hash in self.geometry or signature in self.wordsets:
            raise ValueError('Historical geometry or word-set collision')
        verified = self.solver.verify(board)
        if verified['status'] != 'unique' or not verified['targetPathsUnique']:
            raise ValueError('Solver proof failed: '+verified['status'])
        # No ledger mutation until every independent check has passed.
        self.ids.add(board['id']); self.geometry.add(content_hash); self.wordsets.add(signature)
        self.words.update(words); self.variants.update(variants); self.count += 1
        return verified


def summary(catalog, boards):
    words = [norm(a['word']) for b in boards for a in b['answers']]
    uses = Counter(words)
    added = set(words) & set(catalog.additions)
    return {'boardCount':len(boards), 'targetOccurrences':len(words), 'uniqueWords':len(uses),
            'maxWordUses':max(uses.values(),default=0), 'v3UniqueWords':len(added),
            'v3OccurrenceShare':round(sum(w in added for w in words)/max(1,len(words)),4),
            'wordsAbsentFromReleasedInventory':sum(catalog.released_counts[w]==0 for w in uses),
            'wordsAbsentFromAllInventory':sum(catalog.global_counts[w]==0 for w in uses),
            'previousPlaytestWordOverlap':sorted(set(words)&catalog.playtest_words),
            'tiers':dict(Counter(catalog.entries[w]['tier'] for w in words)),
            'topics':dict(Counter(topic(catalog.entries[w]) for w in words)),
            'families':dict(Counter(family(catalog.entries[w]) for w in words if family(catalog.entries[w]))),
            'personalExposure':'unknown-not-inferred', 'humanDifficulty':'unmeasured'}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lexicon',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--source-sha',required=True)
    parser.add_argument('--as-of',default='2026-09-26')
    parser.add_argument('--seed',type=int,default=2026092603)
    parser.add_argument('--seconds-per-board',type=float,default=180)
    parser.add_argument('--pool-size',type=int,default=24)
    parser.add_argument('--capacity-only',action='store_true')
    args=parser.parse_args()
    output=args.output.resolve(); allowed=(ROOT/'lab-output/gen6').resolve()
    if allowed not in output.parents or output.exists():
        raise ValueError('Use a new named output directory below lab-output/gen6/')
    if len(args.source_sha)!=40 or any(c not in '0123456789abcdef' for c in args.source_sha):
        raise ValueError('Full verified source SHA required')
    if not 1 <= args.pool_size <= 24 or not 5 <= args.seconds_per_board <= 600:
        raise ValueError('Bounded pool and time budget required')
    catalog=CandidateCatalog(args.lexicon,args.as_of)
    if args.source_sha!=catalog.source_sha:
        raise ValueError('CLI baseline differs from verified editorial baseline')
    inputs=frozen_inputs(catalog)
    verify_source_snapshot(args.source_sha,inputs)
    output.mkdir(parents=True)
    write(output/'capacity.json',catalog.capacity())
    write(output/'inventory.json',{'asOf':args.as_of,'sourceSha':args.source_sha,
          'scope':'static-content-inventory-not-personal-exposure','boards':list(catalog.inventory.values())})
    if args.capacity_only:
        print(json.dumps(catalog.capacity(),ensure_ascii=False));return
    solver=Solver(frozen_validation_words(catalog))
    (output/'recognition-words.txt').write_text('\n'.join(solver.words)+'\n',encoding='utf-8')
    exposure=RefreshedExposure(catalog);validator=Round3Validator(catalog,solver)
    profile=full_profile(catalog)
    profile['geometry_profile']='mozkokalypsa-full-v1-gen6-selection'
    boards,evidence=[],[]
    settings={'seed':args.seed,'count':12,'secondsPerBoard':args.seconds_per_board,'poolSize':args.pool_size,
              'asOf':args.as_of,'policy':POLICY,'preferredShape':PREFERRED_SHAPE,
              'shapePolicy':'nearest sustainable approved 5..9-letter multiset, 14 words / 100 cells',
              'geometryProfile':profile,
              'controls':0,'freshPolicyBoards':12}
    dictionary={'scope':RECOGNITION_SCOPE,'sha256':solver.hash,'size':len(solver.words),
                'dynamicWordfreqCovered':False}
    started=time.monotonic()
    for ordinal in range(1,13):
        seed=int(digest([args.seed,'round3',ordinal])[:16],16);rng=random.Random(seed)
        words=choose_refreshed_words(catalog,exposure,rng)
        # Reuse the existing Hamiltonian geometry unchanged with the proven
        # per-board length multiset; module-local configuration, no source edits.
        geometry_lab.SHAPE = sorted(map(len,words))
        board,record=generate_full(catalog,solver,solver.prefixes,words,rng,profile,'sustained',
                                  args.seconds_per_board,args.pool_size)
        board['id']=f'mk3-{ordinal:02d}'
        board['meta']={'level':ordinal,'experimentId':EXPERIMENT,'playtestOnly':True,
                       'generatorGeneration':6,'contentGeneration':catalog.free_generation,
                       'contentHash':board_hash(board),'seed':seed,'lexicalPolicy':'gen6-refreshed-v1'}
        verified=validator.add(board)
        board['meta']['validation']=verified
        record.update(id=board['id'],seed=seed,selection=f'best-sustained-of-{args.pool_size}',
                      lengthShape=sorted(map(len,words)),
                      words=sorted(words),v3Words=sorted(set(words)&set(catalog.additions)),
                      tiers=dict(Counter(catalog.entries[w]['tier'] for w in words)))
        boards.append(board);evidence.append(record);exposure.add(board)
        write(output/'checkpoint.json',{'status':'incomplete','sourceSha':args.source_sha,'settings':settings,
                                       'inputs':inputs,'boards':boards,'evidence':evidence})
        print(board['id'],len(record['v3Words']),'v3 words',verified['status'],flush=True)
    if frozen_inputs(catalog)!=inputs:
        raise ValueError('Frozen inputs changed during generation; output cannot be accepted')
    bank={'kind':'gen6-unpublished-preview','schemaVersion':1,'status':'verified-unpublished',
          'experimentId':EXPERIMENT,'sourceSha':args.source_sha,'generatorGeneration':6,
          'runtimeFreeGeneration':catalog.free_generation,'publicationAuthorized':False,
          'controls':0,'humanDifficulty':'unmeasured','validationDictionary':dictionary,
          'boards':boards,'contentHash':digest(boards)}
    report={'status':'verified-unpublished','sourceSha':args.source_sha,'inputs':inputs,
            'settings':settings,'validationDictionary':dictionary,'summary':summary(catalog,boards),
            'boards':evidence,'contentHash':bank['contentHash'],'seconds':round(time.monotonic()-started,3),
            'reproduction':'Same source snapshot, inputs, seed and completed fixed-size candidate pools produce identical boards; timeout never passes.'}
    write(output/'bank.json',bank);write(output/'verification.json',report)
    print('COMPLETE',json.dumps(report['summary'],ensure_ascii=False),flush=True)


if __name__=='__main__':main()
