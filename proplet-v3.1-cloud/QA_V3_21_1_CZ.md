# QA Proplet v3.21.1

## Root cause

V3.21 používala pro tabletový viewport `short side >= 700 px`. Reálný browser viewport rozloženého Fold7 může být výrazně nižší, takže téměř čtvercový vnitřní displej s browser chrome skončil v phone-landscape guardu.

Druhá slabina byla závislost guardu na mobilním UA. Na foldable zařízení nemusí být UA/mobile signál spolehlivý pro aktuální fyzický display mode.

## Nové testovací scénáře

- unfolded real-world small viewport: 749×654 → tablet-like, neblokovat,
- unfolded portrait-like: 654×749 → tablet-like, neblokovat,
- unfolded near-square: 750×749 → tablet-like, neblokovat,
- nominal unfolded: 984×1092 → tablet-like,
- folded cover landscape: 814×411 → phone-like, blokovat,
- folded portrait: 411×814 → neblokovat,
- desktop short window: 1000×500 + non-handheld pointer → neblokovat.

## Layout render

Na 749×654 byl samostatně vyrenderován skutečný game DOM/CSS layout:

- game grid: 547 px + 165 px pravý panel,
- board stage: 545×467 px,
- 5×5 starter board: 455×455 px,
- Hint / Reset: 165×42 px.

Na 654×749 zůstává dvousloupcový tablet layout a board stage má 450×562 px.

## Regrese

Prošly:

- v3.21 starter server test,
- v3.21 package/content integrity,
- nový v3.21.1 Fold viewport test,
- v3.19.2 Rescue offer,
- v3.19 focus pause,
- v3.18 Free global leaderboard,
- v3.16 migration suite 14/14,
- v3.16.5 Daily replay,
- v3.20 account nudges 1/4/10,
- v3.16.3 win praise,
- v3.16.4 share metadata,
- Python compile,
- JS syntax check.

`data/puzzles.json` a `public/puzzles.json` jsou bitově shodné s v3.21.
