# Proplet v3.5.2 — Content & Progression

Tato verze rozšiřuje obsah a přepracovává XP levely. **Nevyžaduje žádnou SQL migraci.**

## Nový obsah

Volná hra má nově 100 úrovní v každé obtížnosti:

- 100 × Snadná
- 100 × Střední
- 100 × Těžká
- 100 × Mozkožrout

Původních levelů 1–50 se změna nedotýká. Přibyly pouze levely 51–100. Daily (365) i rescue (30) zůstávají stejné.

Nových 200 levelů prošlo dvěma kontrolami:

1. exact-cover solver znovu potvrdil právě jedno úplné řešení každé desky,
2. každé cílové slovo má v nových levelech právě jednu lokální trasu — nevzniká tedy situace typu „správné slovo, ale dvě různé cesty“.

## XP roadmapa

Roadmapa má nově 32 levelů místo 10. Rozestupy jsou výrazně plynulejší, zvlášť mezi 2 500 a 10 000 XP.

Volná banka nyní obsahuje celkem 12 500 dosažitelných XP:

- Easy: 1 000 XP
- Medium: 2 000 XP
- Hard: 3 500 XP
- Mozkožrout: 6 000 XP

Další levely pokračují přes Daily až k 47 000 XP. Při jednom roce Daily + všech volných levelech je k dispozici 49 000 XP.

## Nasazení z v3.5.1

1. **Supabase neměň. Žádné SQL není potřeba.**
2. Nahraj na GitHub soubory z update balíku a přepiš jejich staré verze.
3. Dej `Commit changes`.
4. Vercel provede deployment automaticky.
5. Po zobrazení banneru nové verze v Propletu klepni na `Aktualizovat`; případně PWA úplně zavři a znovu otevři.

Důležité jsou zejména oba soubory `puzzles.json`: veřejná kopie pro frontend a serverová kopie v `data/`.
