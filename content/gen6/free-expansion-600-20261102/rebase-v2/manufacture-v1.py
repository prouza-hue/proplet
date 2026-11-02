"""Bounded worker jobs, ordered acceptance and immutable resume fingerprints."""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from copy import deepcopy
import json
import random
import time
import traceback

from tools.gen5.catalog import ROOT, choose_words, digest, tier_mix_ok
from tools.gen5.geometry import build
from tools.gen5.validation import Solver, structural, geometry_errors, BudgetExceeded
from tools.gen5.runner import difficulty_prefixes
from tools.measure_gen4_ambiguity import board_metrics
from tools.daily_specials.core import transformed_hash
from .catalog import (ExpansionCatalog, ExpansionExposure, DIFFICULTIES, SERIES,
    BATCH, OUTPUT, SEED, GLOBAL_NEW_CAP, profile_for, sha, board_digest, LEXICON_PATH)

_catalog = None
_solver = None
_prefixes = None


def write(path, payload):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    temp.replace(path)


def initialize():
    global _catalog, _solver, _prefixes
    _catalog = ExpansionCatalog()
    _solver = _catalog.solver()
    _prefixes = difficulty_prefixes(_catalog)


def composition_errors(catalog, words):
    errors=[]
    topics={catalog.entries[w].get('capacity_topic') for w in words}
    families=[catalog.entries[w].get('family') or w for w in words]
    if len(topics)<min(3,len(words)): errors.append('topic-diversity')
    if len(set(families))!=len(words): errors.append('family-duplicates')
    if any((set(words)-{w}) & catalog.variants.get(w,{w}) for w in words): errors.append('variant-duplicates')
    return errors


def generate(difficulty, ordinal, seed, accepted, seconds):
    catalog = _catalog
    exposure = ExpansionExposure(catalog,accepted)
    profile = profile_for(catalog,difficulty,ordinal)
    previous = catalog.profiles.get(difficulty)
    catalog.profiles[difficulty] = profile
    rng = random.Random(seed)
    started = time.monotonic(); deadline = started+seconds; rejects=Counter()
    try:
        for attempt in range(1,1601):
            if time.monotonic()>deadline-.5: break
            try:
                if difficulty == 'mozkokalypsa':
                    from . import mk
                    board = mk.generate(catalog,exposure,_solver,rng,ordinal,deadline)
                else:
                    words = choose_words(catalog,exposure,difficulty,rng)
                    if composition_errors(catalog,words): rejects['composition']+=1; continue
                    board = build(words,difficulty,profile,rng,deadline,rejects)
            except BudgetExceeded:
                rejects['geometry_budget']+=1; break
            if board is None: rejects['geometry']+=1; continue
            metrics=structural(board)
            errors=geometry_errors(metrics,profile)
            if errors: rejects.update(errors); continue
            ambiguity=board_metrics(board,_prefixes,4)
            if difficulty != 'mozkokalypsa' and not profile['ambiguity'][0]<=ambiguity['localAmbiguityScore']<=profile['ambiguity'][1]:
                rejects['ambiguity']+=1; continue
            if transformed_hash(board) in catalog.historical_shapes:
                rejects['historical-transformed-board']+=1; continue
            proof=_solver.verify(board,seconds=min(15,max(.01,deadline-time.monotonic())),node_limit=2000000)
            if proof['status']!='unique' or not proof['targetPathsUnique']:
                rejects['solver_'+proof['status'] if proof['targetPathsUnique'] else 'target_paths']+=1; continue
            board['id']=f'{SERIES}-{difficulty}-{ordinal:03d}'
            preserved = board.get('meta',{}).get('manufacture',{})
            board['meta']={'level':catalog.last_level[difficulty]+ordinal,
                'contentGeneration':catalog.free_generation,'generatorGeneration':6,
                'generationKey':BATCH,'releaseBatch':BATCH,'lexiconVersion':3,
                'geometryProfile':profile['geometry_profile'],'releaseCandidate':True,
                'editorialStatus':'pending-board-composition-review',
                'manufacture':{'seed':seed,'attempt':attempt,'profileOrdinal':ordinal,
                    'geometry':metrics,'ambiguity':ambiguity,'verification':proof,
                    'lexiconSha256':catalog.lexicon_hash,**preserved}}
            return {'board':board,'diagnostics':{'seconds':round(time.monotonic()-started,3),'rejections':dict(rejects)}}
        return {'board':None,'diagnostics':{'seconds':round(time.monotonic()-started,3),'rejections':dict(rejects),'status':'no_candidate_within_budget'}}
    except Exception:
        return {'board':None,'diagnostics':{'status':'error','detail':traceback.format_exc()}}
    finally:
        if previous is None: catalog.profiles.pop(difficulty,None)
        else: catalog.profiles[difficulty]=previous


