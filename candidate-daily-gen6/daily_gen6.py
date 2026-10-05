"""Candidate-only dated adapter around the pinned Gen6 lexical/geometry tooling.

No production write target; ordered ledger, exact input guards, bounded fork workers.
"""
from __future__ import annotations
import argparse, ast, hashlib, json, multiprocessing as mp, random, time, traceback
from collections import Counter
from copy import deepcopy
from datetime import date, timedelta
from pathlib import Path
from tools.gen5.catalog import Catalog, Exposure, ROOT, choose_words, digest, norm, profile_for, tier_mix_ok
from tools.gen5.geometry import build
from tools.gen5.validation import Solver, structural, geometry_errors, BudgetExceeded
from tools.gen5.runner import difficulty_prefixes
from tools.measure_gen4_ambiguity import board_metrics
from tools.free_refresh.catalog import HISTORY, LEXICON_HASH, board_digest, sha, walk

VERSION='daily-gen6-20261007-v1'
ROOT_SEED=2026100501
START=date(2026,10,7)
BASE=date(2026,8,24)
COUNT=100
DIFFICULTIES=('easy','medium','hard')
WORKING=ROOT/'content/lexicon-v3/working'

def write(p,value):
    p=Path(p);p.parent.mkdir(parents=True,exist_ok=True)
    t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');t.replace(p)

def difficulty(day):
    return 'easy' if day.weekday()<2 else 'medium' if day.weekday()<5 else 'hard'

def plan():
    ordinals=Counter(difficulty(BASE+timedelta(days=i)) for i in range((START-BASE).days))
    result=[]
    for i in range(COUNT):
        day=START+timedelta(days=i);d=difficulty(day);ordinals[d]+=1
        result.append({'dailyDate':day.isoformat(),'difficulty':d,'profileOrdinal':ordinals[d],
                       'bankVersion':VERSION,'puzzleId':'g6-d-'+day.strftime('%Y%m%d'),
                       'challengeKey':'daily:'+day.isoformat()})
    return result

class DailyCatalog(Catalog):
    def __init__(self):
        manifest=json.loads((ROOT/'DAILY_INPUTS_VERIFIED.json').read_text())
        for f in manifest['files']:
            if sha(ROOT/f['path'])!=f['sha256']:raise ValueError('Changed source: '+f['path'])
        super().__init__()
        self.source_main=manifest['sourceMain'];self.lexicon_hash=LEXICON_HASH
        lexmanifest=json.loads((WORKING/'manifest.json').read_text())
        for name,h in lexmanifest['outputs_sha256'].items():
            if sha(WORKING/name)!=h:raise ValueError('Changed immutable V3: '+name)
        if sha(WORKING/'lexicon.json')!=LEXICON_HASH:raise ValueError('Incomplete lexicon')
        payload=json.loads((WORKING/'lexicon.json').read_text())
        self.entries={norm(e['word']):deepcopy(e) for e in payload['entries']}
        if len(self.entries)!=4290:raise ValueError('Wrong lexicon capacity')
        self.additions={w for w,e in self.entries.items() if e['source_cohort']=='approved-expansion-1143'}
        if len(self.additions)!=1143:raise ValueError('Incomplete additions')
        self.exclusions|={w for w,e in self.entries.items() if not e['target_eligible']}
        for e in self.entries.values():e['theme']=e['capacity_topic']
        self.variants={w:{w} for w in self.entries}
        for group in json.loads((WORKING/'variant-groups.json').read_text())['groups']:
            members={norm(w) for w in group['members']}
            for w in members:self.variants[w]=members
        self.inventory={};self.history_sources=[]
        for name in HISTORY:
            p=ROOT/name;self.history_sources.append({'path':name,'sha256':sha(p),'sourceMain':self.source_main})
            for b in walk(json.loads(p.read_text())):
                key=('retired-tajenka-v1:' if name.endswith('tajenka_weekend_v1.json') else '')+b['id']
                if name.endswith('_board_candidates.json'):key='unreleased-candidate:'+name+':'+key
                h=board_digest(b)
                if key in self.inventory and self.inventory[key]['contentHash']!=h:
                    if name.startswith('data/legacy_daily_'):key=name+':'+key
                    else:raise ValueError('Historical identity conflict: '+key)
                rec=self.inventory.setdefault(key,{'id':b['id'],'contentHash':h,'words':sorted(self.words(b)),'sources':[]})
                rec['sources'].append(name)
        self.historical_ids={r['id'] for r in self.inventory.values()}
        self.historical_words_hashes={digest(r['words']) for r in self.inventory.values()}
        self.global_counts=Counter(w for r in self.inventory.values() for w in r['words'])
        bank=json.loads((ROOT/'data/puzzles.json').read_text())
        self.before=[]
        for i in range((START-BASE).days):
            day=BASE+timedelta(days=i);b=bank['daily'][i]
            self.before.append({'dailyDate':day.isoformat(),'puzzleId':b['id'],'contentHash':board_digest(b),'words':sorted(self.words(b))})

    def eligible(self,d):
        return {w:e for w,e in super().eligible(d).items() if e['target_eligible']}

