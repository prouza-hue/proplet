# Proplet

Česká webová/PWA slovní hra. Aktuální produkční runtime je **v4.02.0** na `https://hrajproplet.cz`.

## Kanonická struktura

- `server.py` — FastAPI entrypoint.
- `backend/` — backendové doménové/infrastrukturní moduly: config, contracts, DB transport, content, progress, rankings, results a analytics.
- `public/` — web/PWA/admin runtime.
- `public/app/` — explicitní frontendové ownery pro core, game, account, content, engagement, rankings a analytics.
- `data/` — kanonické runtime/build-time content vstupy a historická evidence podle content manifestu.
- `proplet_content/` — pure content model/IO/validator.
- `tools/` — current test runner, build/generation CLI, validátory a historické release testy.
- `supabase/migrations/manifest.json` — kanonický manifest SQL lineage.
- `vercel.json` — deployment/security konfigurace.

Detailní mapa: `docs/ARCHITECTURE.md`.

## Vývoj a testy

Autoritativní current gate:

```bash
python tools/test_current.py
```

Dev/test dependencies:

```bash
python -m pip install -r requirements-dev.txt
```

Historické `tools/test_v3*.py/js` jsou ve `tests/current/manifest.json` vedené jako `legacy_evidence`; default gate je nespouští, pokud konkrétní test není explicitně povýšen do current suite.

Content build/validace:

```bash
python tools/build_runtime_content.py --check
python tools/validate_migration_manifest.py
```

Generation workflow se nespouští jako běžný test a vydané banky se neregenerují bez explicitního release rozhodnutí.

## Release flow

1. nová branch z aktuálního produkčního `main`;
2. characterization před runtime změnou;
3. current gate + cílené kontrakty;
4. review PR a Vercel preview;
5. explicitní user approval;
6. merge do `main`;
7. ověřit production deployment, `/api/health`, build log a runtime errors.

Produkční DB migrace, změny produkčních dat a content generation vyžadují zvláštní explicitní schválení.

## Migrace

`SUPABASE_SETUP.sql` je historický bootstrap, nikoli současný repair baseline. Kanonické pořadí a checksums jsou v `supabase/migrations/manifest.json`; viz `docs/SUPABASE_MIGRATION_MANIFEST.md`.

## Legacy a kompatibilita

Staré číslo verze v názvu **neznamená dead code**. Některé versioned assety jsou stále živé compatibility vrstvy načítané z `runtime-meta.js`.

Ověřený cleanup a seznam záměrně ponechaných kandidátů: `docs/LEGACY_ASSETS.md`.
