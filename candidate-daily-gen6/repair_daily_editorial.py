"""Narrow content-bound editorial repair, preserving the original manufactured batch."""
from collections import Counter
from copy import deepcopy
from datetime import date
from pathlib import Path
import json,multiprocessing as mp
from tools import daily_gen6 as gen
from tools.gen5.catalog import digest
from tools.gen5.runner import difficulty_prefixes
from tools.gen5.validation import Solver
from tools.free_refresh.catalog import board_digest,sha

OUT=gen.ROOT/'candidate-daily'
REPAIR_DATE='2026-11-23'
BaseExposure=gen.DailyExposure

def main():
    bank=json.loads((OUT/'bank.json').read_text());checkpoint=json.loads((OUT/'manufacture-checkpoint.json').read_text())
    index=next(i for i,b in enumerate(bank['boards']) if b['meta']['dailyDate']==REPAIR_DATE)
    original=bank['boards'][index];c=gen.DailyCatalog()
    if not any(a['word']=='ZLATÁ' for a in original['answers']):raise ValueError('Repair basis/content changed')
    words,raw,recognition=gen.recognition();solver=Solver(words);prefixes=difficulty_prefixes(c);slot=gen.plan()[index]
    other=bank['boards'][:index]+bank['boards'][index+1:];day=date.fromisoformat(REPAIR_DATE)
    nearby=set().union(*(c.words(b) for b in other if abs((date.fromisoformat(b['meta']['dailyDate'])-day).days)<=24))
    rejected=c.words(original)
    class RepairExposure(BaseExposure):
        def __init__(self,cat,accepted=()):
            super().__init__(cat,accepted)
            self.global_new=Counter(w for b in other for w in c.words(b))
        def forbidden(self,d):
            result=super().forbidden(d)|nearby|rejected
            for w in list(result):result|=c.variants.get(w,{w})
            return result
    gen.DailyExposure=RepairExposure
    exposure=RepairExposure(c,bank['boards'][:index]);ids=set(c.historical_ids)|{b['id'] for b in other}
    sets=set(c.historical_words_hashes)|{digest(sorted(c.words(b))) for b in other}
    hashes={r['contentHash'] for r in c.inventory.values()}|{board_digest(b) for b in other}
    diagnostics=[];replacement=None;ctx=mp.get_context('fork')
    for attempt in range(50):
        seed=int(digest([gen.ROOT_SEED,gen.VERSION,REPAIR_DATE,'editorial-repair-1',attempt])[:16],16)
        parent,child=ctx.Pipe(False);proc=ctx.Process(target=gen.manufacture,args=(child,c,solver,prefixes,slot,seed,bank['boards'][:index],45));proc.start();child.close()
        if parent.poll(50):
            try:result=parent.recv()
            except EOFError:result={'board':None,'diagnostics':{'status':'worker-exit'}}
        else:result={'board':None,'diagnostics':{'status':'budget-exhausted'}}
        parent.close();proc.join(1)
        if proc.is_alive():proc.kill();proc.join()
        diagnostics.append({'attempt':attempt,'seed':seed,**result['diagnostics']})
        if result['board']:
            replacement=result['board'];gen.accept(c,solver,prefixes,exposure,replacement,slot,ids,sets,hashes)
            replacement['meta']['editorialRepair']={'rejectedContentHash':board_digest(original),'reason':'Concrete Easy composition contains context-dependent feminine form ZLATÁ; select a clearer composition without changing approved V3.'}
            break
        if result['diagnostics'].get('status')=='error':raise ValueError(result['diagnostics']['detail'])
    if replacement is None:raise ValueError('No accepted repair')
    gen.write(OUT/'manufactured-bank-before-editorial.json',bank)
    gen.write(OUT/'schedule-before-editorial.json',json.loads((OUT/'schedule.json').read_text()))
    bank['boards'][index]=replacement;bank['contentHash']=digest(bank['boards'])
    schedule=json.loads((OUT/'schedule.json').read_text());schedule['bindings'][index]['contentHash']=board_digest(replacement)
    bank['geometryBankHash']=digest([b['contentHash'] for b in schedule['bindings']])
    repair={'schemaVersion':1,'reviewer':'independent_qa AI editorial','dailyDate':REPAIR_DATE,
        'originalBoard':original,'originalContentHash':board_digest(original),'replacementContentHash':board_digest(replacement),
        'replacementBoard':replacement,'repairCodeSha256':sha(Path(__file__)),'diagnostics':diagnostics,
        'originalBankContentHash':checkpoint['contentHash'],'finalBankContentHash':bank['contentHash'],
        'policyChanged':False,'currentBankUnchanged':True,'status':'technical-manufacture-passed-awaiting-independent-reacceptance'}
    gen.write(OUT/'editorial-repairs.json',repair)
    finalstate=deepcopy(checkpoint);finalstate['boards']=bank['boards'];finalstate['contentHash']=bank['contentHash'];finalstate['editorialRepairManifestSha256']=digest(repair)
    gen.write(OUT/'acceptance-checkpoint.json',finalstate);gen.write(OUT/'bank.json',bank);gen.write(OUT/'schedule.json',schedule)
    pack=json.loads((OUT/'server-pack.json').read_text());pack['bindings']=schedule['bindings'];pack['puzzles']={b['id']:b for b in bank['boards']};gen.write(OUT/'server-pack.json',pack)
    print(json.dumps({'dailyDate':REPAIR_DATE,'words':[x['word'] for x in replacement['answers']],'finalBankHash':bank['contentHash']},ensure_ascii=False))

if __name__=='__main__':main()