class DailyExposure(Exposure):
    def __init__(self,c,accepted=()):
        super().__init__(c)
        self.calendar=[set(x['words']) for x in c.before]
        for b in accepted:self.add(b)
    def add(self,b):
        super().add(b);self.calendar.append(self.catalog.words(b))
    def forbidden(self,d):
        words=set().union(*self.calendar[-24:])
        for w in list(words):words|=self.catalog.variants.get(w,{w})
        return words|{w for w,n in self.global_new.items() if n>=3}
    def weight(self,d,w):
        return super().weight(d,w)*(2.4 if w in self.catalog.additions else 1)*(1.5 if self.catalog.global_counts[w]==0 else 1)

def recognition():
    # Reassemble from exact pinned accepted frequency layer; no dependency on live wordfreq.
    # Execute only the unmodified pure static recognition functions from the exact
    # current runtime AST; HTTP framework dependencies are irrelevant to manufacturing.
    import re, unicodedata
    from functools import lru_cache
    from types import SimpleNamespace
    tree=ast.parse((ROOT/'word_recognition_v3330.py').read_text())
    names={'RECOGNITION_OVERLAY','RECOGNITION_BLOCKLIST','_CZECH_WORD','_CZECH_DIACRITICS'}
    nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in {'_normalize','_acceptable','_recognition_index'}
           or isinstance(n,(ast.Assign,ast.AnnAssign)) and any(isinstance(t,ast.Name) and t.id in names for t in (n.targets if isinstance(n,ast.Assign) else [n.target]))]
    ns={'ROOT':ROOT,'DATA':ROOT/'data','json':json,'re':re,'unicodedata':unicodedata,'lru_cache':lru_cache}
    exec(compile(ast.Module(body=nodes,type_ignores=[]),'current-runtime-static-recognition','exec'),ns)
    runtime=SimpleNamespace(**ns)
    old=ROOT/'content/gen6/free-refresh-300/recognition-words.txt'
    previous=json.loads((old.parent/'recognition-manifest.json').read_text())
    if sha(old)!=previous['sha256']:raise ValueError('Recognition source changed')
    freq=ROOT/'content/gen6/round3-eight/wordfreq-cs-runtime.txt'
    if sha(freq)!='bfc1eb49c6959a7ebbfa5ee9beff74e377e55f59e783445f99447ef8a8e34610':raise ValueError('Frequency source changed')
    targets={norm(e['word']) for e in json.loads((WORKING/'lexicon.json').read_text())['entries']}
    variants={norm(w) for g in json.loads((WORKING/'variant-groups.json').read_text())['groups'] for w in g['members']}
    words=set(runtime._recognition_index())|targets|variants
    for p in (old,freq,WORKING/'recognition-words.txt'):
        words|={norm(w) for w in p.read_text().splitlines()}
    words=sorted(w for w in words if runtime._acceptable(w));raw=('\n'.join(words)+'\n').encode()
    return words,raw,{'acceptedEntries':len(words),'sha256':hashlib.sha256(raw).hexdigest(),
        'runtimeSha256':sha(ROOT/'word_recognition_v3330.py'),'runtimeOverlay':sorted(runtime.RECOGNITION_OVERLAY),
        'pinnedFrequencySha256':sha(freq),'previousRecognitionSha256':previous['sha256'],
        'derivation':'union of exact pinned frequency acceptance, current static runtime, full V3 and variants; never narrowed'}

