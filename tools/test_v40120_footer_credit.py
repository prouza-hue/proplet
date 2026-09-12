from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
footer = (ROOT / "public" / "footer-hotfix-v40120.js").read_text(encoding="utf-8")
theme = (ROOT / "public" / "theme-init.js").read_text(encoding="utf-8")
sw = (ROOT / "public" / "sw.js").read_text(encoding="utf-8")
runtime = (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
styles = (ROOT / "public" / "styles.css").read_text(encoding="utf-8")

assert "© 2026 Proplet · Česká slovní hra" in footer
assert "Pavel Prouza" in footer
assert "Proplet v5.0.0" in footer
assert 'href="/privacy.html">Soukromí</a>' in footer
assert 'href="/terms.html">Podmínky</a>' in footer
assert "Pavel & Sol" not in footer

# Visibility is owned by the application/game layout. Footer copy code must
# never override the canonical body.playing rule.
assert "body.playing header,body.playing .bottom-nav,body.playing .app-footer{display:none}" in styles
assert "footer.style.setProperty('display'" not in footer
assert "footer.style.display" not in footer
assert "footer.style.setProperty('visibility'" not in footer
assert "footer.style.visibility" not in footer

assert "/footer-hotfix-v40120.js?v=3" in theme
assert "/footer-hotfix-v40120.js?v=3" in sw
assert "footerCreditV40120:true" in runtime

print("PASS: v5 footer content remains intact and gameplay owns footer visibility")
