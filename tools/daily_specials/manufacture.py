"""Bounded seeded manufacture; resumes only after revalidating the ledger."""
import argparse
from collections import Counter
import json
from pathlib import Path
import random
import subprocess
import time
from .core import *
from tools.gen5.geometry import build
from tools.gen5.validation import BudgetExceeded

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--seconds',type=int,default=600)
    args=parser.parse_args();cat=Catalog();solver=cat.solver();rng=random.Random(6112026)
    path=OUT/'bank.json';previous=read(path)['boards'] if path.exists() else []
    for b in previous: cat.add(b)
    boards=list(previous);diag=Counter(); deadline=time.monotonic()+args.seconds
    helper=ROOT/'tools/daily_specials/full_geometry';geometry=OUT/'geometry-pool.jsonl'
    if not geometry.exists():
        subprocess.run(['g++','-O3','-std=c++17',str(ROOT/'tools/daily_specials/full_geometry.cpp'),'-o',str(helper)],check=True)
        with geometry.open('w') as f:
            subprocess.run([str(helper),'6112026','4000000','200'],stdout=f,check=True,timeout=100)
    strong=OUT/'geometry-strong.jsonl'
    if not strong.exists():
        executable=ROOT/'tools/daily_specials/full_geometry_strong'
        subprocess.run(['g++','-O3','-std=c++17',str(ROOT/'tools/daily_specials/full_geometry_strong.cpp'),'-o',str(executable)],check=True)
        with strong.open('w') as f:
            subprocess.run([str(executable),'6142026','8000000','20'],stdout=f,check=True,timeout=100)
    pools={False:[json.loads(line) for line in geometry.read_text().splitlines()],True:[json.loads(line) for line in strong.read_text().splitlines()]}
    # Relative weeks, no production dates. Stronger full boards every fourth week.
    for week in range(1,13):
        for d in DIFFICULTIES:
            bid=f'g6-ds-{d}-w{week:02d}'
            if any(b['id']==bid for b in boards):continue
            rng=random.Random(6112026+week*100+DIFFICULTIES.index(d))
            accepted=None
            for attempt in range(1,2501):
                if time.monotonic()>deadline:raise SystemExit('Bounded run stopped; checkpoint remains unpublished')
                chosen=cat.choose(d,rng);p=cat.profiles[d]
                if d=='mozkokalypsa':
                    layout=rng.choice(pools[week%4==0])
                    bylen={n:[w for w in chosen if len(w)==n] for n in set(map(len,chosen))}
                    letters=['']*100;answers=[]
                    for cells in layout['paths']:
                        w=bylen[len(cells)].pop();answers.append({'word':w.upper(),'path':cells})
                        for c,ch in zip(cells,w.upper()):letters[c]=ch
                    rng.shuffle(answers)
                    b=dict(difficulty=d,rows=10,cols=10,mask=list(range(100)),letters=letters,answers=answers,lengths=[len(a['word']) for a in answers])
                else:
                    try:b=build(chosen,d,p,rng,min(deadline,time.monotonic()+8),diag)
                    except BudgetExceeded:diag['geometry_timeout']+=1;continue
                    if b is None:continue
                m=structural(b)
                if geometry_errors(m,p):diag['geometry_contract']+=1;continue
                if transformed_hash(b) in cat.historical_shapes|{transformed_hash(x) for x in boards}:diag['duplicate_shape_letters']+=1;continue
                amb=board_metrics(b,solver.prefixes,4)['localAmbiguityScore']
                if not p['ambiguity'][0]<=amb<=p['ambiguity'][1]:diag['ambiguity_band']+=1;continue
                verification=solver.verify(b,seconds=10,node_limit=1000000)
                if verification['status']!='unique' or not verification['targetPathsUnique']:diag['solver_'+verification['status']]+=1;continue
                b.update(id=bid,meta={'contentGeneration':6,'generationKey':'daily-specials-gen6-v1',
                    'challengeKind':'special','relativeWeek':week,'weekday':{'hardcore':3,'mozkomor':5,'mozkokalypsa':7}[d],
                    'lexiconVersion':3,'geometryProfile':p['geometry_profile'],'humanDifficulty':'unmeasured',
                    'productionAuthorized':False})
                accepted=b;break
            if accepted is None:raise ValueError('No accepted candidate '+bid)
            boards.append(accepted);cat.add(accepted)
            write(path,dict(schemaVersion=1,status='prepared-awaiting-playtest',timeZone='Europe/Prague',
                bankVersion='daily-specials-gen6-36-v1',launchDate=None,productionAuthorized=False,boards=boards))
            print(bid,'attempt',attempt,'cells',m['cells'],'turns',round(m['meanTurns'],2),'ambiguity',amb,flush=True)
    write(OUT/'manufacture-log.json',{'seed':6112026,'rejections':dict(diag),'profiles':cat.profiles,
        'history':cat.inventory,'historyDistinctContent':len(cat.history),'lexiconSHA256':LEX_HASH,
        'dictionaryHash':solver.hash,'dictionarySize':len(solver.words)})
    print('COMPLETE',len(boards),flush=True)
if __name__=='__main__':main()
