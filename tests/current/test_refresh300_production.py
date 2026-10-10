"""The approved refresh adds only new immutable boards, without changing historical slots."""
import hashlib,json
from pathlib import Path
import server
R=Path(__file__).resolve().parents[2]
read=lambda p:json.loads((R/p).read_text())
h=lambda x:hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
data=read('data/puzzles.json');public=read('public/puzzles.json');boundary=read('content/gen6/free-refresh-300/production-boundaries.json');source=read('content/gen6/free-refresh-300/bank.json')
assert h(source['boards'])==source['contentHash']=='7048e9bc26c8e7670bab4aad158bb87f73ff1bbf86e6215a7e262d2c3905635e'
assert public['free']==data['free'];assert data['contentGeneration']==data['freeGeneration']==4
for k,digest in boundary['preserved'].items():assert h(data[k])==digest,k
for diff,digest in boundary['free'].items():
 bank=data['free'][diff];old=[p for p in bank if not p['id'].startswith('g6-refresh-')]
 assert h(old)==digest,diff
 assert len({p['id'] for p in bank})==len(bank)==len({p['meta']['level'] for p in bank})
new=[p for bank in data['free'].values() for p in bank if p['id'].startswith('g6-refresh-')]
assert len(new)==300
byid={p['id']:p for p in new}
for original in source['boards']:
 p=byid[original['id']]
 for k in ['id','difficulty','rows','cols','mask','letters','answers']:assert p[k]==original[k],(p['id'],k)
 assert p['meta']['level']==original['meta']['level'] and p['meta']['contentGeneration']==4
 assert p['meta']['releaseCandidate'] is False
 info=server.free_puzzle_info(p['id'],p['difficulty']);assert info['level']==p['meta']['level'] and info['generation']==4
 cells=[]
 for a in p['answers']:
  path=a['path'];cells+=path;assert ''.join(p['letters'][i] for i in path)==a['word']
  for x,y in zip(path,path[1:]):assert max(abs(x//p['cols']-y//p['cols']),abs(x%p['cols']-y%p['cols']))==1
 assert sorted(cells)==sorted(p['mask']) and len(cells)==len(set(cells))
assert [len(data['free'][d]) for d in ['easy','medium','hard','hardcore','mozkomor','mozkokalypsa']]==[400,400,400,300,150,100]
html=(R/'public/index.html').read_text();assert 'free-refresh-preview' not in html and 'free-refresh-fixtures' not in html
assert 'connect-src \'none\'' not in html
assert 'proplet-v4.05.3-firstgame-telemetry1' in (R/'public/sw.js').read_text()
print('PASS 300 approved boards, path integrity, old bank hashes, all historical fields, runtime identities and production boundary')
