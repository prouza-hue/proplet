# Aktualizace Propletu na v3.10

Tento balík lze nasadit **přímo z v3.8.1, v3.9 i novějšího hotfixu**.

## Pokud jsi stále na v3.8.1

1. Otevři Supabase → **SQL Editor**.
2. Spusť jednou celý soubor `SUPABASE_MIGRATION_V3_9.sql`.
3. Na GitHub nahraj/přepiš soubory z update balíku.
4. Commitni změny; Vercel nasadí novou verzi automaticky.

## Pokud už jsi v3.9 migraci spustil

SQL už nedělej. Jen nahraj/přepiš soubory z update balíku a commitni.

## Co přepsat

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/sw.js`
- `server.py`

Dokumentaci můžeš nahrát také, ale pro běh aplikace není nutná.

## Kontrola po deployi

Otevři:

`https://proplet-nine.vercel.app/api/health`

Hledej:

- `"ok": true`
- `"version": "3.10.0"`

V patičce aplikace má být **Proplet v3.10**.

## Rychlé ověření resetu

1. Spusť libovolnou Free úroveň.
2. Nech běžet čas třeba 15 sekund a udělej několik tahů.
3. Stiskni **Reset**.
4. Plocha se vyčistí, ale čas ani počet tahů se nesmí vrátit na nulu.

## Ověření postupu

Pokud máš historicky dokončenou např. Těžkou 1 a 4, ale 2 je nedokončená, karta musí nabízet **Těžká 2**. Po dokončení 2 pak 3; úroveň 4 se následně automaticky přeskočí jako již hotová.
