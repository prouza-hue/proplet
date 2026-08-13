# Aktualizace Propletu na v3.17.0

V3.17.0 přidává první skutečnou administraci: Quality Analytics, frontu hlášení slov, uživatele a audit zásahů. Přístup je navázaný na hráče **Pavel** v týmu **Prouza**, ale oprávnění žije v samostatné administrátorské tabulce.

## 1. Nejdřív spusť SQL

V Supabase otevři **SQL Editor**, vlož celý obsah:

`SUPABASE_MIGRATION_V3_17.sql`

a spusť ho jednou před deploymentem aplikace.

Migrace:

- nic nemaže z výsledků, XP ani historie;
- vytvoří oddělené admin oprávnění a auditní log;
- přidělí roli `owner` existujícímu hráči Pavel / Prouza;
- změní hlášení slov tak, aby šlo z jedné desky nahlásit více různých slov;
- doplní stavy `nové / prověřuji / vyřešeno / zamítnuto`.

### Ověření oprávnění

Po migraci můžeš v SQL Editoru spustit:

```sql
select p.name, p.family_code, a.role, a.active
from public.admin_accounts a
join public.players p on p.id = a.player_id;
```

Správně uvidíš hráče `Pavel`, tým `PROUZA`, roli `owner` a `active = true`.

Pokud dotaz nevrátí žádný řádek, účet se v databázi jmenuje jinak. Pak grant proveď tímto dotazem po úpravě jména nebo týmu:

```sql
insert into public.admin_accounts (player_id, role, active)
select id, 'owner', true
from public.players
where lower(name) = 'pavel' and lower(family_code) = 'prouza'
on conflict (player_id) do update set role = 'owner', active = true;
```

## 2. Deployment

Nejbezpečnější je nasadit celý cloud balíček. Z update balíčku nahraď:

- `server.py`,
- `SUPABASE_SETUP.sql`,
- `public/app.js`,
- `public/index.html`,
- `public/styles.css`,
- `public/sw.js`,

a přidej nové soubory:

- `public/admin.html`,
- `public/admin.css`,
- `public/admin.js`.

Po deploymentu v Propletu přijmi nabídku aktualizace a aplikaci jednou obnov.

## 3. Kontrola

1. `/api/health` vrací `version = 3.17.0` a `adminMigration = true`.
2. Přihlas se jako **Pavel** v týmu **Prouza**.
3. V profilu se objeví karta **Proplet Admin**.
4. Otevře se `/admin` s Přehledem, Quality, Hlášeními, Uživateli a Historií zásahů.
5. Jiný přihlášený hráč dostane při otevření administrace chybu 403.

## Co lze v první verzi měnit

Zapisující akcí je zatím pouze vyřízení hlášení slova. Každá změna stavu se ukládá do `admin_audit_log`.

Výsledky, XP, účty ani herní obsah administrace v této verzi nemaže a neupravuje.

## Rollback

Návrat aplikace na v3.16.5 nemaže nové tabulky ani audit. Databázovou migraci nevracej zpět. Pro bezpečné zachování více hlášení z jedné desky je ale lepší ponechat `server.py` z v3.17.0.
