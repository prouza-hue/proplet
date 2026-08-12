#!/usr/bin/env python3
"""Safely rebuild tiered-vocabulary Free banks while freezing any historically exposed prefix.

Input is the production manifest of puzzle IDs that were ever started or completed.  Played IDs
are mapped against the active/legacy banks.  For each difficulty we freeze the *whole prefix* up
to the highest level represented by any played ID.  This is intentionally more conservative than
freezing only exact IDs and protects old local in-progress snapshots created by earlier versions.

Beyond the frozen prefix, already-compliant puzzles may remain.  Non-compliant puzzles are replaced
with v3.12 candidates using the curated A-D answer tiers.  Replacements are archived in legacyFree
so delayed/offline historical result syncs keep resolving.
"""
from __future__ import annotations
from collections import Counter, deque
from pathlib import Path
import argparse, json, sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import generate_puzzles as gp  # noqa
import audit_vocabulary as av  # noqa

PREFIX={'easy':'e12','medium':'m12','hard':'h12','hardcore':'x12'}
DIFFS=('easy','medium','hard','hardcore')


def load_played(path: Path) -> set[str]:
    raw=path.read_text(encoding='utf-8').strip()
    try:
        data=json.loads(raw)
    except json.JSONDecodeError:
        data=[line.strip() for line in raw.splitlines() if line.strip()]

    # Accept direct array, {played_puzzle_ids:[...]}, or Supabase SQL editor shape:
    # [{"played_puzzle_ids":[...]}]
    if isinstance(data,list) and len(data)==1 and isinstance(data[0],dict):
        data=data[0]
    if isinstance(data,dict):
        for key in ('played_puzzle_ids','playedPuzzleIds','ids'):
            if key in data:
                data=data[key]
                break
    if not isinstance(data,list) or any(isinstance(x,(dict,list)) for x in data):
        raise SystemExit('Played manifest must contain a JSON array of puzzle IDs.')
    ids={str(x).strip() for x in data if str(x).strip()}
    if not ids:
        raise SystemExit('Played manifest is empty; refusing to guess that nothing has been played.')
    return ids


def level_of(p: dict) -> int | None:
    try:
        v=(p.get('meta') or {}).get('level')
        return int(v) if v is not None else None
    except (TypeError,ValueError):
        return None


def derive_freeze_cutoffs(data: dict, played: set[str]) -> tuple[dict[str,int],dict[str,list[str]]]:
    """Map played IDs to current/historical levels and freeze through the max per difficulty."""
    cutoffs={d:0 for d in DIFFS}
    unmapped={d:[] for d in DIFFS}
    for diff in DIFFS:
        lookup={}
        for p in data.get('free',{}).get(diff,[]):
            lookup[p['id']]=level_of(p)
        for p in data.get('legacyFree',{}).get(diff,[]):
            lookup.setdefault(p['id'],level_of(p))
        for pid in sorted(played):
            if pid not in lookup:
                continue
            lvl=lookup[pid]
            if lvl is None:
                # Very old pre-sequential banks can have no visible level metadata. They are
                # already legacy/immutable and therefore do not justify freezing a current level.
                unmapped[diff].append(pid)
                continue
            cutoffs[diff]=max(cutoffs[diff],lvl)
    return cutoffs,unmapped


def words_of(p: dict) -> list[str]:
    return [str(a.get('word') or '').lower() for a in (p.get('answers') or [])]


def anti_repeat_pool(base_pool: list[str], usage: Counter[str], recent_words: set[str], *, strict_recent: bool) -> list[str]:
    """Preserve tier weighting while strongly preferring fresh words across a whole bank."""
    base=Counter(base_pool)
    out=[]
    for w,mult in base.items():
        if strict_recent and w in recent_words:
            continue
        # Scale original tier weights, then damp already-used answers. At least one copy remains
        # in the relaxed pass so rare lengths never make generation impossible.
        copies=max(1, round((mult*5)/(1+usage[w]*1.7)))
        out.extend([w]*copies)
    return out


