from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
css=(ROOT/'public/styles.css').read_text()
app=(ROOT/'public/app.js').read_text()
server=(ROOT/'server.py').read_text()
html=(ROOT/'public/index.html').read_text()
sw=(ROOT/'public/sw.js').read_text()
assert "const APP_VERSION='3.22.4'" in app
assert 'Proplet v3.22.4' in html
assert 'proplet-v3.22.4-unified-layout' in sw
assert '"version": "3.22.4"' in server
assert '"foldWebPwaLayoutUnified": True' in server
assert '@media (max-width:999px)' in css
assert 'grid-template-columns:minmax(0,1fr)!important' in css
assert '@media (min-width:1000px) and (min-height:650px)' in css
assert 'display-mode: standalone' not in css.lower(), 'layout must not fork for PWA standalone mode'
print('PASS: v3.22.4 unifies sub-1000px game structure across browser/PWA; desktop retains side rail')
