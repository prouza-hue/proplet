import json
from collections import defaultdict
from pathlib import Path

from generate_puzzles_bootstrap import build_bootstrap

path=Path(__file__).resolve().parents[1]/'public'/'puzzles.json'
raw=path.read_bytes()
data=json.loads(raw)
bootstrap=build_bootstrap(data,raw)

for label,payload in [('PUZZLE_SECTION',data),('BOOTSTRAP_SECTION',bootstrap)]:
    rows=[]
    for key,value in payload.items():
        size=len(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode('utf-8'))
        rows.append((size,key))
    for size,key in sorted(rows,reverse=True):
        print(f'{label} {key}: {size:,} B')

for label,puzzles in [
    ('FREE_META',[p for bank in (data.get('free') or {}).values() for p in bank]),
    ('DAILY_META',data.get('daily') or []),
]:
    totals=defaultdict(int)
    counts=defaultdict(int)
    for puzzle in puzzles:
        for key,value in (puzzle.get('meta') or {}).items():
            totals[key]+=len(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode('utf-8'))
            counts[key]+=1
    for key,size in sorted(totals.items(),key=lambda row:row[1],reverse=True):
        print(f'{label} {key}: {size:,} B across {counts[key]} puzzles')
