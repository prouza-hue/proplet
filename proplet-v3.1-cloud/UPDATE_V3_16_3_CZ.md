# Aktualizace Proplet na v3.16.3

V3.16.3 mění výsledkovku: každé dokončení dostane hravou pochvalu podle obtížnosti a čisté řešení získá krátký dovětek navíc.

## Databáze

Nová SQL migrace není potřeba. XP ani uložené výsledky se nemění.

## Deployment

Nasaď celý cloud balíček, nebo z update balíčku nahraď:

- `server.py`,
- `public/app.js`,
- `public/index.html`,
- `public/styles.css`,
- `public/sw.js`.

Service worker má nový cache klíč. Po nasazení přijmi v aplikaci nabídku aktualizace a jednou ji obnov.

## Kontrola po nasazení

1. Na `/api/health` ověř `version = 3.16.3`, `freeGeneration = 2`, `dailyGeneration = 2` a `database = true`.
2. V patičce ověř **Proplet v3.16.3**.
3. Dokonči jednu Snadnou a ověř krátkou klidnou pochvalu nad výsledkem.
4. Dokonči nebo znovu otevři Daily a ověř pochvalu odpovídající její obtížnosti.
5. U Těžké nebo Mozkožrouta ověř výraznější vítěznou hlášku.
6. U čistého řešení ověř doplňující větu o vyřešení bez nápovědy.
7. Na menším telefonu ověř, že je dlouhá výsledkovka s nalezenými slovy posuvná.

## Rollback

Rollback na v3.16.2 nemaže data. Vrátí pouze původní obecný titulek výsledkovky.