def accept(catalog, solver, exposure, board, ordinal, ids, wordsets, shapes, full=True):
    d=board['difficulty']; p=profile_for(catalog,d,ordinal)
    if board['id']!=f'{SERIES}-{d}-{ordinal:03d}' or board['id'] in ids: raise ValueError('ID/order')
    if board['meta']['level']!=catalog.last_level[d]+ordinal or board['meta']['contentGeneration']!=catalog.free_generation: raise ValueError('Runtime generation/level')
    errors=geometry_errors(structural(board),p)
    words=catalog.words(board)
    errors += composition_errors(catalog,words)
    if not words<=set(catalog.eligible(d)) or words & exposure.forbidden(d): errors.append('vocabulary/cooldown/cap')
    if not tier_mix_ok(list(words),catalog.entries,p['policy']): errors.append('tier-mix')
    if board_digest(board) in catalog.historical_board_hashes: errors.append('historical-content')
    if digest(sorted(words)) in wordsets: errors.append('wordset-repeat')
    shape=transformed_hash(board)
    if shape in shapes: errors.append('symmetry-content-repeat')
    if errors: raise ValueError(','.join(errors))
    if full:
        score=board_metrics(board,difficulty_prefixes(catalog),4)['localAmbiguityScore']
        if d != 'mozkokalypsa' and not p['ambiguity'][0]<=score<=p['ambiguity'][1]: raise ValueError('Independent ambiguity band')
        proof=solver.verify(board,seconds=15,node_limit=2000000)
        if proof['status']!='unique' or not proof['targetPathsUnique']: raise ValueError('Independent proof: '+proof['status'])
        board['meta']['manufacture']['independentVerification']=proof
    ids.add(board['id']); wordsets.add(digest(sorted(words))); shapes.add(shape); exposure.add(board)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--count',type=int,default=100)
    parser.add_argument('--seconds',type=int,default=45)
    parser.add_argument('--workers',type=int,default=5)
    parser.add_argument('--difficulties',nargs='+',choices=DIFFICULTIES,default=list(DIFFICULTIES))
    args=parser.parse_args()
    if not 1<=args.count<=100 or not 1<=args.workers<=6 or not 5<=args.seconds<=180: parser.error('Bounded count/workers/seconds required')
    catalog=ExpansionCatalog(); solver=catalog.solver(); exposure=ExpansionExposure(catalog)
    code=[ROOT/'tools/free_expansion/catalog.py',ROOT/'tools/free_expansion/manufacture.py']
    code += list((ROOT/'tools/gen5').glob('*.py'))+[ROOT/'tools/measure_gen4_ambiguity.py']
    inputs={'sourceMain':catalog.source_main,'lexicon':catalog.lexicon_hash,'lexiconPhysical':sha(LEXICON_PATH),
        'recognitionHash':solver.hash,'recognitionWords':len(solver.words),
        'profiles':sha(ROOT/'content/gen5/profiles.json'),'history':digest(catalog.history_sources),
        'code':{str(p.relative_to(ROOT)).replace('\\','/'):sha(p) for p in sorted(code)}}
    checkpoint=OUTPUT/'manufacture-checkpoint.json'
    state=json.loads(checkpoint.read_text(encoding='utf-8')) if checkpoint.exists() else {
        'seed':SEED,'inputs':inputs,'boards':[],'contentHash':digest([]),'diagnostics':[],'attempts':{},'extensions':{}}
    if state['seed']!=SEED or state['inputs']!=inputs or state['contentHash']!=digest(state['boards']): raise ValueError('Checkpoint inputs/content drifted')
    if 'mozkokalypsa' in args.difficulties:
        from . import mk
        mk_input=mk.fingerprint() if hasattr(mk,'fingerprint') else {'code':sha(ROOT/'tools/free_expansion/mk.py')}
        previous=state['extensions'].get('mozkokalypsa')
        if previous is not None and previous!=mk_input: raise ValueError('MK adapter changed after manufacture began')
        state['extensions']['mozkokalypsa']=mk_input
    ids=set(catalog.historical_ids);wordsets=set(catalog.historical_words_hashes);shapes=set(catalog.historical_shapes);counts=Counter()
    for b in state['boards']:
        accept(catalog,solver,exposure,b,counts[b['difficulty']]+1,ids,wordsets,shapes,full=False)
        counts[b['difficulty']]+=1
    OUTPUT.mkdir(parents=True,exist_ok=True)
    (OUTPUT/'recognition-words.txt').write_text('\n'.join(solver.words)+'\n',encoding='utf-8')
    write(OUTPUT/'recognition-manifest.json',{'dictionaryHash':solver.hash,'dictionarySize':len(solver.words),
        'sourceMain':catalog.source_main,'overlayPolicy':'Current explicit runtime overlay + current static recognition + all approved v3 entries',
        'sha256':sha(OUTPUT/'recognition-words.txt')})
    write(OUTPUT/'history-manifest.json',{'sources':catalog.history_sources,'boards':len(catalog.inventory),'personalExposure':'unknown-not-inferred'})
    print(json.dumps({'stage':'start','capacity':catalog.capacity(args.difficulties),'historyBoards':len(catalog.inventory),
        'recognitionWords':len(solver.words),'resumed':dict(counts),'globalNewCap':GLOBAL_NEW_CAP}),flush=True)
    with ProcessPoolExecutor(max_workers=args.workers,initializer=initialize) as pool:
        while any(counts[d]<args.count for d in args.difficulties):
            snapshot=deepcopy(state['boards']);jobs=[]
            for d in args.difficulties:
                if counts[d]>=args.count: continue
                ordinal=counts[d]+1;key=f'{d}-{ordinal:03d}';attempt=state['attempts'].get(key,0)
                if attempt>=100: raise ValueError('100 bounded attempts exhausted: '+key)
                seed=SEED+DIFFICULTIES.index(d)*100000+ordinal*100+attempt
                state['attempts'][key]=attempt+1
                jobs.append((d,ordinal,key,pool.submit(generate,d,ordinal,seed,snapshot,args.seconds)))
            for d,ordinal,key,future in jobs:
                result=future.result(timeout=args.seconds+60)
                state['diagnostics'].append({'slot':key,'attempt':state['attempts'][key],**result['diagnostics']})
                b=result['board']
                if b:
                    try:
                        accept(catalog,solver,exposure,b,ordinal,ids,wordsets,shapes)
                        state['boards'].append(b);counts[d]+=1
                        print(json.dumps({'accepted':b['id'],'counts':dict(counts),'seconds':result['diagnostics'].get('seconds'),
                            'words':[a['word'] for a in b['answers']]},ensure_ascii=False),flush=True)
                    except ValueError as err:
                        state['diagnostics'][-1]['centralRejection']=str(err)
                        print(json.dumps({'retry':key,'reason':str(err)}),flush=True)
                elif result['diagnostics'].get('status')=='error':
                    write(checkpoint,state); raise ValueError(result['diagnostics']['detail'])
                else: print(json.dumps({'retry':key,'diagnostics':result['diagnostics']}),flush=True)
                state['contentHash']=digest(state['boards']);write(checkpoint,state)
            bank={'schemaVersion':1,'bankId':BATCH,'status':'manufactured-awaiting-editorial-review',
                'sourceMain':catalog.source_main,'counts':dict(counts),'runtimeGeneration':catalog.free_generation,
                'generatorGeneration':6,'recognitionHash':solver.hash,'lexiconSha256':catalog.lexicon_hash,
                'inputs':inputs,'extensions':state['extensions'],'boards':state['boards'],'contentHash':digest(state['boards'])}
            write(OUTPUT/'bank.json',bank)
    print(json.dumps({'stage':'manufactured','counts':dict(counts),'contentHash':digest(state['boards'])}),flush=True)


if __name__=='__main__': main()
