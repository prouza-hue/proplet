from pathlib import Path

root=Path('.')

# Add dedicated equal-weight starter choice actions.
p=root/'public/index.html'
s=p.read_text()
needle='''      <div id="newBadgeBox" class="new-badge-box hidden"></div>\n      <button id="winPrimaryBtn" class="primary-btn big">Pokračovat</button>'''
repl='''      <div id="newBadgeBox" class="new-badge-box hidden"></div>\n      <div id="starterHardActions" class="starter-hard-actions hidden" aria-label="Jak pokračovat po tréninku">\n        <div class="starter-hard-prompt"><span aria-hidden="true">🔥</span><span><strong>Dnešní výzva je Těžká.</strong> Vyber si tempo.</span></div>\n        <button id="starterWarmupBtn" class="starter-choice-btn starter-choice-warmup"><span class="starter-choice-icon" aria-hidden="true">🌱</span><span><strong>Snadná</strong><small>Na rozjezd</small></span></button>\n        <button id="starterHardDailyBtn" class="starter-choice-btn starter-choice-hard"><span class="starter-choice-icon" aria-hidden="true">🔥</span><span><strong>Dnešní Těžká</strong><small>Jdu rovnou</small></span></button>\n      </div>\n      <button id="winPrimaryBtn" class="primary-btn big">Pokračovat</button>'''
assert needle in s
p.write_text(s.replace(needle,repl,1))

# Wire actions and simplify starter win UI.
p=root/'public/app.js'
s=p.read_text()
old=""" $('#backFromGame').onclick=goBackFromGame;$('#resetBtn').onclick=resetGame;$('#gameUndoBtn').onclick=undoReset;$('#hintBtn').onclick=openHintModal;$('#starterHintNudgeBtn').onclick=acceptStarterHintNudge;$('#starterHintNudgeDismiss').onclick=dismissStarterHintNudge;$('#winPrimaryBtn').onclick=closeWinAndContinue;$('#winAccountBtn').onclick=openAccountFromWin;$('#winReplayBtn').onclick=replayDailyFromWin;$('#winMenuBtn').onclick=closeWinToMenu;$('#winShareBtn').onclick=shareDaily;"""
new=""" $('#backFromGame').onclick=goBackFromGame;$('#resetBtn').onclick=resetGame;$('#gameUndoBtn').onclick=undoReset;$('#hintBtn').onclick=openHintModal;$('#starterHintNudgeBtn').onclick=acceptStarterHintNudge;$('#starterHintNudgeDismiss').onclick=dismissStarterHintNudge;$('#winPrimaryBtn').onclick=closeWinAndContinue;$('#winAccountBtn').onclick=openAccountFromWin;$('#winReplayBtn').onclick=replayDailyFromWin;$('#winMenuBtn').onclick=closeWinToMenu;$('#winShareBtn').onclick=shareDaily;$('#starterWarmupBtn').onclick=()=>{trackProductEvent('starter_easy_warmup_selected');startStarterWarmup()};$('#starterHardDailyBtn').onclick=()=>{trackProductEvent('starter_hard_direct_selected');startDaily({starterHardDirect:true})};"""
assert old in s
s=s.replace(old,new,1)

old="""$('#newBadgeBox').classList.remove('hidden');const starterRewardCopy=getProfile()?.token?'10 XP je v tvé hodnosti. V běžné hře nápověda zruší ✨ Čistě.':'10 XP máš uložených na tomto zařízení. S účtem se přenesou do tvé hodnosti. V běžné hře nápověda zruší ✨ Čistě.';$('#newBadgeBox').innerHTML=`<div class=\"unlock-row starter-reward\"><span class=\"emoji\">🧩</span><div><strong>První propletení</strong><small>${starterRewardCopy}</small></div></div>${hardNext?'<div class=\"unlock-row starter-hard-choice\"><span class=\"emoji\">🔥</span><div><strong>Dnešní výzva je Těžká</strong><small>Dneska se zrovna nešetří. Můžeš do ní rovnou — nebo si dát jednu Snadnou na rozjezd.</small></div></div>':''}`;\n $('#winReplayBtn').classList.add('hidden');$('#winShareBtn').classList.add('hidden');$('#winMenuBtn').classList.remove('hidden');$('#winMenuBtn').textContent=hardNext?'🔥 Jdu rovnou na dnešní Těžkou':'Vybrat volnou hru';$('#winAccountBtn')?.classList.add('hidden');$('#winDetails')?.classList.add('hidden');$('#winFeedback')?.classList.add('hidden');$('#winPrimaryBtn').textContent=hardNext?'🌱 Nejdřív Snadná':'Hrát dnešní výzvu ☀️';$('#winModal').classList.add('starter-win');"""
new="""$('#newBadgeBox').classList.add('hidden');$('#newBadgeBox').innerHTML='';const hardActions=$('#starterHardActions');hardActions?.classList.toggle('hidden',!hardNext);\n $('#winReplayBtn').classList.add('hidden');$('#winShareBtn').classList.add('hidden');$('#winMenuBtn').classList.toggle('hidden',hardNext);if(!hardNext)$('#winMenuBtn').textContent='Vybrat volnou hru';$('#winAccountBtn')?.classList.add('hidden');$('#winDetails')?.classList.add('hidden');$('#winFeedback')?.classList.add('hidden');$('#winPrimaryBtn').classList.toggle('hidden',hardNext);if(!hardNext)$('#winPrimaryBtn').textContent='Hrát dnešní výzvu ☀️';$('#winModal').classList.add('starter-win');"""
assert old in s
s=s.replace(old,new,1)

