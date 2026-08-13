# Proplet v3.20.1 — dotažení onboardingu a výsledkovky

v3.20.1 je malý UX hotfix nad v3.20. **Nemění puzzle, XP, pořadí, účetní model ani databázové schéma.**

## Onboarding

- Druhý krok `Propleť úplně všechno` už nebarví náhodné kombinace písmen. Ukázka je přesně **PES / LES / MOC** — tři skutečná slova, která vyplní všech devět políček.
- Štítky `Bez diagonál` a `Celá plocha` mají větší odstup od tlačítka Pokračovat.
- Krok Pomocníka je kratší a kompaktnější: 2×2 volby, kratší text a krátké potvrzení zvolené varianty.
- Pomocník se ve statickém viewport QA vejde bez vnitřního scrollu i při 320×568 px.

## Výsledek anonymního hráče

Přímo pod globálním pořadím je nově plnošířkové CTA:

**☁️ Uložit postup a zobrazit své místo**

Otevře vytvoření účtu. Po úspěšném vytvoření/přihlášení se anonymní data claimnou stejně jako dosud, čekající výsledek se synchronizuje a hráč se vrátí do výsledkovky s obnoveným pořadím.

Nové nízkoobjemové funnel eventy:

- `win_account_cta_shown`
- `win_account_cta_create`
- `win_account_cta_authenticated`

## Méně tlačítkového šumu

- `Vybrat další hru / Hraj další úroveň` zůstává jediná dominantní fialová akce.
- `Sdílet / Znovu / Dnes|Menu` jsou jedna kompaktní utility řádka.
- `Nalezená slova` a `Divné slovo?` jsou součástí jednoho rozbalovacího `Detaily výsledku`.
- Rating obtížnosti zůstává dostupný, ale je o něco nižší a úspornější.

## Kompatibilita

- 1. / 4. / 10. account nudge zůstává beze změny.
- Account-without-team a pozdější přidání týmu zůstává beze změny.
- Rescue, Daily/Free globální pořadí a pause při hidden/blur zůstávají zachované.
- `data/puzzles.json` a `public/puzzles.json` mají stejný SHA-256 jako v3.19.2/v3.20:
  `1dc3547289a0209f96fda78c993d8d12df098daf13b55d78d7edb3e5fdaa2b84`
