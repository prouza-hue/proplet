# Proplet v3.24.0 — sedmidenní Daily rytmus

## Co se mění

Od **pondělí 17. 8. 2026** má Denní výzva pevný kalendářní týden:

- **Pondělí:** Snadná
- **Úterý:** Snadná
- **Středa:** Střední
- **Čtvrtek:** Střední
- **Pátek:** Střední
- **Sobota:** Těžká
- **Neděle:** Těžká

Každé pondělí se rytmus vrací na začátek. Na obrazovce Dnes je rytmus zobrazen jen jako malý orientační proužek; hlavní roli dál drží samotná Denní výzva.

## Daily Generation 3

Pro nový rytmus vznikla kompletní nová banka **365 Daily úloh** s novými ID `g3-d-001` až `g3-d-365`.

Důvodem není jen změna pořadí obtížností: původní Gen2 obsahovala 61 snadných Daily, což by pro dvě snadné úlohy týdně nestačilo na celý rok bez nežádoucího opakování. Gen3 proto vznikla z aktuálního Lexiconu v2 znovu a zachovává stejné generátorové a solverové bezpečnostní podmínky.

Rozložení celé 365denní rotace:

- **105× Snadná**
- **156× Střední**
- **104× Těžká**

## Bezpečný přechod a historie

- Do **16. 8. 2026 včetně** zůstává primární Daily Generation 2.
- Od **17. 8. 2026** je primární Generation 3.
- Gen2 je plně archivovaná v `data/legacy_daily_gen2.json` a její ID zůstávají serverem rozpoznatelná kvůli starším/offline PWA klientům.
- Historické výsledky se nepřepisují a žádné veřejné puzzle nedostalo jiný obsah pod stejným ID.
- Leaderboard používá vždy primární generaci příslušného data, takže výsledky různých desek nesmíchává.
- Budoucí Gen3 ID server nepřijme pro datum před 17. 8. 2026.
- Free a Rescue banky zůstávají proti v3.23.1 beze změny.

## Release audit

`DAILY_GENERATION3_AUDIT.json` a `DAILY_GENERATION3_AUDIT_CZ.md` potvrzují:

- **365 / 365** aktivních Gen3 Daily znovu ověřeno exact-cover solverem,
- každá úloha má právě jedno úplné řešení,
- 0 kolizí aktivních ID s Gen2, Free nebo Rescue,
- minimální kruhový rozestup opakování stejného cílového slova: **25 dní**,
- **1 330** různých cílových slov,
- průměrná hodnota `fun`: **3,27**,
- Tier A/B/C: **907 / 1 651 / 328** odpovědí,
- `data/puzzles.json` a `public/puzzles.json` jsou totožné.

GitHub Actions navíc před commitem ověřuje, že Free a Rescue banka jsou shodné s `main`, kontroluje syntaxi `server.py` i `public/app.js` a hlídá přechodové metadata.

## Další drobná oprava

Součástí v3.24 je i oprava čitelnosti vyřešených slov ve výsledkovém dialogu v tmavém režimu. Výsledková slova nyní používají stejný barevný token a kontrastní logiku jako nalezená slova během hry.

## Nasazení

**Bez nové Supabase migrace.** Jde o změnu aplikační logiky, UI a puzzle banky.
