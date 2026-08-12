# Aktualizace Propletu na v3.8

## 1. Supabase — jednou

V Supabase otevři:

**SQL Editor → New query**

Zkopíruj celý obsah souboru:

`SUPABASE_MIGRATION_V3_8.sql`

a klikni **Run**.

Migrace pouze rozšíří tabulku `leagues` o dobrovolné nastavení Ligy rodin. Stávající hráči, výsledky, Daily, XP i interní rodinné ligy zůstávají beze změny.

## 2. GitHub

Nahraď soubory z update balíčku ve svém repository a dej **Commit changes**.

Důležité změněné soubory:

- `server.py`
- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/sw.js`
- `SUPABASE_MIGRATION_V3_8.sql`

Vercel se po commitu nasadí automaticky.

## 3. Kontrola

Po deployi otevři:

`https://proplet-nine.vercel.app/api/health`

Chceme vidět:

`"globalLeagueMigration": true`

Pokud je `true`, Liga rodin je připravená.

## 4. Zapojení vlastní rodiny

V Propletu:

**Pořadí → Liga rodin → Nastavení týmu**

Zadej:

- veřejný název týmu,
- PIN rodinné ligy.

U staré ligy, která ještě PIN neměla, se tímto krokem PIN poprvé nastaví.

Účast je dobrovolná a lze ji stejným PINem zase vypnout.
