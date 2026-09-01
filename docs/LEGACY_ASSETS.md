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

Po implementačním commitu doplnit:

- current gate;
- asset scan;
- Vercel preview health/smoke;
- preview request-log scan na odstraněné `/server.py`;
- build/runtime error scan.
