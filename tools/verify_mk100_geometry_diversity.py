import json
from collections import defaultdict
from pathlib import Path
from tools.gen5.catalog import digest
D=Path('content/gen6/mozkokalypsa-100')
b=json.loads((D/'bank.json').read_text(encoding='utf-8'))
groups=defaultdict(list)
for board in b['boards']:
    alternatives=[]
    for symmetry in range(8):
        paths=[]
        for a in board['answers']:
            route=[]
            for index in a['path']:
                r,c=divmod(index,10)
                if symmetry&4:r,c=c,r
                if symmetry&2:r=9-r
                if symmetry&1:c=9-c
                route.append(r*10+c)
            paths.append(min(tuple(route),tuple(reversed(route))))
        alternatives.append(tuple(sorted(paths)))
    groups[digest(min(alternatives))].append(board['meta']['level'])
gap=min(y-x for positions in groups.values() for x,y in zip(positions,positions[1:]))
assert gap>=8
claimed=json.loads((D/'summary.json').read_text(encoding='utf-8'))['canonicalGeometry']
assert (len(groups),gap,max(map(len,groups.values())))==(claimed['uniqueTilings'],claimed['minimumRepeatGap'],claimed['maximumRepeat'])
result={'status':'PASS','bankContentHash':b['contentHash'],'boardCount':100,'uniqueCanonicalTilings':len(groups),
 'minimumRepeatGap':gap,'maximumReuse':max(map(len,groups.values())),
 'normalization':'all8square symmetries; answer order and words ignored; each path reversal normalized',
 'independentImplementation':'Codex root; no manufacture module imported',
 'repeatPositions':{h:p for h,p in groups.items() if len(p)>1}}
(D/'independent-canonical-geometry.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('CANONICAL_PASS',len(groups),gap,result['maximumReuse'])
