"""Eight fresh, demanding boards from the complete owner-approved Lexikon v3.

Offline manufacture only. Released banks and the twelve-board prototype are
immutable inputs. A completed exact proof is required; a timeout is not a pass.
"""
from collections import Counter
from copy import deepcopy
import argparse
import json
from pathlib import Path
import random
import statistics
import time

from tools.gen5.catalog import ROOT, assign_tiers, digest, norm, tier_mix_ok, read_json
from tools.gen5.validation import Solver, structural, geometry_errors
from tools.mozkokalypsa_lab import SHAPE, full_profile, generate_full, residual_metrics
from .catalog import board_hash, walk_boards
from .full_catalog import FullCatalog

EXPERIMENT = 'mozkokalypsa-round3-lexicon-v3-8'
EDITION = 'lexicon-v3-eight-v1'
COUNT = 8
SHAPE_FIXED = tuple(SHAPE)


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    tmp.replace(path)


def topic(entry):
    return entry['capacity_topic']


def allocate(catalog, seed):
    """Allocate the entire lexical series before any geometry is manufactured."""
    policy = catalog.policy['category_policy']
    eligible = {w:e for w,e in catalog.available_for_round3().items() if w not in catalog.playtest_words}
    minimum = catalog.policy['new_word_minimum_per_board']
    maximum = catalog.policy['new_word_maximum_per_board']
    for restart in range(40):
        rng = random.Random(digest([seed, 'lexical', restart]))
        used, used_variants, prior_topics, prior_families = set(), set(), Counter(), Counter()
        sets = []
        for ordinal in range(COUNT):
            available = {w:e for w,e in eligible.items() if w not in used
                         and (not e.get('variant_group') or e['variant_group'] not in used_variants)}
            found = None
            for _ in range(300):
                shape = list(SHAPE_FIXED); rng.shuffle(shape)
                tiers = assign_tiers(shape, available, policy, rng)
                if tiers is None:
                    break
                words, themes, families, variants = [], Counter(), set(), set()
                for length, tier in zip(shape, tiers):
                    options = [w for w,e in available.items() if len(w)==length and e['tier']==tier
                               and w not in words and themes[topic(e)] < 3
                               and (not e.get('family') or e['family'] not in families)
                               and (not e.get('variant_group') or e['variant_group'] not in variants)]
                    if not options:
                        break
                    options.sort()
                    weights = []
                    for w in options:
                        e = available[w]
                        historical = catalog.released_counts[w] + .5*catalog.reserved_counts[w]
                        # Novel but recognized concepts; do not invent difficulty labels.
                        novelty = 2 if w in catalog.additions else 1
                        weights.append(novelty / ((1+historical)**.65 * (1+themes[topic(e)])**1.7
                                                  * (1+.15*prior_topics[topic(e)])
                                                  * (1+prior_families[e.get('family')])**1.2))
                    w = rng.choices(options, weights=weights, k=1)[0]; e=available[w]
                    words.append(w); themes[topic(e)]+=1
                    if e.get('family'): families.add(e['family'])
                    if e.get('variant_group'): variants.add(e['variant_group'])
                fresh = sum(w in catalog.additions for w in words)
                if (len(words)==14 and minimum<=fresh<=maximum and len(themes)>=8
                        and tier_mix_ok(words, available, policy)
                        and digest(sorted(words)) not in catalog.historical_words_hashes):
                    found=sorted(words); break
            if found is None:
                break
            used.update(found); used_variants.update(variants)
            prior_topics.update(topic(available[w]) for w in found)
            prior_families.update(available[w]['family'] for w in found if available[w].get('family'))
            sets.append(found)
        if len(sets)==COUNT:
            return sets, restart
    raise ValueError('Cannot meet the full eight-board lexical contract; no relaxed fallback')


def profile_for(catalog):
    p = full_profile(catalog)
    p.update(min_path_turns=3, min_mean_turns=4.65, max_path_straight_share=.55,
             geometry_profile='mozkokalypsa-v3-eight-demanding-v1')
    return p


