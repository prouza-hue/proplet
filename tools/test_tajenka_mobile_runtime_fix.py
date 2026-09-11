#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

app = (ROOT / "public/app.js").read_text(encoding="utf-8")
core = (ROOT / "public/quality-v334-core-v40114.js").read_text(encoding="utf-8")
css = (ROOT / "public/printshop-ui.css").read_text(encoding="utf-8")

assert "function setTajenkaHintBanner(" in app
assert "setTajenkaHintBanner(hintText)" in app
assert "$('#tajenkaHintBanner')?.remove();" in app
assert "calmMode:!!g.calmMode" in app

assert "['daily','free','tajenka'].includes(g.mode)" in core
assert "['daily','free','tajenka'].includes(currentGame.mode)" in core
assert "event.mode==='daily'||event.mode==='free'||event.mode==='tajenka'" in core
assert "if(g.mode==='tajenka'){if(typeof saveTajenkaGameProgress==='function')saveTajenkaGameProgress(g);return}" in core
assert "['daily','free'].includes" not in core

assert "Tajenka mobile semantic hint — dedicated visible row" in css
assert ".tajenka-hint-banner:not(.hidden)" in css
assert "grid-row:5!important" in css
assert "@media(max-width:600px)" in css

print("Tajenka mobile runtime fix: semantic hint visible + calm mode eligible PASS")
