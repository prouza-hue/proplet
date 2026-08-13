# Proplet v3.20.2 — Portrait game guard

v3.20.2 řeší telefonní landscape během samotné hry.

## Produktové rozhodnutí

Na nízkém landscape viewportu telefonu by další zmenšování desky poškozovalo čitelnost a přesnost tahání. Proto Proplet na telefonu během aktivní hry používá **portrait-only** přístup.

Při otočení telefonu naležato se zobrazí jednoduchá celoplošná zpráva:

> Otoč telefon na výšku
>
> Na šířku se herní plocha nevejde pohodlně. Jakmile telefon otočíš, pokračuješ přesně tam, kde jsi skončil.

Současně se pozastaví herní čas. Po návratu na výšku se hra automaticky obnoví.

## Co zůstává landscape-friendly

- Dnes
- Volná hra
- Pořadí
- Profil
- výsledkovka po dokončení
- tablet a desktop

Guard se aktivuje pouze tehdy, když je zařízení identifikované jako telefon, je otevřená aktivní nedokončená hra a viewport je širší než vyšší.

## Technická bezpečnost

- žádná SQL migrace,
- žádná změna účtů, výsledků, XP, leaderboardů ani Pomocníka,
- žádná změna puzzle banky,
- při blokaci se používá stávající pause/resume mechanismus, takže je chráněná i Rescue hra.
