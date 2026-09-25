#!/usr/bin/env python3
"""Offline round-two calibration. Never publishes or alters pilot/production banks."""
from __future__ import annotations
import argparse,json,random,statistics,time,sys,math
from pathlib import Path
from collections import Counter
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT),str(ROOT/'tools')]
from tools import mozkokalypsa_lab as lab
from tools.gen5.catalog import Catalog,Exposure,assign_tiers,digest,input_fingerprint,norm
from tools.gen5.validation import Solver,validation_words,structural,geometry_errors,path_metrics,neighbours
from tools.gen5.runner import difficulty_prefixes
from tools.measure_gen4_ambiguity import board_metrics

PLAN=['accessible','core','core','challenge','accessible','core','core','challenge','core','accessible','core','peak']
SPICE={3:'bonviván',6:'šprýmař',9:'erotoman',12:'furiant'}

def eligible(c):
 return {w:e for w,e in c.eligible('mozkomor').items() if 5<=len(w)<=9 and e['tier'] in 'ABC' and e.get('origin')!='wikidata_frequency_candidate' and w!='lunochod'}

def capacity(c):
 q=eligible(c);counts=Counter(map(len,q));shape=Counter(lab.SHAPE)
 return {'eligibleTotal':len(q),'lengths':dict(counts),'tiers':dict(Counter(e['tier'] for e in q.values())),
  'lengthTier':{t:dict(Counter(len(w) for w,e in q.items() if e['tier']==t)) for t in 'ABC'},
  'demand100':{n:k*100 for n,k in shape.items()},
  'distinctUpperBoundFixedShape':sum(min(counts[n],k*100) for n,k in shape.items()),
  'minimumMaxUsesByLength':{n:math.ceil(k*100/counts[n]) for n,k in shape.items()},
  'warning':'Length-only necessary bounds, not a proof of geometry or per-board lexical feasibility.'}

def choose(c,exposure,used,rng,spice=None):
 q={w:e for w,e in eligible(c).items() if e.get('origin')!='mozkokalypsa_editorial_20260925'}
 shape=lab.SHAPE.copy();target={'A':2,'B':6,'C':6}
 if spice:shape.remove(len(spice));target['C']-=1
 # Freshness is a preference; never substitute invalid words to satisfy cooldown.
 fresh={w:e for w,e in q.items() if w not in used}
 for pool in (fresh,q):
  policy={'allowed':list('ABC'),'weights':dict.fromkeys('ABC',1),'min_fraction':{t:k/len(shape) for t,k in target.items()},'max_fraction':{t:k/len(shape) for t,k in target.items()}}
  rng.shuffle(shape);tiers=assign_tiers(shape,pool,policy,rng)
  if tiers is None:continue
  words=[spice] if spice else [];themes=Counter()
  for n,t in zip(shape,tiers):
   choices=sorted(w for w,e in pool.items() if len(w)==n and e['tier']==t and w not in words)
   weights=[exposure.weight('mozkomor',w)/(1+themes[pool[w].get('theme','')]) for w in choices]
   w=rng.choices(choices,weights=weights)[0];words.append(w);themes[pool[w].get('theme','')]+=1
  return words
 raise ValueError('Insufficient editorial capacity; no automatic lexical downgrade')

def residual(board,prefixes):
 answers=board['answers'];idx=list(range(14))
 orders=[sorted(idx,key=lambda i:(path_metrics(answers[i]['path'],10)[0],len(answers[i]['word']),answers[i]['word']))]
 for seed in range(6):
  order=idx.copy();random.Random(2026092500+seed).shuffle(order);orders.append(order)
 out={'initial':board_metrics(board,prefixes,4)['localAmbiguityScore']}
 for k in (3,7,10):
  scores=[];singles=[];component_counts=[]
  for order in orders:
   remaining=[answers[i] for i in idx if i not in order[:k]]
   cells=set(c for a in remaining for c in a['path']);todo=set(cells);parts=[]
   while todo:
    seen={min(todo)};stack=list(seen);todo-=seen
    while stack:
     for n in neighbours(stack.pop(),10,10,todo):todo.remove(n);seen.add(n);stack.append(n)
    parts.append(seen)
   singleton=sum(any(set(a['path'])==p for p in parts) for a in remaining)/len(remaining)
   b={**board,'answers':remaining,'mask':sorted(cells),'lengths':[len(a['word']) for a in remaining]}
   scores.append(board_metrics(b,prefixes,4)['localAmbiguityScore']);singles.append(singleton);component_counts.append(len(parts))
  out['after'+str(k)]={'ambiguityMedian':statistics.median(scores),'ambiguityMin':min(scores),'isolatedWordShareMedian':statistics.median(singles),'isolatedWordShareMax':max(singles),'componentsMedian':statistics.median(component_counts)}
 out['selectionScore']=round(.2*out['initial']+.2*out['after3']['ambiguityMedian']+.3*out['after7']['ambiguityMedian']+.3*out['after10']['ambiguityMedian']-10*out['after7']['isolatedWordShareMedian']-5*out['after10']['isolatedWordShareMedian'],4)
 return out

