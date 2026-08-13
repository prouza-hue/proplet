# Aktualizace Propletu z v3.12 na v3.13

## 1. Supabase

Před nasazením spusť v **SQL Editoru** celý soubor:

`SUPABASE_MIGRATION_V3_13.sql`

Migrace přidá:

- `players.support_mode`,
- `helper_events`,
- `hint_events`.

Nic nemaže ani nepřepisuje historické výsledky.

## 2. GitHub / Vercel

Nahraj obsah `proplet-v3.13-update.zip` do stejného repozitáře a nech přepsat stejnojmenné soubory. Commitni změny; Vercel se nasadí automaticky.

## 3. Kontrola

Otevři:

`https://proplet-nine.vercel.app/api/health`

Hledej zejména:

- `"version": "3.13.0"`
- `"analyticsV2Migration": true`
- `"database": true`
- `"ok": true`

V patičce aplikace bude `Proplet v3.13`.

## 4. Test Pomocníka

V profilu **Já → Pomocník → Nastavit** zvol například `Začínající čtenář`.

Spusť normální Free nebo Denní úroveň a 45 sekund nenajdi žádné nové slovo. Objeví se jednorázová nabídka Pomocníka. Rescue režim Pomocníka nepoužívá.

## 5. Quality report

Po nasbírání dat je pro přihlášeného hráče dostupný:

`GET /api/quality-report`

Metodika je popsána v `QUALITY_ANALYTICS_V2_CZ.md`.
