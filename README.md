# Proplet v3.24.0

Aktuální produkční release: **v3.24.0 — Daily 2/3/2 + jednotný production root**.

## Produkční struktura

Od v3.24 je jediným zdrojem pravdy **root tohoto repozitáře**. Vercel má `Root Directory` nastavený na repository root.

Hlavní runtime části:

- `server.py` — FastAPI backend
- `public/` — web/PWA/admin
- `data/` — puzzle banky, lexikon a archivované Daily generace
- `tools/` — generátory, audity a regresní testy
- `requirements.txt` — pinované Python dependencies
- `vercel.json` — Vercel konfigurace a security headers

Adresář `proplet-v3.1-cloud/` byl historický deployment relikt a od v3.24 se nepoužívá.

## v3.24

Denní výzva má od pondělí 17. 8. 2026 pevný týdenní rytmus:

- Po–Út: Snadná
- St–Pá: Střední
- So–Ne: Těžká

Daily Generation 3 obsahuje 365 nových úloh a Generation 2 zůstává archivovaná kvůli historii a kompatibilitě starších/offline klientů.

Podrobnosti: `RELEASE_V3_24_CZ.md`, `DAILY_GENERATION3_AUDIT_CZ.md`.

## Nasazování

Běžný release:

1. změny připravit v samostatné branchi,
2. automatické testy / QA,
3. Pull Request do `main`,
4. po schválení **Squash and merge**,
5. Vercel automaticky nasadí `main` z rootu,
6. ověřit `/api/health` a základní smoke test.

Pokud release vyžaduje změnu databáze, musí být v release dokumentaci výslovně uvedena příslušná `SUPABASE_MIGRATION_*.sql` a pořadí nasazení. **v3.24 žádnou novou Supabase migraci nevyžaduje.**
