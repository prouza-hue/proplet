"""Keep approved word sets; reject recycled full-board tilings under all symmetries."""
import json
import random
import subprocess
from .core import *

def cellsets(b,flip=False,turn=0):
    out=set()
    for a in b['answers']:
        cells=[]
        for i in a['path']:
            y,x=divmod(i,10)
            if flip:x=9-x
            for _ in range(turn):y,x=x,9-y
            cells.append(y*10+x)
        out.add(tuple(sorted(cells)))
    return out
def shared(a,b):
    sa=cellsets(a)
    return max(len(sa&cellsets(b,f,t)) for f in (False,True) for t in range(4))
def main():
    cat=Catalog();solver=cat.solver();bank=read(OUT/'bank.json');accepted=[];log=[]
    pools={False:[],True:[]}
    for strong in (False,True):
        original=OUT/('geometry-strong.jsonl' if strong else 'geometry-pool.jsonl')
        pools[strong]+=[json.loads(x) for x in original.read_text().splitlines()]
        for seed in (7103,8107,9109,10111):
            path=OUT/f'geometry-diverse-{int(strong)}-{seed}.jsonl'
            if not path.exists():
                helper=ROOT/'tools/daily_specials'/('full_geometry_strong' if strong else 'full_geometry')
                with path.open('w') as f:subprocess.run([str(helper),str(seed),'20000000','2' if strong else '12'],stdout=f,check=True,timeout=100)
            pools[strong]+=[json.loads(x) for x in path.read_text().splitlines()]
    for b in bank['boards']:
        if b['difficulty']!='mozkokalypsa':continue
        rng=random.Random(9112026+b['meta']['relativeWeek']);p=cat.profiles['mozkokalypsa'];layouts=pools[b['meta']['relativeWeek']%4==0]
        for attempt in range(10000):
            layout=rng.choice(layouts);answers=[];letters=['']*100
            bylen={n:[norm(a['word']) for a in b['answers'] if len(a['word'])==n] for n in set(b['lengths'])}
            for v in bylen.values():rng.shuffle(v)
            for path in layout['paths']:
                word=bylen[len(path)].pop();answers.append({'word':word.upper(),'path':path})
                for i,ch in zip(path,word.upper()):letters[i]=ch
            candidate={**b,'letters':letters,'answers':answers,'lengths':[len(a['word']) for a in answers]}
            if any(shared(candidate,x)>=7 for x in accepted):continue
            if any(cellsets(candidate)==cellsets(x,f,t) for x in cat.history if len(x['mask'])==100 for f in (False,True) for t in range(4)):continue
            if geometry_errors(structural(candidate),p):continue
            amb=board_metrics(candidate,solver.prefixes,4)['localAmbiguityScore']
            if not p['ambiguity'][0]<=amb<=p['ambiguity'][1]:continue
            v=solver.verify(candidate,seconds=10,node_limit=1000000)
            if v['status']!='unique' or not v['targetPathsUnique']:continue
            b.update(candidate);accepted.append(candidate);log.append({'id':b['id'],'attempt':attempt+1,'geometrySeed':layout['seed'],'geometryStep':layout['step']})
            print('DIVERSE',b['id'],attempt+1,flush=True);break
        else:raise ValueError('Diversity pool exhausted')
    write(OUT/'bank.json',bank);write(OUT/'geometry-selection.json',{'maximumSharedPathCellSetsUnderSymmetry':6,'selection':log})
if __name__=='__main__':main()
