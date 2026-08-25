from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
footer = (ROOT / "public" / "footer-hotfix-v40120.js").read_text(encoding="utf-8")
theme = (ROOT / "public" / "theme-init.js").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
version = (ROOT / "proplet_version.py").read_text(encoding="utf-8")
sw = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")

assert "Upleteno s ❤️ v roce 2026" in footer
assert "Pavel Prouza" in footer
assert "Pavel & Sol" not in footer
assert "/footer-hotfix-v40120.js?v=1" in theme
assert 'APP_VERSION = "4.01.20"' in version
assert "version:'4.01.20'" in runtime
assert "footerCreditV40120:true" in runtime
assert "proplet-v4.01.20-shell" in sw

print("PASS: v4.01.20 footer credit copy and release metadata")
