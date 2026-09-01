# Legacy/dead asset evidence — Sprint 16

Base: `5edd2bc847153ef50a5226c080e1e79243d96000`.

Zásada: staré číslo verze není důkaz dead code. Soubor se odstraňuje pouze s reachability/compatibility důkazem.

## Odstraněno

| Soubor | Důkaz | Rollback |
| --- | --- | --- |
| `public/server.py` | GitHub reference scan: žádný loader/import/workflow/reference; produkční load chain (`index.html`, `theme-init.js`, `runtime-meta.js`, `sw.js`, `vercel.json`) neobsahuje `/server.py`; root `server.py` je skutečný FastAPI runtime entrypoint. Soubor v `public/` byl pouze historická staticky publikovaná kopie. | obnovit z base SHA přes Git |
| `tools/__pycache__/generate_puzzles.cpython-313.pyc` | generovaný Python bytecode, žádná runtime/reference potřeba | obnovit z base SHA přes Git; prakticky má být znovu vygenerován lokálním Pythonem, ne verzován |
| `tools/__pycache__/test_v317_admin.cpython-312.pyc` | generovaný Python bytecode, žádná runtime/reference potřeba | stejné |

Repo nyní ignoruje `__pycache__/` a `*.py[cod]`.

## Auditní kandidáti, kteří jsou ve skutečnosti LIVE

Tyto soubory se **nesmí** odstranit bez samostatného budoucího důkazu:

- `public/p0-hotfix-v3336.js`
- `public/p0-hotfix-v3336.css`
- `public/push-origin-v3325.js`
- `public/quality-hotfix-v334.css`

Současný `public/runtime-meta.js` je dynamicky načítá; navíc je chrání current testy.

## Neodstraněno — zatím pouze „unreferenced candidate“

Reference scan dnes nenašel produkční loader/import pro:

- `public/game-layout-v3323.js`
- `public/release-notes.js`
- `public/release-notes.css`
- `public/valid-word-feedback-v3328.js`

Audit ale výslovně upozornil na možné historické přímé QA URL. Bez dostatečného request-log/compatibility důkazu zůstávají v repu. Sprint 16 preferuje menší cleanup před falešně jistým mazáním.

## Test lifecycle

`tests/current/manifest.json` má explicitní `legacy_evidence` kategorii pro historické release/regression testy. Vybrané starší testy mohou být explicitně current, pokud stále chrání dnešní chování.

Staré testy se nemažou ani „neopravují do zelena“ jen kvůli historickému stáří.

## Preview evidence

Implementation HEAD: `5eeadbdecd38aa5603b4da939143c4df2a463e77`.

- Current tests: **53 PASS / 0 FAIL**.
- Asset scan: **77 PASS / 0 FAIL** (69 local references).
- Syntax: **241 PASS / 0 FAIL**.
- Vercel preview deployment `dpl_9aeEcy8PKkGe75K44DAMfmrNVxLq`: **READY**.
- Preview root: HTTP 200.
- Preview `/api/health`: HTTP 200, Proplet `4.01.40`, `ok=true`, `database=true`.
- Build error scan: clean.
- Preview runtime `error/fatal`: no logs.
- Before the deliberate removal check, preview request-log scan found **no request to `/server.py`**.
- Deliberate `GET /server.py` returns **404 Not Found**, proving the historical backend source is no longer publicly served.
