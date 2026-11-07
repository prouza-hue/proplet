# Dvoutýdenní experiment se vstupem nových hráčů

Preregistrace z 4. listopadu 2026 s dodatkem ze 7. listopadu 2026, klíč `new-player-entry-v1`. Uživatel následně schválil produkční nasazení a okamžité spuštění po dokončení kontrol. Hypotéza je, že vynechání tréninku zvýší pravděpodobnost dokončení alespoň jedné skutečné hry do 24 hodin.

## Změna přiřazování připravená 7. listopadu

Tento PR zavádí uživatelem vyžádané střídání nových způsobilých identit A, B, A, B, počínaje A. Čtecí kontrola ze 7. 11. 2026 v 18.30.36 UTC potvrdila produkční revizi 4f8d3d3edc44e1cb0369fc45051ecbca62ac718b, verzi 4.10.32, aktivní nábor a dosavadní součet A 20 / B 11. Nábor začal 4. 11. 2026 v 00.25.06,242652 UTC (01.25.06,242652 Europe/Prague). Čas pozorování není čas přechodu politiky, ten při případném budoucím nasazení zapíše migrace. Přechod se týká až nových přiřazení po nasazení migrace. Dosavadní přiřazení a jejich postup zůstávají ve fázi hash50_v1. První přiřazení nové fáze alternating_v1 má pořadové číslo 1 a větev A bez ohledu na historické počty.

Pořadí rezervuje server atomicky ve stejné transakci jako přiřazení. Opakované požadavky stejné identity vracejí původní větev a nové pořadí nespotřebují. Produkce, preview a testovací průchody mají oddělená pořadí. Každý řádek ledgeru uchovává allocation_policy, allocation_ordinal a allocation_switched_at. Historický hash má poslední dvě hodnoty prázdné. Přepnutí není restart náboru.

Konec náboru zůstává 18. 11. 2026 v 01.25.06,242652 Europe/Prague (00.25.06,242652 UTC). Závěrečný odečet zůstává 20. 11. 2026 v 09.00 Europe/Prague (08.00 UTC). Tento dodatek je připravený v PR a nedokládá produkční nasazení změny.

## Nábor a zásah

Začátek náboru je přesný serverový okamžik jednorázové aktivace uložený v entry_control.starts_at, včetně tohoto okamžiku. Konec entry_control.ends_at je přesně o 14 celých dní později, bez koncového okamžiku. Operátor při aktivaci uloží a zveřejní oba konkrétní časy v Europe/Prague i UTC spolu s nasazeným SHA. Databázový interval vznikne atomicky před prvním způsobilým přiřazením. Dřívější navržený termín od 16. listopadu nahrazuje uživatelem schválený okamžitý start.

Posledním hráčům doběhne jejich 24hodinové okno a celý následující pražský kalendářní den. Finální zmrazení dat nastane v 09.00 Europe/Prague dva kalendářní dny po pražském datu konce náboru. Tento odstup zahrnuje i rezervu pro opožděný sběr. Čtecí dotaz odvozuje nábor i zmrazení výhradně z uloženého intervalu a přikládá je ke každému výstupu. Před aktivací vrací prázdný výsledek. Nábor se bez nové dohody neprodlužuje a uložené časy se po aktivaci nepřepisují.

A absolvuje současný trénink PES, LES, ČAJ a pak první Volnou hru. Dokončení tréninku nese stávajících 10 XP podle běžných pravidel. B otevře rovnou tutéž g4-e-009. Vynecháním tréninku hráč v B jeho 10 XP nezíská. Rozdíl odměny je součástí měřeného zásahu. Ovládání, pomoc, odměna za skutečnou desku a okamžik nabídky účtu po jejím dokončení jsou společné.