def check_series(boards, catalog, solver, verify=True):
    if len(boards)!=COUNT:
        raise ValueError('Exactly eight complete boards required')
    seen, variants, contents, proofs = set(), set(), set(), []
    eligible = catalog.available_for_round3()
    for ordinal, b in enumerate(boards,1):
        expected=f'mk3v3-{ordinal:02d}'
        if b['id']!=expected or b['id'] in catalog.historical_ids:
            raise ValueError('Eight-board identity collision')
        meta=b.get('meta',{})
        if (meta.get('experimentId')!=EXPERIMENT or meta.get('generatorGeneration')!=6
                or meta.get('contentGeneration')!=catalog.free_generation
                or meta.get('playtestOnly') is not True or meta.get('lexiconHash')!=catalog.lexicon_hash):
            raise ValueError('Wrong runtime separation or full-lexicon provenance')
        if tuple(sorted(b['lengths']))!=tuple(sorted(SHAPE_FIXED)) or geometry_errors(structural(b),profile_for(catalog)):
            raise ValueError('High-difficulty geometry or fixed shape failed')
        words=catalog.words(b)
        if (not words<=set(eligible) or words & (seen|catalog.playtest_words)
                or not tier_mix_ok(sorted(words),catalog.entries,catalog.policy['category_policy'])):
            raise ValueError('Vocabulary, repetition or lexical difficulty contract failed')
        fresh=len(words & set(catalog.additions))
        if not catalog.policy['new_word_minimum_per_board']<=fresh<=catalog.policy['new_word_maximum_per_board']:
            raise ValueError('Fresh vocabulary share failed')
        themes=Counter(topic(catalog.entries[w]) for w in words)
        if len(themes)<8 or max(themes.values())>3:
            raise ValueError('Thematic variety failed')
        groups=[catalog.entries[w].get('variant_group') for w in words]
        groups=[g for g in groups if g]
        if len(groups)!=len(set(groups)) or set(groups)&variants:
            raise ValueError('Orthographic variant repeat')
        families=[catalog.entries[w].get('family') for w in words]
        families=[g for g in families if g]
        if len(families)!=len(set(families)):
            raise ValueError('Same word family twice on one board')
        h=board_hash(b)
        if (h!=meta.get('contentHash') or h in contents or h in catalog.historical_board_hashes
                or digest(sorted(words)) in catalog.historical_words_hashes):
            raise ValueError('Content identity collision or mismatch')
        if verify:
            v=solver.verify(b)
            if v['status']!='unique' or not v['targetPathsUnique']:
                raise ValueError('No complete exact proof: '+b['id']+' '+str(v))
            proofs.append(v)
        seen.update(words); variants.update(groups); contents.add(h)
    return proofs


