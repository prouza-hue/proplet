# Proplet v3.10.1 — hotfix profilu

## Co se mění
- Hodnost v sekci Já zobrazuje číslo, ikonu i název.
- Hotovo je rozděleno na Snadnou, Střední, Těžkou a Mozkožrout.
- Výzvy jsou přejmenované na Denní výzvy.
- Verze aplikace je v3.10.1.

## Nasazení
Žádná SQL migrace není potřeba.

Nahraj/přepiš:
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/sw.js`
- `server.py`

Commitni změny na GitHubu a nech Vercel deploynout novou verzi.
Po deployi `/api/health` vrátí `"version": "3.10.1"`.
