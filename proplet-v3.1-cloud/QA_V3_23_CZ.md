# QA — Proplet v3.23 Launch Readiness

## Výsledek

**Lokální release suite: PASS.**

Důležité omezení: lokální prostředí nemá PostgreSQL/Supabase a enterprise policy blokuje živou Chromium navigaci na localhost. Proto jsou produkční SQL execution a live production E2E výslovně oddělené launch gate, ne falešně označené jako lokálně otestované.

## Security / API

PASS:
- 64KB request body limit nad skutečným body,
- sanitizace/propagace request ID,
- generická 500 bez interního detailu,
- sanitizované operational metadata,
- HMAC network identity bez ukládání raw IP,
- DB rate limiter fail-closed,
- result sanity validation,
- `attempt_id` binding,
- cross-team leaderboard PII boundary,
- minimalizovaný team discovery,
- account export bez secrets,
- first-password endpoint nepřepisuje existující heslo,
- secondary session expiry,
- active-admin account deletion block,
- former-admin FK `ON DELETE SET NULL`,
- fresh-install setup bez name/team admin bootstrapu,
- housekeeping pouze nad novými technickými tabulkami.

### Exhaustivní API surface

`test_v323_api_surface.py` inventarizuje **56/56 `/api/*` routes** a každá musí být explicitně zařazena jako:
- veřejná/minimalizovaná,
- telemetry actor,
- přihlášený hráč,
- admin,
- cron secret.

Běžné mutační endpointy musí mít rate-limit nebo silnější gate.

## Privacy / account control

PASS:
- veřejná privacy + terms,
- správce/kontaktní cesta,
- účely/právní základy,
- práva uživatele,
- provider wording bez tvrzení, že všechna data nutně zůstávají v EU,
- account export,
- account deletion,
- support channel anonymní i přihlášený,
- retention text odpovídá housekeeping implementaci.

## Launch radar

PASS nad mockovanými anonymními + account daty:
- active actors 24h / 7d,
- onboarding→starter→Daily→account funnel,
- starter→account conversion,
- rolling D1,
- errors,
- rate limits,
- support queue,
- app versions,
- žádné raw actor identifiers v admin response.

## UI / browser layout

`test_v323_visual.py` používá Chromium `set_content()` s reálným HTML/CSS, protože enterprise policy prostředí blokuje localhost/file navigaci.

PASS bez horizontálního overflow:
- mobile onboarding — skutečný první krok „Najdi PES“,
- Fold dark profile + privacy controls,
- Fold support modal,
- narrow dark privacy page,
- admin Launch tab.

Výstupy: `qa-v323-visual/` v pracovním QA stromu; nejsou součástí release ZIPu.

## Velké desky / Fold regresní ochrana

PASS:
- 10×10 exact 2D fit,
- uměle zvětšený text 42px + line-height 1.45 nesmí zvětšit grid,
- v3.22.4 jednotná struktura web/PWA pod 1000 CSS px,
- orientation blocker zůstává odstraněný.

## Historické regrese

PASS:
- 14/14 Daily/Free migration + global leaderboard fairness testů,
- Daily replay,
- Rescue offer,
- focus/visibility pause,
- account nudges 1/4/10,
- optional starter hint.

## Syntax / package

PASS:
- Python compile,
- `app.js` syntax,
- `admin.js` syntax,
- `sw.js` syntax,
- HTML unique IDs,
- CSS parser,
- CSP/no-inline-JS package assertions,
- clean-install SQL parity,
- pinned runtime requirements.

## SQL v3.23

Lokální statický audit PASS:
- rerunnable `IF NOT EXISTS` / replace-style objekty,
- session expiry backfill má zdroj v `created_at NOT NULL`,
- žádný DELETE nad results/players/puzzle runs,
- housekeeping maže jen staré rate-limit/ops/resolved support řádky,
- service-only RPC privilege intent,
- clean-install setup obsahuje současný stav.

**Neověřeno lokálně:** skutečné spuštění na PostgreSQL/Supabase.  
Proto je součástí release `SUPABASE_VERIFY_V3_23.sql` a production GO vyžaduje jeho PASS po migraci.

## Integrita puzzle

Beze změny proti v3.22.4:

- `data/puzzles.json` SHA-256  
  `ae74c21be87af921bccb0386197eefc1c3274f253f15423848b98f9aeb3aea23`
- `public/puzzles.json` SHA-256  
  `ae74c21be87af921bccb0386197eefc1c3274f253f15423848b98f9aeb3aea23`
- `SUPABASE_MIGRATION_V3_21.sql` SHA-256  
  `739f0b7b48fd3c18577b25b5ded7a9ca52f7ca01520f3b70e38adfbce884bed3`

Žádný veřejný puzzle ID nebyl změněn.

## Production acceptance gate

Po deployi ještě musí PASS:
1. `SUPABASE_MIGRATION_V3_23.sql`,
2. `SUPABASE_VERIFY_V3_23.sql`,
3. `/api/health` se `securityMigration:true` a `ok:true`,
4. live account/team/support/game smoke,
5. Fold web/PWA test,
6. externí uptime monitor.
