from pathlib import Path


root = Path(__file__).resolve().parents[1]
density = (root / "public" / "copy-density-v3327.js").read_text(encoding="utf-8")
quality = (root / "public" / "quality-v334.js").read_text(encoding="utf-8")
runtime = (root / "public" / "runtime-meta.js").read_text(encoding="utf-8")

# Late presentation layers must preserve the Gen4 row copy rendered by app.js.
assert "main.innerHTML='<strong>Splněno</strong>" not in density
assert "Lze zahrát znovu · bez XP" not in density

# The progress ring and its caption count only boards played in the active
# generation, never historical slot transfers.
assert "freeProgress(diff).done" in density
assert "const actual=Number(data.actual||0)" in quality
assert "Nový postup ${actual}/${total}" in quality
assert "data.completed" not in quality.split("async function enrichPlayedLevels", 1)[1].split("function installHistoryWrapper", 1)[0]

# Release copy matches the fresh-start decision as well.
assert "Nový postup od jedničky" in quality
assert "Každá obtížnost začíná úrovní 1" in quality
assert "Splněné úrovně zůstávají splněné" not in quality
assert "levelOverviewRenderFixV4008:true" in runtime

print("Proplet v4.01.6 level overview late-render regression: OK")
