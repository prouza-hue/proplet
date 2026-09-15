"""Single-ledger, checkpointed pilot runner with isolated bounded workers."""
from __future__ import annotations

from collections import Counter
import argparse
import json
import multiprocessing as mp
from pathlib import Path
import random
import time
import traceback

from .catalog import Catalog, DIFFICULTIES, Exposure, ROOT, choose_words, digest, input_fingerprint, read_json, tier_mix_ok, profile_for
from .validation import Solver, BudgetExceeded, structural, geometry_errors, validation_words

try:
    from tools import measure_gen4_ambiguity as ambiguity
except ModuleNotFoundError:
    import measure_gen4_ambiguity as ambiguity


def difficulty_prefixes(catalog):
    words={w.strip().casefold() for w in (ROOT/'data/words.txt').read_text(encoding='utf-8').splitlines()}
    return Solver(words | set(catalog.entries)).prefixes


def worker(connection, difficulty, ordinal, seed, accepted, seconds, series_id=None):
    """A hard parent timeout covers the legacy constructor, imports and solver."""
    started = time.monotonic()
    deadline = started + seconds
    rejections = Counter()
    try:
        from .geometry import build
        catalog = Catalog()
        exposure = Exposure(catalog, accepted)
        solver = Solver(validation_words(catalog))
        # Preserve the old prefix lexicon solely for baseline-comparable difficulty.
        # Correctness is checked against the larger, frozen recognition union.
        prefixes = difficulty_prefixes(catalog)
        rng = random.Random(seed)
        profile = profile_for(catalog,difficulty,ordinal)
        catalog.profiles[difficulty]=profile
        shortlist = []
        for attempt in range(1, 1001):
            if time.monotonic()>deadline-1:
                break
            words = choose_words(catalog,exposure,difficulty,rng)
            try:
                board = build(words,difficulty,profile,rng,deadline,rejections)
            except BudgetExceeded:
                rejections['geometry_budget'] += 1
                break
            if board is None:
                rejections['geometry'] += 1
                continue
            board['id']=f'g5-pilot-{difficulty}-{ordinal:03d}'
            board['meta']={'level':len(catalog.history[difficulty])+ordinal,'contentGeneration':5,
                           'calibrationOnly':True,'generationKey':'gen5-lab-v1','geometryProfile':profile['geometry_profile']}
            if series_id:
                board['id']=f'{series_id}-{difficulty}-{ordinal:03d}'
                board['meta'].update(generationKey=series_id,releaseCandidate=True)
            metrics = structural(board)
            amb = ambiguity.board_metrics(board,prefixes,4)
            if not profile['ambiguity'][0] <= amb['localAmbiguityScore'] <= profile['ambiguity'][1]:
                rejections['ambiguity_band'] += 1
                continue
            verification = solver.verify(board,seconds=min(8,max(.01,deadline-time.monotonic())))
            if verification['status']!='unique' or not verification['targetPathsUnique']:
                rejections['solver_'+verification['status'] if verification['targetPathsUnique'] else 'target_path_or_budget'] += 1
                continue
            board['meta']['gen5']={'seed':seed,'attempt':attempt,'geometry':metrics,'ambiguity':amb,
                                  'verification':verification,
                                  'lexicalReviewRequired':[w for w in sorted(words) if catalog.entries[w].get('origin')=='wikidata_frequency_candidate']}
            # Mozkomor uses best of 3 accepted layouts. Rank by normalized local choices,
            # not target length/rare vocabulary. Human playtest remains mandatory.
            shortlist.append(board)
            if difficulty!='mozkomor' or len(shortlist)>=3:
                break
        if shortlist:
            best=max(shortlist,key=lambda b:b['meta']['gen5']['ambiguity']['localAmbiguityScore'])
            connection.send({'board':best,'diagnostics':{'rejections':dict(rejections),'shortlist':len(shortlist),
                                                        'seconds':round(time.monotonic()-started,3)}})
        else:
            connection.send({'board':None,'diagnostics':{'rejections':dict(rejections),'seconds':round(time.monotonic()-started,3),
                                                         'status':'no_candidate_within_budget'}})
    except BudgetExceeded:
        connection.send({'board':None,'diagnostics':{'status':'unknown_budget','rejections':dict(rejections)}})
    except Exception:
        connection.send({'board':None,'diagnostics':{'status':'error','detail':traceback.format_exc()}})
    finally:
        connection.close()


