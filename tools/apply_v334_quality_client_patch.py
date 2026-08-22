#!/usr/bin/env python3
"""One-shot adjustments to the additive v3.34 client layer; removed after use."""
from pathlib import Path

path = Path("public/quality-v334.js")
text = path.read_text(encoding="utf-8")


def once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, got {count}")
    text = text.replace(old, new, 1)

once(
"if((path==='/api/result'||path==='/api/attempt/start'||path==='/api/attempt/finish')&&opts?.body){",
"if((path==='/api/result'||path==='/api/attempt/start'||path==='/api/attempt/checkpoint'||path==='/api/attempt/finish')&&opts?.body){",
"checkpoint calm payload",
)
once(
"currentGame.calmMode=true;saveCalmIntoProgress();applyCalmRunUi();if(typeof showToast==='function')showToast('Klidný režim zapnutý. Tenhle pokus už není soutěžní 🫧')",
"currentGame.calmMode=true;saveCalmIntoProgress();try{if(typeof sendAttemptCheckpoint==='function')sendAttemptCheckpoint('resume')}catch{};applyCalmRunUi();if(typeof showToast==='function')showToast('Klidný režim zapnutý. Tenhle pokus už není soutěžní 🫧')",
"mid-run calm checkpoint",
)
once(
"if(rec?.calmMode===true||currentGame?.calmMode===true){q('#levelLeaderboardBox')?.classList.add('hidden');return}return base(date,rec)",
"if(calmPreference()||currentGame?.calmMode===true){q('#levelLeaderboardBox')?.classList.add('hidden');return}return base(date,rec)",
"daily leaderboard visibility",
)
once(
"try{if(levelDetailContext?.result?.calmMode===true){q('#levelDetailLeaderboard')?.classList.add('hidden');const result=q('#levelDetailResult');if(result&&!q('.calm-win-note',result.parentElement))result.insertAdjacentHTML('afterend','<div class=\"calm-win-note\">🫧 Tento pokus byl odehraný v Klidném režimu a není v pořadí.</div>')}}catch{};return out",
"try{if(calmPreference())q('#levelDetailLeaderboard')?.classList.add('hidden');if(levelDetailContext?.result?.calmMode===true){const result=q('#levelDetailResult');if(result&&!q('.calm-win-note',result.parentElement))result.insertAdjacentHTML('afterend','<div class=\"calm-win-note\">🫧 První dokončení bylo v Klidném režimu a do pořadí se nepočítá.</div>')}}catch{};return out",
"level detail calm visibility",
)
once(
"const wrapped=function(date,rec,...rest){const out=base(date,rec,...rest);if(rec?.calmMode===true)applyCalmWin(rec);return out}",
"const wrapped=function(date,rec,...rest){const out=base(date,rec,...rest);if(rec?.calmMode===true&&calmPreference())applyCalmWin(rec);return out}",
"stored daily calm display",
)

path.write_text(text, encoding="utf-8")
print("Applied v3.34 quality client follow-up patch")
