# Proplet v3.3 — aktualizace existujícího cloudu

Tento návod je pro už běžící Proplet na Vercelu + Supabase.

## DŮLEŽITÉ: pořadí je tentokrát SQL → GitHub

### 1. Supabase — spusť migraci
1. Otevři svůj projekt v Supabase.
2. Vlevo otevři **SQL Editor**.
3. Klikni **New query**.
4. Na počítači otevři soubor `SUPABASE_MIGRATION_V3_3.sql` z tohoto balíku.
5. Zkopíruj **celý obsah** a vlož ho do SQL Editoru.
6. Klikni **Run**.
7. Pokud se neobjeví červená chyba, je hotovo. Migrace nic nemaže: přidá heslo, tabulku sessions a povolí obtížnost `hardcore`.

### 2. GitHub — nahraď aplikaci
Nahraď obsah repozitáře obsahem složky `proplet-v3.3-cloud` a dej **Commit changes**.

Nejdůležitější nové/změněné soubory jsou:
- `server.py`
- `SUPABASE_SETUP.sql`
- `SUPABASE_MIGRATION_V3_3.sql`
- `data/puzzles.json`
- `public/puzzles.json`
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/sw.js`
- `tools/generate_puzzles.py`

Vercel po commitu vytvoří nový deployment automaticky.

### 3. Ověř backend
Po dokončení deploymentu otevři na své adrese:

`/api/health`

Správně má být mimo jiné:

```json
{
  "ok": true,
  "database": true,
  "puzzleFile": true,
  "accountMigration": true
}
```

Pokud je `accountMigration: false`, nespouštěj přihlašování na druhém zařízení a znovu zkontroluj krok 1.

### 4. Obnov PWA
Pokud máš Proplet připnutý na ploše telefonu:
1. úplně ho zavři,
2. otevři znovu,
3. případně jednou obnov stránku v prohlížeči.

Service worker má nový cache klíč v3.3, takže staré soubory se odstraní.

## Jak nastavit heslo stávajícímu hráči
Na zařízení, kde už jsi přihlášený:
1. otevři **Já**,
2. v kartě účtu klikni **Nastavit heslo**,
3. zadej heslo alespoň o 8 znacích dvakrát,
4. ulož.

Stávající výsledky, XP, streak i token zařízení zůstanou zachované.

## Jak se přihlásit na druhém zařízení
1. Otevři stejný Proplet na notebooku / druhém telefonu.
2. Otevři **Já → Přihlásit hráče**.
3. Zadej stejné **jméno**, **rodinný kód** a **heslo**.
4. Po přihlášení se stáhne cloudový postup a dokončená Daily se na druhém zařízení zobrazí jako již hotová.

Každé zařízení má vlastní session token, takže mohou zůstat přihlášená současně.

## Co zůstává beze změny
- 365 Daily úloh je stejných jako ve v3.2.2 — dnešní Daily se aktualizací nezmění.
- 50 Easy a 50 Medium úloh je stejných jako dřív.
- Staré Hard výsledky zůstávají v Supabase, počítají se do XP/statistik a případná čekající synchronizace je stále přijata.
- Hard dostává nový 50úrovňový track s křivějšími cestami; proto se jeho nový progress bar počítá od nové sady.
