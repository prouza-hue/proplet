import json
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
