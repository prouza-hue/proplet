# Dvoutýdenní experiment se vstupem nových hráčů

Preregistrace z 4. listopadu 2026, klíč `new-player-entry-v1`. Tento plán čeká na samostatné rozhodnutí o spuštění. Hypotéza je, že vynechání tréninku zvýší pravděpodobnost dokončení alespoň jedné skutečné hry do 24 hodin.

## Nábor a zásah

Pevný začátek je 16. 11. 2026 v 00.00 Europe/Prague včetně, konec 30. 11. v 00.00 bez tohoto okamžiku. V UTC jde o 15. 11. ve 23.00 až 29. 11. ve 23.00. Poslední den pro návraty D1 končí 1. 12. v 00.00 pražského času. Zvolené finální zmrazení dat je 2. 12. 2026 v 09.00 Praha (08.00 UTC), aby doběhl i opožděný sběr. Výsledky archivovat k tomuto času. Pokud není připravený celý experiment před začátkem, nespouštět zkrácený nábor. Náhradní termín vyžaduje novou dohodu před náborem.

A absolvuje současný trénink PES, LES, ČAJ a pak první Volnou hru. Dokončení tréninku nese stávajících 10 XP podle běžných pravidel. B otevře rovnou tutéž g4-e-009. Vynecháním tréninku hráč v B jeho 10 XP nezíská. Rozdíl odměny je součástí měřeného zásahu. Ovládání, pomoc, odměna za skutečnou desku a okamžik nabídky účtu po jejím dokončení jsou společné.

Jednotkou je nová first-party identita bez předchozího vstupu do onboardingu nebo skutečné hry. Jmenovatelem v každé větvi jsou všechna serverová přiřazení v okně, včetně identit bez dalších událostí. Přiřazení 50/50 je deterministické bez průběžného dorovnávání. Každý flow se počítá jednou podle původní větve i po převodu na účet. Zahrnout pouze produkci s is_test=false, shodně pro přiřazení, hry i události. Testovací a interní průchody se značí předem. Nejasné vazby se hlásí jako závada integrity.

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

Čas do otevření popsat jen diagnosticky. Událost startu ani synchronizace výsledku sama o sobě nedokládá skutečné dokončení. Propojení první desky vyžaduje souhlas flow, ID pokusu a ID desky.

## Ranní report a bezpečnost

Ranní manažerský report Proplet (ID automatizace `rann-mana-ersk-report-proplet`) běží v 09.00 Europe/Prague za předchozí uzavřený den. Používá projekt Supabase `iopyhluayfszskyqqpuc` a externí `work/reporting-tools/report-methodology-reference.md` ze staršího projektu. Administrátorský historický launch report je jiný zdroj.

Před povolením náboru ověřit v odkazované metodice existující vazbu na preregistraci a soubor `docs/audits/ENTRY-EXPERIMENT-READOUT.sql` na přesně nasazeném commitu. Zkontrolovat načtení metodiky ranní automatizací a její první read-only výpočet. Pokud napojení chybí, ponechat nábor vypnutý. Neměnit čas, příjemce ani stručný formát reportu.

Každé ráno interně archivovat datum, čas odečtu, release, počet včerejších a celkových přiřazení A/B, otevřená okna, výsledek kontroly poměru a chyby. Vynechání tréninku v B není propad. Před finálním odečtem nepublikovat průběžná srovnání úspěšnosti. Do manažerského shrnutí patří odchylka vyžadující zásah. Produkční ověření je jen čtecí.

Nábor hned vypnout při prokázaném přeřazení, přepsání rozehrané hry, odlišné první desce, nefunkční pomoci či předčasné nabídce účtu, ztrátě postupu při přihlášení nebo při zařazení testovacích dat jako hráčů. Vypnout také při nejméně pěti identitách s potvrzeným selháním načtení a podílu alespoň 10 % v jedné větvi mezi alespoň 30 identitami přiřazenými v poslední hodině. Při celkovém N ≥ 100 kontrolovat přesným oboustranným binomickým testem poměr 1:1. Při p < 0,001 pozastavit nábor a prověřit implementaci. Alarm vyšetřit hned, nečekat na ranní report. Zapsat přesný čas zastavení, důvod a rozsah škody. Dosavadní přiřazení zachovat. Bez dohody nábor znovu neotevírat a neprodlužovat.

## Jedno závěrečné rozhodnutí

Vyhodnotit primární podíl jednou po zmrazení dat. Uvést n/N pro A a B, rozdíl B minus A v procentních bodech a dvoustranný 95% interval pro rozdíl podle Newcomba ze dvou Wilsonových intervalů bez korekce kontinuity. Prakticky významná změna je předem stanovena na 3 procentní body. Větev B podpořit jen při odhadu alespoň +3 body a dolní mezi nad nulou. Pro A platí odhad nejvýše −3 body a horní mez pod nulou. Sekundární výsledky jsou popisné a nemohou nahradit primární rozhodnutí.

Při méně než 100 přiřazených v kterékoli větvi, neúplném měření, předčasném zastavení nebo nesplnění rozhodovacího pravidla uvést přesně „výsledek zatím není přesvědčivý“. Minimum 100 identit ve větvi samo nezaručuje potřebnou přesnost. Ani kladný výsledek automaticky nemění běžný vstup.

Výsledek read-only SQL archivovat jako CSV s hlavičkou (psql --csv). Příkaz `python tools/entry_experiment_readout.py report.csv` kontroluje poměr a hodinový alarm. Při finálním výpočtu po doložení integrity i celého náboru připojit `--intact-final`. Archivovat CSV, výstup, verzi kódu a čas pořízení. Zpětný odečet nepředstavuje historický snapshot databáze.

## Provozní postup

Dne 4. 11. 2026 obsluhovala hrajproplet.cz revize main `c402d3bfb07d4808ae1f2b23d891b838967e8800`, verze 4.10.19. Nasazené first-steps používají trainingWin → startFirst → POST /api/first-board/assignment. Čtecí kontrola definice RPC na produkčním PostgreSQL potvrdila policy `challenger_rollout_20261007` a desku `g4-e-009`. Před spuštěním znovu ověřit alias, SHA, banku i RPC.

1. Po schválení připravit databázovou migraci verzovanou v tomto PR a následně nasadit odpovídající klient i server. Migrace zakládá zavřenou databázovou bránu. Před spuštěním musí projít izolované testy obou větví, načtení reportu i kontrola jeho přístupu k ledgeru.
2. Připravit produkční release s `PROPLET_ENTRY_EXPERIMENT_ENABLED=1`. Před začátkem okna po samostatném souhlasu obsluhy otevřít databázovou bránu níže. Přesný okamžik provedení, SHA, identitu operátora a stav brány zaznamenat. Po zmeškání začátku tuto operaci neprovádět.
3. Pro okamžité ukončení nových přiřazení uzavřít bránu druhým příkazem. Původní ledger a report zachovat. V dalším běžném nasazení odebrat proměnnou prostředí. Vypnutí ani uzavření kalendářního okna nepřepíše uložený postup.

Každý příkaz je samostatná operace obsluhy na správném prostředí. První patří výhradně ke schválenému spuštění.

```sql
UPDATE proplet_experiment_internal.entry_control SET enabled=true WHERE singleton RETURNING enabled;
```

Okamžité bezpečnostní zastavení a kontrola výsledného stavu:

```sql
UPDATE proplet_experiment_internal.entry_control SET enabled=false WHERE singleton RETURNING enabled;
SELECT enabled FROM proplet_experiment_internal.entry_control WHERE singleton;
```
