# Technical debt refactor status

- Sprint: integrační předěl 00–03 — Safety rails
- Branch: `refactor/s03-migration-manifest` (stack nad samostatnými checkpoint větvemi 00, 01 a 02)
- Base SHA: `e3b2ecfa7e81d74c9522d27a9ad15198497a9972` (`main`, auditovaný Proplet 4.01.35)
- Current HEAD: `02f5110` (ověřený implementační checkpoint; tento konsolidovaný handover commit následuje)
- Stav: done; povinný integrační STOP po čtyřech sprintech
- Zamýšlená změna chování: Sprint 01 zabraňuje ztrátě nově enqueueovaného výsledku při překryvu synců; Sprint 02 nahrazuje automatický reload při aktivaci service workeru explicitním update oznámením. Sprinty 00 a 03 nemění runtime ani databázi.
- Změněné soubory: 19 souborů v oblastech current gate (`.github/workflows/current-runtime.yml`, `requirements-dev.txt`, `tests/current/`, `tools/test_current.py`), result queue (`public/app/core/result-queue.js`, adaptéry v `public/app.js`, load order v `public/index.html`, precache v `public/sw.js`), bezpečný SW handshake (`public/sw.js`, `public/app.js`) a statický Supabase manifest/validator (`supabase/migrations/manifest.json`, `supabase/schema-verification.sql`, `tools/validate_migration_manifest.py`, dokumentace).
- Hotové kroky: Sprint 00 `9fed76a`; Sprint 01 `f66321e`; Sprint 02 `7a27d22`; Sprint 03 implementační checkpoint `02f5110`. Sol provedl samostatný diff review každého sprintu i celého stacku, opravil odhalené parity/first-install/lineage/validator nedostatky a ověřil čistý pracovní strom po testech.
- Zbývající kroky: Žádné v bloku 00–03. Nezačínat Sprint 04 bez nového explicitního pokračování po této pauze.
- Testy PASS: full current gate 21/21; produkční assety 72/72; Python/Node syntax 189/189; migration manifest 38/38; negativní queue, SW lifecycle/handshake a manifest fixtures; `git diff --check`; HTTP smoke `/`, `/app/core/result-queue.js`, `/sw.js`; žádný existující root `SUPABASE_*.sql` nebyl změněn.
- Testy FAIL / nespouštěné: Žádný povolený automatický test neselhal. Browser QA nebyla dostupná (v prostředí chybí browser runner a cloud browser blokuje localhost). Schema verification SQL nebylo spuštěno a k Supabase/produkční DB se nepřipojovalo.
- Nově nalezená rizika: Manifest popisuje historickou lineage, neověřuje skutečný stav připojené DB; `SUPABASE_SETUP.sql` je patchovaný historický bootstrap, nikoli současný v4.01 baseline. Refactor větve a commity jsou zatím pouze lokální — vzdálený push/PR nebyl autorizován ani proveden.
- Bezpečný bod pokračování: Aktuální čistý tip `refactor/s03-migration-manifest`; celý stack lze reprodukovat z auditního SHA a uvedených čtyř checkpointů. Žádný merge do `main`, deployment, produkční zápis ani DB migrace neproběhly.
- Další povolený sprint: 04 — Backend foundation, až po výslovném zahájení dalšího čtyřsprintového bloku; Luna implementace a Sol review podle dosavadního režimu.
