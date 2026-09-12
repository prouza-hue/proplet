import json
from pathlib import Path

path=Path(__file__).resolve().parents[1]/'public'/'puzzles.json'
data=json.loads(path.read_bytes())
rows=[]
for key,value in data.items():
    size=len(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode('utf-8'))
    rows.append((size,key))
for size,key in sorted(rows,reverse=True):
    print(f'PUZZLE_SECTION {key}: {size:,} B')
