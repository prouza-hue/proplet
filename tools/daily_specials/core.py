"""Explicit high-difficulty contracts and one edition-wide vocabulary ledger."""
from collections import Counter
from copy import deepcopy
import hashlib
import json
import random
import re
from pathlib import Path
from tools.gen5.catalog import ROOT, norm, digest, assign_tiers, length_shapes, tier_mix_ok
from tools.gen5.validation import Solver, validation_words, structural, geometry_errors, neighbours, path_metrics
from tools.measure_gen4_ambiguity import board_metrics

OUT = ROOT/'content/gen6/daily-specials-36'
LEX_HASH = '7baff6af094af0331d379050a680980e9b4f880428efd0c9ea620ce80c1fc277'
DICT_HASH = 'eaf808cd425024e1f84df62498abb8f7de9a39257b70dc0d069ac6f4d0cd05c1'
DIFFICULTIES = ('hardcore', 'mozkomor', 'mozkokalypsa')
SHAPE = [5]+[6]*3+[7]*4+[8]*5+[9]
AVOID = set('hřebelec software ninja erotoman firewall lunochod červodíra blockchain pulsar tensor'.split())
# Edition-specific texture guard, not a change to the game's recognition lexicon.
SPECIALIST = set('citera raznice plotice štoček propust šerosvit devětsil kamenina podběl dřevoryt hmatník přeslička linoryt lyska mincíř orobinec svorník střevlík tobolka potápník sítotisk'.split())