Jednotkou je nová first-party identita bez předchozího vstupu do onboardingu nebo skutečné hry. Jmenovatelem v každé větvi jsou všechna serverová přiřazení v okně, včetně identit bez dalších událostí. Původní politika hash50_v1 používá deterministické rozdělení identity s pravděpodobností 50/50. Nová politika alternating_v1 střídá po jednom A a B. Historické počty se při tomto přechodu nedorovnávají. Každý flow se počítá jednou podle původní větve i po převodu na účet. Zahrnout pouze produkci s is_test=false, shodně pro přiřazení, hry i události. Testovací a interní průchody se značí předem. Nejasné vazby se hlásí jako závada integrity.

## Co se bude počítat

Okno 24 h začíná časem přiřazení včetně a končí přesně za 24 hodin bez pravé hranice. Násobné události jedné identity zvyšují čitatel dané metriky nejvýše o jednu. U každého podílu uvést absolutní n/N.

| Ukazatel | Čitatel |
| --- | --- |
| Primární dokončení | Alespoň jeden skutečný herní pokus identity se začátkem a serverově evidovaným dokončením v okně. Počítají se Volná hra, Denní a denní speciál vedené v puzzle_attempts. Tajenka používá samostatný signál tajenka_completed uložený serverem po skutečném dokončení na klientu. Starter je vyloučen. |
| Začátek první desky | Explicitní start prvního flow spojený ID pokusu s reálnou otevřenou g4-e-009 v okně. |
| Dokončení první desky | Serverové dokončení právě takto spojeného pokusu v okně. |
| Další hra | Po prvním dokončení další odlišný skutečný pokus se začátkem v okně. |
| Návrat D1 | Nové otevření, aktivní relace či herní aktivita stejné identity následující pražský kalendářní den, od místní půlnoci včetně po další půlnoc bez ní. |
| Vytvoření účtu | Nové account_created v okně s odpovídajícím flow. Přihlášení ke starému účtu ani klik na registraci nestačí. |
| Pomoc | Použití standardní nápovědy na přímo spojené první skutečné desce v okně. Použití tréninkové nápovědy v A vykazovat odděleně. |
| Chyby a načítání | Identity s hlášenou klientskou chybou a zvlášť s potvrzeným selháním načtení první skutečné desky v okně. Samotná absence startu může znamenat i odchod. Nedostupnost sběru se označí jako neznámá. |

Archiv a všech šest obtížností Volné hry (včetně veřejné Mozkokalypsy) používají režim free. Denní Extra používá daily_special. Měsíční soutěž odvozuje skóre ze skutečných Denních her, proto její pořadí a připsání bodů nesmí přidat další dokončení. Víkendová Tajenka má signály tajenka_started a tajenka_completed. Klient ukládá dokončení před odesláním signálu, včetně hry hosta. Do readoutu vstoupí jen signál přijatý se skutečnou first-party identitou v produkci bez testovacího příznaku. Původní pozvánkový režim playtest Mozkokalypsa III skončil podle serverové uzávěry 30. 9. 2026 a v listopadovém náboru není způsobilou hrou.

Čas do otevření popsat jen diagnosticky. Událost startu ani synchronizace výsledku sama o sobě nedokládá skutečné dokončení. Propojení první desky vyžaduje souhlas flow, ID pokusu a ID desky.

## Ranní report a bezpečnost

Ranní manažerský report Proplet (ID automatizace `rann-mana-ersk-report-proplet`) běží v 09.00 Europe/Prague za předchozí uzavřený den. Používá projekt Supabase `iopyhluayfszskyqqpuc` a externí `work/reporting-tools/report-methodology-reference.md` ze staršího projektu. Administrátorský historický launch report je jiný zdroj.

Před povolením náboru ověřit v odkazované metodice existující vazbu na preregistraci a soubor `docs/audits/ENTRY-EXPERIMENT-READOUT.sql` na přesně nasazeném commitu. Zkontrolovat načtení metodiky ranní automatizací a její první read-only výpočet. Pokud napojení chybí, ponechat nábor vypnutý. Neměnit čas, příjemce ani stručný formát reportu.

