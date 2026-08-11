# Proplet v3.2.2 – Vercel puzzle-data hotfix

Vercel FastAPI při nasazení přesouvá `public/` statické soubory na CDN. Python backend proto nemůže spoléhat na lokální cestu `public/puzzles.json`.

## Oprava
- backend čte `data/puzzles.json`
- `public/puzzles.json` zůstává pro frontend
- generátor zapisuje identickou databázi do obou míst
- `/api/health` nově ukazuje `puzzleFile` a `puzzleSource`

## Nasazení hotfixu
Na GitHub nahraď / přidej:
1. `server.py`
2. `data/puzzles.json`
3. volitelně `tools/generate_puzzles.py` (pro budoucí generování úloh)

Po automatickém deployi Vercelu otevři `/api/health`. Správný stav obsahuje:
`"ok": true`, `"database": true`, `"puzzleFile": true`.
