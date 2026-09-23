# Mozkokalypsa: doplňkový tester a vyhodnocení (2026-09-23)

Na výslovné zadání vlastníka přidáváme účet Pavel jako čtvrtého účastníka.
Původní trojice PiettraWal / Michael / Ave zůstává ve svých slotech 0/1/2.
Nová role observer používá existující pořadí 0; slot označuje pořadí desek.
Primární trojice má nadále unikátní sloty; databáze dovoluje nejvýše jednoho observera.
Autorizace zůstává podle neměnného player_id a aktivní pozvánky, nikoli podle jména.
Migrace nemění RLS, granty, RPC ani tabulky běžných výsledků.

## Vyhodnocení
- 2 kontrolní desky současného profilu Mozkomor, 4 plné desky, 4 s déle přetrvávajícími alternativami.
- Porovnat uvnitř každého původního testera: dokončení, uložený herní čas i čas na slovo, průběh nálezů, chybné tahy, nápovědy a jejich úrovně/načasování, návraty/reset, klidný režim.
- Připojit dobrovolné hodnocení obtížnosti a zábavnosti 1–5 a poznámky.
- Hledat, zda výzva přetrvává i ke konci, místo pouhého prodloužení práce. Z kombinace událostí a komentářů; telemetrie sama nezná hráčovo přemýšlení.
- Přerušení není automaticky frustrace; nedokončené pokusy vykázat zvlášť.
- Primární výsledky filtrovat participant_role='tester'. Pavlovy výsledky role observer popsat odděleně kvůli znalosti návrhu.
- Uvést jednotlivé hráče/desky a mediány; tři zkušení hráči nejsou statistický důkaz pro celou populaci. Žádné dodatečně vymyšlené procentní prahy úspěchu.
- Úspěch pilotu: zajímavější trvalá výzva bez opakované frustrace či technických problémů. Rozhodnutí opřít o kombinaci chování a hodnocení.
- Vyhodnocení je následný report nad databází, nikoli nový automatický dashboard nebo polling.

## Ověření změny
Izolovaný HTTP/PostgREST/PostgreSQL test provede kompletní zápisový tok pod syntetickým observerem, který sdílí pořadí s primárním testerem. Ověří zákaz duplicitního primárního slotu a druhého observera, přístup obou rolí, dokončení a feedback, revokaci a nezměněné běžné výsledky.
Skutečný účet vlastníka nepoužívat k syntetickým pokusům.
