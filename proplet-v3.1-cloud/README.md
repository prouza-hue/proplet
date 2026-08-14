# Proplet v3.23.1

Aktuální release candidate: **v3.23.1 — Launch Ready 🚀**.

Tento sprint nepřidává novou herní mechaniku a nemění puzzle banku. Zaměřuje se na veřejný launch:

- security hardening a atomický rate limiting,
- bezpečné error handling + request ID,
- session expiry a result/attempt sanity,
- privacy boundary týmových dat,
- export a smazání účtu,
- in-app support,
- privacy/terms,
- Launch radar v administraci,
- CSP/security headers,
- launch metadata a provozní QA.

## Nasazení

**v3.23 vyžaduje SQL migraci.**

Pořadí:

1. `SUPABASE_MIGRATION_V3_23.sql`
2. `SUPABASE_VERIFY_V3_23.sql` — musí PASS
3. update ZIP do GitHub adresáře **`proplet-v3.1-cloud/`**
4. Vercel deploy
5. `/api/health`
6. production smoke podle `LAUNCH_CHECKLIST_V3_23_CZ.md`

Podrobnosti: `UPDATE_V3_23_CZ.md`, `SECURITY_AUDIT_V3_23_CZ.md`, `QA_V3_23_CZ.md`.

## v3.23.1

- Liga týmů podporuje i tým s jediným členem; skórování a privacy pravidla jsou stejná jako u větších týmů.
