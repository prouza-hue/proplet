# Proplet — architecture map

Aktualizováno po technickém refactor plánu 00–16. Dokument popisuje vlastnictví, nikoli historické pořadí releasů.

## Runtime

```text
PWA / browser
  -> public/index.html
  -> theme-init.js + runtime-meta.js
  -> public/app/* domain owners
  -> FastAPI server.py
  -> backend/* services/contracts/DB transport
  -> Supabase PostgREST / RPC

Service worker
  -> offline shell / update handshake / push

Content
  data/* -> proplet_content/* + tools/build_runtime_content.py -> public runtime compatibility artifact
```

## Backend ownership

`server.py` zůstává deployment entrypoint a HTTP assembly vrstva. Níže položené odpovědnosti vlastní:

- `backend/config.py` — runtime config/version/path settings;
- `backend/contracts.py` — Pydantic HTTP contracts;
- `backend/db.py` — DB/PostgREST transport;
- `backend/content.py` — content lookup/release compatibility;
- `backend/progress.py` — progress read model;
- `backend/rankings.py` — ranking queries/services;
- `backend/results.py` — result flow service boundary;
- `backend/analytics.py` — product analytics registry validation/writer.

Feature instalátory, které ještě existují kvůli kompatibilitě, nejsou automaticky dead code.

## Frontend ownership

- `public/app/core/`
  - `api-client.js`
  - `storage.js`
  - `result-queue.js`
  - `completion-pipeline.js`
- `public/app/game/`
  - `state.js`, `board.js`, `input.js`, `hints.js`
- `public/app/account/`
  - `session.js`, `account.js`, `tajenka-storage.js`
- `public/app/content/`
  - `progression.js`, `daily.js`
- `public/app/engagement/`
  - `onboarding.js`, `nudges.js`
- `public/app/rankings/rankings.js`
- `public/app/analytics.js`

`public/app.js` zůstává kompatibilní bootstrap/orchestration vrstva; starší versioned assety mohou zůstat aktivní, pokud jsou explicitně načítané nebo plní mixed-cache/compatibility účel.

## CSS ownership

- `game.css` — game/Fold/responsive game layout;
- `results.css` — result actions/layout;
- `app-play.css` — Daily/Free discovery;
- `app-onboarding.css` — onboarding presentation;
- `app-profile-settings.css` — profile/settings/account presentation.

Některé menší versioned stylesheets zůstávají aktivní přes `theme-init.js` nebo `runtime-meta.js`. Odstraňovat je lze pouze po reachability + visual důkazu.

## Content pipeline

`content/generation-manifest.json` a `proplet_content/` oddělují input, output, schema, hash a provenance. Kanonický public compatibility build je read-only ověřitelný přes:

```bash
python tools/build_runtime_content.py --check
```

Vydaná puzzle banka se neregeneruje jako vedlejší efekt testu nebo validace.

## Tests

Autoritativní gate:

```bash
python tools/test_current.py
```

`tests/current/manifest.json` rozlišuje current suite a historical `legacy_evidence`. Generation/manual workflow nejsou součástí běžného current gate.

## Database migrations

Kanonický lineage manifest: `supabase/migrations/manifest.json`.

```bash
python tools/validate_migration_manifest.py
```

Validator je statický a DB nemění. `SUPABASE_SETUP.sql` není current baseline.

## Release safety

Každý runtime sprint: branch -> characterization -> current gate -> preview -> explicitní approval -> merge -> production health/log verification.

Viz také `docs/LEGACY_ASSETS.md`, `docs/CONTENT_GENERATION_WORKFLOW.md` a `docs/SUPABASE_MIGRATION_MANIFEST.md`.
