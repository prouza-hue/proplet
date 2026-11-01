# Samostatnost v měsíční soutěži — UI v3

Datum rozhodnutí a implementace: 1. 11. 2026. Výchozí produkční main `3a9274e` (v4.10.2), pracovní větev `codex/monthly-independence-v3`. Uživatel schválil skutečnou změnu výpočtu a přepočet listopadu. Tento záznam popisuje UI implementaci a místní ověření; produkční migraci, přepočet, CI a nasazení koordinuje backendový agent.

Nová denní formule je 55 za dokončení + samostatnost max(25 − 5 × nápovědy, 0) + ověřená rychlost 0–20. Pravidla uvádějí přímo 25/20/15/10/5/0 bodů pro 0/1/2/3/4/5+ nápověd. Obrazovka čte novou serverovou položku `independencePoints`; nepočítá si denní skóre sama. Při explicitní historické v2 použije původní serverové `cleanPoints + hintPoints` a původní křivku 25/7/4/1/0. Historická v1 zachovává 100/120 a maximum 2 400. Kritéria shody včetně skutečného čistého řešení a počtu nápověd se nemění.

Fixture a existující aktivní UI test pokrývají v3, všechny počty nápověd 0–5, přednost serverové samostatnosti před starými poli i její nulovou hodnotu. Nový řádek s jednou nápovědou ukazuje 95 = 55 + 20 + 20; bez nápovědy zůstává 90 = 55 + 25 + 10. Fixture správně vybírá lepší den za 95 do nejlepší dvacítky a vyřazuje jeden den za 90. V1 i V2 jsou testované podle obou explicitních serverových příznaků verze. Layout, Dnes, herní deska, patronství a další XP ekonomika se nemění.

Koordinovaná verze je v4.10.3, shell/app cache `proplet-v4.10.3-monthly-independence3`, app/theme token `41003monthly-independence3`, runtime `41003`, měsíční modul `monthly-independence3`. Nezměněné CSS, novinkový skript i ostatní assety zachovávají své URL. Nový online statický náhled se nevytváří.
