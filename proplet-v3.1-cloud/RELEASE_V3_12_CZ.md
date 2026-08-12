# Proplet v3.12 — Přestavba Free banky

v3.12 dokončuje práci, kterou začal tierovaný slovník ve v3.11. Nový slovníkový standard se nyní promítá i do všech Free úrovní, které podle produkčních dat ještě nebyly bezpečnostně exponované hráčům.

## Co zůstává zmrazené

- Snadná 1–54
- Střední 1–50
- Těžká 1–10
- Mozkožrout 1–11

Tyto části jsou bitově stejné jako ve v3.11.

## Co je nové

- 275 nově vytvořených Free úrovní,
- Snadná používá pouze Tier A,
- Střední A+B s převahou B,
- Těžká B+C s převahou C,
- Mozkožrout C+D s výrazným zastoupením D,
- frekvenční/dialogový korpus je nadále pouze validator-only,
- žádné cílové slovo se v novém obsahu neopakuje v předchozích osmi úrovních,
- Těžká a Mozkožrout mají maximálně dvě čtyřpísmenná slova na desku.

## Kontrola

Všech 275 nových úrovní bylo po generování znovu nezávisle ověřeno:

- 275/275 tier policy,
- 275/275 unikátní lokální cesty cílových slov,
- 275/275 unikátní kompletní řešení.

Aktivní banka má stále 795 puzzle a 795 unikátních desek. Daily a Rescue se v tomto releasu nemění.

Podrobný audit: `FREE_BANK_AUDIT_V3_12_CZ.md`.
