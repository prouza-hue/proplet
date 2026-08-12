#!/usr/bin/env python3
from pathlib import Path
import json, random, time
import generate_puzzles as gp

root=Path(__file__).resolve().parents[1]
server_out=root/'data/puzzles.json'; public_out=root/'public/puzzles.json'
d=json.loads(server_out.read_text(encoding='utf-8'))

freq=gp.load_frequency_words()
dictionary=[w for w,_ in freq if w not in gp.FUNCTION_WORDS]
curated=[];seen=set()
for raw in gp.CURATED:
    w=gp.clean_word(raw)
    if not w or not 3<=len(w)<=10 or w in gp.FUNCTION_WORDS or w in seen: continue
    seen.add(w);curated.append(w)
for w in curated:
    if w not in dictionary: dictionary.append(w)
dictionary=dictionary[:12000]+[w for w in curated if w not in dictionary[:12000]]
fallback=[w for w,_ in freq[250:6500] if w not in gp.FUNCTION_WORDS and w not in gp.NAME_BLOCK and 4<=len(w)<=9]
answer_pool=curated*12+fallback[:500]

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
                p=gp.create_puzzle(diff,seed,answer_pool,dictionary,f"{prefix[diff]}-{i+1:03d}",variant_index=i if diff=='hard' else None)
            except RuntimeError:
                continue
            sig=(p['rows'],p['cols'],tuple(p['letters']))
            if sig in used: continue
            used.add(sig);bank.append(p);save()
            print(f'{diff} {len(bank)}/100 ({time.time()-started:.1f}s)',flush=True)
            break
print('DONE', {k:len(v) for k,v in d['free'].items()}, flush=True)
