#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
app=(ROOT/'public/app.js').read_text()
html=(ROOT/'public/index.html').read_text()
css=(ROOT/'public/styles.css').read_text()

# The starter must never force a hint or block board interaction.
assert 'starterAwaitingHint' not in app
assert 'Nejdřív klepni na Nápovědu' not in app
assert 'Nápovědu si za chvíli vyzkoušíme' not in app

# Hint is optional and can be offered non-modally after 10 s of inactivity.
assert 'function maybeOfferStarterHint()' in app
assert 'idle<10000' in app
assert 'starterHintOfferShown' in app
assert 'id="starterHintNudge"' in html
assert 'Je jen na tobě — můžeš dál normálně hrát.' in html
assert '.starter-hint-nudge' in css
assert "$('#starterHintNudgeBtn').onclick=acceptStarterHintNudge" in app
assert "$('#starterHintNudgeDismiss').onclick=dismissStarterHintNudge" in app

# Player-facing Helper wording must name the actor and the action.
assert 'Kdy se má ozvat?' not in app+html
assert 'Kdy ti má Pomocník nabídnout nápovědu?' in app+html
assert 'Ozve se po ' not in app
assert 'Pomocník se sám neozve.' not in app

# Starter result copy adapts if the player never used a hint.
assert "g.starterHintUsed?'Rovná cesta" in app
print('PASS: v3.21.2 optional starter hint and clearer Helper copy')
