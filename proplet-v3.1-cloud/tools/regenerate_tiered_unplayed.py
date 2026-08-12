#!/usr/bin/env python3
"""Plan/apply tiered-vocabulary replacements for globally UNPLAYED Free puzzles.

Safety first: the script refuses to run without a played-ID manifest exported from Supabase.
Played or merely-started puzzle IDs are frozen. Existing compliant puzzles are also kept.
Replaced old puzzles are archived in legacyFree so delayed offline results remain syncable.
"""
from __future__ import annotations
from collections import Counter, defaultdict
from pathlib import Path
import argparse, json, sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import generate_puzzles as gp  # noqa
import audit_vocabulary as av  # noqa

PREFIX={'easy':'e11','medium':'m11','hard':'h11','hardcore':'x11'}


def load_played(path: Path) -> set[str]:
    raw=path.read_text(encoding='utf-8').strip()
    try:
        data=json.loads(raw)
    except json.JSONDecodeError:
        data=[line.strip() for line in raw.splitlines() if line.strip()]
    if isinstance(data,dict):
        for key in ('played_puzzle_ids','playedPuzzleIds','ids'):
            if key in data:
                data=data[key]; break
    if not isinstance(data,list):
        raise SystemExit('Played manifest must be a JSON array (or a text file with one ID per line).')
    ids={str(x).strip() for x in data if str(x).strip()}
    if not ids:
        raise SystemExit('Played manifest is empty; refusing to guess that nothing has been played.')
    return ids


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--played-ids',type=Path,required=True)
    ap.add_argument('--apply',action='store_true',help='Actually rewrite data/public puzzles.json. Default is dry-run.')
    ap.add_argument('--seed',type=int,default=3111001)
    args=ap.parse_args()
    played=load_played(args.played_ids)
    server=ROOT/'data/puzzles.json';public=ROOT/'public/puzzles.json'
    data=json.loads(server.read_text(encoding='utf-8'))
    tiers,tier_of=gp.load_answer_tiers();pools=gp.build_answer_pools(tiers)
    freq=gp.load_frequency_words();all_answers=[w for t in 'ABCD' for w in tiers[t]]
    dictionary=[w for w,_ in freq if w not in gp.FUNCTION_WORDS]
    dictionary=dictionary[:12000]+[w for w in all_answers if w not in dictionary[:12000]]

    # Avoid duplicating any board that has existed in the distribution, not just active ones.
    used=set()
    for bank in data.get('free',{}).values():
        for p in bank: used.add((p['rows'],p['cols'],tuple(p['letters'])))
    for bank in data.get('legacyFree',{}).values():
        for p in bank: used.add((p['rows'],p['cols'],tuple(p['letters'])))
    for p in data.get('daily',[]): used.add((p['rows'],p['cols'],tuple(p['letters'])))
    for p in data.get('rescue',[]): used.add((p['rows'],p['cols'],tuple(p['letters'])))

    plan=[]
    for diff in ('easy','medium','hard','hardcore'):
        bank=sorted(data['free'][diff],key=lambda p:int((p.get('meta') or {}).get('level') or 9999))
        for p in bank:
            audit=av.audit_puzzle('free',diff,p,tier_of)
            if p['id'] in played:
                reason='frozen-played'
            elif audit['status']=='PASS':
                reason='keep-compliant'
            else:
                reason='replace-unplayed'
            plan.append({'difficulty':diff,'level':int((p.get('meta') or {}).get('level') or 0),'puzzleId':p['id'],'action':reason,'violations':audit['violations']})
    counts=Counter(x['action'] for x in plan)
    print('PLAN',json.dumps(counts,ensure_ascii=False),flush=True)
    for diff in ('easy','medium','hard','hardcore'):
        c=Counter(x['action'] for x in plan if x['difficulty']==diff)
        print(diff,dict(c),flush=True)
    if not args.apply:
        print('Dry-run only. Re-run with --apply after reviewing the manifest/plan.')
        return

    by_key={(x['difficulty'],x['level']):x for x in plan}
    data.setdefault('legacyFree',{})
    for di,diff in enumerate(('easy','medium','hard','hardcore')):
        oldbank=sorted(data['free'][diff],key=lambda p:int((p.get('meta') or {}).get('level') or 9999))
        newbank=[];archive=data['legacyFree'].setdefault(diff,[]);archive_ids={p['id'] for p in archive}
        for old in oldbank:
            level=int((old.get('meta') or {}).get('level') or 0)
            if by_key[(diff,level)]['action']!='replace-unplayed':
                newbank.append(old);continue
            if old['id'] not in archive_ids:
                archive.append(old);archive_ids.add(old['id'])
            retry=0
            while True:
                seed=(args.seed+di*1000003+level*7919+retry*104729)%(2**31-2)+1;retry+=1
                try:
                    p=gp.create_puzzle(diff,seed,pools[diff],dictionary,f"{PREFIX[diff]}-{level:03d}",variant_index=level-1 if diff=='hard' else None,tier_of=tier_of,vocab_key=diff)
                except RuntimeError:
                    continue
                sig=(p['rows'],p['cols'],tuple(p['letters']))
                if sig in used:continue
                used.add(sig);p.setdefault('meta',{})['level']=level;p['meta']['tieredVocabulary']=True;p['meta']['contentVersion']='3.11'
                newbank.append(p);break
            if level%10==0: print(diff,level,flush=True)
        data['free'][diff]=newbank

    data['version']=max(int(data.get('version') or 0),8);data['vocabularyVersion']=1
    data['vocabularyTierCounts']={k:len(v) for k,v in tiers.items()};data['generatedAt']='2026-08-12'
    raw=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    server.write_text(raw,encoding='utf-8');public.write_text(raw,encoding='utf-8')
    print('APPLIED. Run tools/audit_vocabulary.py and the solver checks before deployment.')

if __name__=='__main__':main()
