from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
hard = (ROOT / "public" / "difficulty" / "hard.svg").read_text(encoding="utf-8")
hardcore = (ROOT / "public" / "difficulty" / "hardcore.svg").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
version = (ROOT / "proplet_version.py").read_text(encoding="utf-8")
sw = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")

assert "#ff5d2f" in hard and "#ffc447" in hard and "#fff8cf" in hard
assert "#a93657" in hardcore and "#ed7582" in hardcore and "#ff9ca6" in hardcore
assert 'APP_VERSION = "4.01.25"' in version
assert "version:'4.01.25'" in runtime
assert "difficultyIconPolishV40121:true" in runtime
assert "proplet-v4.01.25-shell" in sw

print("PASS: v4.01.21 polished Těžká and Mozkožrout icons with fresh PWA shell")
