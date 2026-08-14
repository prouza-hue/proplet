# Proplet v3.21 — nasazení

Release **v3.21 „First Touch & Game Feel“** navazuje na v3.20.2.

## 1. Nejdřív Supabase

V **Supabase → SQL Editor → New query** spusť celý soubor:

`SUPABASE_MIGRATION_V3_21.sql`

Migrace:

- rozšíří povolené `results.mode` o `starter`,
- existujícím hráčům připíše jednorázových **10 XP** přes technický výsledek `starter-v1`, aby nový starter nikoho v celkovém XP pořadí nezvýhodnil,
- zachová všechny dosavadní výsledky, hráče, týmy i progres,
- je idempotentní.

Historický starter výsledek existujících hráčů dostane `completed_at` podle data vzniku účtu, takže se nepřipíše do aktuálního týdne.

## 2. GitHub

Rozbal `proplet-v3.21-update.zip` a jeho obsah nahraj **do existující složky**:

`proplet-v3.1-cloud/`

Ne do kořene repozitáře.

Přepiš stejnojmenné soubory, commitni změny a nech Vercel vytvořit Production deployment.

## 3. Kontrola `/api/health`

Po deployi otevři:

`https://proplet-nine.vercel.app/api/health`

Hledej zejména:

```json
"version": "3.21.0",
"gameFeelSprint": "3.21",
"starterPuzzle": true,
"starterXp": 10,
"starterMigration": true,
"uxMigration": true,
"adminStatic": true,
"ok": true
```

Pokud `starterMigration` není `true`, **nezkoušej starter výsledek opravovat ručně** — nejdřív znovu zkontroluj, že celý `SUPABASE_MIGRATION_V3_21.sql` doběhl bez chyby.

## 4. Doporučený smoke test

V anonymním / čistém browseru:

1. onboarding → `Najdi PES`,
2. vyber Pomocníka,
3. `Jdu na první Proplet` musí otevřít rovnou starter, nikoli menu,
4. starter: MRAK → JABLKO → použít Nápovědu → ČOKOLÁDA → AUTOBUS,
5. po posledním slově musí být krátce vidět hotová deska,
6. výsledek ukáže +10 XP a CTA `Teď na dnešní výzvu ☀️`,
7. CTA přejde na Dnes a zvýrazní Daily.

Dále ověř:

- krátký tah 1–3 písmena není chyba ani tah,
- skutečně chybná cesta krátce červeně zůstane vidět,
- Reset → `VRÁTIT` obnoví vyplněnou plochu,
- Nápověda/Reset mají na nízkém telefonu bezpečnou dotykovou výšku,
- Fold7 složený naležato ukáže portrait guard,
- Fold7 rozložený používá tabletový layout i naležato,
- běžná Daily, Free, Rescue, výsledkovka, účet a `/admin` fungují jako předtím.

## Není potřeba

- regenerovat Free nebo Daily banku,
- mazat Local Storage,
- resetovat hráče,
- měnit VAPID klíče nebo Vercel env,
- spouštět starší migrace znovu.
