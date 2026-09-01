# PROPLET — HANDOVER SPRINT 14 (IN PROGRESS)

Datum: **2026-09-01**

## Stav v jedné minutě

- Scope: pouze Sprint 14 — Canonical content build a generation manifest.
- Repo: `prouza-hue/proplet`.
- Branch: `refactor/s14-content-pipeline`.
- Base produkčního `main`: `b8de402ad676b823f72a905289945eff6f6b3e6c`.
- Remote branch HEAD před tímto handoverem: `8f12bc50dfc32349ee1a6f34884f67b8d5f6e0c`.
- Commity na remote branchi:
  1. `27f370ba2de3133092d4d3148439da473c85fe6b` — characterization;
  2. `6e55140feb78fa75da2734ef2ee7429a4f473515` — implementace;
  3. `8f12bc50dfc32349ee1a6f34884f67b8d5f6e0c7` — verification/status.
- PR **nebyl otevřen**.
- Remote CI ani Vercel preview **nebyly spuštěny**.
- Nic nebylo mergováno ani nasazeno do produkce.
- Žádný generation workflow ani generation command nebyl spuštěn.

## Ověřený live baseline

- Produkční runtime merge: `f4e5ed7455b4c09c2e303c7679dc9361dcf663c4`.
- Produkční Vercel deployment: `dpl_CSp3HZ6JZUHCBC1NKuWkbbnPgGEU`, `READY`.
- `https://hrajproplet.cz/api/health`: verze `4.01.40`, `ok=true`, `database=true`.
- `origin/main` byl těsně před vytvořením remote branche znovu ověřen a zůstal `b8de402…`.

## Byte-identita a content provenance

- `data/puzzles.json`: SHA-256 `51370983c0f8a831f2706eaf45b6130e44666fe4aa8e57e309868766475ee53a`, 2 815 720 bytes.
- `public/puzzles.json`: SHA-256 `09b2f3a4545ac1504de0e618a6bfa657f04c0d72f324dfb2b2eadff1b73504c7`, 2 817 259 bytes.
- Jediný sémantický rozdíl: public má navíc Daily `g3-d-007` (366 vs. 365).
- Public artefakt byl byte-identicky zrekonstruován z `data/puzzles.json` + `g3-d-007` z `data/archive/v3.33.5/puzzles.json.gz`.
- `data/words.txt` a `public/valid-words-v3328.txt` jsou byte-identické: SHA-256 `0ce6845aea800582202a618c7da95a16d8eaf3e43921afd1c2d77d718d835047`.
- Žádný soubor v `data/` ani `public/` není změněn oproti base.

## Implementace

- `content/generation-manifest.json` + JSON schema: inputs/outputs/hashes/sizes/Git blobs/provenance/generation metadata.
- `proplet_content/{models,io,validator}.py`: strict model, explicit atomic IO, read-only fail-closed validator.
- `tools/build_runtime_content.py`: vyžaduje `--check` nebo explicitní `--output`; i write mode nejprve ověří vydaný public artefakt a smí pouze kopírovat již byte-prokázané bytes.
- `tools/generate_puzzles.py`: CLI vyžaduje explicitní `--output`; auxiliary outputs jsou explicitní a primary bank se zapisuje poslední.
- Dokumentace: `docs/CONTENT_GENERATION_WORKFLOW.md`.
- Current Runtime workflow nově reaguje i na `content/**` a `data/**`.

## Testy a review

- Sprint 14 characterization: PASS.
- Sprint 14 pipeline: PASS.
- Canonical builder `--check`: PASS, public hash `09b2f3a4…`.
- Full local Current Runtime Gate v projektovém `.venv`: **50 PASS / 0 FAIL**.
- Assets: **76 PASS / 0 FAIL**.
- Syntax: **1081 PASS / 0 FAIL**.
- Nezávislé read-only review po opravách: bez P0/P1.

## Důležité známé limity

- Historický Lexicon V2 build použil externí reviewed green-core, který není v repu. Přiložený green-core není prokázaný jako přesný historický input; manifest proto negarantuje historickou regeneraci lexikonu, pouze pinuje vydané bytes.
- Čtyři stale Mozkomor workflow odkazují na odstraněné soubory. Nespouštět a neopravovat v tomto sprintu.
- Legacy direct writers zůstávají nekanonické; jejich plošný převod je mimo Sprint 14.
- Multi-output zápisy jsou jednotlivě atomické, ne cross-file transakční; proto se primary bank zapisuje poslední.

## Bezpečné pokračování pro Sola

1. Načíst tento handover, `PROPLET_HANDOVER_PO_SPRINTU_13B.md`, `TECH_DEBT_REFACTOR_PLAN.md`, `TECH_DEBT_AUDIT.md` a `TECH_DEBT_REFACTOR_STATUS.md`.
2. Ověřit remote branch HEAD a čistý diff proti `b8de402…`; `git diff --name-only main...branch -- data public` musí být prázdný.
3. Kvůli úspoře kreditů neopakovat inventuru ani lokální testy bez nového důvodu.
4. Pokud se bude pokračovat, otevřít review PR z `refactor/s14-content-pipeline` do `main` a ověřit pouze `current-runtime` + Vercel preview. Path filtry změn nemají spustit Gen4/Mozkomor generation workflow; před otevřením PR to znovu rychle zkontrolovat.
5. Bez explicitního schválení uživatele **nemergovat**, nespouštět generation workflow, neregenerovat banky a nezačínat Sprint 15.

## STOP

Práce byla na pokyn uživatele zastavena před PR. Další rozhodnutí patří uživateli a Solovi v Chatu.
