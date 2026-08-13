# Aktualizace Propletu na v3.18.0

V3.18.0 přidává anonymní globální pořadí ke každé aktivní Free úrovni a sjednocuje české označení čistého vyřešení.

## Databáze

**Žádnou novou SQL migraci nespouštěj.** Globální pořadí bezpečně používá existující tabulku `puzzle_runs` a první dokončené pokusy, které Proplet už ukládá.

## Deployment

Nejbezpečnější je nasadit celý cloud balíček. Z update balíčku nahraď:

- `server.py`,
- `public/app.js`,
- `public/admin.js`,
- `public/index.html`,
- `public/styles.css`,
- `public/sw.js`.

Po deploymentu přijmi nabídku aktualizace PWA a aplikaci jednou obnov. Nový název cache zajistí, že se výsledkovka nespáruje se starým JavaScriptem.

## Kontrola po nasazení

1. `/api/health` vrací `version = 3.18.0`.
2. Dohraj libovolnou aktivní Free úroveň.
3. Na výsledkovce se objeví záložky **🌍 Globálně** a **👥 Můj tým**.
4. Globální záložka ukáže tvoje místo a anonymní sousedy; týmová zachová jména.
5. Vysvětlení pořadí zní **Čisté vyřešení → méně nápověd → čas → tahy**.
6. Znovu odehraj stejnou úroveň: replay zůstane tréninkový a původní pořadí se nezmění.

## Rollback

Návrat aplikace na v3.17.0 nevyžaduje změnu databáze a nemaže žádné výsledky. Nový endpoint po rollbacku pouze přestane být dostupný.
