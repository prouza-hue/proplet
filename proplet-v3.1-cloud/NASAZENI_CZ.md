# Proplet v3.1 Cloud – nasazení Vercel + Supabase

Tento balíček je připravený pro cloud. Nemusíš upravovat Python ani JavaScript.

## Co budeš potřebovat

- účet GitHub
- účet Supabase
- účet Vercel
- cca 15 minut při prvním nasazení

## 1. Supabase

1. Přihlas se do Supabase a klikni **New project**.
2. Project name: `proplet`.
3. Vygeneruj/ulož Database password (aplikace ho přímo nepotřebuje, ale ulož si ho).
4. Zvol region poblíž ČR a vytvoř projekt.
5. V levém menu otevři **SQL Editor** → **New query**.
6. Otevři soubor `SUPABASE_SETUP.sql`, zkopíruj celý obsah do editoru a klikni **Run**.
7. Otevři **Settings → API Keys**.
8. Zkopíruj:
   - Project URL → bude `SUPABASE_URL`
   - Secret key začínající `sb_secret_` → bude `SUPABASE_SECRET_KEY`
9. Secret key nikam veřejně neposílej a nedávej na GitHub.

## 2. GitHub

1. Na github.com klikni **New repository**.
2. Název: `proplet`.
3. Zvol **Private** (doporučeno).
4. Vytvoř prázdný repozitář.
5. Klikni **Add file → Upload files**.
6. Nahraj **obsah složky `proplet-v3-cloud`**, ne ZIP jako jeden soubor.
   V kořeni repozitáře musí být vidět např. `server.py`, `requirements.txt`, `public`, `SUPABASE_SETUP.sql`.
7. Klikni **Commit changes**.

## 3. Vercel

1. Přihlas se do Vercelu přes GitHub.
2. Klikni **Add New… → Project**.
3. U repozitáře `proplet` klikni **Import**.
4. Root Directory nech `./`.
5. Framework Preset může Vercel určit automaticky; nic ručně nepřepisuj.
6. Rozbal **Environment Variables** a vlož dvě položky:
   - `SUPABASE_URL` = Project URL ze Supabase
   - `SUPABASE_SECRET_KEY` = Secret key `sb_secret_...`
7. Klikni **Deploy**.
8. Po dokončení klikni **Visit**.

## 4. Kontrola

Na adrese svého Vercel webu dopiš `/api/health`, například:

`https://proplet-xyz.vercel.app/api/health`

Správný výsledek obsahuje:

`"ok": true` a `"database": true`

Pak otevři hlavní adresu aplikace a vytvoř hráče.

## 5. Děti / více telefonů

Na každém telefonu otevři stejnou Vercel adresu.
Každý zvolí vlastní jméno, ale všichni použijí stejný rodinný kód, např. `PROUZOVI`.
Potom se uvidí ve společném leaderboardu.

## Aktualizace aplikace

Když později změníš soubor v GitHubu a uděláš commit, Vercel novou verzi automaticky nasadí.


## Herní obsah této verze

- Daily Challenge: 365 úloh, každý den jedna, dokončit lze jen jednou.
- Volná hra: 50 snadných + 50 středních + 50 těžkých úloh.
- Po dokončení volné úlohy lze zvolit Další úlohu nebo Zpět do menu.


## Aktualizace na v3.3
Pokud už Proplet běží, nepoužívej čistou instalaci. Postupuj podle `UPDATE_V3_3_CZ.md` a nejdřív spusť `SUPABASE_MIGRATION_V3_3.sql`.