def safe_directory(path):
    root = (ROOT/'lab-output/gen5').resolve()
    path = path.resolve()
    if path == root or root not in path.parents:
        raise ValueError('Output must be a named run directory under lab-output/gen5/')
    return path


def atomic_write(path, payload):
    temporary=path.with_suffix(path.suffix+'.tmp')
    temporary.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    temporary.replace(path)


class BankValidator:
    """Incremental acceptance with no ledger mutation on a rejected candidate."""
    def __init__(self,catalog,solver,series_id=None):
        self.catalog=catalog;self.solver=solver;self.prefix=series_id or 'g5-pilot'
        self.exposure=Exposure(catalog)
        self.ids=set(catalog.historical_ids)
        self.wordsets=set(catalog.historical_words_hashes)
        self.ordinals=Counter()
        self.prefixes=None
        self.eligible={d:set(catalog.eligible(d)) for d in DIFFICULTIES}

    def add(self,board,full=True):
        catalog=self.catalog;d=board['difficulty'];ordinal=self.ordinals[d]+1
        if board['id'] in self.ids or board['id']!=f'{self.prefix}-{d}-{ordinal:03d}' or board['meta']['level']!=len(catalog.history[d])+ordinal:
            raise ValueError('Pilot order or level gap: '+board['id'])
        p=profile_for(catalog,d,ordinal)
        errors=geometry_errors(structural(board),p)
        if errors:
            raise ValueError(board['id']+': '+','.join(errors))
        words=catalog.words(board)
        if not words<=self.eligible[d] or words & self.exposure.forbidden(d):
            raise ValueError('Vocabulary, cooldown or repetition cap: '+board['id'])
        if not tier_mix_ok(list(words),catalog.entries,p['policy']):
            raise ValueError('Tier mix: '+board['id'])
        signature=digest(sorted(words))
        if signature in self.wordsets:
            raise ValueError('Repeated word set: '+board['id'])
        if full:
            if self.prefixes is None:
                self.prefixes=difficulty_prefixes(catalog)
            score=ambiguity.board_metrics(board,self.prefixes,4)['localAmbiguityScore']
            if not p['ambiguity'][0]<=score<=p['ambiguity'][1]:
                raise ValueError('Independent ambiguity rejection: '+board['id'])
            verified=self.solver.verify(board)
            if verified['status']!='unique' or not verified['targetPathsUnique']:
                raise ValueError('Independent solver rejection: '+board['id']+' '+verified['status'])
        self.ids.add(board['id']);self.wordsets.add(signature);self.ordinals[d]=ordinal
        self.exposure.add(board)


def validate_bank(catalog,boards,solver,full=True,series_id=None):
    validator=BankValidator(catalog,solver,series_id)
    for board in boards:
        validator.add(board,full)
    return validator.exposure


def report(catalog, boards, diagnostics):
    from statistics import median
    prefixes=difficulty_prefixes(catalog)
    def stats(bs):
        counts=Counter(w for b in bs for w in sorted(catalog.words(b)))
        fours=Counter({w:n for w,n in counts.items() if len(w)==4})
        quartet={'bobr','drak','upír','štít'}
        return {'boards':len(bs),'occurrences':sum(counts.values()),'uniqueWords':len(counts),
                'fourLetterShare':round(sum(fours.values())/max(1,sum(counts.values())),4),
                'maxWordUses':max(counts.values(),default=0),'topWords':counts.most_common(10),
                'quartetBoards':sum(bool(catalog.words(b)&quartet) for b in bs),
                'wordsNeverUsedInSameDifficulty':sum(catalog.counts[bs[0]['difficulty']][w]==0 for w in counts) if bs else 0}
    out={'status':'experimental-not-for-release','difficultyClaims':'hypotheses-pending-human-playtest',
         'profiles':{},'diagnostics':diagnostics}
    for d in DIFFICULTIES:
        selected=[b for b in boards if b['difficulty']==d]
        out['profiles'][d]={'baseline':stats(catalog.base[d]),'pilot':stats(selected)}
        baseline_metrics=[structural(b) for b in catalog.base[d]]
        baseline_ambiguity=[ambiguity.board_metrics(b,prefixes,4)['localAmbiguityScore'] for b in catalog.base[d]]
        out['profiles'][d]['baseline']['medianTurns']=median(m['meanTurns'] for m in baseline_metrics)
        out['profiles'][d]['baseline']['medianAmbiguity']=median(baseline_ambiguity)
        if selected:
            out['profiles'][d]['pilot']['medianTurns']=median(b['meta']['gen5']['geometry']['meanTurns'] for b in selected)
            out['profiles'][d]['pilot']['medianAmbiguity']=median(b['meta']['gen5']['ambiguity']['localAmbiguityScore'] for b in selected)
    return out


