"""100-board word allocation feasibility only; does not generate playable boards."""
import json,random,math
from collections import Counter
from tools.mozkokalypsa_round2 import Catalog,Exposure,assign_tiers,eligible,ROOT,lab

def main():
 c=Catalog();overlay=json.loads((ROOT/'content/mozkokalypsa-v2/editorial-overlay.json').read_text())
 for e in overlay['entries']:c.entries[e['word']]=e
 q={w:e for w,e in eligible(c).items() if e.get('origin')!='mozkokalypsa_editorial_20260925'}
 ex=Exposure(c);counts=Counter();last={};gaps=[];plan=[];ceilings=[]
 for ordinal in range(1,101):
  rng=random.Random(2026092700+ordinal);spice={9:'erotoman',34:'bonviván',59:'šprýmař',84:'furiant'}.get(ordinal)
  shape=lab.SHAPE.copy();target={'A':2,'B':6,'C':6}
  if spice:shape.remove(len(spice));target['C']-=1
  policy={'allowed':list('ABC'),'weights':dict.fromkeys('ABC',1),'min_fraction':{t:n/len(shape) for t,n in target.items()},'max_fraction':{t:n/len(shape) for t,n in target.items()}}
  rng.shuffle(shape)
  # Relaxable least-use preference, never a fixed cap or 20-level exclusion.
  for ceiling in range(1,102):
   pool={w:e for w,e in q.items() if counts[w]<ceiling}
   tiers=assign_tiers(shape,pool,policy,rng)
   if tiers is not None:break
  ceilings.append(ceiling);words=[spice] if spice else []
  for n,t in zip(shape,tiers):
   options=sorted(w for w,e in pool.items() if len(w)==n and e['tier']==t and w not in words)
   def weight(w):
    gap=ordinal-last.get(w,-100)
    recency=min(1,gap/20)**3
    return ex.weight('mozkomor',w)*recency/(1+counts[w])**2
   words.append(rng.choices(options,weights=[weight(w) for w in options])[0])
  for w in words:
   if w in last:gaps.append(ordinal-last[w])
   last[w]=ordinal
  counts.update(words);ex.add({'difficulty':'mozkomor','answers':[{'word':w} for w in words]})
  assert Counter(map(len,words))==Counter(lab.SHAPE)
  assert Counter(c.entries[w]['tier'] for w in words)==Counter(A=2,B=6,C=6)
  assert len(words)==len(set(words))==14
  plan.append({'ordinal':ordinal,'words':words,'relaxedUsePreference':ceiling})
 result={'kind':'lexical-allocation-only-not-generated-boards','seed':2026092700,'boardsPlanned':100,'occurrences':sum(counts.values()),'uniqueWords':len(counts),'maxUses':max(counts.values()),'minOrdinalGap':min(gaps),'gapsUnder20':sum(g<20 for g in gaps),'topRepeated':counts.most_common(15),'hardCooldown':False,'hardUseCap':False,'qualityPoolUnchanged':True,'allocation':plan}
 path=ROOT/'lab-output/mozkokalypsa/round2-20260925-r1/lexical-allocation-soft.json'
 path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:v for k,v in result.items() if k!='allocation'},ensure_ascii=False))

if __name__=='__main__':main()
