"""Explicit static-only support preview build. Never runs the production backend."""
from pathlib import Path
import json, re, shutil, subprocess

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
OUT = ROOT / 'support-dist'
OUT.mkdir(exist_ok=True)
CSP = "default-src 'self'; connect-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'"
for source in PUBLIC.rglob('*'):
    if not source.is_file() or source.name in {'sw.js', 'manifest.webmanifest'}:
        continue
    dest = OUT / source.relative_to(PUBLIC)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, dest)
    if source.suffix == '.css':
        css = source.read_text(encoding='utf-8')
        css = re.sub(r"@import\s+url\(['\"]https://fonts\.googleapis\.com/[^\r\n]+?\);", '', css)
        dest.write_text(css, encoding='utf-8')
font_candidates = [PUBLIC / 'assets/fonts']
font_source = next((p for p in font_candidates if (p / 'preview-fonts.css').exists()), None)
if not font_source:
    raise SystemExit('Local Fraunces/Outfit fonts missing: supply assets/fonts before building.')
font_dest = OUT / 'assets/fonts'
if font_source != font_dest:
    shutil.copytree(font_source, font_dest, dirs_exist_ok=True)
puzzles = json.loads((PUBLIC / 'puzzles.json').read_text(encoding='utf-8'))
config = json.loads((ROOT / 'tests/fixtures/browser/config.json').read_text(encoding='utf-8-sig'))
config.update(environment='preview', pushAvailable=False, version='4.05.0')
tajenka = json.loads((ROOT / 'tests/fixtures/browser/tajenka.json').read_text(encoding='utf-8-sig'))
tajenka['week'] = 9
fixtures = {'puzzles': puzzles, 'config': config, 'tajenka': tajenka}
(OUT / 'support-preview-fixtures.js').write_text('window.PROPLET_SUPPORT_FIXTURES=' + json.dumps(fixtures, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
html = (PUBLIC / 'index.html').read_text(encoding='utf-8')
prefix = '<meta http-equiv="Content-Security-Policy" content="' + CSP + '">\n<meta name="robots" content="noindex,nofollow">\n<script src="/support-preview-fixtures.js"></script>\n<script src="/support-preview-isolation.js"></script>\n<link rel="stylesheet" href="/assets/fonts/preview-fonts.css">\n'
html = html.replace('  <script src="/runtime-meta.js', prefix + '  <script src="/runtime-meta.js', 1)
html = re.sub(r'<script[^>]+src="(?:/_vercel/[^\"]+|/analytics-init\.js)"[^>]*></script>', '', html)
html = re.sub(r'<link[^>]+rel="(?:manifest|canonical)"[^>]*>', '', html)
html = html.replace('</head>', '<link rel="stylesheet" href="/support-preview.css">\n</head>')
html = html.replace('</body>', '<script src="/support-preview.js"></script>\n</body>')
(OUT / 'index.html').write_text(html, encoding='utf-8')
runtime = (PUBLIC / 'runtime-meta.js').read_text(encoding='utf-8')
runtime = runtime.replace("const canonicalOrigin='https://hrajproplet.cz';", 'const canonicalOrigin=location.origin;')
runtime = runtime.replace('const loadPushOriginGuard=()=>{', 'const loadPushOriginGuard=()=>{ return;')
(OUT / 'runtime-meta.js').write_text(runtime, encoding='utf-8')
sha = subprocess.check_output(['git', '-c', 'safe.directory=' + ROOT.as_posix(), 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
(OUT / 'support-preview-build.json').write_text(json.dumps({'baselineSha': '5ac821081a64d3b106aff997a5aa5d2b36986f05', 'sourceCommit': sha, 'builtFrom': 'public/', 'isolated': True, 'database': False, 'payments': False}, indent=2), encoding='utf-8')
print(f'Static support preview built: {OUT} (baseline {sha})')
