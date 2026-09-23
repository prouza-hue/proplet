#!/usr/bin/env python3
"""Offline, bounded Mozkokalypsa 2/4/4 experiment. Never changes released banks.

Uses the current Gen5 validator and lexical history. Full-board geometry is a
backbite-randomized Hamiltonian tiling, not letters added to an existing board.
Opposite word-end contacts are eliminated by solving endpoint parity constraints.
Selection metrics are hypotheses about difficulty, NOT measured human difficulty.
"""
from __future__ import annotations
import argparse
from collections import Counter
from copy import deepcopy
import json
import math
from pathlib import Path
import random
import statistics
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / 'tools')]
from tools.gen5.catalog import Catalog, Exposure, assign_tiers, digest, input_fingerprint, norm
from tools.gen5.validation import Solver, validation_words, structural, geometry_errors, adjacent, path_metrics
from tools.gen5.runner import difficulty_prefixes
from tools.measure_gen4_ambiguity import board_metrics

EXPERIMENT = 'mozkokalypsa-20260922-v1'
SHAPE = [5] + [6]*3 + [7]*4 + [8]*5 + [9]
GRID = list(range(100))
ADJ = {i: [j for j in GRID if adjacent(i, j, 10)] for i in GRID}


def path_turns(path):
    return sum((b-a) != (c-b) for a, b, c in zip(path, path[1:], path[2:]))


def mix_path(path, rng, steps=200, beta=1.8):
    score = path_turns(path)
    for _ in range(steps):
        if rng.random() < .5:
            path = path[::-1]
        i = path.index(rng.choice(ADJ[path[0]]))
        if i < 2:
            continue
        candidate = path[i-1::-1] + path[i:]
        new = path_turns(candidate)
        if new >= score or rng.random() < math.exp((new-score)*beta):
            path, score = candidate, new
    return path


def orient_paths(paths, rng):
    """Every touching pair of endpoints must both be starts or both be ends."""
    edges = {i: [] for i in range(len(paths))}
    for i, p in enumerate(paths):
        for j, q in enumerate(paths[:i]):
            for a, x in enumerate((p[0], p[-1])):
                for b, y in enumerate((q[0], q[-1])):
                    if adjacent(x, y, 10):
                        edges[i].append((j, a ^ b))
                        edges[j].append((i, a ^ b))
    flips = {}
    for i in edges:
        if i in flips:
            continue
        flips[i] = rng.randrange(2)
        todo = [i]
        while todo:
            k = todo.pop()
            for j, parity in edges[k]:
                expected = flips[k] ^ parity
                if j in flips:
                    if flips[j] != expected:
                        return None
                else:
                    flips[j] = expected
                    todo.append(j)
    return [p[::-1] if flips[i] else p for i, p in enumerate(paths)]


def full_profile(catalog):
    p = deepcopy(catalog.profiles['mozkomor'])
    p.update(cells=[100,100], words=[14,14], min_bbox_rows=10,
             min_bbox_cols=10, max_curl_paths=14, max_blank_components=0,
             max_isolated_blanks=0, geometry_profile='mozkokalypsa-full-v1')
    return p


def choose_set(catalog, exposure, forbidden, rng):
    available = {w: e for w,e in catalog.eligible('mozkomor').items()
                 if w not in forbidden and w not in {'lunochod'}
                 and e['tier'] in {'A','B','C'}
                 and e.get('origin') != 'wikidata_frequency_candidate'}
    # Same exact tier composition and length multiset in both full-board arms.
    policy = {'allowed':['A','B','C'], 'weights':{'A':1,'B':1,'C':1},
              'min_fraction':{'A':2/14,'B':6/14,'C':6/14},
              'max_fraction':{'A':2/14,'B':6/14,'C':6/14}}
    shape = SHAPE.copy()
    rng.shuffle(shape)
    tiers = assign_tiers(shape, available, policy, rng)
    if tiers is None:
        raise ValueError('Insufficient reviewed lexical capacity')
    words = []
    for n,t in zip(shape,tiers):
        pool = sorted(w for w,e in available.items() if len(w)==n and e['tier']==t and w not in words)
        weights = [exposure.weight('mozkomor',w) for w in pool]
        words.append(rng.choices(pool,weights=weights,k=1)[0])
    return words


