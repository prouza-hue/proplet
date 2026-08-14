#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/'public/app.js').read_text(); html=(ROOT/'public/index.html').read_text(); css=(ROOT/'public/styles.css').read_text(); server=(ROOT/'server.py').read_text()
assert "const APP_VERSION='3.21.3'" in app
assert 'Proplet v3.21.3' in html
for token in ['landscapeGameBlocker','Otoč telefon na výšku','shouldBlockPhoneLandscape',"pauseGameClock('landscape')",'isTabletSizedViewport']:
    assert token not in app+html+css, token
assert 'updateLandscapeGameBlocker' not in app
assert "document.body.classList.remove('landscape-game-blocked')" in app
assert 'ResizeObserver' in app
assert "window.addEventListener('resize',settleViewportChange)" in app
assert "window.addEventListener('orientationchange',settleViewportChange)" in app
assert "window.visualViewport?.addEventListener?.('resize',settleViewportChange)" in app
assert '"orientationBlocking": False' in server and '"foldResponsiveReflow": True' in server
print('PASS: v3.21.3 no orientation blocker, responsive Fold/phone reflow retained')
