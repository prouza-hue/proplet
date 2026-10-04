# Archiv a měsíční soutěž — rozhodnutí a příprava

Datum: 4. října 2026 (Europe/Prague). Stav: připravené návrhy a izolované opravy; ostrý Archiv ani měsíční soutěž nejsou tímto spuštěny.

## Ověřený výchozí stav

Produkční main a alias hrajproplet.cz: `a41c9e3b1ca55b86e3b6cf7935c30b6190e0e1db`. Produkční Supabase: `iopyhluayfszskyqqpuc`. Produkční prostředí a hlavní větev se při této přípravě nemění.

Oddělené návrhy:

- [Historické odměny — PR 177](https://github.com/prouza-hue/proplet/pull/177).
- [Klikací design a samostatné zadání Daily — PR 178](https://github.com/prouza-hue/proplet/pull/178).
- [Obsah a přesná alternativní řešení — PR 179](https://github.com/prouza-hue/proplet/pull/179).

Dříve schválené doplnění chybějících odměn bylo provedeno 4. října v 12:37 pražského času: 21 řádků, 12 hráčů, 3 185 XP. Tato příprava takové doplnění neopakuje. Michael ani PiettraWal neměli v této opravě chybějící odměnu.

## Historická odměna a současná úroveň

Současná Těžká 29 a historická Těžká 29 jsou jiné desky. Číslo 29 samo o sobě není důvod odečíst nebo zablokovat historickou odměnu. Michaelův výsledek g4-h-029 zahrnuje současnou odměnu a návratový bonus; dosud nezískaný slot G1–G3 zůstává samostatným nárokem.

Starší generace G1, G2 a G3 naopak sdílejí jednu historickou odměnu za stejnou obtížnost a číslo. Opakované hraní jiného starého vydání stejného slotu nesmí platit znovu. Zahranost konkrétní desky a získaná odměna za historický slot proto mají oddělené stavy.

Připravená oprava zavádí vlastní evidenci `historical_free_slot_rewards`. Existující zaplacenou historii převádí do této evidence bez přičítání nebo přepisování XP. Původní ledger zůstává zachován. Nový výsledek nejprve vznikne s nulou XP; teprve vítěz unikátního historického nároku obdrží odměnu v téže transakci. Prohra souběžného nároku ponechá nulu. Opakování stejného výsledku žádný nárok nespotřebuje.

Oprava obsahuje uzavřenou přechodovou bránu. Bezpečný postup je: runtime s historickými zápisy vypnutými, ukončení starých zapisujících instancí, databázový skript, kontrola a doplnění spotřebovaných slotů bez dalších XP, ověření a teprve zapnutí s dokončeným obsahem. Kontrola historie sama nenahrazuje synchronizaci souběžných zapisovačů.

Dvojí platba byla doložená možnost v kódu; nejde o důkaz nového incidentu u Michaela nebo PiettraWal.

## Obsah Archivu

První vydání zachovává původních 800 G3 desek, čtyři obtížnosti po 200. Historické ID, cesty, původní obsah a nároky se nemění. Přístup k desce je přímý, bez odemykání předchozích čísel.

Strukturální kontrola prošla u všech 800 desek; jejich 7 626 původních cílových slov je ve schváleném produkčním Lexikonu V2. Není správné při zpřístupnění přepsat stará řešení na náhodné nové desky vyrobené Gen6.

Počty řešení závisejí na auditním slovníku:

| Auditní rozsah | Jednoznačné desky | Víceznačné desky |
| --- | ---: | ---: |
| 13 441 statických rozpoznávaných slov | 785 | 15 |
| Reprodukovaný širší snapshot 103 836 slov | 714 | 86 |

Širší snapshot obsahuje slovníkový šum, vlastní jména a tvarové varianty. Přítomnost ve wordfreq tedy není redakční souhlas. Každé nekanonické celé řešení se eviduje s přesnými cestami a verdiktem. Původní řešení všech 800 desek zůstávají zachována.

Širší audit eviduje 100 nekanonických celých řešení: po nezávislém jazykovém review je 64 schválených, 21 odmítnutých a 15 čeká na konečné redakční rozhodnutí. Schválené alternativy se týkají 57 desek; otevřené varianty 12 desek. Všechny původní kanonické sady zůstávají zachovány. Podklady obsahují všech 864 schválených celých řešení včetně 800 originálů.

Běžná česká slova a doložitelné srozumitelné tvary se mohou v Archivu přijmout jako konkrétní celá řešení. Povolení slov po jednom by u některých desek připustilo neplatnou směs různých krytí. Obnovení rozehrané hry, výběr nápovědy a dokončení musí pracovat se stejnou množinou kompatibilních celých řešení. Slovo schváleného cílového řešení se současně nesmí vykazovat jako bonusový objev.

Přípravný pomocný modul a kontraktové testy nejsou zapojené do živé aplikace. Zbývající redakční rozhodnutí, skutečné propojení vstupu/nápověd/obnovení a ověření odměn po tomto propojení jsou podmínky zveřejnění. Všech 800 slotů zůstává v manifestu i v případě sporného jazykového nálezu.

## Klikací design

Návrh zachovává Tiskařskou dílnu, Fraunces, Outfit, stávající logo a významy obtížnostních ikon.

Na Hrát je Archiv první výrazná karta pod titulkem, před současnými obtížnostmi. Obsahuje počet 800 a přímé CTA „Prohlédnout staré desky“. Oznámení počtu a možnosti libovolného pořadí je viditelné bez procházení seznamem obtížností.

Přehled Archivu obsahuje obtížnosti, hledání čísla, přepínače Všechny / S odměnou / Nehrané a samostatné stavy Hraná–Nehraná a XP už získány–Odměna. Libovolnou desku lze otevřít přímo; pagination není postupové odemykání.

Navržená textace:

> Tyhle desky pamatují naše začátky. Některá slova a obtížnost jsou svéráznější než dnes. Byla by ale škoda je všechny zahodit.

> Vyber si jakoukoli desku. Nemusíš hrát postupně. Historická XP získáš tam, kde jsi je dosud nezískal. Odměna ze stejné původní úrovně se podruhé nepřičte.

Dnes už nevypisuje šest volných obtížností. Obsahuje Daily, měsíční soutěž, Tajenku, týdenní týmovou soutěž a dvě vstupní karty Hrát a Archiv. CTA „Hraj podle obtížnosti“ vede na Hrát.

Doporučený název přehledu zůstává Dnes, protože obsahuje i nesoutěžní vstupy. Alternativa Soutěže je dostupná k porovnání; změna názvu hlavní navigace není považována za schválené produkční rozhodnutí.

Modelové listopadové, lednové a květnové barvy a motivy ukazují měsíční proměnu. Listopad v návrhu není určený start sezóny. Jména, body i postupy desek jsou výslovně smyšlené.

## První verze měsíční soutěže

| Pravidlo | Návrh první verze |
| --- | --- |
| Vstup | Stejná oficiální Denní výzva pro všechny, automatické zařazení |
| Platný pokus | První oficiální pokus na výzvě, odehraný v jejím pražském dni |
| Dokončení | 100 soutěžních bodů |
| Bonus | +20 bez obsahové nápovědy |
| Započtené dny | 20 nejlepších denních výsledků v daném měsíci |
| Maximum | 2 400 bodů |
| Výběr při stejných denních bodech | Rychlejší výsledek jde do započtené dvacítky |
| Pořadí při stejných měsíčních bodech | Kratší součet časů právě započtených dvaceti výsledků |
| Přesná remíza | Sdílené umístění, např. 1., 1., 3. |
| Celoživotní XP | Neovlivňují měsíční body; archiv, pozvánky a jiné bonusy se nezapočítají |
| Odznaky | Oceněná místa 1–3, měsíční motiv, rok a umístění; bez dalších XP |
| Definitivní uzavření | Po měsíci 48 hodin na reklamace |

Po dosažení dvaceti výsledků silnější další den nahradí slabší. První oficiální pokus se nesmí zlepšovat opakováním, přehráváním nebo zpětným dohráním. U stejné hodnoty a času musí být výběr dvacítky stabilní podle data, aby se součet neměnil náhodným pořadím databázových řádků.

Obsahová nápověda odhaluje řešení nebo jeho části. Ovládací trénink, přístupnost, zvětšení písmen a technická pomoc bonus neodebírají. Při implementaci je nutné klasifikovat skutečné ovládací prvky; nestačí nekriticky převzít součet všech pomocných interakcí.

Body, den, první pokus a čas ověřuje server. Celoživotní úroveň, datum registrace ani čekající archivní XP nezakládají výhodu. Časové pořadí předpokládá jednotnou a ověřenou metodiku měření ve stejných herních podmínkách. Přijetí návrhu pravidel není tvrzení, že je již existující měření certifikované pro sezónu.

Odznaky jsou samostatné sezónní úspěchy, např. „Vládce listopadu 2026“, „Stříbro listopadu 2026“, „Bronz listopadu 2026“. Při sdíleném oceněném místě získají odznak všichni takto umístění. Každý měsíc má vlastní nezaměnitelný rok/měsíc/umístění; nelze ho získat v dalším měsíci.

Oznamovací modal navazuje na refresh300: velký Fraunces, tónovaný papír, tři ilustrované medaile, jasné tři kroky, viditelné maximum 2 400, rozbalovací úplná pravidla a CTA do Daily. Ostrá textace konkrétního měsíce se použije teprve po potvrzení startu.

## Denní banka — proč samotné postupné zobrazení nestačí

Produkční veřejný soubor vrací 366 Daily položek včetně písmen a odpovědí. Serverová rotace obsahuje 365 současných desek; veřejná navíc nese historickou kompatibilitu g3-d-007. UI odemyká postupně, avšak budoucí desky už lze z veřejného souboru získat předem. Toto zjištění není obvinění hráčů z jejich využívání.

Přegenerování musí proto doprovodit distribuce podle serverového pražského dne. Budoucí banku nelze znovu vložit do public/puzzles.json, SW, přednačítání ani veřejného preview. Historie se musí řešit samostatně a kompatibilně.

[Samostatné zadání Lexikon V3 + Gen6](DAILY_GEN6_REGENERATION_HANDOVER_20261004.md) obsahuje zmrazené vstupy a přesné hashe, skutečný výrobní snapshot, Daily adaptér, nová neměnná puzzle ID, zachování daily:datum, offline historii, DST, reprodukovatelný audit a podmínky přechodu. Nová banka zatím není vyrobená ani schválená.

## Ověření a zbývající podmínky

Browserová kontrola běží v izolovaném Chromium nad statickým návrhem se stejným CSP jako produkce. Ověřuje šířky 320/390/768/1440, světlý i tmavý vzhled, skutečně načtené české fonty, dlouhé názvy obtížností, přímý výběr desky 88, ESC, oběh klávesového fokusu a CTA do Daily. Síťové požadavky jsou omezené na lokální statické soubory a Google fonty; žádné herní API ani SW. Finální ověření návrhu e0e7ccd54d98932f25ef5878f3b1a722cbc3511f prošlo: 37 kontrol, 11 snímků, nulové chyby prohlížeče a nulové selhané požadavky. [Browserová kontrola](https://github.com/prouza-hue/proplet/actions/runs/37238159142). Snímky byly také vizuálně prohlédnuté; po nálezu ořezu dlouhých názvů je návrh opravený a znovu ověřený. Přesná poslední verze a PASS/FAIL jsou v public/previews/archive-season-verification/verification.json.

Oprava odměn je ověřována skutečným izolovaným PostgreSQL 17.11: souběh odlišných G2/G3 desek jednoho slotu, replay potvrzení, rollback, původní nuly v ledgeru, opakované naplnění evidence, moderní nárok versus historický a přístupová práva. Samostatný test souběhu i finální databázová sada prošly: [run 37237977906](https://github.com/prouza-hue/proplet/actions/runs/37237977906), isolated-result-database job 111540818476, head 01bacf3976c645c3a3d18fff7674debe3e9981bd. Generation 4 contract rovněž prošel.

Celkový Current runtime gate hlásí dva již existující rozdíly snapshotu inventáře API (S04/S06). Stejně selhávají i ve větvi, která žádný runtime nemění. Tyto digesty se v této přípravě nezměnily jen kvůli zelenému stavu. Konkrétní funkční a databázové výsledky jsou odděleně doložené v jednotlivých PR.

Před spuštěním je potřeba dokončit redakční otevřené body Archivu, integrovat a end-to-end ověřit skutečnou hru a její odměny, vyrobit a prověřit novou neveřejnou Daily banku a sjednotit měření soutěžních pokusů. Ostrá měsíční soutěž začne až dohodnutým prvním celým pražským kalendářním měsícem po těchto ověřeních. Žádné konkrétní datum nebylo touto přípravou stanoveno.
