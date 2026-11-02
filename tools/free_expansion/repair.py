"""Replace editorially rejected unpublished compositions, preserving identity.

The original manufacture checkpoint remains an immutable historical receipt.
Every replacement records the old and new complete board hashes and reason.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
import json
from pathlib import Path
import random
import time

from tools.gen5.catalog import choose_words, digest, norm
from tools.gen5.geometry import build
from tools.gen5.validation import BudgetExceeded, structural
from tools.measure_gen4_ambiguity import board_metrics
from tools.daily_specials.core import transformed_hash
from .catalog import (ExpansionCatalog, ExpansionExposure, OUTPUT, SERIES,
    profile_for, board_digest, SEED, difficulty_prefixes)
from .manufacture import accept, composition_errors, write


class RepairExposure(ExpansionExposure):
    def __init__(self, catalog, boards, forbidden):
        super().__init__(catalog,boards)
        self.explicit_forbidden = set(forbidden)
        for word in list(self.explicit_forbidden):
            self.explicit_forbidden |= catalog.variants.get(word,{word})

    def forbidden(self, difficulty):
        return super().forbidden(difficulty) | self.explicit_forbidden


def replacement(catalog, solver, boards, original, request, seconds):
    d=original['difficulty'];ordinal=original['meta']['manufacture']['profileOrdinal']
    if d=='mozkokalypsa':
        raise ValueError('MK repair requires its original whole-series family/tiling context; use an explicit MK repair adapter')
    profile=profile_for(catalog,d,ordinal)
    previous=catalog.profiles.get(d)
    catalog.profiles[d]=profile
    # Stronger than every local/global cooldown: never introduce a target already
    # present in any other new board, whether earlier or later in the route.
    forbidden={w for b in boards for w in catalog.words(b)}
    forbidden |= {norm(w) for w in request.get('blockedWords',[])}
    others=[b for b in boards if b['id']!=original['id']]
    prefixes=difficulty_prefixes(catalog)
    seed_base=SEED+20000000+ordinal*1000+list(catalog.history).index(d)*100000
    try:
        for run in range(100):
            seed=seed_base+run
            rng=random.Random(seed);deadline=time.monotonic()+seconds;rejects=Counter()
            exposure=RepairExposure(catalog,others,forbidden)
            for attempt in range(1,2401):
                if time.monotonic()>deadline-.5:break
                try:
                    words=choose_words(catalog,exposure,d,rng)
                    if composition_errors(catalog,words):rejects['composition']+=1;continue
                    board=build(words,d,profile,rng,deadline,rejects)
                except BudgetExceeded:break
                if board is None:continue
                metrics=structural(board);ambiguity=board_metrics(board,prefixes,4)
                if d!='mozkokalypsa' and not profile['ambiguity'][0]<=ambiguity['localAmbiguityScore']<=profile['ambiguity'][1]:
                    rejects['ambiguity']+=1;continue
                topics=Counter(catalog.entries[w].get('capacity_topic') for w in catalog.words(board))
                if request.get('maxTopicUses') and max(topics.values())>request['maxTopicUses']:
                    rejects['editorial-topic-cluster']+=1;continue
                proof=solver.verify(board,seconds=min(15,max(.01,deadline-time.monotonic())),node_limit=2000000)
                if proof['status']!='unique' or not proof['targetPathsUnique']:
                    rejects['solver_'+proof['status']]+=1;continue
                mk_meta=board.get('meta',{}).get('manufacture',{})
                board['id']=original['id'];board['meta']=deepcopy(original['meta'])
                board['meta']['editorialStatus']='pending-replacement-composition-review'
                board['meta']['manufacture']={'seed':seed,'attempt':attempt,'profileOrdinal':ordinal,
                    'geometry':metrics,'ambiguity':ambiguity,'verification':proof,
                    'lexiconSha256':catalog.lexicon_hash,**mk_meta}
                board['meta']['editorialRepair']={'reason':request['reason'],
                    'previousBoardHash':board_digest(original),'seed':seed}
                try:
                    accept(catalog,solver,exposure,board,ordinal,
                        set(catalog.historical_ids)|{b['id'] for b in others},
                        set(catalog.historical_words_hashes)|{digest(sorted(catalog.words(b))) for b in others},
                        set(catalog.historical_shapes)|{transformed_hash(b) for b in others})
                except ValueError as error:
                    rejects[str(error)]+=1;continue
                return board,{'seed':seed,'rejections':dict(rejects),
                    'forbiddenOtherBatchTargets':len(forbidden)}
            print(json.dumps({'repairRetry':original['id'],'run':run,'rejections':dict(rejects)}),flush=True)
        raise ValueError('100 bounded editorial repair runs exhausted: '+original['id'])
    finally:
        if previous is None:catalog.profiles.pop(d,None)
        else:catalog.profiles[d]=previous


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--requests',type=Path,required=True)
    parser.add_argument('--seconds',type=int,default=60)
    args=parser.parse_args()
    if not 5<=args.seconds<=180:parser.error('Seconds must be 5..180')
    requests=json.loads(args.requests.read_text(encoding='utf-8'))
    if isinstance(requests,dict):requests=requests['requests']
    path=OUTPUT/'bank.json';bank=json.loads(path.read_text(encoding='utf-8'))
    if bank['contentHash']!=digest(bank['boards']):raise ValueError('Final candidate bank changed without receipt')
    if len(bank['boards'])!=600:raise ValueError('Repairs run after all 600 have completed manufacture')
    catalog=ExpansionCatalog();solver=catalog.solver()
    receipt_path=OUTPUT/'editorial-repairs.json'
    receipt=json.loads(receipt_path.read_text(encoding='utf-8')) if receipt_path.exists() else {
        'schemaVersion':1,'manufacturedContentHash':bank['contentHash'],'repairs':[]}
    for request in requests:
        if any(r['id']==request['id'] and r['reason']==request['reason'] for r in receipt['repairs']):continue
        index=next(i for i,b in enumerate(bank['boards']) if b['id']==request['id'])
        original=deepcopy(bank['boards'][index])
        new,diagnostics=replacement(catalog,solver,bank['boards'],original,request,args.seconds)
        bank['boards'][index]=new;bank['contentHash']=digest(bank['boards'])
        receipt['repairs'].append({'id':new['id'],'reason':request['reason'],
            'originalBoardHash':board_digest(original),'replacementBoardHash':board_digest(new),
            'originalFullHash':digest(original),'replacementFullHash':digest(new),
            'originalWords':sorted(catalog.words(original)),'replacementWords':sorted(catalog.words(new)),
            'originalBoard':original,'replacementBoard':new,**diagnostics})
        receipt['finalContentHash']=bank['contentHash']
        write(receipt_path,receipt);write(path,bank)
        print(json.dumps({'repaired':new['id'],'words':[a['word'] for a in new['answers']]},ensure_ascii=False),flush=True)


if __name__=='__main__':main()