def measure(boards,catalog,prefixes):
    geometry=[structural(b) for b in boards]
    pressure=[residual_metrics(b,prefixes) for b in boards]
    words=[norm(a['word']) for b in boards for a in b['answers']]
    return {'boardCount':len(boards),'targetOccurrences':len(words),'uniqueWords':len(set(words)),
            'tiers':dict(Counter(catalog.entries[w]['tier'] if w in catalog.entries else 'outside-v3' for w in words)),
            'lengths':dict(Counter(map(len,words))),
            'newExpansionWords':len(set(words)&set(catalog.additions)),
            'absentFromAllRecordedBanks':sum(catalog.global_counts[w]==0 for w in set(words)),
            'geometryMedian':{k:statistics.median(m[k] for m in geometry) for k in ('meanTurns','meanStraightShare','minPathTurns')},
            'pressureMedian':{k:statistics.median(m[k] for m in pressure) for k in ('initial','after3Median','halfMedian','selectionScore')},
            'pressureByBoard':dict(zip((b['id'] for b in boards),pressure)),
            'humanDifficulty':'unmeasured','personalExposure':'unknown-not-inferred'}


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--seed',type=int,default=2026092708)
    ap.add_argument('--seconds-per-board',type=float,default=150)
    ap.add_argument('--pool-size',type=int,default=24)
    ap.add_argument('--as-of',default='2026-09-27')
    ap.add_argument('--plan-only',action='store_true')
    args=ap.parse_args(); out=args.output.resolve()
    if (ROOT/'lab-output/gen6').resolve() not in out.parents or out.exists():
        raise ValueError('Use a new output below lab-output/gen6')
    if not 5<=args.seconds_per_board<=600 or not 1<=args.pool_size<=48:
        raise ValueError('Bounded time and candidate-pool budgets required')
    c=FullCatalog(args.as_of); frozen=c.input_hashes(); out.mkdir(parents=True)
    sets,restart=allocate(c,args.seed)
    write(out/'lexical-plan.json',{'seed':args.seed,'restart':restart,'sets':sets,'lexiconHash':c.lexicon_hash,
                                  'entries':{w:c.entries[w] for words in sets for w in words}})
    for i,words in enumerate(sets,1):print(i,sum(w in c.additions for w in words),', '.join(words),flush=True)
    if args.plan_only:return
    started=time.monotonic(); solver=Solver(c.full_dictionary()); p=profile_for(c)
    previous=[b for b,_ in walk_boards(read_json(ROOT/'data/playtests/mozkokalypsa-v2.json'))]
    old=measure(previous,c,solver.prefixes)
    boards=[]; evidence=[]
    for ordinal,words in enumerate(sets,1):
        seed=int(digest([args.seed,'full-v3-eight',ordinal])[:16],16)
        b,r=generate_full(c,solver,solver.prefixes,words,random.Random(seed),p,'sustained',args.seconds_per_board,args.pool_size)
        b['id']=f'mk3v3-{ordinal:02d}'
        b['meta']={'level':ordinal,'experimentId':EXPERIMENT,'playtestOnly':True,'generatorGeneration':6,
                   'contentGeneration':c.free_generation,'contentHash':board_hash(b),'lexiconHash':c.lexicon_hash,
                   'seed':seed,'lexicalPolicy':EDITION,'validation':r['verification']}
        r.update(id=b['id'],seed=seed,selection=f'best-sustained-of-{args.pool_size}',
                 words=words,v3Words=sorted(set(words)&set(c.additions)))
        boards.append(b); evidence.append(r)
        write(out/'checkpoint.json',{'status':'incomplete','boards':boards,'evidence':evidence,'frozenInputs':frozen})
        print(b['id'],r['pressure'],r['rejections'],flush=True)
    proofs=check_series(boards,c,solver)
    if c.input_hashes()!=frozen:raise ValueError('Manufacturing inputs changed')
    measured=measure(boards,c,solver.prefixes)
    # The existing score is a comparative selection aid, not a human-time predictor.
    # Do not silently ship a weaker series on the same pinned dictionary.
    for key in ('initial','after3Median','halfMedian','selectionScore'):
        if measured['pressureMedian'][key] < old['pressureMedian'][key]:
            raise ValueError('Sustained-pressure baseline not met: '+key)
    dictionary={'scope':'full-v3-static-union-plus-pinned-runtime-wordfreq-and-orthographic-variants',
                'sha256':solver.hash,'size':len(solver.words),'wordfreqVersion':'3.1.1',
                'runtimeFrequencyTableCovered':True,
                'limitation':'Pinned acceptable Czech alphabetic frequency-table entries; future runtime/data changes invalidate this snapshot.'}
    bank={'kind':'gen6-unpublished-preview','schemaVersion':1,'edition':EDITION,'status':'verified-unpublished',
          'experimentId':EXPERIMENT,'sourceSha':c.source_sha,'generatorGeneration':6,'runtimeFreeGeneration':c.free_generation,
          'publicationAuthorized':False,'controls':0,'humanDifficulty':'unmeasured','validationDictionary':dictionary,
          'lexiconHash':c.lexicon_hash,'boards':boards,'contentHash':digest(boards)}
    report={'status':'verified-unpublished','sourceSha':c.source_sha,'lexiconHash':c.lexicon_hash,'frozenInputs':frozen,
            'settings':{'seed':args.seed,'count':COUNT,'policy':c.policy,'shape':SHAPE_FIXED,'geometry':p,'poolSize':args.pool_size,
                        'secondsPerBoard':args.seconds_per_board,'lexicalRestart':restart},
            'dictionary':dictionary,'summary':measured,'comparisonRound2':old,'boards':evidence,'finalProofs':proofs,
            'seconds':round(time.monotonic()-started,3),'bankContentHash':bank['contentHash'],
            'interpretation':'All eight boards use the complete expanded lexicon. Fixed original length shape and 2A/6B/6C labels; tougher path floors. No measured claim of equal or increased human difficulty; no concurrent control arm.'}
    write(out/'bank.json',bank);write(out/'verification.json',report)
    (out/'recognition-words.txt').write_text('\n'.join(solver.words)+'\n',encoding='utf-8')
    print('COMPLETE',json.dumps({k:v for k,v in measured.items() if k!='pressureByBoard'},ensure_ascii=False),flush=True)


if __name__=='__main__':main()