Každé ráno interně archivovat datum, čas odečtu, release, počet včerejších a celkových přiřazení A/B, otevřená okna, kontroly přiřazování a chyby. Čtecí SQL zachovává přesně dva souhrnné řádky A/B a původní assigned_yesterday přes obě politiky. Sloupec policy_metrics obsahuje samostatné metriky hash50_v1 a alternating_v1, včetně času přepnutí a mezí pořadových čísel. Ranní součty se dál čtou z horní úrovně, nikoli součtem souhrnu a vnořených dat. Vynechání tréninku v B není propad. Před finálním odečtem nepublikovat průběžná srovnání úspěšnosti. Do manažerského shrnutí patří odchylka vyžadující zásah. Produkční ověření je jen čtecí.

Nábor hned vypnout při prokázaném přeřazení, přepsání rozehrané hry, odlišné první desce, nefunkční pomoci či předčasné nabídce účtu, ztrátě postupu při přihlášení nebo při zařazení testovacích dat jako hráčů. Vypnout také při nejméně pěti identitách s potvrzeným selháním načtení a podílu alespoň 10 % v jedné větvi mezi alespoň 30 identitami přiřazenými v poslední hodině. V původní hashové kohortě při N ≥ 100 kontrolovat přesným oboustranným binomickým testem poměr 1:1. Pro střídání kontrolovat souvislé pořadí od jedničky, lichá čísla ve větvi A, sudá ve větvi B a serverový čas přepnutí. Běžný test poměru náhodného vzorku se na střídání nepoužije. Při p < 0,001 pozastavit nábor a prověřit implementaci. Alarm vyšetřit hned, nečekat na ranní report. Zapsat přesný čas zastavení, důvod a rozsah škody. Dosavadní přiřazení zachovat. Bez dohody nábor znovu neotevírat a neprodlužovat.

## Jedno závěrečné rozhodnutí

Vyhodnotit primární podíl jednou po zmrazení dat, samostatně podle politiky přiřazení. Následující původní pravidlo s intervalem spolehlivosti platí výhradně pro hash50_v1. Uvést n/N pro A a B, rozdíl B minus A v procentních bodech a dvoustranný 95% interval pro rozdíl podle Newcomba ze dvou Wilsonových intervalů bez korekce kontinuity. Prakticky významná změna je předem stanovena na 3 procentní body. Větev B podpořit jen při odhadu alespoň +3 body a dolní mezi nad nulou. Pro A platí odhad nejvýše −3 body a horní mez pod nulou. Sekundární výsledky jsou popisné a nemohou nahradit primární rozhodnutí.

V hashové kohortě při méně než 100 přiřazených v kterékoli větvi, neúplném měření, předčasném zastavení nebo nesplnění rozhodovacího pravidla uvést přesně „výsledek zatím není přesvědčivý“. Minimum 100 identit ve větvi samo nezaručuje potřebnou přesnost. Ani kladný výsledek automaticky nemění běžný vstup.

Pro alternating_v1 uvést n/N a rozdíl B minus A pro primární i sekundární metriky jako popisná pozorování. Přidělení podle pořadí může souviset s časem, zdrojem příchodů a skladbou hráčů. Tato fáze nemá běžnou náhodnou randomizaci, proto z ní helper nevyhlašuje vítěze a nepoužívá původní Newcombův interval jako důkaz účinku. Celkový pooled podíl nesmí získat společný p-test ani kauzální interpretaci. Při malém vzorku, nevyřešené integritě nebo nejasném rozdílu použít závěr „výsledek zatím není přesvědčivý“. Jinak popisné výsledky posoudit společně s časovým a akvizičním složením obou větví. Produktové rozhodnutí vyžaduje toto posouzení.

