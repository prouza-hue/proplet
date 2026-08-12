# Proplet v3.5 – update živého webu

## 1. Nejdřív Supabase
1. Otevři svůj projekt Supabase.
2. Vlevo klikni **SQL Editor** → **New query**.
3. Otevři soubor `SUPABASE_MIGRATION_V3_5.sql` z tohoto balíku.
4. Zkopíruj celý obsah do SQL Editoru.
5. Klikni **Run**.

Migrace přidá telemetry obtížnosti a hráčskou zpětnou vazbu. Staré výsledky ani účty nemaže.

## 2. Potom GitHub
Nahraď soubory z update ZIPu ve stejných cestách:
- `server.py`
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/sw.js`

Pro pořádek můžeš do repozitáře přidat i `SUPABASE_MIGRATION_V3_5.sql` a tento návod.

Dej **Commit changes**. Vercel vytvoří nový deployment automaticky.

## 3. Kontrola
Otevři:

`https://proplet-nine.vercel.app/api/health`

Chceme vidět zejména:
- `"ok": true`
- `"database": true`
- `"puzzleFile": true`
- `"accountMigration": true`
- `"featuresMigration": true`
- `"qualityMigration": true`

Pak aplikaci jednou zavři a znovu otevři. Pokud stará PWA zůstane aktivní, Proplet sám nabídne banner **Je připravená nová verze → Aktualizovat**.

## Co rychle otestovat
1. Na Daily stránce je hned vidět blok **Hraj dál** se 4 obtížnostmi.
2. Spusť Free hru z Daily a použij systémové Android **Zpět** → máš skončit ve výběru volných her, ne zavřít PWA.
3. Z výběru her další **Zpět** → Daily.
4. Daily: odejdi do menu na ~10 sekund a vrať se → čas musí pokračovat, ne pauznout.
5. Free: odejdi do menu na ~10 sekund a vrať se → čas má zůstat pauznutý.
6. Po dořešení přihlášeného hráče se ukáže **Lehčí / Akorát / Těžší** a **Divné slovo?**.
7. V Pořadí je karta **Týden**.
