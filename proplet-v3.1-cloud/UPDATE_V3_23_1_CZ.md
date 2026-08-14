# Aktualizace Propletu v3.22.4 → v3.23.1

## DŮLEŽITÉ: pořadí nasazení

v3.23 obsahuje databázovou bezpečnostní migraci. Správné pořadí je:

**1. Supabase migrace → 2. Supabase verify → 3. GitHub/Vercel deploy → 4. health → 5. smoke test.**

Aplikaci 3.23 nenasazuj před úspěšnou migrací+verify.

## 1. Supabase

V Supabase → SQL Editor spusť celý:

`SUPABASE_MIGRATION_V3_23.sql`

Po úspěchu okamžitě spusť:

`SUPABASE_VERIFY_V3_23.sql`

Na konci musí vrátit objekt s:

```json
{
  "verification": "PASS",
  "version": "3.23.1",
  "adminAuditDeleteRule": "SET NULL",
  "rateLimiterProbe": true,
  "serviceOnlyRpcs": true
}
```

Pokud verify skončí chybou, **zastav deploy aplikace**.

## 2. GitHub / Vercel

Rozbal `proplet-v3.23.1-update.zip` a nahraj/přepiš obsah uvnitř:

**`proplet-v3.1-cloud/`**

Ne do rootu repozitáře.

Commitni změny a počkej na Vercel Production deployment.

## 3. Health

Otevři `/api/health`.

Očekávej zejména:

```json
{
  "version": "3.23.1",
  "launchReadinessSprint": "3.23",
  "publicErrorDetails": false,
  "apiDocsPublic": false,
  "requestBodyLimitKb": 64,
  "secondarySessionDays": 180,
  "securityHeaders": true,
  "accountExport": true,
  "accountDeletion": true,
  "supportChannel": true,
  "launchDashboard": true,
  "singleMemberTeams": true,
  "securityMigration": true,
  "ok": true
}
```

## 4. Povinný production smoke

Postupuj podle `LAUNCH_CHECKLIST_V3_23_CZ.md`. Minimum před veřejným provozem:
- account create/login,
- data export,
- disposable account delete,
- cross-team leaderboard privacy 403,
- anonymní support report,
- admin Launch radar,
- starter + Daily + Free,
- Fold web/PWA portrait/landscape,
- light/dark,
- PWA update.

## Databázová změna

v3.23 přidává:
- expiry/last-used pro secondary sessions,
- service-only rate-limit tabulku + RPC,
- operational events,
- support reports,
- service-only housekeeping RPC,
- `admin_audit_log.admin_player_id` mění na nullable + `ON DELETE SET NULL`.

Nemění ani nemaže puzzle, results nebo XP.

## Co před launchi ještě není „vyřešeno kódem“

- nakonfigurovat externí uptime monitor na `/api/health`,
- případně rozhodnout/custom doménu a při změně upravit metadata,
- skutečný produkční smoke je nutný — lokální prostředí nemůže emulovat produkční Supabase/Vercel 1:1.

## v3.23.1 — jednočlenné týmy

Liga týmů nově přijímá i tým s jediným členem. Není k tomu potřeba další SQL; jde pouze o aplikační pravidlo skórování/eligibility.
