from pathlib import Path

replacements = {
    'server.py': [
        ('APP_VERSION = "3.27.1"', 'APP_VERSION = "3.27.2"'),
    ],
    'public/app.js': [
        ("const APP_VERSION='3.27.1';", "const APP_VERSION='3.27.2';"),
    ],
    'public/sw.js': [
        ("const CACHE='proplet-v3.27.1-icon-refine';", "const CACHE='proplet-v3.27.2-hardcore-crimson';"),
    ],
    'public/styles.css': [
        ('difficulty-card[data-diff="hardcore"]{--diff:#8e44d6;--diff-soft:#f0dcff;background:linear-gradient(145deg,#fffefd 0%,#faf2ff 72%,#f1e2ff 100%);border-color:#dfc8f0}', 'difficulty-card[data-diff="hardcore"]{--diff:#941522;--diff-soft:#f8e4e7;background:linear-gradient(145deg,#fffefd 0%,#fff5f6 72%,#f9e3e6 100%);border-color:#ecc5cb}'),
        ('difficulty-card[data-diff="hardcore"]:before{content:"EXTRA";position:absolute;right:13px;bottom:61px;padding:4px 7px;border-radius:999px;background:#2d2039;color:#fff;', 'difficulty-card[data-diff="hardcore"]:before{content:"EXTRA";position:absolute;right:13px;bottom:61px;padding:4px 7px;border-radius:999px;background:#4b1019;color:#fff;'),
        ('difficulty-card[data-diff="hardcore"] .difficulty-icon{filter:drop-shadow(0 5px 9px rgba(119,58,157,.18))}', 'difficulty-card[data-diff="hardcore"] .difficulty-icon{filter:drop-shadow(0 5px 9px rgba(148,21,34,.18))}'),
        ('difficulty-card[data-diff="hardcore"]{--diff:#a04bd8;--diff-soft:#f2e2fb}', 'difficulty-card[data-diff="hardcore"]{--diff:#941522;--diff-soft:#f8e4e7}'),
        ('quick-game[data-diff="hardcore"]{--q:#a04bd8;--qs:#f5eafb}', 'quick-game[data-diff="hardcore"]{--q:#941522;--qs:#f8e4e7}'),
        ('html[data-theme="dark"] .difficulty-card[data-diff="hardcore"]{--diff:#d49aff;--diff-soft:#3b2948;background:linear-gradient(145deg,#211d2d 0%,#282032 72%,#2d2138 100%);border-color:#493857}', 'html[data-theme="dark"] .difficulty-card[data-diff="hardcore"]{--diff:#ee6974;--diff-soft:#452128;background:linear-gradient(145deg,#211d24 0%,#2b1d22 72%,#341f25 100%);border-color:#5c3038}'),
        ('html[data-theme="dark"] .difficulty-card[data-diff="hardcore"]:before{background:#352541;color:#e8ccff}', 'html[data-theme="dark"] .difficulty-card[data-diff="hardcore"]:before{background:#4b2028;color:#ffc4ca}'),
        ('html[data-theme="dark"] .quick-game[data-diff="hardcore"]{--q:#d49aff;--qs:#3b2948}', 'html[data-theme="dark"] .quick-game[data-diff="hardcore"]{--q:#ee6974;--qs:#452128}'),
        ('difficulty-card[data-diff="hardcore"]{--diff:#8b5ddd;--diff-soft:#efe7ff}', 'difficulty-card[data-diff="hardcore"]{--diff:#941522;--diff-soft:#f8e4e7}'),
        ('html[data-theme="dark"] .difficulty-card[data-diff="hardcore"]{--diff:#bd92ff;--diff-soft:#372b4d}', 'html[data-theme="dark"] .difficulty-card[data-diff="hardcore"]{--diff:#ee6974;--diff-soft:#452128}'),
    ],
    'public/home-layout.css': [
        ('home-continue[data-diff="hardcore"],.home-diff-tile[data-diff="hardcore"]{--q:#a04bd8;--qs:#f5eafb}', 'home-continue[data-diff="hardcore"],.home-diff-tile[data-diff="hardcore"]{--q:#941522;--qs:#f8e4e7}'),
        ('html[data-theme="dark"] .home-continue[data-diff="hardcore"],html[data-theme="dark"] .home-diff-tile[data-diff="hardcore"]{--q:#d49aff;--qs:#3b2948}', 'html[data-theme="dark"] .home-continue[data-diff="hardcore"],html[data-theme="dark"] .home-diff-tile[data-diff="hardcore"]{--q:#ee6974;--qs:#452128}'),
    ],
}

for filename, pairs in replacements.items():
    p = Path(filename)
    text = p.read_text(encoding='utf-8')
    for old, new in pairs:
        count = text.count(old)
        if count != 1:
            raise SystemExit(f'{filename}: expected exactly one match, got {count}: {old[:100]}')
        text = text.replace(old, new)
    p.write_text(text, encoding='utf-8')

print('v3.27.2 patch applied')
