# Proplet v3.15

Aktuální release: **v3.15 — Anonymous Analytics + Instant Results**.

Hlavní novinky:

- Quality Analytics měří i nepřihlášené hráče pomocí náhodného neidentifikujícího ID instalace,
- do databáze se ukládá pouze SHA-256 hash tohoto ID, nikoli jméno, e-mail, IP nebo fingerprint,
- anonymní pokusy, nápovědy, rating obtížnosti a hlášení slov vstupují do QA modelu,
- základní funnel měří otevření appky, tutorial a nabídku/přechod k účtu,
- po registraci/přihlášení se anonymní telemetry z daného zařízení připíše profilu a neduplikuje člověka,
- výsledkovka už během synchronizace nikdy neukazuje starý žebříček předchozího kola.

Nasazení: `UPDATE_V3_15_CZ.md`  
Migrace: `SUPABASE_MIGRATION_V3_15.sql`  
Metodika: `ANONYMOUS_ANALYTICS_V3_15_CZ.md`