def manufacture(conn,c,solver,prefixes,slot,seed,accepted,seconds):
    started=time.monotonic();deadline=started+seconds;rejects=Counter()
    try:
        d=slot['difficulty'];p=profile_for(c,d,slot['profileOrdinal']);c.profiles[d]=p
        exposure=DailyExposure(c,accepted);rng=random.Random(seed)
        for attempt in range(1,1201):
            if time.monotonic()>deadline-.5:break
            words=choose_words(c,exposure,d,rng)
            topics={c.entries[w]['capacity_topic'] for w in words};families=[c.entries[w].get('family') or w for w in words]
            if len(topics)<min(3,len(words)) or len(set(families))!=len(words) or any((set(words)-{w})&c.variants.get(w,{w}) for w in words):
                rejects['composition']+=1;continue
            try:b=build(words,d,p,rng,deadline,rejects)
            except BudgetExceeded:rejects['geometry_budget']+=1;break
            if b is None:rejects['geometry']+=1;continue
            metrics=structural(b);amb=board_metrics(b,prefixes,4)
            if not p['ambiguity'][0]<=amb['localAmbiguityScore']<=p['ambiguity'][1]:rejects['ambiguity']+=1;continue
            proof=solver.verify(b,seconds=min(15,max(.01,deadline-time.monotonic())),node_limit=2000000)
            if proof['status']!='unique' or not proof['targetPathsUnique']:rejects['solver_'+proof['status']]+=1;continue
            b['id']=slot['puzzleId'];b['meta']={'dailyDate':slot['dailyDate'],'bankVersion':VERSION,'generatorGeneration':6,
                'geometryProfile':p['geometry_profile'],'releaseCandidate':True,'editorialStatus':'pending',
                'manufacture':{'seed':seed,'attempt':attempt,'profileOrdinal':slot['profileOrdinal'],'geometry':metrics,'ambiguity':amb,'verification':proof,'lexiconSha256':LEXICON_HASH}}
            conn.send({'board':b,'diagnostics':{'seconds':round(time.monotonic()-started,3),'rejections':dict(rejects)}});return
        conn.send({'board':None,'diagnostics':{'status':'no_candidate_within_budget','seconds':round(time.monotonic()-started,3),'rejections':dict(rejects)}})
    except Exception:conn.send({'board':None,'diagnostics':{'status':'error','detail':traceback.format_exc()}})
    finally:conn.close()

def accept(c,solver,prefixes,exposure,b,slot,ids,sets,hashes,full=True):
    if b['id']!=slot['puzzleId'] or b['id'] in ids or b['meta']['dailyDate']!=slot['dailyDate'] or b['difficulty']!=slot['difficulty']:raise ValueError('Identity/date/order')
    p=profile_for(c,b['difficulty'],slot['profileOrdinal']);errs=geometry_errors(structural(b),p)
    if errs:raise ValueError('Geometry: '+','.join(errs))
    words=c.words(b)
    if not words<=set(c.eligible(b['difficulty'])) or words&exposure.forbidden(b['difficulty']):raise ValueError('Eligibility/daily spacing/cap')
    if not tier_mix_ok(list(words),c.entries,p['policy']):raise ValueError('Tier mix')
    if board_digest(b) in hashes or digest(sorted(words)) in sets:raise ValueError('Geometry/wordset collision')
    if full:
        v=solver.verify(b,seconds=15,node_limit=2000000)
        if v['status']!='unique' or not v['targetPathsUnique']:raise ValueError('Solver: '+v['status'])
        b['meta']['manufacture']['centralVerification']=v
    ids.add(b['id']);sets.add(digest(sorted(words)));hashes.add(board_digest(b));exposure.add(b)

