"""Explicit v1 -> v2 correction of the difficulty measurement reference.

Keeps the original checkpoint and exact source copies as evidence. The current
recognition solver is unchanged. Passing board geometry/targets stay identical;
only a layout below its approved calibrated band is repacked with the same words.
"""
from collections import Counter
from copy import deepcopy
import json
import random
import time

from tools.gen5.catalog import digest
from tools.gen5.geometry import build
from tools.gen5.validation import BudgetExceeded,structural
from tools.measure_gen4_ambiguity import board_metrics
from .catalog import (ExpansionCatalog,ExpansionExposure,OUTPUT,CHECKPOINT_NAME,
    profile_for,difficulty_prefixes,board_digest,sha,SEED)
from .manufacture import write,accept,input_manifest
from . import mk


def main():
    source=OUTPUT/'manufacture-checkpoint.json';target=OUTPUT/CHECKPOINT_NAME
    if target.exists():raise ValueError('A v2 run already exists; never overwrite a checkpoint')
    old=json.loads(source.read_text(encoding='utf-8'))
    if old['contentHash']!=digest(old['boards']):raise ValueError('Original checkpoint content changed')
    catalog=ExpansionCatalog();solver=catalog.solver();prefixes=difficulty_prefixes(catalog)
    if old['inputs']['recognitionHash']!=solver.hash:raise ValueError('Correctness dictionary changed')
    state=deepcopy(old);state['inputs']=input_manifest(catalog,solver)
    state['extensions']['mozkokalypsa']=mk.fingerprint()
    receipt={'reason':'Restore the approved difficulty metric scale after data/words.txt grew during Daily Gen6 integration',
        'date':'2026-11-02','originalCheckpointSha256':sha(source),'originalInputs':old['inputs'],
        'newInputs':state['inputs'],'originalExtensions':old['extensions'],'newExtensions':state['extensions'],
        'correctnessDictionaryUnchanged':{'size':len(solver.words),'hash':solver.hash},
        'baseline':{'board':'g6-refresh-hard-100','stored':15.972,'recomputedFrozen':15.972,'recomputedExpanded':25.25},
        'boards':[]}
    exposure=ExpansionExposure(catalog);ids=set(catalog.historical_ids)
    wordsets=set(catalog.historical_words_hashes);shapes=set(catalog.historical_shapes);counts=Counter()
    previous_mk=list(catalog.history['mozkokalypsa'])
    for index,original in enumerate(old['boards']):
        board=deepcopy(original);d=board['difficulty'];ordinal=counts[d]+1
        p=profile_for(catalog,d,ordinal);oldmetric=board['meta']['manufacture']['ambiguity']
        metric=board_metrics(board,prefixes,4);repacked=False
        if d!='mozkokalypsa' and not p['ambiguity'][0]<=metric['localAmbiguityScore']<=p['ambiguity'][1]:
            words=sorted(catalog.words(board));deadline=time.monotonic()+180;attempt=0
            rng=random.Random(SEED+30000000+ordinal)
            while time.monotonic()<deadline:
                attempt+=1
                try:candidate=build(words,d,p,rng,min(deadline,time.monotonic()+10),Counter())
                except BudgetExceeded:continue
                if candidate is None:continue
                candidate_metric=board_metrics(candidate,prefixes,4)
                if not p['ambiguity'][0]<=candidate_metric['localAmbiguityScore']<=p['ambiguity'][1]:continue
                proof=solver.verify(candidate,seconds=15,node_limit=2000000)
                if proof['status']!='unique' or not proof['targetPathsUnique']:continue
                candidate['id']=board['id'];candidate['meta']=deepcopy(board['meta'])
                candidate['meta']['manufacture'].update(geometry=structural(candidate),ambiguity=candidate_metric,
                    verification=proof,independentVerification=proof,
                    geometryRebaseSeed=SEED+30000000+ordinal,geometryRebaseAttempt=attempt)
                board=candidate;metric=candidate_metric;repacked=True;break
            if not repacked:raise ValueError('Cannot restore calibrated geometry without changing words: '+board['id'])
        board['meta']['manufacture']['ambiguity']=metric
        board['meta']['manufacture']['ambiguityRebaseline']={'previousMetric':oldmetric,
            'reference':'content/gen5/recognition-before-daily-gen6.txt + approved Lexicon v3',
            'correctnessDictionaryUnchanged':True,'geometryRepacked':repacked}
        accept(catalog,solver,exposure,board,ordinal,ids,wordsets,shapes,full=False)
        if d=='mozkokalypsa':mk.validate(board,previous_mk,catalog);previous_mk.append(board)
        counts[d]+=1;state['boards'][index]=board
        receipt['boards'].append({'id':board['id'],'geometryRepacked':repacked,
            'originalHash':digest(original),'newHash':digest(board),
            'originalGeometryHash':board_digest(original),'newGeometryHash':board_digest(board),
            'wordsPreserved':catalog.words(board)==catalog.words(original),
            'previousScore':oldmetric['localAmbiguityScore'],'calibratedScore':metric['localAmbiguityScore']})
        print(json.dumps(receipt['boards'][-1]),flush=True)
    state['contentHash']=digest(state['boards']);state['rebaseReceipt']='rebase-v2/receipt.json'
    receipt['newContentHash']=state['contentHash'];receipt['retainedBoards']=len(state['boards'])
    receipt['geometryRepackedBoards']=[r['id'] for r in receipt['boards'] if r['geometryRepacked']]
    write(OUTPUT/'rebase-v2/receipt.json',receipt);write(target,state)
    bank={'schemaVersion':1,'bankId':'free-expansion-600-20261102','status':'manufactured-awaiting-editorial-review',
        'sourceMain':catalog.source_main,'counts':dict(counts),'runtimeGeneration':catalog.free_generation,
        'generatorGeneration':6,'recognitionHash':solver.hash,'lexiconSha256':catalog.lexicon_hash,
        'inputs':state['inputs'],'extensions':state['extensions'],'boards':state['boards'],'contentHash':state['contentHash']}
    write(OUTPUT/'bank.json',bank)
    if sha(source)!=receipt['originalCheckpointSha256']:raise ValueError('Original evidence changed')
    print(json.dumps({'rebaseComplete':dict(counts),'geometryRepacked':receipt['geometryRepackedBoards']}),flush=True)


if __name__=='__main__':main()
