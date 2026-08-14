#!/usr/bin/env python3
from pathlib import Path
import json, hashlib, re

ROOT=Path(__file__).resolve().parents[1]

required=['server.py','public/app.js','public/index.html','public/styles.css','public/sw.js','SUPABASE_MIGRATION_V3_21.sql','data/puzzles.json','public/puzzles.json']
for f in required: assert (ROOT/f).exists(), f
server=(ROOT/'server.py').read_text(); app=(ROOT/'public/app.js').read_text(); html=(ROOT/'public/index.html').read_text(); css=(ROOT/'public/styles.css').read_text(); sw=(ROOT/'public/sw.js').read_text(); sql=(ROOT/'SUPABASE_MIGRATION_V3_21.sql').read_text()
assert 'version="3.21.2-cloud"' in server and '"version": "3.21.2"' in server
assert "const APP_VERSION='3.21.2'" in app and 'Proplet v3.21' in html and 'proplet-v3.21.2-starter-choice' in sw
assert 'gameFeelSprint' in server and 'starterXp' in server and 'starterMigration' in server
assert "mode in ('daily','free','starter')" in sql and "'starter-v1'" in sql and '10' in sql

cur=json.loads((ROOT/'data/puzzles.json').read_text())
pub=json.loads((ROOT/'public/puzzles.json').read_text())
assert cur==pub
# Complete shell/bind contract: every DOM id referenced by bind() exists.
assert html.rstrip().endswith('</html>') and '<script src="/app.js"></script>' in html
ids=set(re.findall(r'id=["\']([^"\']+)',html)); m=re.search(r"function bind\(\)\{(.*?)\n\}\n\nasync function boot",app,re.S); assert m
bound=set(re.findall(r"\$\('#([^']+)'\)",m.group(1))); assert not (bound-ids),sorted(bound-ids)
starter=cur['starter']
assert starter['id']=='starter-v1' and (starter['rows'],starter['cols'])==(5,5)
assert [a['word'] for a in starter['answers']]==['MRAK','JABLKO','ČOKOLÁDA','AUTOBUS']
assert sum(len(a['path']) for a in starter['answers'])==25
assert len({i for a in starter['answers'] for i in a['path']})==25

# Every target answer must have exactly one orthogonal path spelling it on the starter board.
def count_paths(word):
    rows,cols=starter['rows'],starter['cols']; letters=starter['letters']; mask=set(starter['mask']); total=0
    starts=[i for i in mask if letters[i]==word[0]]
    def neigh(i):
        r,c=divmod(i,cols)
        for dr,dc in ((-1,0),(1,0),(0,-1),(0,1)):
            rr,cc=r+dr,c+dc
            j=rr*cols+cc
            if 0<=rr<rows and 0<=cc<cols and j in mask: yield j
    def dfs(i,k,seen):
        nonlocal total
        if k==len(word)-1: total+=1; return
        for j in neigh(i):
            if j not in seen and letters[j]==word[k+1]: dfs(j,k+1,seen|{j})
    for i in starts: dfs(i,0,{i})
    return total
for a in starter['answers']:
    assert count_paths(a['word'])==1, (a['word'],count_paths(a['word']))

# Existing active content must not move at all: only a new top-level starter may differ.
def digest(obj): return hashlib.sha256(json.dumps(obj,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
EXPECTED_BANK_DIGESTS={
    'free':'683125ea0d61849aac33e0f1be2c7cfbc82d962ba3eba0b11ee0c3da75c0ebc2',
    'daily':'0c0e66cdfec9de832a169ef8953a7b5e6eb081432c45b701d12e2e8425f45f1c',
    'rescue':'9c6cf5e9e2207199024f705c712f61e1863b9381bc847c2c393d6441d760a2b4',
    'legacyFree':'854fa0e30380f1c2345781c8a69307b20d775ab63cd00bd3d7bd79415991674a',
    'legacyDaily':'6067da41b8f25ee60fd860e27a5bebcb35e883b78abf568bbb01a58ea8b1fc01',
}
for key,expected in EXPECTED_BANK_DIGESTS.items(): assert digest(cur.get(key))==expected, key

# High-value behavior guards.
for token in ["mode==='starter'",'maybeOfferStarterHint','starterHintOfferShown','starterHintNudge','starterGuidePath','starter_hint_used','starter_completed','wrongPath','word.length<4','undoSnapshot','showGameUndo','board-complete','await sleep','showStarterDailyNudge']:
    assert token in app, token
for token in ['gameUndoToast','hintEyebrow','hintTitle','hintCopy','starterDailyNudge','winDetails','winFeedback']:
    assert f'id="{token}"' in html, token
for token in ['path-guide','wrong-flash','boardCompleteSettle','starterHintAttention','game-undo-toast','starter-daily-nudge']:
    assert token in css, token
# Fold7 inner display must use tablet behavior, while the folded cover remains phone-landscape guarded.
assert 'function isTabletSizedViewport(w,h)' in app
assert '!isTabletSizedViewport(w,h)' in app
assert 'unfolded foldables are tablets' in css
# Player copy must not expose our implementation history.
for bad in ['postup Gen2','skutečně hraných v Gen2','Archiv původní banky','Převedený slot','XP za nový slot','Táhni prstem','musí sedět i cesta']:
    assert bad not in app+html, bad
print('PASS: v3.21 package, curated starter, game feel, copy and untouched production puzzle banks')
