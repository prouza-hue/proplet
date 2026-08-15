#!/usr/bin/env python3
from __future__ import annotations
from collections import Counter, deque
from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import generate_puzzles as gp

PREFIX={'easy':'e12','medium':'m12','hard':'h12','hardcore':'x12'}

def sig(p): return (p['rows'],p['cols'],tuple(p['letters']))
def words(p): return {a['word'].lower() for a in p['answers']}

def weighted_without(base_pool, usage, blocked):
    bc=Counter(base_pool); out=[]
    for w,m in bc.items():
        if w in blocked: continue
        copies=max(1,round((m*7)/(1+usage[w]*1.8)))
        out += [w]*copies
    return out

D=json.load(open(ROOT/'data/puzzles.json'))
tiers,tier_of=gp.load_answer_tiers(); pools=gp.build_answer_pools(tiers)
freq=gp.load_frequency_words(); all_answers=[w for t in 'ABCD' for w in tiers[t]]
dictionary=[w for w,_ in freq if w not in gp.FUNCTION_WORDS]
dictionary=dictionary[:12000]+[w for w in all_answers if w not in dictionary[:12000]]
used={sig(p) for b in D['free'].values() for p in b}
used|={sig(p) for b in D.get('legacyFree',{}).values() for p in b}
used|={sig(p) for p in D['daily']}; used|={sig(p) for p in D['rescue']}

for di,diff in enumerate(('easy','medium')):
    cutoff=D['freeFreezeCutoffs'][diff]
    bank=sorted(D['free'][diff],key=lambda p:p['meta']['level'])
    usage=Counter(); recent=deque(maxlen=8); repaired=0
    for i,p in enumerate(bank):
        lvl=p['meta']['level']; ws=words(p); blocked=set().union(*recent) if recent else set()
        overlap=ws & blocked if lvl>cutoff else set()
        if overlap:
            pool=weighted_without(pools[diff],usage,blocked)
            replacement=None
            for retry in range(320):
                seed=(3129901+di*1000003+lvl*7919+retry*104729)%(2**31-2)+1
                try:
                    cand=gp.create_puzzle(diff,seed,pool,dictionary,f'{PREFIX[diff]}-{lvl:03d}',tier_of=tier_of,vocab_key=diff)
                except RuntimeError:
                    continue
                if words(cand)&blocked: continue
                if sig(cand) in used: continue
                replacement=cand;break
            if replacement is None:
                raise RuntimeError(f'No strict anti-repeat replacement for {diff} {lvl}; overlap={sorted(overlap)}')
            replacement['meta']['level']=lvl
            replacement['meta']['tieredVocabulary']=True
            replacement['meta']['contentVersion']='3.12'
            replacement['meta']['replacesPuzzleId']=p.get('meta',{}).get('replacesPuzzleId',p['id'])
            replacement['meta']['strictBankAntiRepeat']=True
            bank[i]=p=replacement;ws=words(p);used.add(sig(p));repaired+=1
            print(diff,lvl,'repaired',sorted(overlap),'->',sorted(ws),flush=True)
        usage.update(ws);recent.append(ws)
    D['free'][diff]=bank
    print(diff,'repaired total',repaired,flush=True)

raw=json.dumps(D,ensure_ascii=False,separators=(',',':'))
(ROOT/'data/puzzles.json').write_text(raw,encoding='utf-8')
(ROOT/'public/puzzles.json').write_text(raw,encoding='utf-8')
