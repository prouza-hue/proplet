"""Append-only Mozkokalypsa manufacture with the approved MK100 v2 contracts.

The path-only pool is recovered byte-for-byte from the completed manufacturing
commit. Letters, words, placements, identities and selection are manufactured
anew. Simulated endgame scores remain design proxies, never player telemetry.
"""
from __future__ import annotations

import ast
from collections import Counter
from copy import deepcopy
from functools import lru_cache
import hashlib
import json
import random
import time

from tools.gen5.catalog import ROOT, assign_tiers, digest, norm
from tools.gen5.validation import structural, geometry_errors
from tools.mozkokalypsa_lab import board_from_paths, full_profile, residual_metrics
from tools.free_expansion.mk_inputs.mk100_endgame import endgame_metrics
from tools.daily_specials.core import weave

SOURCE_COMMIT = 'debd415486ced6cbcd1513178d6a52f64d9cd55d'
INPUTS = ROOT/'tools/free_expansion/mk_inputs'
PROFILE_VERSION = 'mk100-morphology-v2'
SHAPE = [5]+[6]*3+[7]*4+[8]*5+[9]
WAVE = ['relief','main','relief','main','main','challenge','main','relief','main','main',
        'challenge','main','main','relief','main','challenge','main','main','main','summit']
PROFILE_TIERS = {'relief':{'A':6,'B':6,'C':2}, 'main':{'A':4,'B':6,'C':4},
                 'challenge':{'A':2,'B':6,'C':6}, 'summit':{'A':2,'B':4,'C':8}}
POLARIZING_CAP = {'relief':0,'main':1,'challenge':2,'summit':2}
TARGETED = {5,9,45,65,85}|({6,11,16,26,31,36,46,51,56,66,71,76,86,91,96}-{36,76,96})|{20,60,100}
SOURCE_HASHES = {'mk100_manufacture.py':'ff7993e910c8c6546895941550aedb082f9ad0abb9725bc3e233c514a3cd25b7',
                 'mk100_endgame.py':'0a3b3106c4a1ff924e09da6a306e43f7071995c0c05d538dc3ff53f41c064c77',
                 'geometry-production-v2.json':'b3eb5c35e8c81880b1e3b3825f74f0d55fdfae493324e49b762944c858af022e',
                 'geometry-pool-v2.jsonl':'0de9f413408a994e725c58c88f6fc3add8b684247bc83e6c83a421075e3f18e8'}


