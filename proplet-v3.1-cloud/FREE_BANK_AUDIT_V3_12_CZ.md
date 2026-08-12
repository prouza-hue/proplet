# Proplet v3.12 — audit přestavby Free banky

## Bezpečnostní freeze

Produkční manifest obsahoval **93 puzzle ID**, která byla alespoň jednou spuštěna nebo dokončena. ID byla namapována proti aktivním i historickým (`legacyFree`) bankám.

Pro maximální bezpečnost se nezmrazují jen jednotlivá hraná ID, ale celý souvislý začátek každé obtížnosti až po nejvyšší dohledanou hranou úroveň:

| Obtížnost | Zmrazeno | Nově přestavěno |
|---|---:|---:|
| Snadná | 1–54 | 55–100 (46 úrovní) |
| Střední | 1–50 | 51–100 (50 úrovní) |
| Těžká | 1–10 | 11–100 (90 úrovní) |
| Mozkožrout | 1–11 | 12–100 (89 úrovní) |
| **Celkem** | **125** | **275** |

Staré `h-017` pochází z pre-sekvenční historické Hard banky a nemá metadata čísla úrovně. Je už uložené v `legacyFree`, takže zůstává resolvovatelné a není důvod podle něj měnit současnou freeze hranici.

### Ověření freeze

- všech 125 zmrazených aktivních úrovní je **bitově identických s v3.11**,
- všech 93 produkčně hraných ID je i po přestavbě dohledatelných v aktivní, Daily nebo legacy bance,
- Daily banka je proti v3.11 **beze změny**,
- Rescue banka je proti v3.11 **beze změny**.

## Nový obsah

Celý bezpečně nehraný ocas Free banky byl vytvořen jednotným v3.12 generátorem. Cílové odpovědi pocházejí výhradně z ručně kurátorovaných tierů A–D.

| Obtížnost | Nových úloh | Odpovědí | Tier mix |
|---|---:|---:|---|
| Snadná | 46 | 288 | A: 288 |
| Střední | 50 | 368 | A: 124, B: 244 |
| Těžká | 90 | 936 | B: 400, C: 536 |
| Mozkožrout | 89 | 1 157 | C: 557, D: 600 |

Těžká i Mozkožrout nadále mají nejvýše **dvě čtyřpísmenná slova na úroveň**.

## Anti-repeat

Generování pracuje s bankou jako celkem, ne jen s každou deskou izolovaně. Při volbě odpovědí preferuje dosud méně použitá slova a přísně blokuje slova z předchozích osmi úrovní.

Výsledek v nově přestavěné části:

- Snadná: **0** opakování v předchozích 8 úrovních,
- Střední: **0**,
- Těžká: **0**,
- Mozkožrout: **0**.

## Nezávislá validace

Po dokončení generování byl spuštěn samostatný audit nad všech **275 nových Free úrovní**:

- tier policy: **275/275 PASS**,
- jediná lokální cesta každého cílového slova: **275/275 PASS**,
- jediné kompletní exact-cover řešení: **275/275 PASS**,
- aktivní puzzle: **795**,
- unikátní aktivní ID: **795**,
- unikátní signatury desek: **795**,
- `data/puzzles.json` = `public/puzzles.json`: **ano**.

Strojový report: `FREE_BANK_AUDIT_V3_12.json`.

## Důležitá zásada do budoucna

Puzzle, které bylo někdy veřejně spuštěno, se už obsahově nemění. Nová generace dostává nové ID (`e12-*`, `m12-*`, `h12-*`, `x12-*`) a nahrazované starší ID zůstává v `legacyFree`, pokud je potřeba pro kompatibilitu historického/offline syncu.
