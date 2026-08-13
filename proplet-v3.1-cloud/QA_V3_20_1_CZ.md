# Proplet v3.20.1 — QA report

## Statické a syntaktické kontroly

- `node --check public/app.js`: PASS
- `python -m py_compile server.py`: PASS
- HTML bind contract: každý `$('#id')` použitý v `bind()` existuje v `index.html`: PASS
- `public/puzzles.json == data/puzzles.json`: PASS
- SHA-256 puzzle banky proti dodané v3.19.2: PASS

SHA-256:

`1dc3547289a0209f96fda78c993d8d12df098daf13b55d78d7edb3e5fdaa2b84`

## Onboarding viewport QA

Layout byl renderován headless Chromiumem přes vložený dokument se skutečným CSS (lokální HTTP navigaci prostředí blokuje administrátorská politika, proto byl použit `Page.setDocumentContent`).

### Propleť úplně všechno

- 360×640: bez vnitřního scrollu
- 360×740: bez vnitřního scrollu
- 320×568: bez vnitřního scrollu po úzkém responsive passu
- mezera mezi štítky a CTA: ~13–18 px podle viewportu
- demo: `PES / LES / MOC`

### Pomocník

- 360×640: bez vnitřního scrollu
- 360×740: bez vnitřního scrollu
- 390×740: bez vnitřního scrollu
- 320×568: bez vnitřního scrollu

## Výsledkovka viewport QA

Anonymní Daily mock s globálním pořadím + account CTA + všemi sekundárními akcemi:

- 360×640: bez vnitřního scrollu
- 360×740: bez vnitřního scrollu
- 320×568: velmi kompaktní responsive varianta; account CTA a hlavní CTA jsou v první části výsledku

## Funkční regresní testy

Spuštěny:

- v3.20.1 package/UI guard
- v3.20.1 account/server guard
- v3.20 1/4/10 nudge test
- v3.19.2 rescue-offer regression
- v3.19 focus/pause regression
- v3.18 Free global leaderboard regression
- v3.16.5 Daily replay regression

## Ruční post-deploy test

Po produkčním Vercel deployi doporučen krátký reálný test na telefonu, zejména návrat z vytvoření účtu do výsledkovky a refresh globálního místa. To je jediná část závislá na skutečné produkční síti/Supabase, kterou nelze plně simulovat statickým lokálním renderem.
