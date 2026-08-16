from pathlib import Path
p=Path(__file__).resolve().parents[1]/'public/app.js'
s=p.read_text(encoding='utf-8')

def one(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
    s=s.replace(old,new,1)

one("if(winBoard){winBoard.classList.remove('daily-global-board','free-level-board');if(g.mode==='free'){winBoard.classList.remove('hidden');winBoard.innerHTML='<div class=\"leaderboard-empty\"><strong>Aktualizuji pořadí…</strong><small>Započítávám právě dohraný výsledek.</small></div>'}else if(g.mode==='daily'){",
    "if(winBoard){winBoard.classList.remove('daily-global-board','free-level-board');if(g.mode==='free'&&!g.postStarterWarmup){winBoard.classList.remove('hidden');winBoard.innerHTML='<div class=\"leaderboard-empty\"><strong>Aktualizuji pořadí…</strong><small>Započítávám právě dohraný výsledek.</small></div>'}else if(g.postStarterWarmup){winBoard.classList.add('hidden')}else if(g.mode==='daily'){",
    'warmup leaderboard initial state')
one("const celebrations=[];if(newBadge)celebrations.push(`",
    "const celebrations=[];if(!g.postStarterWarmup&&newBadge)celebrations.push(`",
    'warmup badge suppression')
one(";if(newAchievements.length){celebrations.push(`",
    ";if(!g.postStarterWarmup&&newAchievements.length){celebrations.push(`",
    'warmup achievement suppression')
p.write_text(s,encoding='utf-8')
print('v3.31.4 preview warmup result polished')
