"""Resumable multi-process manufacturing, one ordered acceptance ledger, no publishing."""
from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import json
import multiprocessing as mp
import os
from pathlib import Path
import re
import time

from .catalog import Catalog, DIFFICULTIES, ROOT, digest, input_fingerprint, read_json
from .runner import BankValidator, atomic_write, report, safe_directory, validate_bank, worker
from .validation import Solver, validation_words
from .package import package_candidate


@contextmanager
def writer_lock(directory):
    """OS advisory lock releases on crash; never delete or guess a stale PID."""
    directory.mkdir(parents=True,exist_ok=True)
    handle=(directory/'.writer.lock').open('a+b')
    if handle.tell()==0:
        handle.write(b'0');handle.flush()
    handle.seek(0)
    try:
        if os.name=='nt':
            import msvcrt
            msvcrt.locking(handle.fileno(),msvcrt.LK_NBLCK,1)
        else:
            import fcntl
            fcntl.flock(handle,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except OSError:
        handle.close()
        raise ValueError('Another writer owns this run') from None
    try:
        yield
    finally:
        handle.close()


def validate_plan(plan):
    if not re.fullmatch(r'g5-[a-z0-9-]{1,32}',plan.get('seriesId','')):
        raise ValueError('Invalid series ID')
    if set(plan.get('counts',{}))!=set(DIFFICULTIES):
        raise ValueError('Plan must contain every difficulty')
    if any(type(n) is not int or not 0<=n<=100 for n in plan['counts'].values()) or not sum(plan['counts'].values()):
        raise ValueError('Counts must be 0..100 with at least one board')
    if type(plan.get('seed')) is not int:
        raise ValueError('Integer seed required')
    if type(plan.get('secondsPerBoard')) not in (int,float) or not 1<=plan['secondsPerBoard']<=180:
        raise ValueError('Invalid generation budget')
    if type(plan.get('attemptsPerInvocation')) is not int or not 1<=plan['attemptsPerInvocation']<=10:
        raise ValueError('Invalid generation budget')
    if type(plan.get('workers')) is not int or not 1<=plan['workers']<=4:
        raise ValueError('Workers must be 1..4')


def schedule(plan):
    return [(d,i) for i in range(1,max(plan['counts'].values())+1)
            for d in DIFFICULTIES if i<=plan['counts'][d]]


def board_id(plan,d,i):
    return f"{plan['seriesId']}-{d}-{i:03d}"


def verify_checkpoint(state,plan,inputs,catalog,solver,full=True):
    if state.get('kind')!='gen5-series' or state.get('schemaVersion')!=1:
        raise ValueError('Not a Gen5 series checkpoint')
    if state.get('plan')!=plan or state.get('inputs')!=inputs:
        raise ValueError('Frozen plan/input/code changed; use a new run directory')
    boards=state['puzzles']
    if [b['id'] for b in boards]!=[board_id(plan,d,i) for d,i in schedule(plan)[:len(boards)]]:
        raise ValueError('Checkpoint must be a canonical prefix of the plan')
    if state.get('contentHash')!=digest(boards):
        raise ValueError('Checkpoint content hash mismatch')
    if len(boards)>sum(plan['counts'].values()):
        raise ValueError('Too many boards')
    if state.get('status') not in ('incomplete','generated-verified-unpublished'):
        raise ValueError('Invalid checkpoint status')
    if state['status']=='generated-verified-unpublished' and len(boards)!=sum(plan['counts'].values()):
        raise ValueError('Incomplete checkpoint claims completion')
    valid_ids={board_id(plan,d,i) for d,i in schedule(plan)}
    if not isinstance(state.get('attempts'),dict) or any(k not in valid_ids or type(n) is not int or n<0 for k,n in state['attempts'].items()):
        raise ValueError('Invalid attempt counters')
    validate_bank(catalog,boards,solver,full=full,series_id=plan['seriesId'])


def save(path,state):
    state['contentHash']=digest(state['puzzles'])
    atomic_write(path,state)


def run_job(d,i,seed,accepted,seconds,series_id):
    parent,child=mp.Pipe(duplex=False)
    process=mp.Process(target=worker,args=(child,d,i,seed,accepted,seconds,series_id))
    process.start();child.close()
    try:
        if parent.poll(seconds+5):
            try:
                return parent.recv()
            except EOFError:
                return {'board':None,'diagnostics':{'status':'worker_crash'}}
        return {'board':None,'diagnostics':{'status':'worker_timeout'}}
    finally:
        process.join(timeout=1)
        if process.is_alive():
            process.terminate();process.join()
        parent.close()


def manufacture(output,plan,resume=False,validate_only=False,max_rounds=None):
    """A round starts from one frozen exposure snapshot, even after interruption.

    At most one job per difficulty is in flight. Per-difficulty hard limits stay
    exact; global soft exposure weights see the preceding complete rounds.
    Ordered acceptance independently rejects cross-difficulty duplicate sets.
    """
    validate_plan(plan)
    output=safe_directory(output)
    path=output/'series.json'
    existed=output.exists()
    if existed and not (resume or validate_only):
        raise ValueError('Run already exists; use --resume or a new directory')
    if (resume or validate_only) and not path.exists():
        raise ValueError('No series checkpoint to resume')
    with writer_lock(output):
        if path.exists() and not (resume or validate_only):
            raise ValueError('Checkpoint appeared before writer lock; refusing overwrite')
        catalog=Catalog();solver=Solver(validation_words(catalog));inputs=input_fingerprint()
        if resume or validate_only:
            state=read_json(path)
            verify_checkpoint(state,plan,inputs,catalog,solver)
        else:
            state={'schemaVersion':1,'kind':'gen5-series','status':'incomplete','plan':plan,
                   'inputs':inputs,'validationLexicon':{'size':len(solver.words),'sha256':solver.hash},
                   'puzzles':[],'diagnostics':[],'attempts':{}}
            save(path,state)
        if not validate_only:
            validator=BankValidator(catalog,solver,plan['seriesId'])
            for board in state['puzzles']:
                validator.add(board,full=False)
            completed={b['id'] for b in state['puzzles']}
            first_round=next((i for d,i in schedule(plan) if board_id(plan,d,i) not in completed),None)
            rounds=range(first_round,max(plan['counts'].values())+1) if first_round else []
            processed=0;failed=False
            with ThreadPoolExecutor(max_workers=plan['workers']) as executor:
                for ordinal in rounds:
                    if max_rounds is not None and processed>=max_rounds:
                        break
                    if input_fingerprint()!=inputs:
                        raise ValueError('Inputs changed during generation')
                    prefix=[b for b in state['puzzles'] if int(b['id'].rsplit('-',1)[1])<ordinal]
                    pending=[d for d in DIFFICULTIES if ordinal<=plan['counts'][d]
                             and board_id(plan,d,ordinal) not in completed]
                    jobs={}
                    for d in pending:
                        key=board_id(plan,d,ordinal)
                        attempt=state['attempts'].get(key,0)
                        seed=int(digest([plan['seed'],plan['seriesId'],d,ordinal,attempt])[:16],16)
                        jobs[d]=executor.submit(run_job,d,ordinal,seed,prefix,plan['secondsPerBoard'],plan['seriesId'])
                    for d in pending:
                        key=board_id(plan,d,ordinal)
                        accepted=False
                        for retry in range(plan['attemptsPerInvocation']):
                            result=jobs[d].result()
                            state['attempts'][key]=state['attempts'].get(key,0)+1
                            diagnostic={'id':key,'attempt':state['attempts'][key],**result['diagnostics']}
                            board=result['board']
                            if board is not None:
                                try:
                                    if board['id']!=key or board['difficulty']!=d:
                                        raise ValueError('Worker result does not match requested job')
                                    validator.add(board,full=False)
                                except ValueError as exc:
                                    diagnostic['status']='acceptance_rejected';diagnostic['reason']=str(exc)
                                    board=None
                            state['diagnostics'].append(diagnostic)
                            if board is not None:
                                state['puzzles'].append(board);completed.add(key);accepted=True
                                save(path,state)
                                print(f"{len(completed)}/{sum(plan['counts'].values())} {key} accepted",flush=True)
                                break
                            save(path,state)
                            print(key,'retry',diagnostic.get('status','no_candidate'),flush=True)
                            if retry+1<plan['attemptsPerInvocation']:
                                seed=int(digest([plan['seed'],plan['seriesId'],d,ordinal,state['attempts'][key]])[:16],16)
                                jobs[d]=executor.submit(run_job,d,ordinal,seed,prefix,plan['secondsPerBoard'],plan['seriesId'])
                        if not accepted:
                            failed=True
                            break
                    if failed:
                        break  # Preserve a canonical prefix; never skip a failed board.
                    processed+=1
            verify_checkpoint(state,plan,inputs,catalog,solver)
            if input_fingerprint()!=inputs:
                raise ValueError('Inputs changed during generation')
            state['status']='generated-verified-unpublished' if len(state['puzzles'])==sum(plan['counts'].values()) else 'incomplete'
            save(path,state)
        summary=report(catalog,state['puzzles'],state['diagnostics'])
        summary.update(status=state['status'],contentHash=state['contentHash'],
                       difficultyClaims='user-calibrated-profiles',planned=plan['counts'])
        atomic_write(output/'report.json',summary)
        if state['status']=='generated-verified-unpublished':
            atomic_write(output/'candidate.json',package_candidate(state,catalog))
        print(state['status'],len(state['puzzles']),'boards; released inputs unchanged',flush=True)
        return state


def main():
    ap=argparse.ArgumentParser(description='Generate a private Gen5 series; no deployment or released-bank writes.')
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--plan',type=Path,default=ROOT/'content/gen5/series-plan.json')
    ap.add_argument('--resume',action='store_true')
    ap.add_argument('--validate-only',action='store_true')
    ap.add_argument('--max-rounds',type=int,help='Stop cleanly after this many new rounds; resume with the same plan.')
    args=ap.parse_args()
    if args.max_rounds is not None and args.max_rounds<1:
        ap.error('max-rounds must be positive')
    state=manufacture(args.output,read_json(args.plan),args.resume,args.validate_only,args.max_rounds)
    if state['status']=='incomplete' and args.max_rounds is None and not args.validate_only:
        raise SystemExit(2)


if __name__=='__main__':
    main()
