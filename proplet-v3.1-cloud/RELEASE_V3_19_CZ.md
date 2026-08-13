# Proplet v3.19 — druhá stovka Free úrovní

V3.19 rozšiřuje každou Free obtížnost ze 100 na 200 úrovní. Přidává tedy 400 nových desek a aktivní Free banka má celkem 800 úrovní.

## Nový obsah

- 100 nových Snadných, Středních, Těžkých a Mozkožroutů jako úrovně 101–200,
- původní úrovně 1–100 zůstávají přesně stejné včetně ID a leaderboardů,
- Daily, Rescue a legacy archiv se obsahově nemění,
- anti-repeat pokračuje přes hranici 100/101 a stejné slovo se vrátí nejdříve po 24 mezilehlých úrovních.

## Klidnější Mozkožrout

Nová stovka Mozkožroutů má stále stejnou velkou a zakroucenou geometrii, ale méně obskurní slovní zásobu. Tier D tvoří přibližně 32–43 % každé desky a vybírá se pouze z ručně zúžené množiny 225 rozpoznatelných či snadno představitelných výrazů. `NOCEBO`, `MASTABA` a další úzké odborné kuriozity jsou pro tuto sadu zablokované.

## Automatická pauza

Časomíra se zastaví, jakmile hráč přepne do jiné aplikace, skryje kartu nebo okno ztratí focus. Po návratu pokračuje od stejného času. Platí to pro Free, Daily i záchranu série. Rozpracované Daily už nepoužívá wall-clock čas.

## Postup, XP a achievementy

- dosavadní postup, výsledky, XP a achievementy zůstávají,
- úrovně 101–200 jsou nové XP sloty a odměnu dávají právě jednou,
- přibyly závěrečné achievementy za všech 200 úrovní v každé obtížnosti a celkový milník 800 her,
- původní achievementy za 100 zůstávají jako mezníky.

## Audit

Nezávislý audit ověřil právě jedno úplné řešení všech 400 nových desek. Současně potvrdil unikátní cesty cílových slov, tier policy, konzervativní Tier D, anti-repeat, unikátní ID a nulovou změnu původní Free stovky, Daily, Rescue i legacy archivu. Výsledek je `PASS 400/400`; podrobnosti jsou v `FREE_EXTENSION_V3_19_AUDIT_CZ.md`.
