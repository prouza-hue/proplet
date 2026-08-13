# Aktualizace Proplet na v3.16.5

V3.16.5 doplňuje bezpečné opakování Daily přímo z výsledkovky a napravuje nejasnou cestu pro hráče se starou generací dnešní desky.

## Databáze

Nová SQL migrace není potřeba. Peterův dnešní výsledek v týmu Prouza ručně nemaž.

## Deployment

Nasaď celý cloud balíček, nebo z update balíčku nahraď:

- `server.py`,
- `public/app.js`,
- `public/index.html`,
- `public/sw.js`.

Po nasazení přijmi nabídku aktualizace a aplikaci jednou obnov.

## Peter / tým Prouza

1. Peter otevře Proplet v3.16.5.
2. Otevře svůj dnešní výsledek.
3. Klepne na **Zahrát novou dnešní výzvu**; pokud telefon generační rozdíl nerozpoznal, může být tlačítko pojmenované **Zahrát znovu · trénink**, ale spustí stejnou aktivní desku.
4. Po dokončení se aktivní Daily synchronizuje do dnešního, týdenního i globálního pořadí.
5. Dalších 100 XP se nepřidá a původní pokus zůstane v historii.

## Běžné opakování

Už správně započítaná Daily ukazuje **Zahrát znovu · trénink**. Další pokus:

- nedá XP,
- nezlepší ani nezhorší oficiální pořadí,
- zůstane v historii pokusů.

## Kontrola po nasazení

1. `/api/health` vrací `version = 3.16.5`.
2. Patička ukazuje **Proplet v3.16.5**.
3. Na výsledkovce běžné Daily je tlačítko **Zahrát znovu · trénink**.
4. Po tréninkovém dohrání výsledkovka píše **Tréninkový pokus · 100 XP už máš**.
5. Původní čas a globální pozice zůstávají beze změny.

## Rollback

Rollback na v3.16.4 nemaže data. Pouze znovu skryje možnost opakovat Daily z výsledkovky.
