# Proplet v3.13 — Quality Analytics v2

## Cíl

Quality Analytics v2 má automaticky vytahovat úlohy, které se podle reálného hraní chovají výrazně lehčeji nebo těžčeji než ostatní úlohy stejné skupiny. Systém **nikdy automaticky nepřepisuje obtížnost ani puzzle**. Vytváří pouze doporučení pro lidskou kontrolu.

## Primární vzorek

Hlavní difficulty model používá pouze **první setkání každého hráče s konkrétním puzzle**.

- pokračování stejného rozehraného `attempt_id` je stále tentýž pokus,
- pozdější replay se do hlavního Difficulty Indexu nezapočítá,
- replaye se dál uchovávají jako diagnostická data,
- pokud první pokus zůstane nedokončený, je to legitimní signál obtížnosti.

Tím se model nezkresluje tím, že si hráč při druhém hraní pamatuje trasu.

## Cohorty

Úloha se porovnává jen s relevantními úlohami:

- `free:easy`
- `free:medium`
- `free:hard`
- `free:hardcore`
- `daily`

Denní výzvy jsou oddělené, protože mají jiné časové chování než Free hra.

## Difficulty Index

Behaviorální index kombinuje robustně normalizované metriky uvnitř cohorty:

- 35 % medián času,
- 20 % completion rate (obráceným směrem),
- 15 % průměr nápověd,
- 10 % chybné pokusy,
- 10 % Clean rate (obráceným směrem),
- 10 % subjektivní rating `Lehčí / Akorát / Těžší`.

Normalizace používá medián a MAD (median absolute deviation), takže jeden absurdní čas nerozhodí celý benchmark. Signály se ořezávají na ±3.

Interpretace:

- `0` = typická úloha své skupiny,
- kladné číslo = chová se těžší,
- záporné číslo = chová se lehčí.

## Síla vzorku

- 0–4 prvních pokusů: bez dat,
- 5–9: předběžné,
- 10–19: použitelné,
- 20–49: spolehlivé,
- 50+: silný vzorek.

Automatický červený/oranžový alert vznikne až od 20 prvních pokusů a `|Difficulty Index| >= 1.25`.

Od 10 pokusů a `|Index| >= 1.0` se úloha zařadí do watchlistu.

## Další signály

Report sleduje také:

- stale incomplete pokusy (nedokončené a bez aktivity 24+ hodin),
- počet replayů,
- počet resetů,
- medián času do prvního správného slova,
- medián času do první nápovědy,
- počet ratingů a response rate,
- hlášení „Divné slovo?“,
- případný rozpor mezi behaviorálními daty a subjektivním ratingem.

## Automatizace

Stávající denní Vercel cron má od v3.13 ještě druhou práci:

- každý den dál řeší push notifikace,
- **každé pondělí** navíc uloží jeden agregovaný QA snapshot do `quality_snapshots`.

Nevzniká tedy žádný druhý cron ani další Vercel konfigurace.

Aktuální report se umí porovnat s posledním uloženým snapshotem a ukáže největší změny Difficulty Indexu.

## Skrytý dashboard

Přihlášený playtester může otevřít:

`https://proplet-nine.vercel.app/?qa=1`

Dashboard není v běžné navigaci. Ukáže pouze agregovaná data, žádná jména hráčů. Obsahuje i tlačítko **Kopírovat shrnutí**, které lze vložit do ChatGPT pro další interpretaci.

## Telemetry připravená pro Pomocníka

v3.13 nově sbírá několik nízkoobjemových checkpointů:

- `first_correct_at_ms`,
- `last_correct_at_ms`,
- `first_hint_at_ms`,
- `reset_count`,
- `found_words`,
- `resume_count`,
- `last_activity_at`.

Checkpoint se odešle po správném slově, nápovědě, resetu a při odchodu z herní obrazovky / skrytí aplikace. Nezapisuje se každý tah prstu.

To nám umožní před implementací Pomocníka zjistit například skutečný čas, po kterém hráči spontánně sahají po nápovědě, a později měřit `helper_offered / accepted / dismissed` bez redesignu analytické vrstvy.
