# Aktualizace Propletu z v3.10.1 na v3.11

## Databáze

**Žádná SQL migrace není potřeba.**

Soubor `PLAYED_PUZZLES_FREEZE_QUERY.sql` je pouze read-only pomůcka pro budoucí regeneraci Free banky. Pro samotné nasazení v3.11 ho spouštět nemusíš.

## Nasazení

1. Nahraj obsah update balíku do stejného GitHub repozitáře a přepiš stejnojmenné soubory.
2. Commitni změny.
3. Nech Vercel dokončit nový Production deploy.
4. Otevři `/api/health`.

Očekávej mimo jiné:

- `"version": "3.11.0"`
- `"vocabularyVersion": 1`
- `"tieredDailyFrom": "2026-08-13"`
- `"vocabularyTierCounts": {"A":488,"B":278,"C":194,"D":148}`

V patičce aplikace bude `Proplet v3.11`.

## Co se hráčům změní

Do dneška nic v rozehraných ani historických puzzle. Od 13. 8. 2026 začnou nové Denní výzvy používat kvalitnější tierovaný slovník.

Free úrovně se v3.11 ještě nepřepisují.
