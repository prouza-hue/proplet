"""Recompute all bank validations and select six spoiler-free preview boards."""
from collections import Counter
from itertools import combinations
import statistics
from .core import *
from .independent import check
from .diversify_full import shared, cellsets

def summary(values):
    return {'minimum':min(values),'median':statistics.median(values),'maximum':max(values)}
def main():
    cat=Catalog();solver=cat.solver();bank=read(OUT/'bank.json');boards=bank['boards']
    assert len(boards)==36 and Counter(b['difficulty'] for b in boards)==Counter({d:12 for d in DIFFICULTIES})
    ids=set();seenwords=set();variants=set();shapes=set();wordsets=set();rows=[]
    for b in boards:
        d=b['difficulty'];ws=words(b);vs={cat.entries[w].get('variant_unit',w) for w in ws}
        assert b['id'] not in ids and not ws&seenwords and not vs&variants
        assert not ws&cat.daily_words and ws<=set(cat.eligible(d))
        assert transformed_hash(b) not in shapes|cat.historical_shapes
        assert digest(sorted(ws)) not in wordsets|cat.historical_sets
        m=structural(b);assert not geometry_errors(m,cat.profiles[d])
        assert tier_mix_ok(ws,cat.entries,cat.profiles[d]['policy'])
        first=solver.verify(b,seconds=30,node_limit=2000000);second=check(b,solver.words)
        assert first['status']==second['status']=='unique' and first['targetPathsUnique'] and second['targetPathsUnique'] and second['uniqueCoverMatchesTargets']
        assert first['candidateCount']==second['candidateCount']
        amb=board_metrics(b,solver.prefixes,4)['localAmbiguityScore'];assert cat.profiles[d]['ambiguity'][0]<=amb<=cat.profiles[d]['ambiguity'][1]
        w=weave(b)
        if d=='mozkokalypsa':assert w['crossContacts']>=74 and w['axisReentries']>=4 and w['neighborsMinimum']>=2 and w['neighborsMean']>=52/14 and w['minSeamCrossers']>=2
        if d=='mozkokalypsa':assert not any(cellsets(b)==cellsets(x,f,t) for x in cat.history if len(x['mask'])==100 for f in (False,True) for t in range(4))
        lex=[{'word':x.upper(),'tier':cat.entries[x]['tier'],'topic':cat.entries[x].get('capacity_topic'),
              'family':cat.entries[x].get('family',x),'variantUnit':cat.entries[x].get('variant_unit',x),
              'sourceCohort':cat.entries[x]['source_cohort'],'specialistFlag':x in SPECIALIST,
              'previousBoardUses':cat.counts[x],'meaning':cat.entries[x].get('meaning_cs')} for x in sorted(ws)]
        rows.append({'id':b['id'],'contentHash':content_hash(b),'geometry':m,'weave':w,
                     'residual':residual(b,solver.prefixes),'solver':first,'independent':second,'lexicon':lex})
        ids.add(b['id']);seenwords|=ws;variants|=vs;shapes.add(transformed_hash(b));wordsets.add(digest(sorted(ws)))
        print('VERIFIED',b['id'],flush=True)
    baseline={};runtime=read(ROOT/'public/puzzles.json')
    for d in DIFFICULTIES:
        old=runtime['free'][d];metrics=[structural(b) for b in old]
        ambiguities=[board_metrics(b,solver.prefixes,4)['localAmbiguityScore'] for b in old]
        baseline[d]={'boards':len(old),'geometry':{k:summary([m[k] for m in metrics]) for k in ('cells','wordCount','meanTurns','meanStraightShare')},
                     'ambiguity':summary(ambiguities)}
        if d=='mozkokalypsa':
            res=[residual(b,solver.prefixes) for b in old]
            baseline[d]['residual']={k:summary([m[k] for m in res]) for k in ('initial','halfMedian','last3Median','last3Minimum')}
    # Transparent relative scoring; no claim of calibrated human seconds.
    selected=[]
    for d in DIFFICULTIES:
        rs=[r for r in rows if next(b for b in boards if b['id']==r['id'])['difficulty']==d]
        scores=[]
        for r in rs:
            # Within this difficulty, combine ranks instead of mixing metric units.
            features=lambda x:(x['geometry']['meanTurns'],x['residual']['initial'],x['residual']['halfMedian'],x['residual']['last3Median'])
            values=features(r)
            score=sum(sum(features(q)[i]<=v for q in rs)/len(rs) for i,v in enumerate(values))/4
            scores.append((score,r))
        scores.sort(key=lambda x:(x[0],x[1]['id']))
        typical=scores[len(scores)//2-1];harder=scores[-2]
        if d=='mozkokalypsa':
            # Include one of the explicitly more interwoven full-board profiles.
            harder=max((x for x in scores if x[1]['geometry']['meanTurns']>=66/14),key=lambda x:(x[0],x[1]['id']))
        for kind,(score,r) in (('typical',typical),('challenging',harder)):
            selected.append({'id':r['id'],'difficulty':d,'kind':kind,'relativeScore':round(score,4)})
    overlap=[]
    for a,b in combinations(boards,2):
        n=shared(a,b)
        if a['difficulty']==b['difficulty']=='mozkokalypsa':assert n<7
        if n:overlap.append({'first':a['id'],'second':b['id'],'sharedWordCellSets':n})
    report={'status':'technical-validation-passed-human-playtest-pending','baseSHA':'d1f5f7825e07d7e8a1751de7075914278d3de8bb',
            'boards':rows,'counts':dict(Counter(b['difficulty'] for b in boards)), 'uniqueWords':len(seenwords),
            'newWordRepeats':0,'newVariantRepeats':0,'baseDailyWordOverlap':0,'duplicateBoardOrWordsetVsHistory':0,
            'recognition':{'size':len(solver.words),'sha256':solver.hash,'frequencyFallback':'Finite approved recognition union; no claim to enumerate arbitrary future frequency fallback.'},
            'lexicon':{'entries':4290,'approvedExpansion':1143,'sha256':LEX_HASH,'tierCounts':dict(Counter(cat.entries[w]['tier'] for w in seenwords))},
            'historySources':cat.inventory,'historyDistinctContent':len(cat.history),'currentFreeBaseline':baseline,
            'pathCellSetOverlaps':overlap,'maximumSharedWordCellSets':max([x['sharedWordCellSets'] for x in overlap],default=0),
            'playtest':selected,'humanDifficulty':'unmeasured','productionAuthorized':False}
    write(OUT/'validation.json',report);write(OUT/'playtest-selection.json',{'boards':selected})
    write(OUT/'schedule.json',{'timeZone':'Europe/Prague','launchDate':None,'baseDailyCadence':['easy','easy','medium','medium','medium','hard','hard'],
            'weeks':[{'week':w,'specials':[{'weekday':{'hardcore':3,'mozkomor':5,'mozkokalypsa':7}[d],'difficulty':d,'puzzleId':f'g6-ds-{d}-w{w:02d}'} for d in DIFFICULTIES]} for w in range(1,13)]})
    print('PASS',len(boards),'boards',len(seenwords),'words; maximum identical word-cell sets',report['maximumSharedWordCellSets'])
if __name__=='__main__':main()
