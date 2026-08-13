# Aktualizace Proplet na v3.16.2

V3.16.2 doplňuje onboarding Pomocníka a opravuje přechod hráčů, kteří pro dnešní datum dokončili ještě archivovanou Daily.

## Databáze

Nová SQL migrace není potřeba. V3.16.2 používá tabulky z `SUPABASE_MIGRATION_V3_16.sql` a mění pouze aplikační logiku.

## Deployment

Nasaď celý cloud balíček, nebo z update balíčku nahraď:

- `server.py`,
- `public/app.js`,
- `public/index.html`,
- `public/styles.css`,
- `public/sw.js`.

Service worker má nový cache klíč. Po nasazení přijmi v aplikaci nabídku aktualizace a jednou ji obnov.

## Kontrola po nasazení

1. Na `/api/health` ověř `version = 3.16.2`, `freeGeneration = 2`, `dailyGeneration = 2` a `database = true`.
2. V patičce ověř **Proplet v3.16.2**.
3. Stávajícímu hráči se jednou ukáže samostatný krok Pomocníka; nový hráč jej dostane na konci celého onboardingu.
4. Vyber například **Vyváženě** a ověř zvýrazněný popis nabídky po 70 sekundách.
5. V profilu znovu otevři Pomocníka, změň volbu a ulož ji tlačítkem.

## Pavel / Prouza — dnešní Daily

Po aktualizaci se u dnešní výzvy zobrazí informace o nové desce a tlačítko **Zahrát novou dnešní výzvu**. Pavel ji dohraje běžným způsobem. Výherní obrazovka potvrdí, že Daily je započítaná a 100 XP už bylo přiděleno dříve.

Potom ověř:

- Pavel je v dnešním pořadí týmu Prouza,
- jeho výsledek se počítá do tohoto týdne i Ligy týmů,
- celkové XP se nezvýšily o dalších 100.

Není potřeba mazat Pavlův starý výsledek ani ručně upravovat XP.

## Rollback

Rollback na v3.16.1 nemaže data, ale znovu znemožní přehrání archivované Daily pod stejným datem. Pokud už byl výsledek převeden na Gen2, zůstane v databázi platný.
