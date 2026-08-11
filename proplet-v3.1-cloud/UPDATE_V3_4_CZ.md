# Proplet v3.4 — aktualizace existujícího cloudu

Tento návod je pro Proplet v3.3 běžící na Vercelu + Supabase.

## Co v3.4 přidává
- adaptivní herní layout pro Samsung Fold / tablet bez scrollování během hry
- kompaktní horní pás s délkami slov; „Aktuálně“ je stále viditelné
- interaktivní onboarding s mini úlohou PES
- záchranu jednoho vynechaného dne streaku: 6×6, 30 sekund, jeden pokus
- 3 stupně nápovědy
- Clean solve a férovější Daily leaderboard
- silnější haptiku + tlačítko „Otestovat haptiku“
- upravené karty obtížností: jedna ikona vlevo, vpravo progress ring + šipka

## DŮLEŽITÉ: pořadí je SQL → GitHub

### 1. Supabase — spusť migraci v3.4
1. Otevři projekt v Supabase.
2. **SQL Editor → New query**.
3. Otevři soubor `SUPABASE_MIGRATION_V3_4.sql`.
4. Zkopíruj CELÝ obsah do SQL Editoru.
5. Klikni **Run**.
6. Pokud nevidíš červenou chybu, pokračuj.

Migrace nic nemaže. Přidá k výsledkům `hints_used` a `clean_solve` a vytvoří tabulku `streak_rescues`.

### 2. GitHub — nahraď soubory
Nahraj obsah update balíku do kořene současného repozitáře a potvrď **Commit changes**.

Zásadní změněné soubory:
- `server.py`
- `data/puzzles.json`
- `public/puzzles.json`
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/sw.js`
- `tools/generate_puzzles.py`
- `SUPABASE_SETUP.sql`

Vercel po commitu vytvoří deployment automaticky.

### 3. Ověř backend
Po deploymentu otevři:

`https://proplet-nine.vercel.app/api/health`

Správně má být mimo jiné:

```json
{
  "ok": true,
  "database": true,
  "puzzleFile": true,
  "accountMigration": true,
  "featuresMigration": true
}
```

Pokud je `featuresMigration: false`, vrať se ke kroku 1.

### 4. Obnov PWA na telefonu
Service worker má nový cache klíč v3.4.

1. Proplet úplně zavři.
2. Otevři ho znovu.
3. Pokud pořád vidíš starou verzi, otevři jednou web v Chromu a dej Obnovit.

## Haptika na Samsungu / Androidu
V Propletu otevři **Já → Zvuk a haptika**.

- Haptika musí být v Propletu zapnutá.
- Klikni **Otestovat haptiku**.
- Proplet nyní používá výrazně delší pulzy než v3.3.
- Není potřeba žádné zvláštní oprávnění Propletu. Pokud test necítíš, zkontroluj, že telefon nemá systémové vibrace/haptiku úplně vypnuté.

## Záchrana streaku
Záchrana se nabídne jen při přesně jednom vynechaném dni, pokud před ním existoval streak.

- 6×6 speciální úloha
- 30 sekund
- bez nápověd
- jeden pokus
- úspěch chrání vynechaný den pro výpočet streaku, ale nepočítá se jako hotová Daily
- neúspěch ukončí předchozí sérii

U přihlášeného hráče je pokus uložen na serveru, takže nejde získat druhý pokus přepnutím zařízení.

## Nápovědy a Clean solve
Nápověda má 3 úrovně:
1. start + délka slova
2. první 3 políčka cesty
3. celé slovo + celá cesta

Jakákoli nápověda zruší Clean solve daného pokusu. Daily leaderboard řadí:
1. Clean solve
2. méně nápověd
3. rychlejší čas
4. méně tahů

## Herní data
- 50 Easy
- 50 Medium
- 50 Hard
- 50 Mozkožrout
- 365 Daily
- 30 samostatných rescue úloh

Původních 200 free + 365 Daily úloh z v3.3 zůstalo beze změny; pouze přibyla rescue banka.
