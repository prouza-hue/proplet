# Proplet v3.13 — Quality Analytics v2

## Cíl

Automaticky vytipovat úrovně, které se podle reálného hraní chovají výrazně lehčeji nebo těžčeji než ostatní úrovně stejné obtížnosti. Report nic sám nepřegeneruje ani nepřesune; slouží jako QA doporučení pro člověka.

## Zdroje dat

Hlavní kalibrace používá vždy **první zahájený pokus každého hráče na každém puzzle**. Replaye zůstávají v databázi, ale neovlivní hlavní Difficulty Index.

Pro každou úroveň se sleduje:

- počet prvních startů a dokončení,
- completion rate,
- medián času dokončených prvních pokusů,
- průměr chybných tahů,
- průměr nápověd,
- podíl čistých řešení,
- subjektivní rating `Lehčí / Akorát / Těžší`,
- počet hlášení divného slova,
- generátorové metadata (score, počet buněk a slov).

## Difficulty Index

Každá metrika se porovnává pouze proti ostatním puzzle **stejné obtížnosti**. Používá se robustní z-score (medián + MAD; při nulové varianci fallback na běžnou směrodatnou odchylku).

Váhy:

- 35 % medián času,
- 20 % completion rate (opačným směrem),
- 15 % průměr nápověd,
- 10 % chyby,
- 10 % Clean rate (opačným směrem),
- 10 % rating hráčů.

Malé vzorky se záměrně tlumí. Plná confidence je od 20 prvních pokusů.

## Vzorek

- 0–4: `none`
- 5–9: `early`
- 10–19: `usable`
- 20–49: `reliable`
- 50+: `strong`

## Flagy

- `too_hard`: alespoň 20 prvních pokusů a Difficulty Index >= +1.25
- `too_easy`: alespoň 20 prvních pokusů a Difficulty Index <= -1.25
- `watch`: alespoň 10 pokusů a |Index| >= 1.60
- `ok`: bez zásahu
- `insufficient_data`: zatím příliš malý vzorek

Automatická změna puzzle není povolena. Outlier se nejprve ručně zkontroluje (geometrie, slovní mix, případné hlášení slov, pořadí v bance).

## Endpoint

Přihlášený hráč může otevřít:

`GET /api/quality-report`

Vrací:

- `summary` — počet outlierů a spolehlivě změřených puzzle,
- `priorities` — až 30 nejdůležitějších kandidátů ke kontrole,
- `rows` — kompletní agregovaný report,
- `helper` — nabídky / přijetí / odmítnutí Pomocníka,
- `hints` — detailní usage telemetry nápověd od v3.13.

Endpoint nevrací jména hráčů.

## Pomocník

Režimy:

- `beginner`: nabídka po 45 s bez nového slova,
- `younger`: 70 s,
- `older`: 100 s,
- `none`: bez automatické nabídky.

Pomocník nabídne pomoc maximálně jednou v jednom pokusu. Nic sám neodhaluje.

### Helper telemetry

`helper_events` ukládá:

- offered / accepted / dismissed,
- support mode,
- čas od začátku,
- čas od posledního nalezeného slova,
- kolik slov bylo nalezeno / celkem.

### Hint telemetry

`hint_events` ukládá:

- úroveň nápovědy 1/2/3,
- zdroj `manual` nebo `helper`,
- support mode,
- `complimentary` (připraveno pro budoucí ekonomiku),
- čas použití a progres desky.

Historická data před v3.13 dál obsahují agregovaný počet a nejsilnější hint v `puzzle_attempts/results`; detailní zdroj hintu je dostupný až od v3.13.
