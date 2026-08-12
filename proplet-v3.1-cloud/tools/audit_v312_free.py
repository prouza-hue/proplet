#!/usr/bin/env python3
from __future__ import annotations
from collections import Counter, defaultdict
from pathlib import Path
import json, random, sys, zipfile
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import generate_puzzles as gp
import audit_vocabulary as av

D=json.load(open(ROOT/'data/puzzles.json'))
T,TIER_OF=gp.load_answer_tiers()
words=[x.strip() for x in (ROOT/'data/words.txt').read_text(encoding='utf-8').splitlines() if x.strip()]
cut=D['freeFreezeCutoffs']
problems=[]; checked=0; stats={}

for diff in ('easy','medium','hard','hardcore'):
    st={'new':0,'localOk':0,'globalOk':0,'tierOk':0,'answers':0,'tierCounts':Counter()}
    for p in sorted(D['free'][diff],key=lambda x:x['meta']['level']):
        lvl=p['meta']['level']
        if lvl<=cut[diff]: continue
        st['new']+=1
        ans=[a['word'].lower() for a in p['answers']]; st['answers']+=len(ans)
        st['tierCounts'].update(TIER_OF.get(w,'OOV') for w in ans)
        audit=av.audit_puzzle('free',diff,p,TIER_OF)
        if audit['status']=='PASS': st['tierOk']+=1
        else: problems.append((diff,lvl,'tier',audit['violations']))

        letters=[x.lower() for x in p['letters']]
        tc=gp.enumerate_candidates(letters,p['rows'],p['cols'],p['mask'],{len(w) for w in ans},ans)
        by=defaultdict(list)
        for c in tc:
            if c.word in ans: by[c.word].append(c.path)
        expected={a['word'].lower():tuple(a['path']) for a in p['answers']}
        local_ok=all(len(by[w])==1 and by[w][0]==expected[w] for w in ans)
        if local_ok: st['localOk']+=1
        else: problems.append((diff,lvl,'local',{w:len(by[w]) for w in ans if len(by[w])!=1 or (by[w] and by[w][0]!=expected[w])}))

        seed=int(p['meta']['generatorSeed'])
        spec=gp.spec_for(diff,lvl-1 if diff=='hard' else None,random.Random(seed))
        solver_dict=list(dict.fromkeys(words[:spec['dict_size']]+ans))
        sol,cands,nodes=gp.solve_count(letters,p['rows'],p['cols'],p['mask'],[len(w) for w in ans],solver_dict,limit=2)
        if sol==1: st['globalOk']+=1
        else: problems.append((diff,lvl,'global',{'solutions':sol,'candidates':cands,'nodes':nodes}))
        checked+=1
        if checked%25==0: print('checked',checked,flush=True)
    st['tierCounts']=dict(st['tierCounts']);stats[diff]=st

# Structural/global bank checks
active=[p for b in D['free'].values() for p in b]+D['daily']+D['rescue']
sigs=[(p['rows'],p['cols'],tuple(p['letters'])) for p in active]
ids=[p['id'] for p in active]
struct={
 'activePuzzles':len(active),'uniqueActiveSignatures':len(set(sigs)),'uniqueActiveIds':len(set(ids)),
 'serverPublicEqual':(ROOT/'data/puzzles.json').read_bytes()==(ROOT/'public/puzzles.json').read_bytes(),
}
out={'checkedNewFree':checked,'stats':stats,'structural':struct,'problems':problems}
(ROOT/'FREE_BANK_AUDIT_V3_12.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(out,ensure_ascii=False,indent=2))
if problems or struct['activePuzzles']!=795 or struct['uniqueActiveSignatures']!=795 or struct['uniqueActiveIds']!=795 or not struct['serverPublicEqual']:
    raise SystemExit(2)
