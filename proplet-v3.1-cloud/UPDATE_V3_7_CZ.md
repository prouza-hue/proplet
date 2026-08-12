# Aktualizace Propletu na v3.7

## Část A — nutné kroky

### 1. Supabase

1. Otevři svůj projekt Proplet v Supabase.
2. Vlevo klikni **SQL Editor → New query**.
3. Z tohoto balíčku otevři `SUPABASE_MIGRATION_V3_7.sql`.
4. Zkopíruj celý obsah do SQL Editoru.
5. Klikni **Run**.
6. Pokud nevidíš červenou chybu, pokračuj dál.

Migrace vytvoří:
- `leagues`
- `puzzle_runs`
- `push_subscriptions`

a převede starší výsledky do historie běhů pro žebříčky jednotlivých úrovní.

### 2. GitHub

Nahraď ve svém repository soubory z update balíčku. Nejdůležitější jsou:

- `server.py`
- `requirements.txt`
- `vercel.json`
- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/sw.js`
- `public/puzzles.json`
- `data/puzzles.json`

Pak dej **Commit changes**.

Vercel vytvoří nový deployment automaticky.

### 3. Kontrola

Po deployi otevři:

`https://proplet-nine.vercel.app/api/health`

Chceme vidět zejména:

- `"ok": true`
- `"database": true`
- `"playtestMigration": true`
- `"puzzleFile": true`

`pushConfigured` může být zatím `false` — push je volitelný a nastavuje se níže.

### 4. PWA

Pokud máš Proplet nainstalovaný na telefonu, otevři ho. Jakmile se objeví nabídka nové verze, klepni **Aktualizovat**. Pokud se neobjeví, aplikaci úplně zavři a znovu otevři.

V3.7 jednou znovu spustí povinný tutorial i stávajícím hráčům, protože jsme podle playtestu změnili pravidlo prvního onboardingu.

---

# Část B — volitelné denní notifikace

Bez této části funguje úplně všechno kromě mobilního připomenutí nové Denní výzvy.

Web Push potřebuje jednorázovou dvojici VAPID klíčů.

## 1. Vygeneruj klíče

Na počítači otevři terminál ve složce kompletního Propletu v3.7 a spusť:

```bash
python -m pip install cryptography
python tools/generate_vapid_keys.py
```

Dostaneš dvě dlouhé hodnoty:

- `VAPID_PUBLIC_KEY=...`
- `VAPID_PRIVATE_KEY=...`

**Soukromý klíč nikdy nenahrávej na GitHub.** Patří pouze do Environment Variables ve Vercelu.

## 2. Vercel Environment Variables

Vercel → projekt Proplet → **Settings → Environment Variables**.

Přidej:

- `VAPID_PUBLIC_KEY` = veřejná hodnota z generátoru
- `VAPID_PRIVATE_KEY` = soukromá hodnota z generátoru
- `VAPID_SUBJECT` = `https://proplet-nine.vercel.app`
- `CRON_SECRET` = libovolný dlouhý náhodný tajný řetězec, ideálně alespoň 16 znaků

Pro CRON_SECRET si můžeš v terminálu vyrobit hodnotu třeba:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Potom ve Vercelu udělej **Redeploy** posledního deploymentu.

## 3. Kontrola push

Znovu otevři `/api/health`.

Teď chceme navíc:

- `"pushConfigured": true`
- `"cronConfigured": true`

V profilu Propletu se pak zpřístupní **Nový Proplet na mobil → Zapnout denní připomínku**.

Proplet požádá Android o oprávnění až po klepnutí na toto tlačítko. Každý telefon/notebook si vytváří vlastní odběr.

## Poznámka k času

`vercel.json` spouští připomínku jednou ráno (`0 7 * * *` v UTC). Server před odesláním kontroluje, kdo už dnešní Denní výzvu dokončil, a těm push neposílá.
