# Aktualizace Propletu 3.7.1 → 3.8.2

Protože tato verze zahrnuje i Ligu rodin z v3.8, postupuj takto.

## 1. Supabase — jednou

V **SQL Editor → New query** vlož celý obsah souboru:

`SUPABASE_MIGRATION_V3_8.sql`

a klikni na **Run**.

Pokud jsi migraci v3.8 už někdy spustil, není potřeba ji spouštět znovu.

## 2. GitHub

Z update balíku nahraď:

- `server.py`
- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/sw.js`

A přidej `SUPABASE_MIGRATION_V3_8.sql` jen jako dokumentaci/migrační soubor, pokud ho v repozitáři ještě nemáš.

Potom **Commit changes**. Vercel vytvoří nový deployment automaticky.

## 3. Kontrola

Otevři:

`https://proplet-nine.vercel.app/api/health`

Kontroluj hlavně:

- `globalLeagueMigration: true`
- `pushConfigured: true`
- `cronConfigured: true`

## 4. Co je nové ve v3.8.2

- Liga rodin z v3.8,
- odstraněné herní Undo z v3.8.1,
- automatická nabídka push připomínky po Denní výzvě s rytmem **hned → +1 den → +7 dní → konec**,
- PIN ligy už není potřeba pro změnu veřejného nastavení týmu; slouží jen jako pozvánka pro nové členy.

Žádná další SQL migrace nad `SUPABASE_MIGRATION_V3_8.sql` není potřeba.