def read(path): return json.loads(Path(path).read_text(encoding='utf-8'))
def write(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
def walk(value):
    if isinstance(value, dict):
        if all(k in value for k in ('answers','letters','mask','rows','cols')):
            yield value
        else:
            for x in value.values(): yield from walk(x)
    elif isinstance(value, list):
        for x in value: yield from walk(x)
def words(board): return {norm(a['word']) for a in board['answers']}
def content_hash(board):
    return digest({k:board.get(k) for k in ('difficulty','rows','cols','mask','letters','answers','lengths')})
def transformed_hash(board):
    """Canonical occupied letters across all rotations/reflections (IDs excluded)."""
    r,c=board['rows'],board['cols']; hashes=[]
    for flip in (False,True):
        for turn in range(4):
            cells=[]
            for i in board['mask']:
                y,x=divmod(i,c); rr,cc=r,c
                if flip: x=cc-1-x
                for _ in range(turn): y,x,rr,cc=x,rr-1-y,cc,rr
                cells.append((y,x,board['letters'][i]))
            hashes.append(digest([rr,cc,sorted(cells)]))
    return min(hashes)
def weave(board):
    paths=[a['path'] for a in board['answers']]; owner={c:i for i,p in enumerate(paths) for c in p}
    near=[set() for _ in paths]; cross=0; reentries=0
    for c,i in owner.items():
        for n in neighbours(c,board['rows'],board['cols'],owner):
            if c<n and i!=owner[n]:
                cross+=1;near[i].add(owner[n]);near[owner[n]].add(i)
    for axis in (0,1):
        for line in range(10):
            seq=[owner.get(line*10+j if axis==0 else j*10+line) for j in range(10)]
            runs=[seq[0]]+[b for a,b in zip(seq,seq[1:]) if a!=b]
            reentries+=sum(n-1 for i,n in Counter(runs).items() if i is not None)
    seams=[]
    for axis in (0,1):
        spans=[[(c//10,c%10)[axis] for c in p] for p in paths]
        for cut in range(3,8): seams.append(sum(min(p)<cut<=max(p) for p in spans))
    return dict(crossContacts=cross, axisReentries=reentries, neighborsMean=sum(map(len,near))/len(near),
                neighborsMinimum=min(map(len,near)), minSeamCrossers=min(seams))

def residual(board, prefixes):
    """Seven transparent synthetic orders; also inspect the last three words."""
    a=board['answers']; orders=[sorted(range(len(a)),key=lambda i:(path_metrics(a[i]['path'],10)[0],len(a[i]['word']),a[i]['word']))]
    for seed in (0,17,38,91,145,209):
        order=list(range(len(a)));random.Random(seed).shuffle(order);orders.append(order)
    scores={3:[],len(a)//2:[],len(a)-3:[]}
    for k in scores:
        for order in orders:
            remaining=[a[i] for i in range(len(a)) if i not in set(order[:k])]
            b={**board,'answers':remaining,'mask':sorted(c for x in remaining for c in x['path']),
               'lengths':[len(x['word']) for x in remaining]}
            scores[k].append(board_metrics(b,prefixes,4)['localAmbiguityScore'])
    import statistics
    initial=board_metrics(board,prefixes,4)['localAmbiguityScore']
    return dict(initial=initial,after3Median=statistics.median(scores[3]),halfMedian=statistics.median(scores[len(a)//2]),
                last3Median=statistics.median(scores[len(a)-3]),last3Minimum=min(scores[len(a)-3]),orders=7,
                interpretation='Static false-prefix pressure, NOT a prediction of player time or difficult endgame.')

class Catalog:
    def __init__(self):
        path=OUT/'inputs/lexicon-v3.json'
        if hashlib.sha256(path.read_bytes()).hexdigest()!=LEX_HASH: raise ValueError('Unfrozen lexicon')
        entries=read(path)['entries']
        if len(entries)!=4290 or sum(e['source_cohort']=='approved-expansion-1143' for e in entries)!=1143:
            raise ValueError('Incomplete lexicon')
        self.entries={norm(e['word']):e for e in entries}
        self.exclusions=set(read(ROOT/'data/target_generation_exclusions_v334.json')['remove_from_target_generation'])|AVOID
        self.profiles={d:deepcopy(read(ROOT/'content/gen5/profiles.json')['profiles'][d]) for d in DIFFICULTIES[:2]}
        # Preserve the authored HC/MM geometry and tier contracts, remove D only.
        for d,p in self.profiles.items():
            p['policy']['allowed']=['A','B','C'];p['policy']['max_fraction']['D']=0
            p['geometry_profile']='gen6-specials-'+d+'-v1'
        # Explicit full-cover contract. Not a renamed lower-difficulty profile.
        self.profiles['mozkokalypsa']={
            'rows':10,'cols':10,'cells':[100,100],'words':[14,14],'min_len':5,'max_len':9,
            'max_four_words':0,'min_bbox_rows':10,'min_bbox_cols':10,'min_curvy_share':1,
            'max_mean_straight_share':.42,'min_mean_turns':54/14,'max_mean_turns':5.4,
            'min_path_turns':2,'max_path_turns':7,'max_path_straight_share':.75,
            'max_curl_paths':14,'max_curl_run':4,'max_blank_components':0,'max_isolated_blanks':0,
            'geometry_profile':'gen6-specials-full-interwoven-v1','ambiguity':[18,60],
            'policy':{'allowed':['A','B','C'],'weights':{'A':3,'B':3,'C':1},
                      'min_fraction':{'A':.35,'B':.35},'max_fraction':{'C':.22}}}
        self.history=[];self.inventory=[]
        patterns=['data/puzzles.json','public/puzzles.json','data/rolling_content_v1.json','data/daily_gen6_private.json',
                  'data/legacy_daily_gen*.json','data/playtests/*.json','data/tajenka_weekend*.json',
                  'data/tajenka_v2_approved.json','data/tajenka_v2_board_candidates.json',
                  'data/*candidate*.json','data/gen5_preview*.json','content/gen6/free-refresh-300/bank.json',
                  'content/gen6/mozkokalypsa-100/bank.json']
        seen=set()
        for path in sorted({x for pat in patterns for x in ROOT.glob(pat)}):
            boards=list(walk(read(path)))
            if not boards:continue
            self.inventory.append({'path':str(path.relative_to(ROOT)),
                'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'boards':len(boards)})
            for b in boards:
                h=content_hash(b)
                if h not in seen: self.history.append(b);seen.add(h)
        self.counts=Counter(w for b in self.history for w in words(b))
        self.historical_shapes={transformed_hash(b) for b in self.history}
        self.historical_sets={digest(sorted(words(b))) for b in self.history}
        self.daily_words={w for b in walk(read(ROOT/'data/daily_gen6_private.json')) for w in words(b)}
        self.used=set();self.used_variants=set();self.new_topics=Counter()
    def add(self,b):
        self.used |= words(b)
        self.used_variants |= {self.entries[w].get('variant_unit',w) for w in words(b)}
        self.new_topics.update(self.entries[w].get('capacity_topic','') for w in words(b))
    def eligible(self,d):
        p=self.profiles[d]
        return {w:e for w,e in self.entries.items() if e.get('target_eligible') is True
          and e['tier'] in p['policy']['allowed'] and w not in self.exclusions|self.daily_words|self.used
          and e.get('variant_unit',w) not in self.used_variants
          and p['min_len']<=len(w)<=p['max_len'] and re.fullmatch('[a-záčďéěíňóřšťúůýž]+',w)
          and (e['source_cohort']=='approved-expansion-1143' or e.get('origin')!='wikidata_frequency_candidate')}
    def choose(self,d,rng):
        p=self.profiles[d]; available=self.eligible(d)
        buckets=Counter(len(w) for w in available)
        shapes=[tuple(SHAPE)] if d=='mozkokalypsa' else length_shapes(p['min_len'],p['max_len'],*p['words'],*p['cells'],p['max_four_words'])
        shapes=[s for s in shapes if all(buckets[n]>=k for n,k in Counter(s).items())]
        for _ in range(250):
            shape=list(rng.choice(shapes));rng.shuffle(shape)
            tiers=assign_tiers(shape,available,p['policy'],rng)
            if tiers is None: continue
            chosen=[];themes=Counter();families=set();variants=set()
            for n,t in zip(shape,tiers):
                pool=[w for w,e in available.items() if len(w)==n and e['tier']==t and w not in chosen
                      and e.get('variant_unit',w) not in variants and e.get('family',w) not in families]
                if not pool: break
                weights=[1/((1+.12*self.counts[w])**.7*(1+themes[available[w].get('capacity_topic','')])**2
                            *(1+.015*self.new_topics[available[w].get('capacity_topic','')])) for w in pool]
                w=rng.choices(sorted(pool),weights=[weights[pool.index(x)] for x in sorted(pool)],k=1)[0]
                chosen.append(w);themes[available[w].get('capacity_topic','')]+=1
                variants.add(available[w].get('variant_unit',w));families.add(available[w].get('family',w))
            if len(chosen)!=len(shape):continue
            if len(set(chosen)&SPECIALIST)>2 or max(themes.values())>max(3,len(chosen)//3):continue
            if digest(sorted(chosen)) in self.historical_sets:continue
            return chosen
        raise ValueError('Lexical capacity/texture allocation exhausted: '+d)
    def solver(self):
        solver=Solver(validation_words(self))
        if solver.hash!=DICT_HASH or len(solver.words)!=103836:raise ValueError('Recognizer changed; re-baseline required')
        return solver