def generate(c,solver,prefixes,words,rng,category,budget=120,pool_size=24):
 deadline=time.monotonic()+budget;path=[r*10+j for r in range(10) for j in (range(10) if r%2==0 else range(9,-1,-1))]
 path=lab.mix_path(path,rng,8000);pool=[];rejected=Counter();profile=lab.full_profile(c)
 for attempt in range(20000):
  if time.monotonic()>deadline:break
  path=lab.mix_path(path,rng);lengths=lab.SHAPE.copy();rng.shuffle(lengths);paths=[];offset=0
  for n in lengths:paths.append(path[offset:offset+n]);offset+=n
  paths=lab.orient_paths(paths,rng)
  if paths is None:rejected['endpoint_parity']+=1;continue
  for _ in range(5):
   b=lab.board_from_paths(paths,words,rng);g=structural(b);errs=geometry_errors(g,profile)
   if errs:rejected.update(errs);break
   v=solver.verify(b,seconds=3)
   if v['status']!='unique' or not v['targetPathsUnique']:rejected['solver_or_target_path']+=1;continue
   m=residual(b,prefixes);pool.append({'board':b,'geometry':g,'verification':v,'residual':m})
   if len(pool)>=pool_size:break
  if len(pool)>=pool_size:break
 if len(pool)<pool_size:raise RuntimeError(f'Incomplete pool {len(pool)}/{pool_size}: {dict(rejected)}')
 pool.sort(key=lambda x:x['residual']['selectionScore'])
 quantile={'accessible':.2,'core':.5,'challenge':.85,'peak':1}[category]
 selected=pool[round((len(pool)-1)*quantile)]
 return selected,{'candidateCount':len(pool),'rankQuantile':quantile,'scores':[x['residual']['selectionScore'] for x in pool],'rejections':dict(rejected)}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,required=True);ap.add_argument('--validate-only',action='store_true');args=ap.parse_args()
 out=args.output.resolve()
 if (ROOT/'lab-output').resolve() not in out.parents:raise ValueError('Private lab-output subdirectory only')
 c=Catalog();frozen=input_fingerprint();before=capacity(c)
 overlay=json.loads((ROOT/'content/mozkokalypsa-v2/editorial-overlay.json').read_text())
 for e in overlay['entries']:c.entries[e['word']]=e
 solver=Solver(validation_words(c));prefixes=difficulty_prefixes(c)
 if args.validate_only:
  bank=json.loads((out/'bank.json').read_text());assert bank['validationDictionaryHash']==solver.hash
  for b in bank['boards']:
   assert not geometry_errors(structural(b),lab.full_profile(c));v=solver.verify(b,seconds=8)
   assert v['status']=='unique' and v['targetPathsUnique'],(b['id'],v)
  assert len(bank['boards'])==12 and len({b['id'] for b in bank['boards']})==12
  assert input_fingerprint()==frozen;print('PASS independent revalidation of 12 full boards; frozen production inputs unchanged');return
 if out.exists():raise ValueError('Use a new output directory')
 out.mkdir(parents=True)
 old=json.loads((ROOT/'data/playtests/mozkokalypsa-v1.json').read_text())['boards'];exposure=Exposure(c,old);used=set();boards=[];evidence=[]
 lab.write(out/'capacity.json',{'beforeOverlay':before,'afterOverlay':capacity(c),'softCooldown':True,'hard20LevelRule':False,'newWordCapIsHard':False})
 for ordinal,category in enumerate(PLAN,1):
  seed=2026092500+ordinal;rng=random.Random(seed);words=choose(c,exposure,used,rng,SPICE.get(ordinal))
  result,pool=generate(c,solver,prefixes,words,rng,category)
  b=result.pop('board');b['id']=f'mk2-{ordinal:02}';b['meta']={'level':ordinal,'calibrationOnly':True,'experimentId':'mozkokalypsa-round2-20260925'}
  evidence.append({'id':b['id'],'categoryHypothesis':category,'seed':seed,'words':sorted(words),'tiers':dict(Counter(c.entries[w]['tier'] for w in words)),**result,**pool})
  boards.append(b);used.update(words);exposure.add(b)
  lab.write(out/'checkpoint.json',{'boards':boards,'evidence':evidence});print(b['id'],category,result['residual']['selectionScore'],sorted(words),flush=True)
 assert input_fingerprint()==frozen
 bank={'experimentId':'mozkokalypsa-round2-20260925','status':'offline-calibration-not-deployed','humanDifficulty':'unmeasured','validationDictionaryHash':solver.hash,'boards':boards}
 lab.write(out/'bank.json',bank);lab.write(out/'verification.json',{'inputs':frozen,'overlayHash':digest(overlay),'dictionarySize':len(solver.words),'dictionaryHash':solver.hash,'bankHash':digest(bank),'boardCount':12,'uniqueWords':len(used),'boards':evidence,'warning':'Categories are within-word-set proxy quantiles, not globally calibrated human difficulty.'})
 print('COMPLETE',len(boards),'boards',len(used),'unique words',flush=True)

if __name__=='__main__':main()
