# Aktualizace Proplet v3.14 → v3.15

## 1. Supabase

Otevři **Supabase → SQL Editor → New query** a spusť celý obsah:

`SUPABASE_MIGRATION_V3_15.sql`

Migrace dovolí Quality Analytics bezpečně ukládat buď `player_id`, nebo anonymní hash a přidá malou tabulku produktového funnelu.

## 2. GitHub

Z update ZIPu přepiš/nahraj:

- `server.py`
- `public/app.js`
- `public/index.html`
- `public/sw.js`
- `SUPABASE_MIGRATION_V3_15.sql`
- dokumentaci můžeš nahrát také

Commitni změny. Vercel nasadí novou verzi automaticky.

## 3. Kontrola

Otevři:

`https://proplet-nine.vercel.app/api/health`

Hledej:

```json
"version": "3.15.0",
"analyticsV2Migration": true,
"anonymousAnalyticsMigration": true,
"anonymousAnalytics": true
```

Patička má ukazovat **Proplet v3.15**.

## 4. Praktický test anonymní telemetry

1. Otevři Proplet v anonymním/inkognito okně nebo v jiném browseru bez přihlášení.
2. Dokonči jednu Free úroveň a klidně ji ohodnoť Lehčí/Akorát/Těžší.
3. V normálním přihlášeném Propletu otevři `/?qa=1`.
4. Po obnovení QA dat se má zvýšit počet anonymních prvních pokusů.

## 5. Test žebříčku

Jako přihlášený hráč dokonči Free úroveň. Po otevření výsledkovky se nesmí ani na okamžik zobrazit žebříček předchozí úrovně. Nejdřív uvidíš **Aktualizuji pořadí…**, potom čerstvá data.

## Není potřeba

- měnit VAPID klíče,
- měnit Vercel env proměnné,
- regenerovat puzzle,
- měnit XP nebo nápovědy.
