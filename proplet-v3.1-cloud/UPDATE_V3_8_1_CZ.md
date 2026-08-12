# Aktualizace Proplet v3.8 → v3.8.1

## Pokud už máš v3.8 nasazenou

Nahraď na GitHubu pouze:

- `public/index.html`
- `public/app.js`
- `public/styles.css`
- `public/sw.js`
- `server.py`

Pak dej **Commit changes**. Vercel provede deploy automaticky.

**Žádné SQL a žádná změna Supabase.**

## Pokud v3.8 ještě nasazenou nemáš

Použij kompletní balík v3.8.1. Liga rodin stále vyžaduje migraci `SUPABASE_MIGRATION_V3_8.sql` z předchozího releasu.

## Kontrola

V patičce musí být `Proplet v3.8.1`. Ve hře mají být jen tlačítka **Nápověda** a **Reset**; tlačítko ↶ Zpět už nikde v herním ovládání ani tutorialu není.
