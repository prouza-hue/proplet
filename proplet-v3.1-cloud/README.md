# Proplet v3.10

Česká PWA slovní hra Proplet.

Aktuální release: **v3.10 — Úspěchy & férový postup**.

Hlavní změny:
- 66 úspěchů v tematických sbírkách,
- oslava nových úspěchů na výsledkové obrazovce,
- oprava posloupnosti Free úrovní,
- Reset už nikdy nerestartuje čas ani tahy.

Nasazení: `UPDATE_V3_10_CZ.md`.

## v3.11 — Tierovaný český slovník

Nová answer vocabulary A–D je v `data/answer_tiers.json`. Generátor ji používá jako jediný zdroj zamýšlených odpovědí; `data/source_cs_50k.txt` zůstává validator-only. Podrobnosti viz `VOCABULARY_DESIGN_V3_11_CZ.md` a `VOCABULARY_AUDIT_V3_11_CZ.md`.
