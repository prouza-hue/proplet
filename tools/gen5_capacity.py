#!/usr/bin/env python3
"""Vocabulary-only rehearsal for the proposed 450 boards. Does not build any board."""
from collections import Counter
import argparse
import random
from gen5.catalog import Catalog, DIFFICULTIES, Exposure, choose_words, digest, input_fingerprint
from gen5.runner import safe_directory, atomic_write


def simulate(catalog, seed):
    ledger=Exposure(catalog)
    schedule={d:50 if d=='mozkomor' else 100 for d in DIFFICULTIES}
    failures=[]
    counts={d:Counter() for d in DIFFICULTIES}
    accepted={d:0 for d in DIFFICULTIES}
    signatures=set(catalog.historical_words_hashes)
    for ordinal in range(1,101):
        for d in DIFFICULTIES:
            if ordinal>schedule[d]:
                continue
            rng=random.Random(int(digest([seed,d,ordinal])[:16],16))
            try:
                words=choose_words(catalog,ledger,d,rng)
                signature=digest(sorted(words))
                if signature in signatures:
                    raise ValueError('duplicate target set')
                signatures.add(signature)
                board={'difficulty':d,'answers':[{'word':w} for w in words]}
                ledger.add(board);counts[d].update(words);accepted[d]+=1
            except ValueError as exc:
                failures.append({'difficulty':d,'ordinal':ordinal,'reason':str(exc)})
        if ordinal%25==0:
            print(seed,'round',ordinal,'allocated',sum(accepted.values()),'failures',len(failures),flush=True)
    return {'seed':seed,'failures':failures,'profiles':{d:{
        'planned':schedule[d],'allocated':accepted[d],'unique':len(counts[d]),
        'occurrences':sum(counts[d].values()),'maxUses':max(counts[d].values(),default=0),
        'fourLetterShare':sum(n for w,n in counts[d].items() if len(w)==4)/max(1,sum(counts[d].values())),
        'quartetUses':sum(counts[d][w] for w in ('bobr','drak','upír','štít')),
        'topWords':counts[d].most_common(10)} for d in DIFFICULTIES}}


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output',required=True)
    args=ap.parse_args()
    from pathlib import Path
    output=safe_directory(Path(args.output))
    output.mkdir(parents=True,exist_ok=True)
    destination=output/'capacity.json'
    if destination.exists():
        raise ValueError('Capacity report already exists; choose a new run directory')
    c=Catalog();fingerprint=input_fingerprint()
    results=[]
    for seed in (20260915,20260916,20260917):
        result=simulate(c,seed);results.append(result)
        print(seed, 'allocated',sum(p['allocated'] for p in result['profiles'].values()),'of 450; failures',len(result['failures']),flush=True)
    if input_fingerprint()!=fingerprint:
        raise ValueError('Inputs changed during rehearsal')
    atomic_write(destination,{'kind':'vocabulary-only-capacity-rehearsal','inputs':fingerprint,
        'limitations':'Does not test packing, ambiguity rejection bias, lexical quality or human difficulty. Not 450 generated levels.',
        'eligible':{d:dict(Counter(e['tier'] for e in c.eligible(d).values())) for d in DIFFICULTIES},'runs':results})


if __name__=='__main__':
    main()