Výsledek read-only SQL archivovat jako CSV s hlavičkou (psql --csv). Příkaz `python tools/entry_experiment_readout.py report.csv` kontroluje hashový poměr, oddělené kohorty a hodinový alarm. Archivní CSV bez policy_metrics zůstávají podporované jako čistě historická hashová kohorta. Při smíšených datech je tento sloupec povinný. Při finálním výpočtu po doložení integrity i celého náboru připojit `--intact-final`. Archivovat CSV, výstup, verzi kódu a čas pořízení. Zpětný odečet nepředstavuje historický snapshot databáze.

## Provozní postup původního spuštění

Dne 4. 11. 2026 obsluhovala hrajproplet.cz revize main `c402d3bfb07d4808ae1f2b23d891b838967e8800`, verze 4.10.19. Nasazené first-steps používají trainingWin → startFirst → POST /api/first-board/assignment. Čtecí kontrola definice RPC na produkčním PostgreSQL potvrdila policy `challenger_rollout_20261007` a desku `g4-e-009`. Před spuštěním znovu ověřit alias, SHA, banku i RPC.

1. V rámci schváleného nasazení připravit databázovou migraci verzovanou v tomto PR a následně nasadit odpovídající klient i server. Migrace zakládá zavřenou databázovou bránu. Před spuštěním musí projít izolované testy obou větví, načtení reportu i kontrola jeho přístupu k ledgeru.
2. Připravit produkční release s PROPLET_ENTRY_EXPERIMENT_ENABLED=1. Po ověření nasazeného klienta, serveru, databáze a reportu spustit jednorázový aktivační příkaz níže. Vrácené konkrétní časy začátku a konce, termín zmrazení, SHA, identitu operátora a stav brány zaznamenat. Pokud příkaz nevrátí právě jeden řádek, nezačínat nové okno a zjistit uložený stav.
3. Pro okamžité ukončení nových přiřazení uzavřít bránu druhým příkazem. Původní ledger a report zachovat. V dalším běžném nasazení odebrat proměnnou prostředí. Vypnutí ani uzavření kalendářního okna nepřepíše uložený postup.

Každý příkaz je samostatná operace obsluhy na správném prostředí. První patří výhradně ke schválenému spuštění.

```sql
WITH activation AS MATERIALIZED (SELECT clock_timestamp() AS starts_at)
UPDATE proplet_experiment_internal.entry_control AS c
SET starts_at=a.starts_at, ends_at=a.starts_at+interval '14 days', enabled=true
FROM activation AS a
WHERE c.singleton AND c.starts_at IS NULL AND c.ends_at IS NULL
RETURNING c.enabled,
          c.starts_at AT TIME ZONE 'UTC' AS starts_utc,
          c.ends_at AT TIME ZONE 'UTC' AS ends_utc,
          c.starts_at AT TIME ZONE 'Europe/Prague' AS starts_prague,
          c.ends_at AT TIME ZONE 'Europe/Prague' AS ends_prague,
          ((c.ends_at AT TIME ZONE 'Europe/Prague')::date+2)+time '09:00' AS freeze_prague;
```

Okamžité bezpečnostní zastavení a kontrola výsledného stavu:

```sql
UPDATE proplet_experiment_internal.entry_control SET enabled=false WHERE singleton RETURNING enabled;
SELECT enabled, starts_at, ends_at FROM proplet_experiment_internal.entry_control WHERE singleton;
```

## Předání změny politiky

Před případným nasazením tohoto PR ověřit aktuální produkční SHA, uložený starts_at/ends_at a kontrolu ranního reportu. Migrace musí zachovat existující interval, přidat politiku a oddělené pořadí a zapsat čas přechodu. Zaznamenat nasazené SHA, čas přechodu v UTC i Europe/Prague a první pořadové číslo nové fáze. Výsledky před přechodem neoznačovat zpětně jako střídavé.

Při bezpečnostním zastavení použít stávající enabled=false. Obnovení se řídí novým schválením a pokračuje v uloženém pořadí. Přechod ani bezpečnostní vypnutí nezakládá další čtrnáctidenní okno. Ověření připraveného PR probíhá na lokálních syntetických datech.
