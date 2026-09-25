# Mozkokalypsa — malovaný roztržený vír v2

Datum: 25. 9. 2026. Samostatný návrh nové grafické podoby; produkční reference zatím nezměněny.

## Proč změna

Dosavadní ikona skládá přebarvený rastrový disk Mozkomora s osmi jednoduchými vektorovými hroty. Geometrie hrotů má jiný materiál než malovaný střed a sousední ikonky. V2 drží směr švestkového víru s měděnými úlomky, ale kreslí celý objekt jako soudržný malovaný tvar: vrstvené spirálové pásy, inkoustové mezery, nepravidelné odštípnuté měděné hrany a teplé světlé jádro. Není to změna ostatních ikon ani vizuálního systému.

## Soubory k instalaci

- `public/difficulty/printshop/mozkokalypsa-v2.webp`: transparentní 512 × 512, 43 910 B, schválení čekající zdroj.
- `public/difficulty/printshop/mozkokalypsa-v2.svg`: samostatný SVG obal s vloženým WebP, 58 787 B, stejný viewBox jako stávající ikona. Bez externích požadavků, skriptů, fontů či filtrů.
- `tools/package_mozkokalypsa_icon_v2.py`: deterministické opětovné zabalení zdroje. Původní generátor v1 není přepsán.
- `docs/design/mozkokalypsa-v2-comparison.webp`: porovnání se dvěma sousedními ikonami a v1 na světlém a tmavém podkladu.
- `docs/design/mozkokalypsa-v2-small-sizes.webp`: kontrola při 24, 32, 48, 64 a 96 px.

Připraveno jako sousední verze. Zapojení může změnit pouze cestu k ikoně na v2; stávající ikona, měření i herní logika zůstávají beze změny. Samostatný hostovaný náhled nevznikl.

## Kontrola

Vizuálně porovnáno s aktuálními `mozkomor.webp` a `hardcore.webp` z main. Ověřeno na světlém papíru #f5f0e8 a tmavém inkoustovém podkladu #211c29. Ve 32/48/64 px je zachován světlý střed, švestkový vír a měděná roztržená silueta. Ve 24 px přirozeně mizí textura, ale kontrastní vír zůstává rozeznatelný. Alfa má rozsah 0–255, hranice neprůhledného obsahu jsou (25, 24, 498, 492) ve 512 px; žádná část není uříznuta. Ověřená je grafická podoba a balení, nikoli ještě konkrétní produkční obrazovka.

## Provenience

Vytvořeno vestavěným imagegen podle skutečných malovaných referencí `mozkomor.webp` a `hardcore.webp`; není to ruční vektorová napodobenina. Následně pouze standardní zmenšení na 512 px, WebP quality 90 a zabalení do samostatného SVG. Zdrojová generace: `generated_images/exec-bdf28702-3c01-4142-90c8-323147c212a9.png`.

Prompt: One production difficulty icon on true transparent background. Match reference painterly gouache/faceted hand-painted Proplet icons with dark plum dimensional rims. A powerful fractured vortex with broad deep-plum and dusty-mauve spiral ribbons, warm ivory small core, asymmetric copper and burnt-rose fractured flanges organically grown from the rim. Cohesive painted object, not a pasted disk plus vector spikes; not a sun, gear or shuriken. Rich confident brush facets, overlapping spiral arms and ink creases, chipped copper highlights, readable at 32px. No face, eyes, teeth, text, letters, badge frame, external glow, cast ground shadow or background. Square centered composition, transparent clearance and crisp alpha boundaries.