def bank_signature(p: dict):
    return (p['rows'],p['cols'],tuple(p['letters']))


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--played-ids',type=Path,required=True)
    ap.add_argument('--apply',action='store_true',help='Actually rewrite data/public puzzles.json. Default is dry-run.')
    ap.add_argument('--seed',type=int,default=3121201)
    ap.add_argument('--difficulty',choices=DIFFS,help='Optional single-bank apply for resumable generation.')
    args=ap.parse_args()

    played=load_played(args.played_ids)
    server=ROOT/'data/puzzles.json';public=ROOT/'public/puzzles.json'
    data=json.loads(server.read_text(encoding='utf-8'))
    tiers,tier_of=gp.load_answer_tiers();pools=gp.build_answer_pools(tiers)
    freq=gp.load_frequency_words();all_answers=[w for t in 'ABCD' for w in tiers[t]]
    dictionary=[w for w,_ in freq if w not in gp.FUNCTION_WORDS]
    dictionary=dictionary[:12000]+[w for w in all_answers if w not in dictionary[:12000]]

    cutoffs,unmapped=derive_freeze_cutoffs(data,played)
    print('FREEZE_CUTOFFS',json.dumps(cutoffs,ensure_ascii=False),flush=True)
    if any(unmapped.values()):
        print('PLAYED_LEGACY_WITHOUT_LEVEL',json.dumps({k:v for k,v in unmapped.items() if v},ensure_ascii=False),flush=True)

    # Avoid duplicating any board that has ever existed in this distribution.
    used=set()
    for bank in data.get('free',{}).values():
        for p in bank: used.add(bank_signature(p))
    for bank in data.get('legacyFree',{}).values():
        for p in bank: used.add(bank_signature(p))
    for p in data.get('daily',[]): used.add(bank_signature(p))
    for p in data.get('rescue',[]): used.add(bank_signature(p))

    plan=[]
    for diff in DIFFS:
        bank=sorted(data['free'][diff],key=lambda p:level_of(p) or 9999)
        cutoff=cutoffs[diff]
        for p in bank:
            lvl=level_of(p) or 0
            audit=av.audit_puzzle('free',diff,p,tier_of)
            if lvl<=cutoff:
                reason='frozen-prefix'
            elif p['id'] in played:
                # Should be impossible because cutoff is max played level, but keep hard guard.
                reason='frozen-played'
            elif (p.get('meta') or {}).get('contentVersion')=='3.12':
                reason='keep-v312'
            else:
                # Entire safely-unplayed tail is normalized into one v3.12 content system.
                # This also removes rolling word repetitions left by a handful of old puzzles
                # that happened to pass the vocabulary policy in isolation.
                reason='replace-unplayed'
            plan.append({'difficulty':diff,'level':lvl,'puzzleId':p['id'],'action':reason,'violations':audit['violations']})

    counts=Counter(x['action'] for x in plan)
    print('PLAN',json.dumps(counts,ensure_ascii=False),flush=True)
    for diff in DIFFS:
        c=Counter(x['action'] for x in plan if x['difficulty']==diff)
        print(diff,dict(c),flush=True)
    if not args.apply:
        print('Dry-run only. Re-run with --apply after reviewing freeze cutoffs.')
        return

    data.setdefault('legacyFree',{})
    selected=(args.difficulty,) if args.difficulty else DIFFS
    by_key={(x['difficulty'],x['level']):x for x in plan}

    for di,diff in enumerate(DIFFS):
        if diff not in selected:
            continue
        oldbank=sorted(data['free'][diff],key=lambda p:level_of(p) or 9999)
        newbank=[]
        archive=data['legacyFree'].setdefault(diff,[])
        archive_ids={p['id'] for p in archive}
        usage=Counter()
        recent=deque(maxlen=8)

        for old in oldbank:
            lvl=level_of(old) or 0
            action=by_key[(diff,lvl)]['action']
            if action!='replace-unplayed':
                chosen=old
            else:
                if old['id'] not in archive_ids:
                    archive.append(old);archive_ids.add(old['id'])

                chosen=None
                recent_words=set().union(*recent) if recent else set()
                # Strict pass avoids words from previous 8 levels. Relax only if generation has
                # genuinely difficult length/tier constraints.
                for phase in (0,1):
                    pool=anti_repeat_pool(pools[diff],usage,recent_words,strict_recent=(phase==0))
                    for retry in range(36 if phase==0 else 80):
                        seed=(args.seed+di*1000003+lvl*7919+phase*15485863+retry*104729)%(2**31-2)+1
                        try:
                            cand=gp.create_puzzle(
                                diff,seed,pool,dictionary,f"{PREFIX[diff]}-{lvl:03d}",
                                variant_index=lvl-1 if diff=='hard' else None,
                                tier_of=tier_of,vocab_key=diff,
                            )
                        except RuntimeError:
                            continue
                        sig=bank_signature(cand)
                        if sig in used:
                            continue
                        chosen=cand
                        used.add(sig)
                        break
                    if chosen is not None:
                        break
                if chosen is None:
                    raise RuntimeError(f'Could not generate replacement {diff} level {lvl}')
                chosen.setdefault('meta',{})['level']=lvl
                chosen['meta']['tieredVocabulary']=True
                chosen['meta']['contentVersion']='3.12'
                chosen['meta']['replacesPuzzleId']=old['id']

            newbank.append(chosen)
            ws=set(words_of(chosen)); usage.update(ws); recent.append(ws)
            if lvl%10==0 or action=='replace-unplayed' and lvl==cutoffs[diff]+1:
                print(f'{diff} {lvl}/100 · {action} · unique words used {len(usage)}',flush=True)

            # Expensive Mozkožrout generation is resumable: every 10 levels persist the
            # completed prefix and leave the untouched suffix in place. A later invocation
            # sees the already-generated v3.12 levels as compliant and continues forward.
            if lvl%10==0 and lvl<100:
                idx=len(newbank)
                data['free'][diff]=newbank+oldbank[idx:]
                data['version']=max(int(data.get('version') or 0),9)
                data['vocabularyVersion']=2
                data['freeTieredFromVersion']='3.12'
                data['freeFreezeCutoffs']=cutoffs
                data['vocabularyTierCounts']={k:len(v) for k,v in tiers.items()}
                data['generatedAt']='2026-08-12'
                raw=json.dumps(data,ensure_ascii=False,separators=(',',':'))
                server.write_text(raw,encoding='utf-8');public.write_text(raw,encoding='utf-8')
                print(f'CHECKPOINT {diff} through {lvl}',flush=True)

        data['free'][diff]=newbank
        # Final bank checkpoint.
        data['version']=max(int(data.get('version') or 0),9)
        data['vocabularyVersion']=2
        data['freeTieredFromVersion']='3.12'
        data['freeFreezeCutoffs']=cutoffs
        data['vocabularyTierCounts']={k:len(v) for k,v in tiers.items()}
        data['generatedAt']='2026-08-12'
        raw=json.dumps(data,ensure_ascii=False,separators=(',',':'))
        server.write_text(raw,encoding='utf-8');public.write_text(raw,encoding='utf-8')
        print(f'CHECKPOINT {diff}',flush=True)

    print('APPLIED. Run vocabulary + independent solver/bank audits before deployment.',flush=True)

if __name__=='__main__':main()
