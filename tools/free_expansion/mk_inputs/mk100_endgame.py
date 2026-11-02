"""Offline last-three design proxies; neither telemetry nor a human-time model.

The previous residual score stops at seven found words. This module evaluates
the actual remainder after eleven found words. Runtime-recognized prefixes
must be passed unchanged; no target-only dictionary is used to fake pressure.
"""
from __future__ import annotations

from collections import Counter
from itertools import combinations, pairwise
import argparse
import hashlib
import json
from pathlib import Path
import random
import statistics

from tools.gen5.catalog import digest, norm
from tools.gen5.validation import neighbours, path_metrics
from tools.measure_gen4_ambiguity import board_metrics, percentile

METRIC = 'mk100-after11-proxy-v1'


def residual_structure(board, indices):
    """Describe induced remaining-cell graph independently of its lettering.

    An isolated simple chain has its own component with no self chord: tracing
    from either endpoint reveals the whole word shape. An isolated word whose
    path folds against itself is NOT classified as a simple chain.
    """
    answers = [board['answers'][i] for i in indices]
    owner = {cell:i for i,a in enumerate(answers) for cell in a['path']}
    if len(owner) != sum(len(a['path']) for a in answers):
        raise ValueError('Remaining answer paths overlap')
    mask = set(owner)
    adjacency = {c:neighbours(c,board['rows'],board['cols'],mask) for c in mask}
    true_edges = {tuple(sorted(e)) for a in answers for e in pairwise(a['path'])}
    contacts, chords = 0, 0
    neighbor_words = [set() for _ in answers]
    for c, adjacent in adjacency.items():
        for nxt in adjacent:
            if nxt <= c:
                continue
            if owner[c] != owner[nxt]:
                contacts += 1
                neighbor_words[owner[c]].add(owner[nxt])
                neighbor_words[owner[nxt]].add(owner[c])
            elif (c,nxt) not in true_edges:
                chords += 1
    isolated = [i for i,a in enumerate(answers)
                if not neighbor_words[i] and all(len(adjacency[c]) <= 2 for c in a['path'])]
    rest, component_sizes = set(mask), []
    while rest:
        todo, count = [min(rest)], 0
        rest.remove(todo[0])
        while todo:
            c = todo.pop()
            count += 1
            for nxt in adjacency[c]:
                if nxt in rest:
                    rest.remove(nxt)
                    todo.append(nxt)
        component_sizes.append(count)
    return {'crossWordContacts':contacts, 'nonconsecutiveSelfContacts':chords,
            'isolatedChainWords':len(isolated),
            'isolatedChainWordList':[answers[i]['word'] for i in isolated],
            'residualComponents':len(component_sizes),
            'componentSizes':sorted(component_sizes,reverse=True),
            'branchCells':sum(len(adj)>=3 for adj in adjacency.values()),
            'degreeAtMost2Share':round(sum(len(adj)<=2 for adj in adjacency.values())/len(mask),4)}


def _tail_record(board, indices, prefixes, max_depth=4):
    remaining = [board['answers'][i] for i in indices]
    residual = {**board, 'answers':remaining,
                'mask':sorted(c for a in remaining for c in a['path']),
                'lengths':[len(a['word']) for a in remaining]}
    pressure = board_metrics(residual,prefixes,max_depth)
    return {'remainingIndices':list(indices), 'remainingWords':[a['word'] for a in remaining],
            **residual_structure(board,indices), 'pressure':pressure}


def plausible_orders(board, entries=None):
    """Three transparent easy-first hypotheses, not observed player orders.

    The familiarity order uses saved AI editorial tiers (A before B before C),
    not measured population knowledge. Unknown words are C, with that missing
    basis reported separately. Mixed order combines this tier with path turns.
    """
    entries = entries or {}
    indices = list(range(len(board['answers'])))
    def geometry(i):
        a=board['answers'][i]
        return path_metrics(a['path'],board['cols'])[0],len(a['word']),norm(a['word'])
    def familiarity(i):
        a=board['answers'][i]; e=entries.get(norm(a['word']),{})
        tier={'A':0,'B':1,'C':2,'D':3}.get(e.get('tier'),2)
        return tier,-float(e.get('familiarity') or 0),geometry(i)
    def mixed(i):
        return (2*familiarity(i)[0]+geometry(i)[0]/2+geometry(i)[1]/10,geometry(i)[2])
    return [('geometry-first',sorted(indices,key=geometry)),
            ('familiarity-first',sorted(indices,key=familiarity)),
            ('mixed-first',sorted(indices,key=mixed))]


