# Aktualizace Propletu z v3.19.2 na v3.20

v3.20 je jeden větší UX sprint. **Nemění žádnou úroveň, slovník, XP ekonomiku ani existující výsledky.** Mění onboarding, přehlednost obrazovek a práci s hráčským účtem.

## 1. Supabase — nejdřív spusť migraci

V **Supabase → SQL Editor → New query** spusť celý soubor:

`SUPABASE_MIGRATION_V3_20.sql`

Migrace pouze:

- přidá `players.team_joined_at`,
- u stávajících týmových hráčů ho bezpečně nastaví na datum vytvoření profilu,
- přidá index pro týmové pořadí.

Sloupec chrání férovost Ligy týmů: hráč, který se k týmu přidá až později, mu zpětně nepřinese staré Daily výsledky.

## 2. GitHub — pozor na umístění projektu

Repo má historicky aplikaci v adresáři:

`proplet-v3.1-cloud/`

**Obsah update ZIPu nahraj právě do tohoto adresáře, ne do rootu repozitáře.** Přepiš stejnojmenné soubory.

Update obsahuje zejména:

- `server.py`
- `public/app.js`
- `public/index.html`
- `public/styles.css`
- `public/sw.js`
- `SUPABASE_MIGRATION_V3_20.sql`
- `SUPABASE_SETUP.sql`
- dokumentaci v3.20

Commitni změny; Vercel provede nový Production deployment.

## 3. Kontrola `/api/health`

Po deployi otevři:

`https://proplet-nine.vercel.app/api/health`

Hledej zejména:

```json
"version": "3.20.0",
"ok": true,
"uxMigration": true,
"accountWithoutTeam": true,
"accountNudgeCompletions": [1, 4, 10]
```

Patička aplikace má ukazovat **Proplet v3.20**.

## 4. Doporučený smoke test

### Nový hráč

1. Otevři Proplet v anonymním okně / čistém browseru.
2. Onboarding musí mít přesně tři kroky: **PES → celá plocha → Pomocník**.
3. Dokonči první hru. Objeví se nabídka **Uložit postup**.
4. Založ účet pouze jménem + heslem. Tým se nesmí vyžadovat.
5. Obnov stránku. Účet musí zůstat **Bez týmu** a postup musí být zachovaný.
6. V profilu zvol **Přidat tým** a ověř připojení / založení týmu.

### Account nudges

Na čistém anonymním profilu se automatická nabídka účtu smí objevit po:

- 1. dokončené hře,
- 4. dokončené hře,
- 10. dokončené hře.

Po třetí nabídce už žádný další automatický modal. V hlavičce zůstává nenásilné **☁️ Uložit**.

### Starý účet

Ověř jednoho existujícího hráče v týmu:

- běžné přihlášení jménem + heslem,
- pokud existuje jmenovec, funguje volba **Mám starší účet v týmu**,
- týmové pořadí i Liga týmů zůstávají funkční.

### Regrese hry

- Daily i Free jdou spustit a dokončit,
- záchrana série se nabízí stejně jako ve v3.19.2,
- čas se při skrytí / ztrátě focusu nepřičítá,
- globální Free leaderboard se načte až pro správnou úroveň,
- `/admin` se dál otevře oprávněnému účtu.

## Co není potřeba

- neregeneruj puzzle,
- nemaž Local Storage,
- nemaž hráče ani výsledky,
- neměň VAPID klíče ani Vercel env proměnné,
- nespouštěj starší migrace znovu.