def fingerprint():
    result={'sourceCommit':SOURCE_COMMIT,'adapterSha256':hashlib.sha256(__file__.encode()).hexdigest()}
    from pathlib import Path
    result['adapterSha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    for filename,expected in SOURCE_HASHES.items():
        actual=hashlib.sha256((INPUTS/filename).read_bytes()).hexdigest()
        if actual!=expected:raise ValueError('Recovered MK source differs: '+filename)
        result[filename]=actual
    return result


def previous_boards(catalog):
    from .catalog import OUTPUT
    checkpoint=OUTPUT/'manufacture-checkpoint.json'
    previous=[]
    if checkpoint.exists():
        state=json.loads(checkpoint.read_bytes())
        if state['contentHash']!=digest(state['boards']):raise ValueError('Changed accepted MK context')
        previous=[b for b in state['boards'] if b['difficulty']=='mozkokalypsa']
    return list(catalog.history['mozkokalypsa'])+previous


def variant_group(catalog, word):
    members=catalog.variants.get(word,{word})
    return tuple(sorted(members)) if len(members)>1 else None


@lru_cache(maxsize=1)
def recovered_policy():
    """Read only literal policy constants from the pinned recovered source."""
    text = (INPUTS/'mk100_manufacture.py').read_text(encoding='utf-8')
    if hashlib.sha256(text.encode('utf-8')).hexdigest()!=SOURCE_HASHES['mk100_manufacture.py']:
        raise ValueError('Recovered MK editorial policy changed')
    tree = ast.parse(text)
    wanted = {'NARROW','ORDINARY_LOWFREQ','EXCLUDE_THIS_EDITION','SCOPED_TOPIC_GROUPS'}
    nodes = [node for node in tree.body if isinstance(node,ast.Assign)
             and any(isinstance(t,ast.Name) and t.id in wanted for t in node.targets)]
    context = {'set':set}
    exec(compile(ast.Module(body=nodes,type_ignores=[]),str(INPUTS/'mk100_manufacture.py'),'exec'),
         {'__builtins__':{}},context)
    return context


def name(ordinal):
    return WAVE[(ordinal-1)%20]


def profile(ordinal):
    class C:
        profiles = json.loads((ROOT/'content/gen5/profiles.json').read_text(encoding='utf-8'))['profiles']
    p = full_profile(C())
    n = name(ordinal)
    minimum,mean,straight = {'relief':(1,3.0,.75),'main':(1,3.7,.67),
                             'challenge':(2,4.3,.60),'summit':(2,4.7,.55)}[n]
    p.update(min_len=5,max_len=9,min_path_turns=minimum,min_mean_turns=mean,
             max_path_straight_share=straight,geometry_profile=PROFILE_VERSION+'-'+n,
             cooldown=19,new_word_cap=2,
             policy={'allowed':['A','B','C'],'weights':{'A':1,'B':1,'C':1},
                     'min_fraction':{t:v/14 for t,v in PROFILE_TIERS[n].items()},
                     'max_fraction':{t:v/14 for t,v in PROFILE_TIERS[n].items()}})
    return p


@lru_cache(maxsize=1)
def pool():
    raw = (INPUTS/'geometry-pool-v2.jsonl').read_bytes()
    manifest = json.loads((INPUTS/'geometry-production-v2.json').read_bytes())
    if hashlib.sha256(raw).hexdigest()!=manifest['poolSha256']:
        raise ValueError('Recovered approved MK geometry pool changed')
    records = [json.loads(line) for line in raw.decode('utf-8').splitlines()]
    if len(records)!=224 or len(records)!=manifest['poolSize']:
        raise ValueError('Incomplete approved MK geometry pool')
    return records


def transform_path(path, variant):
    out=[]
    for cell in path:
        r,c=divmod(cell,10)
        if variant&4:r,c=c,r
        if variant&2:r=9-r
        if variant&1:c=9-c
        out.append(r*10+c)
    return out


def canonical_tiling(board):
    variants=[]
    for variant in range(8):
        paths=[]
        for answer in board['answers']:
            path=tuple(transform_path(answer['path'],variant))
            paths.append(min(path,path[::-1]))
        variants.append(tuple(sorted(paths)))
    return min(variants)


def topic(entry):
    policy=recovered_policy()
    scoped={w:label for label,words in policy['SCOPED_TOPIC_GROUPS'].items() for w in words.split()}
    return scoped.get(norm(entry['word']),entry.get('capacity_topic') or entry.get('topic') or entry.get('theme') or 'nezařazené')


def eligible(catalog):
    from wordfreq import zipf_frequency
    policy=recovered_policy()
    out={}
    for w,e in catalog.entries.items():
        if (not e.get('target_eligible') or w in catalog.exclusions|policy['EXCLUDE_THIS_EDITION']
            or not 5<=len(w)<=9 or e['tier'] not in 'ABC' or w==w[::-1]):
            continue
        z=zipf_frequency(w,'cs')
        if e.get('fun',3)<3 or (w not in catalog.additions and z<2.7):
            continue
        e=deepcopy(e)
        e['zipfEditorialProxy']=round(z,3)
        e['editorialTopic']=topic(e)
        e['intentionalPolarizing']=w in policy['NARROW'] or (z<2.4 and w not in policy['ORDINARY_LOWFREQ'])
        out[w]=e
    return out


def choose(catalog, exposure, rng, ordinal):
    """Approved shape/tier/texture rules, with the shared current exposure ledger."""
    n=name(ordinal)
    forbidden=exposure.forbidden('mozkokalypsa')
    entries=getattr(catalog,'mk_entries',None)
    if entries is None:
        entries=eligible(catalog)
        catalog.mk_entries=entries
    available={w:e for w,e in entries.items() if w not in forbidden}
    prior=previous_boards(catalog)
    family_recent={catalog.entries[norm(a['word'])].get('family') for b in prior[-7:]
                   for a in b['answers'] if norm(a['word']) in catalog.entries}
    family_recent.discard(None)
    used_variants={variant_group(catalog,norm(a['word'])) for b in prior
                   if b['id'].startswith('g6-expansion-mozkokalypsa-') for a in b['answers']}
    used_variants.discard(None)
    available={w:e for w,e in available.items() if (not e.get('family') or e['family'] not in family_recent)
               and variant_group(catalog,w) not in used_variants}
    p=profile(ordinal)
    for _ in range(200):
        shape=SHAPE.copy();rng.shuffle(shape)
        tiers=assign_tiers(shape,available,p['policy'],rng)
        if tiers is None:continue
        chosen=[];themes=Counter();families=set();variants=set();polar=0
        for length,tier in sorted(zip(shape,tiers),key=lambda x:(x[1]!='C',-x[0])):
            options=[w for w,e in available.items() if len(w)==length and e['tier']==tier and w not in chosen
                     and themes[e['editorialTopic']]<3
                     and (not e.get('family') or e['family'] not in families)
                     and e.get('variant_unit',w) not in variants
                     and polar+int(e['intentionalPolarizing'])<=POLARIZING_CAP[n]]
            if not options:break
            options.sort()
            weights=[exposure.weight('mozkokalypsa',w)
                     *(2.1 if w in catalog.additions else 1)
                     *(1+min(1.6,max(0,available[w]['zipfEditorialProxy']-2.7)))
                     *(.35 if available[w]['intentionalPolarizing'] else 1)
                     /(1+themes[available[w]['editorialTopic']])**1.9 for w in options]
            w=rng.choices(options,weights=weights,k=1)[0];e=available[w]
            chosen.append(w);themes[e['editorialTopic']]+=1;polar+=int(e['intentionalPolarizing'])
            if e.get('family'):families.add(e['family'])
            variants.add(e.get('variant_unit',w))
        if (len(chosen)==14 and len(themes)>=7 and sum(w in catalog.additions for w in chosen)>=6
            and digest(sorted(chosen)) not in catalog.historical_words_hashes):
            return chosen
    raise ValueError('Approved MK lexical texture capacity exhausted for '+str(ordinal))


def build(words,rng,deadline,ordinal,rejections):
    options=[(i,p) for i,p in enumerate(pool()) if p['constructionProfile']==name(ordinal)]
    index,geometry=rng.choice(options)
    variant=rng.randrange(8)
    paths=[transform_path(path,variant) for path in geometry['paths']]
    if rng.randrange(2):paths=[path[::-1] for path in paths]
    b=board_from_paths(paths,words,rng)
    b['difficulty']='mozkokalypsa'
    b['_mkPlacement']={'geometryPoolIndex':index,'geometrySeed':geometry.get('seed'),
                       'geometryStep':geometry.get('step'),'transform':variant,
                       'sourceCommit':SOURCE_COMMIT}
    return b


def endgame_meets_floor(result):
    s=result['summary']
    return (s['endgameSelectionScore']>=23.4209 and s['plausiblePressureMinimum']>=20
            and s['plausibleAllThreeSimpleChains']==0)


def generate(catalog,exposure,solver,rng,ordinal,deadline):
    """Select 16/48 fully verified placements rather than the first solver pass."""
    p=profile(ordinal);n=name(ordinal);targeted=ordinal in TARGETED
    want=48 if targeted else 16
    rejects=Counter();options=[];attempts=0
    words=choose(catalog,exposure,rng,ordinal)
    entries=catalog.mk_entries
    recent_tilings={canonical_tiling(b) for b in previous_boards(catalog)[-7:]}
    while time.monotonic()<deadline-.05:
        attempts+=1
        b=build(words,rng,deadline,ordinal,rejects)
        if canonical_tiling(b) in recent_tilings:rejects['canonical_gap']+=1;continue
        if geometry_errors(structural(b),p):rejects['geometry']+=1;continue
        proof=solver.verify(b,seconds=min(5,max(.01,deadline-time.monotonic())),node_limit=1000000)
        if proof['status']!='unique' or not proof['targetPathsUnique']:
            rejects['solver_'+proof['status'] if proof['targetPathsUnique'] else 'target_paths']+=1
            continue
        pressure=residual_metrics(b,solver.prefixes)
        interweave=weave(b)
        ending=endgame_metrics(b,solver.prefixes,entries,seed=2026110201+ordinal,random_orders=6) if targeted else None
        if n=='relief':score=-pressure['selectionScore']+.04*interweave['crossContacts']
        elif n=='main':score=pressure['selectionScore']+.08*interweave['crossContacts']+.2*interweave['axisReentries']
        else:score=pressure['selectionScore']+.12*interweave['crossContacts']+.4*interweave['axisReentries']
        if ending:score+=ending['summary']['endgameSelectionScore']*3
        options.append((score,b,proof,pressure,ending,interweave))
        if len(options)>=want and (not targeted or sum(endgame_meets_floor(o[4]) for o in options)>=4):break
    eligible_options=[o for o in options if not targeted or endgame_meets_floor(o[4])]
    if len(options)<want or not eligible_options:
        return None
    score,b,proof,pressure,ending,interweave=max(eligible_options,key=lambda o:o[0])
    placement=b.pop('_mkPlacement')
    evidence={'profile':n,'profileVersion':PROFILE_VERSION,'targetedEndgame':targeted,
              'verifiedOptions':len(options),'requiredVerifiedOptions':want,'attempts':attempts,
              'selectedPlacement':placement,'pressure':pressure,'endgame':ending,
              'weave':interweave,
              'selectionScore':score,'verification':proof,'rejections':dict(rejects),
              'candidateOptions':[{'contentHash':digest({k:x[1][k] for k in ('rows','cols','mask','letters','answers','lengths')}),
                                   'selectionScore':x[0],
                                   'endgameFloor':endgame_meets_floor(x[4]) if x[4] else None}
                                  for x in options],
              'humanDifficulty':'unmeasured'}
    b['meta']={'profile':n,'profileVersion':PROFILE_VERSION,'targetedEndgame':targeted,
               'manufacture':{'mk':evidence}}
    return b


def validate(board,previous_mk_boards,catalog=None):
    """Independent acceptance boundary for the recovered MK-specific rules."""
    from .catalog import ExpansionCatalog
    catalog=catalog or ExpansionCatalog()
    ordinal=board['meta']['manufacture']['profileOrdinal']
    entries=eligible(catalog)
    words=[norm(a['word']) for a in board['answers']]
    if sorted(map(len,words))!=SHAPE:raise ValueError('MK fixed length composition')
    if Counter(entries[w]['tier'] for w in words)!=Counter(PROFILE_TIERS[name(ordinal)]):raise ValueError('MK exact tier composition')
    topics=Counter(entries[w]['editorialTopic'] for w in words)
    if len(topics)<7 or max(topics.values())>3:raise ValueError('MK editorial topic texture')
    if sum(entries[w]['intentionalPolarizing'] for w in words)>POLARIZING_CAP[name(ordinal)]:raise ValueError('MK polarizing term cap')
    if sum(w in catalog.additions for w in words)<6:raise ValueError('MK refreshed vocabulary composition')
    if canonical_tiling(board) in {canonical_tiling(b) for b in previous_mk_boards[-7:]}:raise ValueError('MK canonical tiling gap')
    families={entries[w].get('family') for w in words}-{None}
    recent_families={catalog.entries[norm(a['word'])].get('family') for b in previous_mk_boards[-7:]
                     for a in b['answers'] if norm(a['word']) in catalog.entries}-{None}
    if families&recent_families:raise ValueError('MK family gap')
    groups={variant_group(catalog,w) for w in words}-{None}
    prior_groups={variant_group(catalog,norm(a['word'])) for b in previous_mk_boards
                  if b['id'].startswith('g6-expansion-mozkokalypsa-') for a in b['answers']}-{None}
    if groups&prior_groups:raise ValueError('MK spelling variant group reused')
    evidence=board['meta']['manufacture']['mk']
    target=ordinal in TARGETED
    if evidence['verifiedOptions']<(48 if target else 16):raise ValueError('MK candidate pool incomplete')
    if target and not endgame_meets_floor(evidence['endgame']):raise ValueError('MK endgame proxy floor')
    return {'profile':name(ordinal),'targetedEndgame':target,'canonicalTilingHash':digest(canonical_tiling(board)),
            'verifiedCandidateCount':evidence['verifiedOptions']}
