# Aktualizace Proplet → v3.14

## 1. Supabase — jednou spusť migraci

V Supabase otevři **SQL Editor → New query** a vlož celý obsah:

`SUPABASE_MIGRATION_V3_14.sql`

Klikni **Run**.

Tato migrace je záměrně kumulativní. Pokud už jsi při nasazení v3.13 spustil `SUPABASE_MIGRATION_V3_13.sql`, existující části bezpečně zachová a doplní nové checkpointy a týdenní snapshoty v3.14. Pokud jsi ji nespustil, v3.14 potřebné tabulky vytvoří také.

Stačí tedy nyní spustit **jen `SUPABASE_MIGRATION_V3_14.sql`**.

## 2. GitHub

Nahraj/přepiš soubory z update ZIPu:

- `server.py`
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/sw.js`
- `SUPABASE_MIGRATION_V3_14.sql`
- dokumentaci můžeš nahrát také

Commitni změny. Vercel se nasadí automaticky.

## 3. Kontrola

Otevři:

`https://proplet-nine.vercel.app/api/health`

Hledej zejména:

```json
"version": "3.14.0",
"analyticsV2Migration": true,
"helperSystem": true
```

V patičce aplikace má být **Proplet v3.14**.

## 4. Pomocník

Přihlášený hráč:

**Já → Pomocník → Nastavit**

Vyber jednu ze čtyř úrovní podpory.

Pro rychlý test můžeš zvolit 🐣 Začínající čtenář. Po 45 sekundách bez nového správného slova se má nabídnout malé postrčení. Pomocník se nabízí jen jednou za pokus.

## 5. QA dashboard

Jako přihlášený hráč otevři:

`https://proplet-nine.vercel.app/?qa=1`

Na začátku budou statistiky Pomocníka a nových hint eventů pochopitelně téměř prázdné. Data se začnou plnit až po v3.14.

## Co není potřeba

- žádná změna VAPID klíčů,
- žádná nová Vercel env proměnná,
- žádná regenerace puzzle,
- žádná změna XP ani žebříčků.