def main():
    cli=argparse.ArgumentParser();cli.add_argument('--out',required=True,type=Path);cli.add_argument('--seconds',default=45,type=int);cli.add_argument('--limit',default=100,type=int)
    a=cli.parse_args();out=a.out.resolve()
    if out==ROOT or out in {ROOT/'data',ROOT/'public'} or 'public' in out.relative_to(ROOT).parts:raise ValueError('Explicit private candidate directory required')
    if not 1<=a.limit<=100 or not 5<=a.seconds<=180:raise ValueError('Bounded run required')
    out.mkdir(parents=True,exist_ok=True);c=DailyCatalog();words,raw,rec=recognition();(out/'recognition-words.txt').write_bytes(raw);write(out/'recognition-manifest.json',rec)
    solver=Solver(words);prefixes=difficulty_prefixes(c);slots=plan()
    inputs={'sources':sha(ROOT/'DAILY_INPUTS_VERIFIED.json'),'ownCode':sha(Path(__file__)),
            'recognition':rec['sha256'],'lexicon':LEXICON_HASH,'rootSeed':ROOT_SEED,'planHash':digest(slots),'bankVersion':VERSION}
    checkpoint=out/'manufacture-checkpoint.json'
    state=json.loads(checkpoint.read_text()) if checkpoint.exists() else {'inputs':inputs,'boards':[],'contentHash':digest([]),'attempts':{},'diagnostics':[]}
    if state['inputs']!=inputs or state['contentHash']!=digest(state['boards']):raise ValueError('Checkpoint/source/content changed')
    exposure=DailyExposure(c);ids=set(c.historical_ids);sets=set(c.historical_words_hashes);hashes={r['contentHash'] for r in c.inventory.values()}
    for i,b in enumerate(state['boards']):accept(c,solver,prefixes,exposure,b,slots[i],ids,sets,hashes,False)
    write(out/'preserved-history.json',{'bindings':c.before,'contentHash':digest(c.before),'previousLast24':c.before[-24:]})
    write(out/'history-manifest.json',{'sources':c.history_sources,'boards':len(c.inventory),'personalExposure':'unknown; static history only'})
    capacity={d:{'eligible':len(c.eligible(d)),'initialAvailable':len(set(c.eligible(d))-exposure.forbidden(d)),'byTierLength':dict(Counter(e['tier']+'-'+str(len(w)) for w,e in c.eligible(d).items()))} for d in DIFFICULTIES}
    write(out/'production-plan.json',{'schemaVersion':1,'bankVersion':VERSION,'rootSeed':ROOT_SEED,'cutover':START.isoformat(),
        'activeUntil':slots[-1]['dailyDate'],'count':100,'timeZone':'Europe/Prague','counts':dict(Counter(x['difficulty'] for x in slots)),
        'cooldownInterveningDays':24,'maxExactOccurrences':3,'sourceMain':c.source_main,'generatorGeneration':6,
        'inputs':inputs,'slots':slots,'capacity':capacity,'status':'locked-before-manufacturing'})
    print(json.dumps({'stage':'start','recognition':len(words),'resumed':len(state['boards']),'capacity':capacity}),flush=True)
    ctx=mp.get_context('fork')
    while len(state['boards'])<a.limit:
        slot=slots[len(state['boards'])];key=slot['dailyDate'];attempt=state['attempts'].get(key,0)
        if attempt>=50:raise ValueError('Fifty bounded attempts exhausted: '+key)
        seed=int(digest([ROOT_SEED,VERSION,key,slot['difficulty'],attempt])[:16],16)
        state['attempts'][key]=attempt+1;write(checkpoint,state)
        parent,child=ctx.Pipe(False);p=ctx.Process(target=manufacture,args=(child,c,solver,prefixes,slot,seed,state['boards'],a.seconds));p.start();child.close()
        if parent.poll(a.seconds+5):
            try:result=parent.recv()
            except EOFError:result={'board':None,'diagnostics':{'status':'worker_exit_without_result'}}
        else:result={'board':None,'diagnostics':{'status':'hard_worker_timeout'}}
        parent.close();p.join(timeout=1)
        if p.is_alive():p.kill();p.join()
        diag={'slot':key,'attempt':attempt,'seed':seed,**result['diagnostics']};state['diagnostics'].append(diag)
        if result['board']:
            try:
                b=result['board'];accept(c,solver,prefixes,exposure,b,slot,ids,sets,hashes);state['boards'].append(b)
                print(json.dumps({'accepted':key,'count':len(state['boards']),'seconds':diag.get('seconds'),'words':[x['word'] for x in b['answers']]},ensure_ascii=False),flush=True)
            except ValueError as e:diag['centralRejection']=str(e);print(json.dumps({'retry':key,'reason':str(e)}),flush=True)
        else:print(json.dumps({'retry':key,'diagnostics':diag}),flush=True)
        state['contentHash']=digest(state['boards']);write(checkpoint,state)
        if diag.get('status')=='error':raise ValueError(diag['detail'])
    bindings=[{**slots[i],'contentHash':board_digest(b)} for i,b in enumerate(state['boards'])]
    bank={'schemaVersion':1,'status':'manufactured-awaiting-independent-editorial-review','bankVersion':VERSION,'boards':state['boards'],
        'contentHash':digest(state['boards']),'geometryBankHash':digest([x['contentHash'] for x in bindings]),'count':len(bindings),
        'lexiconSha256':LEXICON_HASH,'recognitionSha256':rec['sha256'],'generatorGeneration':6,'productionChanged':False}
    write(out/'bank.json',bank);write(out/'schedule.json',{'schemaVersion':1,'bankVersion':VERSION,'timeZone':'Europe/Prague','bindings':bindings})
    write(out/'server-pack.json',{'schemaVersion':1,'status':'candidate','timeZone':'Europe/Prague','cutover':START.isoformat(),'activeUntil':slots[-1]['dailyDate'],
        'bankVersion':VERSION,'bindings':bindings,'puzzles':{b['id']:b for b in state['boards']}})
    print(json.dumps({'stage':'manufactured','count':len(bindings),'hash':bank['contentHash']}),flush=True)

if __name__=='__main__':main()