old=""" $('#winModal').classList.remove('starter-win');$('#winDetails')?.classList.remove('hidden');$('#winFeedback')?.classList.remove('hidden');winDailyGlobalData=null;"""
new=""" $('#winModal').classList.remove('starter-win');$('#starterHardActions')?.classList.add('hidden');$('#winPrimaryBtn').classList.remove('hidden');$('#winDetails')?.classList.remove('hidden');$('#winFeedback')?.classList.remove('hidden');winDailyGlobalData=null;"""
assert old in s
s=s.replace(old,new,1)
p.write_text(s)

# Replace old hard-choice card styling with equal-weight action cards.
p=root/'public/styles.css'
s=p.read_text()
start=s.index('/* v3.31.4 preview — protect first real session when Daily is Hard. */')
end=s.index('\n', s.index('html[data-theme="dark"] .starter-win .starter-hard-choice>.emoji', start))
# Include the remainder of that one-line dark rule.
end=s.index('\n', end+1) if end+1 < len(s) else len(s)
block='''/* v3.31.4 preview — equal-weight choice when the first Daily is Hard. */\n.starter-hard-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:9px 0 2px}\n.starter-hard-prompt{grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:7px;padding:2px 4px 4px;color:#6f6575;font-size:12px;line-height:1.3;text-align:center}.starter-hard-prompt>span:first-child{font-size:17px}.starter-hard-prompt strong{color:#4b424e}\n.starter-choice-btn{min-width:0;min-height:74px;border-radius:17px;padding:10px 8px;border:1px solid;display:flex;align-items:center;justify-content:center;gap:8px;text-align:left;cursor:pointer;box-shadow:0 5px 13px rgba(59,49,81,.08);transition:transform .08s ease,box-shadow .15s ease}.starter-choice-btn:active{transform:scale(.98)}.starter-choice-btn>span:last-child{min-width:0}.starter-choice-btn strong,.starter-choice-btn small{display:block}.starter-choice-btn strong{font-size:13px;line-height:1.15}.starter-choice-btn small{margin-top:3px;font-size:10px;font-weight:800;opacity:.72}.starter-choice-icon{flex:0 0 31px;width:31px;height:31px;border-radius:11px;display:grid;place-items:center;font-size:18px}\n.starter-choice-warmup{background:linear-gradient(145deg,#effaf5,#e6f6ef);border-color:#bfe2d1;color:#276d55}.starter-choice-warmup .starter-choice-icon{background:#d5f0e4}.starter-choice-hard{background:linear-gradient(145deg,#fff4ea,#ffead9);border-color:#efc6a4;color:#8b4820}.starter-choice-hard .starter-choice-icon{background:#ffd9bc}\nhtml[data-theme="dark"] .starter-hard-prompt{color:#c9c0cc}html[data-theme="dark"] .starter-hard-prompt strong{color:#f2edf3}html[data-theme="dark"] .starter-choice-warmup{background:linear-gradient(145deg,#20352f,#1d302b);border-color:#41675a;color:#bcebd8}html[data-theme="dark"] .starter-choice-warmup .starter-choice-icon{background:#29483e}html[data-theme="dark"] .starter-choice-hard{background:linear-gradient(145deg,#3a2a21,#34261f);border-color:#674837;color:#ffd0b2}html[data-theme="dark"] .starter-choice-hard .starter-choice-icon{background:#523426}\n@media(max-width:350px){.starter-hard-actions{gap:6px}.starter-choice-btn{min-height:68px;padding:8px 6px;gap:6px}.starter-choice-icon{flex-basis:27px;width:27px;height:27px;font-size:16px}.starter-choice-btn strong{font-size:12px}.starter-choice-btn small{font-size:9.5px}}\n'''
s=s[:start]+block+s[end:]
p.write_text(s)
