# Aktualizace Propletu z v3.12 na v3.13

## 1. Supabase

V Supabase otevři **SQL Editor → New query** a spusť celý soubor:

`SUPABASE_MIGRATION_V3_13.sql`

Migrace nic nemaže ani nepřepočítává výsledky. Přidá pouze telemetry sloupce a tabulku týdenních QA snapshotů.

## 2. GitHub

Nahraj obsah `proplet-v3.13-update.zip` do stejného repozitáře a přepiš stejnojmenné soubory.

Commitni změny. Vercel se nasadí automaticky.

## 3. Kontrola

Otevři:

`https://proplet-nine.vercel.app/api/health`

Hledej:

- `"version": "3.13.0"`
- `"qualityAnalyticsV2": true`
- `"qualityMigration": true`
- `"pushConfigured": true` (pokud máš push nakonfigurovaný)
- `"cronConfigured": true`

V patičce bude `Proplet v3.13`.

## 4. QA dashboard

Jako přihlášený hráč otevři:

`https://proplet-nine.vercel.app/?qa=1`

Pokud je zatím málo dat, dashboard správně ukáže hlavně „čeká na data“. Alerty jsou schválně konzervativní a vznikají až při dostatečném vzorku.

## Co se nemění

- 795 puzzle je stejné jako ve v3.12,
- žádné XP ani achievementy se nepřepočítávají,
- nápovědy zatím nejsou omezené ani monetizované,
- Pomocník zatím není aktivní,
- žádná obtížnost se automaticky nepřesouvá.