def main():
    ap=argparse.ArgumentParser(description='Offline-only Gen5 pilot; never publishes or edits released banks.')
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--count',type=int,default=2,help='Per selected difficulty; at most 10 in this pilot tool.')
    ap.add_argument('--difficulties',nargs='+',choices=DIFFICULTIES,default=list(DIFFICULTIES))
    ap.add_argument('--seed',type=int,default=20260915)
    ap.add_argument('--seconds-per-board',type=float,default=45)
    ap.add_argument('--resume',action='store_true')
    ap.add_argument('--validate-only',action='store_true')
    args=ap.parse_args()
    if not 1<=args.count<=10 or not 1<=args.seconds_per_board<=180:
        ap.error('Pilot count 1..10, per-board budget 1..180 seconds.')
    if len(set(args.difficulties))!=len(args.difficulties):
        ap.error('Duplicate difficulty')
    output=safe_directory(args.output)
    catalog=Catalog()
    solver=Solver(validation_words(catalog))
    inputs=input_fingerprint()
    path=output/'pilot.json'
    settings={'seed':args.seed,'count':args.count,'difficulties':args.difficulties,'secondsPerBoard':args.seconds_per_board}
    if args.resume or args.validate_only:
        state=read_json(path)
        if state['inputs']!=inputs:
            raise ValueError('Input/code fingerprint changed; start a new named run.')
        if not args.validate_only and state['settings']!=settings:
            raise ValueError('Resume settings differ; use the exact original settings.')
        validate_bank(catalog,state['puzzles'],solver)
    else:
        if output.exists():
            raise ValueError('Run directory already exists; use --resume or a new name.')
        output.mkdir(parents=True)
        state={'kind':'gen5-pilot','status':'incomplete','contentGeneration':5,'settings':settings,
               'inputs':inputs,'validationLexicon':{'size':len(solver.words),'sha256':solver.hash},
               'puzzles':[],'diagnostics':[]}
        atomic_write(path,state)
    if not args.validate_only:
        # Round-robin interleaving shares exposure across difficulties without letting
        # the first difficulty reserve all desirable words. One writer owns acceptance.
        blocked=set()
        for ordinal in range(1,args.count+1):
            for d in args.difficulties:
                if d in blocked:
                    continue
                board_id=f'g5-pilot-{d}-{ordinal:03d}'
                if any(b['id']==board_id for b in state['puzzles']):
                    continue
                seed=int(digest([args.seed,d,ordinal])[:16],16)
                parent,child=mp.Pipe(duplex=False)
                process=mp.Process(target=worker,args=(child,d,ordinal,seed,state['puzzles'],args.seconds_per_board))
                process.start();child.close()
                try:
                    if parent.poll(args.seconds_per_board+5):
                        try:
                            result=parent.recv()
                        except EOFError:
                            result={'board':None,'diagnostics':{'status':'worker_crash'}}
                    else:
                        result={'board':None,'diagnostics':{'status':'worker_timeout'}}
                finally:
                    process.join(timeout=1)
                    if process.is_alive():
                        process.terminate();process.join()
                    parent.close()
                state['diagnostics'].append({'id':board_id,**result['diagnostics']})
                if result['board'] is not None:
                    validate_bank(catalog,state['puzzles']+[result['board']],solver,full=False)
                    state['puzzles'].append(result['board'])
                    print(board_id+' accepted '+json.dumps(result['diagnostics']),flush=True)
                else:
                    blocked.add(d)  # Resume must fill this gap before later levels.
                    print(board_id+' NOT ACCEPTED '+json.dumps(result['diagnostics']),flush=True)
                atomic_write(path,state)
        validate_bank(catalog,state['puzzles'],solver)
        state['status']='pilot-complete' if len(state['puzzles'])==args.count*len(args.difficulties) else 'incomplete'
        atomic_write(path,state)
    if input_fingerprint()!=inputs:
        raise ValueError('Frozen inputs changed during run')
    atomic_write(output/'report.json',report(catalog,state['puzzles'],state['diagnostics']))
    print('Verified:',len(state['puzzles']),'boards;',state['status'],'; frozen inputs unchanged',flush=True)


if __name__=='__main__':
    main()
