#!/usr/bin/env python3
from pathlib import Path
import json, random, time
import generate_puzzles as gp

root=Path(__file__).resolve().parents[1]
server_out=root/'data/puzzles.json'; public_out=root/'public/puzzles.json'
d=json.loads(server_out.read_text(encoding='utf-8'))

freq=gp.load_frequency_words()
tiers,tier_of=gp.load_answer_tiers()
answer_pools=gp.build_answer_pools(tiers)
all_answers=[w for tier in ('A','B','C','D') for w in tiers[tier]]
dictionary=[w for w,_ in freq if w not in gp.FUNCTION_WORDS]
dictionary=dictionary[:12000]+[w for w in all_answers if w not in dictionary[:12000]]

used={(p['rows'],p['cols'],tuple(p['letters'])) for bank in d['free'].values() for p in bank}
used|={(p['rows'],p['cols'],tuple(p['letters'])) for p in d['daily']}
used|={(p['rows'],p['cols'],tuple(p['letters'])) for p in d.get('rescue',[])}
prefix={'easy':'e','medium':'m','hard':'h3','hardcore':'x'}

def save():
    d['version']=5;d['generatedAt']='2026-08-12';d['dailyRotationSize']=len(d['daily'])
    raw=json.dumps(d,ensure_ascii=False,separators=(',',':'))
    server_out.write_text(raw,encoding='utf-8');public_out.write_text(raw,encoding='utf-8')

started=time.time()
for di,diff in enumerate(('easy','medium','hard','hardcore')):
    bank=d['free'][diff]
    while len(bank)<100:
        i=len(bank)
        # stable-ish distinct seed stream by difficulty/index/retry
        retry=0
        while True:
            seed=(2026081200 + di*1000003 + (i+1)*7919 + retry*104729) % (2**31-2) + 1
            retry+=1
            try:
                p=gp.create_puzzle(diff,seed,answer_pools[diff],dictionary,f"{prefix[diff]}-{i+1:03d}",variant_index=i if diff=='hard' else None,tier_of=tier_of,vocab_key=diff)
            except RuntimeError:
                continue
            sig=(p['rows'],p['cols'],tuple(p['letters']))
            if sig in used: continue
            used.add(sig);bank.append(p);save()
            print(f'{diff} {len(bank)}/100 ({time.time()-started:.1f}s)',flush=True)
            break
print('DONE', {k:len(v) for k,v in d['free'].items()}, flush=True)