def board_from_paths(paths, words, rng):
    buckets = {}
    for w in words:
        buckets.setdefault(len(w),[]).append(w)
    for ws in buckets.values():
        rng.shuffle(ws)
    answers,letters = [],['']*100
    for path in paths:
        word = buckets[len(path)].pop().upper()
        answers.append({'word':word,'path':path})
        for i,c in zip(path,word):
            letters[i]=c
    rng.shuffle(answers)
    return {'difficulty':'mozkomor','rows':10,'cols':10,'mask':GRID.copy(),
            'letters':letters,'answers':answers,'lengths':[len(a['word']) for a in answers]}


def residual_metrics(board, prefixes):
    """Fixed synthetic orders: easy-first plus six random orders; no human claim."""
    answers = board['answers']
    indices = list(range(len(answers)))
    # A simple easy-first proxy: fewer turns and shorter words first.
    orders = [sorted(indices,key=lambda i:(path_metrics(answers[i]['path'],10)[0],len(answers[i]['word']),answers[i]['word']))]
    for seed in range(6):
        order = indices.copy()
        random.Random(2026092200+seed).shuffle(order)
        orders.append(order)
    scores = {3:[],len(answers)//2:[]}
    for k in scores:
        for order in orders:
            remaining = [answers[i] for i in indices if i not in set(order[:k])]
            cells = sorted(c for a in remaining for c in a['path'])
            residual = {**board,'answers':remaining,'mask':cells,
                        'lengths':[len(a['word']) for a in remaining]}
            scores[k].append(board_metrics(residual,prefixes,4)['localAmbiguityScore'])
    early = statistics.median(scores[3])
    middle = statistics.median(scores[len(answers)//2])
    initial = board_metrics(board,prefixes,4)['localAmbiguityScore']
    return {'initial':initial,'after3Median':round(early,3),
            'halfMedian':round(middle,3),
            'after3Worst':min(scores[3]),'halfWorst':min(scores[len(answers)//2]),
            'orders':7,'selectionScore':round(.3*initial+.3*early+.4*middle,4)}


def generate_full(catalog, solver, prefixes, words, rng, profile, arm, budget, target_pool):
    deadline = time.monotonic()+budget
    path = [r*10+c for r in range(10) for c in (range(10) if r%2==0 else range(9,-1,-1))]
    path = mix_path(path,rng,8000)
    rejected = Counter()
    candidates=[]
    for attempt in range(1,20001):
        if time.monotonic()>=deadline:
            break
        path = mix_path(path,rng)
        lengths = SHAPE.copy();rng.shuffle(lengths)
        paths=[];offset=0
        for n in lengths:
            paths.append(path[offset:offset+n]);offset+=n
        paths = orient_paths(paths,rng)
        if paths is None:
            rejected['endpoint_parity']+=1;continue
        # Try a few independently shuffled lexical placements per sound tiling.
        for _ in range(5):
            board = board_from_paths(paths,words,rng)
            metrics = structural(board)
            errors = geometry_errors(metrics,profile)
            if errors:
                rejected.update(errors);break
            verified = solver.verify(board,seconds=3)
            if verified['status']!='unique' or not verified['targetPathsUnique']:
                rejected['solver_'+verified['status'] if verified['targetPathsUnique'] else 'target_path']+=1
                continue
            residual = residual_metrics(board,prefixes)
            candidates.append((residual['selectionScore'],board,metrics,verified,residual))
            if len(candidates)>=target_pool:
                break
        if len(candidates)>=target_pool:
            break
    if len(candidates)<target_pool:
        raise RuntimeError(f'Incomplete {arm} candidate pool: {len(candidates)}/{target_pool}, {dict(rejected)}')
    # Ordinary arm is FIRST valid board, never cherry-picked downwards.
    chosen = candidates[0] if arm=='full' else max(candidates,key=lambda c:c[0])
    _,board,metrics,verified,residual = chosen
    return board, {'candidateCount':len(candidates),'selection':'first-valid' if arm=='full' else 'best-sustained-of-24',
                   'poolScores':[c[0] for c in candidates], 'rejections':dict(rejected),
                   'geometry':metrics,'verification':verified,'pressure':residual}


def write(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix(path.suffix+'.tmp')
    tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    tmp.replace(path)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--baseline',type=Path,required=True)
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--seed',type=int,default=2026092202)
    ap.add_argument('--seconds-per-board',type=float,default=120)
    args=ap.parse_args()
    target=args.output.resolve()
    if (ROOT/'lab-output').resolve() not in target.parents or target.exists():
        raise ValueError('Use a new private lab-output subdirectory')
    target.mkdir(parents=True)
    started=time.monotonic();catalog=Catalog();frozen=input_fingerprint()
    solver=Solver(validation_words(catalog));prefixes=difficulty_prefixes(catalog)
    controls=json.loads(args.baseline.read_text(encoding='utf-8'))['puzzles']
    if len(controls)!=2:
        raise ValueError('Exactly two independently generated controls required')
    boards=[];evidence=[];rng=random.Random(args.seed)
    forbidden=set().union(*(catalog.words(b) for b in controls))
    forbidden |= set().union(*(catalog.words(b) for b in catalog.history['mozkomor'][-12:]))
    exposure=Exposure(catalog,controls)
    for i,b in enumerate(controls,1):
        b=deepcopy(b);b['id']=f'mk26-{i:02d}'
        verification=solver.verify(b)
        if verification['status']!='unique' or not verification['targetPathsUnique']:
            raise ValueError('Control failed independent revalidation')
        e={'id':b['id'],'arm':'control','geometry':structural(b),'verification':verification,
           'pressure':residual_metrics(b,prefixes),'sourceId':controls[i-1]['id']}
        b['meta']={'level':i,'experimentId':EXPERIMENT,'playtestOnly':True}
        boards.append(b);evidence.append(e)
    for i in range(3,11):
        arm='full' if i<7 else 'sustained'
        seed=rng.randrange(2**31);local=random.Random(seed)
        words=choose_set(catalog,exposure,forbidden,local)
        b,e=generate_full(catalog,solver,prefixes,words,local,full_profile(catalog),arm,
                          args.seconds_per_board,1 if arm=='full' else 24)
        b['id']=f'mk26-{i:02d}';b['meta']={'level':i,'experimentId':EXPERIMENT,'playtestOnly':True}
        e.update(id=b['id'],arm=arm,seed=seed,
                 tiers=dict(Counter(catalog.entries[w]['tier'] for w in words)),
                 words=sorted(w.upper() for w in words))
        boards.append(b);evidence.append(e);forbidden.update(words);exposure.add(b)
        write(target/'checkpoint.json',{'boards':boards,'evidence':evidence})
        print(b['id'],arm,e['pressure'],e.get('candidateCount'),e['words'],flush=True)
    if input_fingerprint()!=frozen:
        raise ValueError('Frozen released inputs changed')
    allwords=[norm(a['word']) for b in boards for a in b['answers']]
    assert len(allwords)==len(set(allwords))
    for b in boards:
        v=solver.verify(b)
        assert v['status']=='unique' and v['targetPathsUnique']
    # Stable balanced interleavings, hidden arm IDs remain server-side.
    orders=[['mk26-01','mk26-03','mk26-07','mk26-04','mk26-08','mk26-02','mk26-05','mk26-09','mk26-06','mk26-10'],
            ['mk26-08','mk26-04','mk26-02','mk26-09','mk26-05','mk26-10','mk26-06','mk26-01','mk26-07','mk26-03'],
            ['mk26-05','mk26-09','mk26-06','mk26-01','mk26-10','mk26-03','mk26-07','mk26-02','mk26-04','mk26-08']]
    manifest={'experimentId':EXPERIMENT,'version':1,'name':'Mozkokalypsa','status':'verified-content-not-deployed',
              'sourceSha':'6a3918f592698562943026203c5e6ce9869b9652','seed':args.seed,
              'humanDifficulty':'unmeasured','boards':boards,'orders':orders}
    report={'experimentId':EXPERIMENT,'sourceSha':manifest['sourceSha'],'inputs':frozen,
            'dictionary':{'size':len(solver.words),'sha256':solver.hash},'uniqueWords':len(allwords),
            'boardCount':10,'arms':dict(Counter(e['arm'] for e in evidence)),
            'seconds':round(time.monotonic()-started,3),'boards':evidence,
            'bankHash':digest(manifest),'difficultyWarning':'Proxy scores are NOT human difficulty or timing predictions.'}
    write(target/'bank.json',manifest);write(target/'verification.json',report)
    print('COMPLETE',report['seconds'],report['bankHash'],flush=True)

if __name__=='__main__':main()
