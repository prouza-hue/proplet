from pathlib import Path


root = Path(__file__).resolve().parents[1]
app = (root / "public" / "app.js").read_text(encoding="utf-8")
styles = (root / "public" / "styles.css").read_text(encoding="utf-8")
runtime = (root / "public" / "runtime-meta.js").read_text(encoding="utf-8")

# Gen4 has its own visible progression and its own per-board XP economy.
assert "done=slots.actual.size" in app
assert "nextUnsolved=list.find(p=>!slots.actual.has" in app
assert "unplayed=list.filter(p=>!slots.actual.has" in app
assert "startStarterWarmup(){const list=sortedFreeBank('easy'),slots=localFreeSlotState('easy'),p=list.find(x=>!slots.actual.has" in app
assert "return info&&slots.actual.has(info.level)?0" in app

# An abandoned board from an older content generation must not hijack the new
# sequence, but a current Gen4 board can still resume normally.
resume_body = app.split("function resumableFreePuzzle", 1)[1].split("async function archivedFreePuzzle", 1)[0]
assert "list.find(p=>p.id===row.puzzleId)" in resume_body
assert "__archiveResume" not in resume_body

# The legacy-credit detail is short, visual and its single CTA is centred.
assert "Nová deska čeká" in app
assert "Dřívější verzi máš splněnou. Tahle je nová." in app
assert "XP za novou desku" in app
assert "Hrát novou desku" in app
assert "level-detail-actions.solo" in styles
assert "new-board-visual" in styles
assert "freshGen4FreeProgressionV4007:true" in runtime
assert "legacyBoardDetailRedesignV4007:true" in runtime

print("Proplet v4.01.4 fresh Gen4 progression and legacy-board detail: OK")
