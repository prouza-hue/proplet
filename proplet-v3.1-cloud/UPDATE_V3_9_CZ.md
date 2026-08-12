# Aktualizace Propletu na v3.9

Tento postup je určený i pro přechod přímo z **v3.8.1**. Obsahuje i drobné změny z v3.8.2.

## 1. Supabase — jednou spusť migraci

1. Otevři svůj projekt v Supabase.
2. `SQL Editor` → `New query`.
3. Otevři soubor `SUPABASE_MIGRATION_V3_9.sql`.
4. Zkopíruj jeho celý obsah do editoru.
5. Klikni `Run`.

Migrace přidá avatar hráče a obnoví oficiální výsledky volných úrovní na nejstarší uložený dokončený pokus.

## 2. GitHub

Nahraď soubory z update balíčku:

- `server.py`
- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/sw.js`

a přidej pro archivaci:

- `SUPABASE_MIGRATION_V3_9.sql`

Potom `Commit changes`. Vercel vytvoří nový deployment automaticky.

## 3. Kontrola

Po deployi otevři:

`https://proplet-nine.vercel.app/api/health`

Hledej zejména:

- `"ok": true`
- `"database": true`
- `"profilesMigration": true`
- `"version": "3.9.0"`

## 4. PWA

Pokud je Proplet nainstalovaný na telefonu, použij banner `Aktualizovat`, případně aplikaci úplně zavři a znovu otevři. V patičce má být **Proplet v3.9**.

## Rychlý test

1. Profil → zvol avatar. Obnov stránku: avatar zůstane.
2. Profil → `Odhlásit hráče z tohoto zařízení`. Přihlas jiného hráče: má vlastní rozehraný stav.
3. Nový hráč → `Přidat se k týmu` → týmový PIN.
4. Existující hráč → přihlášení jménem + osobním heslem, bez PINu týmu.
5. Zkus rozehranou úroveň na mobilu i notebooku; Skládáš/Nalezeno/deska se nesmí překrývat.
6. Zopakuj už dokončenou úroveň rychleji: pořadí i historie musí dál ukazovat první dokončený pokus.
