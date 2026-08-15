#!/usr/bin/env python3
from pathlib import Path
import json, random, time, sys
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

# Freeze current playable order. meta.level becomes authoritative in v3.7.
for diff in ('easy','medium','hard','hardcore'):
    bank=d['free'][diff]
    # Once stable level numbers exist, never reshuffle them by generated difficulty score.
    if bank and all(p.get('meta',{}).get('level') for p in bank):
        ordered=sorted(bank,key=lambda p:int(p.get('meta',{}).get('level',9999)))
    else:
        ordered=sorted(bank,key=lambda p:(p.get('meta',{}).get('difficultyScore',0),p['id']))
        for level,p in enumerate(ordered,1): p.setdefault('meta',{})['level']=level
    d['free'][diff]=ordered

# Preserve current levels 1–9; archive all old later puzzles for queued legacy sync.
d.setdefault('legacyFree',{})
used={(p['rows'],p['cols'],tuple(p['letters'])) for bank in d['free'].values() for p in bank}
used|={(p['rows'],p['cols'],tuple(p['letters'])) for p in d.get('daily',[])}
used|={(p['rows'],p['cols'],tuple(p['letters'])) for p in d.get('rescue',[])}

for diff,prefix in [('hard','h7'),('hardcore','x7')]:
    old=d['free'][diff]
    # Once regeneration has started, keep checkpointed v3.7 levels instead of restarting.
    already_v7 = any(p.get('meta',{}).get('level') == 10 and p.get('meta',{}).get('longWordPolicy') == 'max2x4' for p in old)
    if already_v7:
        continue
    preserve=old[:9]
    archive=d['legacyFree'].setdefault(diff,[])
    archive_ids={p['id'] for p in archive}
    for p in old[9:]:
        if p['id'] not in archive_ids:
            archive.append(p);archive_ids.add(p['id'])
    d['free'][diff]=preserve


def save():
    d['version']=7;d['generatedAt']='2026-08-12';d['dailyRotationSize']=len(d['daily'])
    raw=json.dumps(d,ensure_ascii=False,separators=(',',':'))
    server_out.write_text(raw,encoding='utf-8');public_out.write_text(raw,encoding='utf-8')

save(); started=time.time()
for di,(diff,prefix) in enumerate([('hard','h7'),('hardcore','x7')]):
    bank=d['free'][diff]
    while len(bank)<100:
        level=len(bank)+1
        retry=0
        while True:
            # stable seed stream per level/retry
            seed=(370000001 + di*13000003 + level*99991 + retry*104729) % (2**31-2)+1
            retry+=1
            try:
                p=gp.create_puzzle(diff,seed,answer_pools[diff],dictionary,f'{prefix}-{level:03d}',variant_index=level-1 if diff=='hard' else None,tier_of=tier_of,vocab_key=diff)
            except RuntimeError:
                continue
            if sum(1 for a in p['answers'] if len(a['word'])==4)>2:
                continue
            sig=(p['rows'],p['cols'],tuple(p['letters']))
            if sig in used: continue
            p['meta']['level']=level
            p['meta']['longWordPolicy']='max2x4'
            used.add(sig);bank.append(p);save()
            print(f'{diff} {level}/100 short4={sum(1 for a in p["answers"] if len(a["word"])==4)} ({time.time()-started:.1f}s)',flush=True)
            break
print('DONE', {k:len(v) for k,v in d['free'].items()}, flush=True)
