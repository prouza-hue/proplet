from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
footer = (ROOT / "public" / "footer-hotfix-v40120.js").read_text(encoding="utf-8")
theme = (ROOT / "public" / "theme-init.js").read_text(encoding="utf-8")
sw = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")

assert "© 2026 Proplet · Česká slovní hra" in footer
assert "Pavel Prouza" in footer
assert "Proplet v5.0.0" in footer
assert 'href="/privacy.html">Soukromí</a>' in footer
assert 'href="/terms.html">Podmínky</a>' in footer
assert "Pavel & Sol" not in footer
assert "/footer-hotfix-v40120.js?v=2" in theme
assert "/footer-hotfix-v40120.js?v=2" in sw
assert "footerCreditV40120:true" in runtime

print("PASS: v5 footer copy, credit, version and legal links remain intact")
