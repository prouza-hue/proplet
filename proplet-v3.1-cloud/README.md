# Proplet v3.1 Cloud

Cloud-ready verze Propletu pro **Vercel + Supabase**.

- FastAPI běží jako Vercel Function.
- `public/` obsahuje PWA frontend a puzzle databázi.
- Supabase (Postgres přes Data REST API) drží hráče a výsledky.
- Citlivý `SUPABASE_SECRET_KEY` je pouze environment variable na Vercelu a není v browseru ani GitHubu.
- Daily Challenge se mění automaticky podle data v Europe/Prague a každý hráč ji může dokončit pouze jednou.
- Volná hra obsahuje 50 unikátních úloh pro každou obtížnost (150 celkem).

Začni souborem **NASAZENI_CZ.md**.

## Environment variables

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

## Databáze

Spusť `SUPABASE_SETUP.sql` v Supabase SQL Editoru.

## Lokální vývoj (volitelné)

```bash
pip install -r requirements.txt
export SUPABASE_URL='https://...supabase.co'
export SUPABASE_SECRET_KEY='sb_secret_...'
uvicorn server:app --reload
```

## Jazyková data

Viz `NOTICE.md`.
