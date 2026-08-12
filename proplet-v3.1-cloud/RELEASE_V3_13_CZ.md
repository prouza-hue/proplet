# Proplet v3.13 — Quality Analytics v2

v3.13 nemění obsah puzzle ani pravidla hry. Staví nad existující telemetrií automatickou QA vrstvu pro kalibraci obtížnosti a připravuje měření pro budoucí Pomocník / ekonomiku nápověd.

## Hlavní změny

- hlavní difficulty model používá jen první setkání hráče s puzzle,
- replaye jsou oddělená diagnostika,
- robustní Difficulty Index relativně k ostatním puzzle stejné cohorty,
- confidence podle velikosti vzorku,
- automatické alerty až od 20 prvních pokusů,
- subjektivní rating obtížnosti je jen 10 % modelu,
- word reporty se propisují do QA alertů,
- nové telemetry: čas první správné cesty, čas první nápovědy, resety, návraty, hloubka rozehrání,
- pondělní QA snapshot přes existující daily cron,
- skrytý dashboard `?qa=1` + kopírování shrnutí.

Podrobná metodika: `QUALITY_ANALYTICS_V3_13_CZ.md`.