def endgame_metrics(board, prefixes, entries=None, exhaustive=False,
                    seed=20261001, random_orders=6):
    """Return complete per-tail evidence plus bounded comparative selection aid.

    Recommended production use: inexpensive named/sensitivity orders for a
    larger pool; exhaustive 364 triples for selected harder-end candidates.
    This function does not prove uniqueness. Use the complete solver separately.
    """
    if len(board['answers'])!=14:
        raise ValueError('The last-three audit expects fourteen target words')
    orders=plausible_orders(board,entries)
    plausible=[]
    for label,order in orders:
        plausible.append({'label':label,'kind':'plausible-hypothesis',
                          'foundOrder':[board['answers'][i]['word'] for i in order],
                          **_tail_record(board,order[-3:],prefixes)})
    sensitivity=[]
    for i in range(random_orders):
        order=list(range(14))
        # Seed depends only on declared seed and sample index, so reference
        # boards and new candidates get the same deterministic permutation.
        random.Random(int(digest([seed,'endgame-order',i])[:16],16)).shuffle(order)
        sensitivity.append({'label':f'sensitivity-{i+1}','kind':'uniform-sensitivity-order',
                            'foundOrder':[board['answers'][j]['word'] for j in order],
                            **_tail_record(board,order[-3:],prefixes)})
    p=[r['pressure']['localAmbiguityScore'] for r in plausible]
    q=[r['pressure']['localAmbiguityScore'] for r in sensitivity] or p
    isolated=statistics.mean(r['isolatedChainWords'] for r in plausible)
    score=(.4*min(p)+.4*statistics.median(p)+.2*percentile(q,.25))*(1-.18*isolated)
    result={'metric':METRIC,'removedWords':11,'remainingWords':3,
            'prefixMaxDepth':4,'plausible':plausible,'sensitivity':sensitivity,
            'summary':{'plausiblePressureMinimum':min(p),
                       'plausiblePressureMedian':statistics.median(p),
                       'distinctPlausibleTailCount':len({tuple(sorted(r['remainingIndices'])) for r in plausible}),
                       'distinctEvaluatedOrderTailCount':len({tuple(sorted(r['remainingIndices'])) for r in plausible+sensitivity}),
                       'sensitivityPressureP25':round(percentile(q,.25),3),
                       'sensitivityPressureMedian':statistics.median(q),
                       'plausibleIsolatedChainWordsMean':round(isolated,4),
                       'plausibleAllThreeSimpleChains':sum(r['isolatedChainWords']==3 for r in plausible),
                       'endgameSelectionScore':round(score,4)},
            'missingEditorialBasis':[a['word'] for a in board['answers']
                                     if norm(a['word']) not in (entries or {})],
            'interpretation':'Static after-eleven prefix/geometry proxy and simulated orders; no measured player difficulty, timing or enjoyment.'}
    if exhaustive:
        tails=[_tail_record(board,indices,prefixes) for indices in combinations(range(14),3)]
        pressures=[r['pressure']['localAmbiguityScore'] for r in tails]
        result['exhaustive']={'triples':len(tails),
            'pressureMin':min(pressures),'pressureP25':round(percentile(pressures,.25),3),
            'pressureMedian':statistics.median(pressures),'pressureMax':max(pressures),
            'medianCrossWordContacts':statistics.median(r['crossWordContacts'] for r in tails),
            'medianNonconsecutiveSelfContacts':statistics.median(r['nonconsecutiveSelfContacts'] for r in tails),
            'isolatedChainWordShare':round(sum(r['isolatedChainWords'] for r in tails)/(3*len(tails)),6),
            'allThreeSimpleChainFraction':round(sum(r['isolatedChainWords']==3 for r in tails)/len(tails),6),
            'tailRecords':tails}
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dictionary',type=Path,required=True)
    parser.add_argument('--lexicon',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('banks',type=Path,nargs='+')
    args=parser.parse_args()
    dictionary=sorted(set(norm(w) for w in args.dictionary.read_text(encoding='utf-8').splitlines() if w.strip()))
    prefixes={depth:{w[:depth] for w in dictionary if len(w)>=depth} for depth in range(1,5)}
    entries={norm(e['word']):e for e in json.loads(args.lexicon.read_text(encoding='utf-8'))['entries']}
    inputs={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [args.dictionary,args.lexicon,*args.banks]}
    records=[]
    for p in args.banks:
        bank=json.loads(p.read_text(encoding='utf-8'))
        for board in bank['boards']:
            if board['id'] in {'mk2-09','mk2-10'} or board['id'].startswith('mk3w2-'):
                records.append({'id':board['id'],**endgame_metrics(board,prefixes,entries,True)})
    output={'date':'2026-10-01','metric':METRIC,'dictionarySize':len(dictionary),
            'dictionaryHash':digest(dictionary),'inputsSha256':inputs,'references':records,
            'interpretation':'Existing immutable reference boards, read-only offline audit. Simulations are not telemetry. Exact uniqueness is a separate validation.'}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'metric':METRIC,'dictionarySize':len(dictionary),
                      'references':[{'id':r['id'],**r['summary'],
                                     'allTriplesPressureMedian':r['exhaustive']['pressureMedian'],
                                     'allTriplesContactsMedian':r['exhaustive']['medianCrossWordContacts'],
                                     'allTriplesSelfContactsMedian':r['exhaustive']['medianNonconsecutiveSelfContacts']}
                                    for r in records]},ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
