from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

version = (ROOT / 'proplet_version.py').read_text(encoding='utf-8')
runtime = (ROOT / 'public/runtime-meta.js').read_text(encoding='utf-8')
theme = (ROOT / 'public/theme-init.js').read_text(encoding='utf-8')
sw = (ROOT / 'public/sw.js').read_text(encoding='utf-8')
hotfix = (ROOT / 'public/daily-win-menu-v40123.js').read_text(encoding='utf-8')

assert 'APP_VERSION = "4.01.23"' in version
assert "version:'4.01.23'" in runtime
assert 'dailyWinMenuParityV40123:true' in runtime
assert "/daily-win-menu-v40123.js?v=1" in theme
assert "proplet-v4.01.23-shell" in sw
assert "'← Dnes'" in hotfix
assert "'← Menu'" in hotfix
assert "#winMenuBtn" in hotfix

print('PASS: Daily result return label is normalized to ← Menu, matching Free results.')
