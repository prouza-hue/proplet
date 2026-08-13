# Proplet v3.16.2

Aktuální release: **v3.16.2 — Pomocník v onboardingu a bezpečný přechod Daily**.

Hlavní novinky:

- nový kurátorovaný Lexicon v2 s 3 153 cílovými lemmaty a metadaty `familiarity`, `complexity`, `fun`, `theme`, `register` a `age_floor`,
- úplně nová banka 400 Free úrovní: 100 Snadných, Středních, Těžkých i Mozkožroutů,
- unikátní Gen2 puzzle ID, přísná jednoznačnost řešení a minimálně 24 mezilehlých úrovní před opakováním slova,
- hravější Mozkožrout s 679 odpověďmi Tier D a průměrnou zábavností 3,79/5,
- původní Free desky zůstávají v archivu `legacyFree` a jejich časy se nemíchají s Gen2 leaderboardy,
- postup hráče se převádí po slotech obtížnost + číslo úrovně; XP, hodnost, achievementy i historie zůstávají,
- převedenou Gen2 desku lze dobrovolně zahrát pro nový čas a leaderboard, ale bez druhé XP odměny.
- všech 365 Daily úloh je nově vytvořeno z Lexiconu v2 s rodinným mixem A/B/C a vlastními ID `g2-d-*`,
- každá Daily má alespoň jedno slovo s `fun` 4–5 a kruhový anti-repeat nejméně 24 mezilehlých dní,
- původní Daily banka je archivovaná; staré a offline výsledky se bezpečně přijmou, ale leaderboard nemíchá dvě různé desky.
- Pomocník se nastavuje už v onboardingu podle skutečného času 45 / 70 / 100 sekund nebo „nenabízet“, s přesným popisem dopadu před uložením,
- hráč se starou Daily pro dnešní datum může dokončit aktivní Gen2 desku; výsledek se započítá do týdne bez druhých 100 XP.

Nasazení: `UPDATE_V3_16_2_CZ.md`  
Migrace: `SUPABASE_MIGRATION_V3_16.sql`  
Release notes: `RELEASE_V3_16_2_CZ.md`  
Lexikon: `LEXICON_V2_PRODUCTION_CZ.md`  
Audity: `FREE_GENERATION2_AUDIT_CZ.md`, `DAILY_GENERATION2_AUDIT_CZ.md`
