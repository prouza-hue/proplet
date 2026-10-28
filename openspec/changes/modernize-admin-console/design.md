## Context

Podklady a omezení přístupu zachycuje `audit.md`. Návrh je z 29. 10. 2026, založen na produkčním SHA `1de7389`, nikoli na nepublikované měsíční soutěži. Admin je samostatná statická stránka nad FastAPI; nový framework ani samostatná služba nejsou potřebné. Prvním uživatelem je vlastník Propletu. Návrh neuděluje oprávnění ke spuštění jakékoliv opravy konkrétního hráče.

## Goals / Non-Goals

**Goals:** Rychle poznat, co vyžaduje zásah; najít správného hráče; vyřídit a znovu dohledat případ; bezpečně obnovit přístup; vidět současný obsah, kvalitu a provoz; rozumět původu každého čísla. Udržet administraci použitelnou na desktopu, mobilu a rozloženém Foldu.

**Non-Goals:** První vydání nezahrnuje univerzální editor databáze, automatické slučování účtů, mazání Auth identit, libovolné změny XP, editaci puzzle banky, odesílání hromadných push ani ovládání deploymentů. Týmové přesuny, odpojení identity a korekce historických týmových bodů mají samostatnou druhou etapu. Měsíční soutěž nebude ukazována jako produkční schopnost, dokud ji skutečně neposkytuje aktuální runtime.

## Decisions

### 1. Jedno provozní centrum, sedm jasných sekcí

| Sekce | Úloha první verze |
|---|---|
| Přehled | Krátká fronta otevřených případů a doložených chyb; dnešní hra; čerstvost zdrojů. Přímé odkazy do detailu. |
| Hráči a týmy | Serverové hledání/stránkování; jednoznačné účty; porovnání 2–3 účtů; výsledky, XP, identity a recovery; týmy a členství ke čtení. |
| Hlášení | Podzáložky Podpora a Slova; stavy, hledání, kategorie, historie, interní poznámka, související hráč a puzzle. |
| Obsah a kvalita | Dnešní a nejbližší publikovaný program Daily/Extra/Tajenky, dostupnost bank a archivů; existující Quality a snapshoty. |
| Provoz | Doložená verze/prostředí/SHA; chyby dle typu a verze; push diagnostika; omezený přehled integrity účtů; poslední běhy pouze s doloženým zdrojem. |
| Analytika | Současná aktivace a návraty; oddělené populace návštěv, lokálního hraní a účtů; starý Launch pouze historický pohled. |
| Historie | Audit zápisů s filtrem cíle, akce a období, propojený s případem/hráčem. |

Přehled nebude druhou kopií všech tabulek. Fronta rozlišuje počet případů, počet událostí a počet hráčů. Jediný součet všech těchto jednotek by byl zavádějící. Zastaralý zdroj má vlastní stav a nezvyšuje počet hráčských případů.

### 2. Zachovat lehký stack, rozdělit podle odpovědnosti

`public/admin.html` bude sémantický shell; `admin.css` využije schválenou materiálovou a typografickou podobu Tiskařské dílny, lokální Fraunces/Outfit. Skripty rozdělit do adminových modulů pro API, routing/stav, přehled, hráče/recovery, případy, obsah/kvalitu a provoz/analytiku. Žádné zásahy do herního vzhledu kvůli adminu.

Navigace použije URL parametry například `?section=players&player=<uuid>` a podporu Back/Forward. E-mail, bearer token a volný citlivý text do URL nepatří. Zachovat `/admin.html` a existující `/admin` aliasy. Seznamy se obnovují cíleně; průběžná aktualizace nesmí přepsat rozepsanou poznámku. Všechny pozdní odpovědi budou svázané s identitou požadavku, nejen recovery.

Rozsáhlý detail bude samostatný panel/pohled s přímým odkazem; malé potvrzení použije nativní dialog a úplnou správu fokusu. Otevření přes skutečné tlačítko nebo odkaz, Escape a návrat fokusu, čitelné formuláře a dotykové cíle kolem 44 px. Počítat i s 320px šířkou; řádková data na mobilu převést na označené bloky nebo izolovaný posuv tabulky, nikoliv posuv celé stránky. Žádné eyebrow nadpisy.

### 3. Každý datový zdroj sděluje, co opravdu ví

Nové souhrny mají metadata `generatedAt`, `period {from,to,timeZone}`, `source`, `status`, `coverage` a případný `requestId`. Povolené stavy zahrnou loading, ready, empty, partial, stale, unavailable a error. `empty` vyžaduje úspěšný úplný dotaz s nulovým výsledkem; chyba není nula. Starší data lze ponechat se stavem a časem, nikdy se nesmějí jevit jako čerstvá. Půlnoc a kalendářní období jsou Europe/Prague; uložené timestampy se nezaměňují s lokálním datem.

Příklad kontraktu návrhu: `{data: {...}, meta: {generatedAt, period, source, status, coverage, definitionVersion}}`. Je to nový návrh, nikoliv popis dnešního API. Existující odpovědi měnit aditivně nebo přes nový admin endpoint; herní API neměnit kvůli adminu. Drahé výpočty držet na serveru s omezením rozsahu a krátkou cache, která zachová skutečný čas generování. Obnovení jedné sekce nesmí spustit kompletní sken všech hráčů a historie.

### 4. Opravit kontrakty hráčů před přidáváním ovládacích prvků

Rozšířit GET `/api/admin/users` o validované `offset`, `limit`, povolené `sort`, přesné UUID a skutečné total. Stejný princip pro support, reports a audit; total počítat nad filtrem před limitováním. Použít existující RPC a indexy, kde vyhovují. Klientský filtr první načtené stránky nenahradí serverové hledání.

Seznam i detail musí čerpat z téhož autoritativního modelu XP jako současný účet, včetně account rewards a platných pravidel. Použít dávkový serverový souhrn pro stránku, ne N dotazů do `player_stats` na N řádků. Nezavést další paralelní XP vzorec. Oddělit poslední aktivitu a poslední dokončenou hru. Neznámá nebo historicky chybějící identita je „nezjištěno“, ne potvrzení bezpečného účtu.

Zobrazení úplného UUID a jeho kopie je dostupné v detailu; seznam může mít zkrácené ID. Porovnání uvádí XP, výsledky, aktivitu, tým, stav hesla, maskovaný ověřený e-mail, Google vazbu a stav recovery. Shodné jméno nikdy samo neprokazuje vlastnictví. Read-only týmy vycházejí z aktuálního členství a zvlášť uložených soutěžních výsledků; tyto pojmy neslučovat.

### 5. PR 118 převzít po funkcích na současný main

Celý původní diff lze textově aplikovat bez konfliktu, ale to neprokazuje bezpečnost. Převzít potřebnou serverovou funkci a testy do dnešní architektury; zachovat současný Google PKCE, explicitní link intent a kontrolu providerova potvrzeného e-mailu. Recovery UI vytvořit v novém detailu.

Průchod: vybrat jedno UUID → zobrazit identitu a stav → zadat cílovou schránku a důvod zásahu → serverový náhled/validace → potvrdit konkrétního hráče → odeslat ověřovací odkaz → stav „čeká na ověření“ → skutečné ověření schránky přes existující endpoint → běžná obnova hesla hráčem. Odeslání e-mailu není dokončená obnova. Admin nenastavuje heslo, nezobrazuje token ani neoznačuje e-mail ručně za ověřený. Stávající PR nemusí obsahovat navržený serverový náhled; jeho přidání je součást realizace.

Serverový owner pin platí pro každý `/api/admin` endpoint, včetně samostatných installerů, GET i POST a snapshotu. Vyžadovat aktivní oprávnění a explicitní write kontrolu pro zápisy. Klientská informace o týmu není autorizace. Pin se nesmí při testování produkce obejít novým obecným owner grantem.

Challenge lifecycle musí mít jednu sdílenou autoritu s běžným auth flow. Vydání, revokaci a spotřebu řešit databázově transakčně s jednoznačným pořadím a kontrolou konfliktu při finálním přiřazení. Kontrolovat také stav/revizi identity cílového účtu při náhledu, odeslání a spotřebování: pokud si mezitím ověří jinou schránku nebo změní auth vazbu, starý challenge nesmí novou identitu přepsat. Stejná již ověřená schránka může mít explicitní idempotentní výsledek `alreadyVerified`. Dva souběžné požadavky nesmějí vytvořit dva účinné odkazy. Při neúspěšné revokaci se nový e-mail nevydá. Selhání externího doručení zanechá challenge neúčinný a jasný audit výsledku; protože e-mail není součást DB transakce, opakování musí být idempotentní. Použitý, expirovaný a superseded odkaz odmítnout. Audit musí být spolehlivou součástí přechodu nebo trvalého outboxu; selhání auditu nesmí produkovat nezdokumentovaný úspěch.

UI používá AbortController/generaci requestu a ověřuje shodné UUID před renderem i odesláním. Potvrzení zobrazuje pevný cíl. Pomalá odpověď pro A po otevření B se zahodí. Všechny výstupy maskují schránku, textové vstupy se escapují. Povolit jen ověřené callback origins prostředí; produkční recovery nesmí odkazovat na dočasné preview.

### 6. Současné měření nejprve prokázat

Definovat první kroky podle aktuálního runtime: otevření tréninku → dokončení krátkého tréninku → start první skutečné volné hry → její dokončení → nabídka uložení → dokončená autentizace → serverem potvrzené uložení. Jde o požadované obchodní kroky; jejich mapování na existující události se musí ověřit. Případy přeskočení či návratu mají vlastní větev, nikoli automatický neúspěch.

Funnel má verzi definice, verzi onboardingu, stejnou populaci a jmenovatel u každého přechodu. Před propojením anonymního a účtového identifikátoru potvrdit skutečně dostupnou vazbu a preference měření. D1 a D7 počítat nad úplnými uzavřenými kalendářními kohortami s explicitním jmenovatelem; nezralá kohorta je „zatím nelze vyhodnotit“. Historická data nelze zpětně vymyslet. Nové měření může začínat datem vydání a do té doby zůstat neověřené.

Kvalita zůstává nad prvními životními pokusy v doloženém 90denním okně, se samostatným calm mode, vyřazenými deskami, velikostí vzorku a omezenou historií. Aktivovat historii snapshotů. U desek uvést podporovaný režim; neprezentovat Tajenku/Extra jako analyticky pokryté jen proto, že se objevily v programu obsahu.

### 7. Využít provozní diagnostiku, nevyrábět nepravdivé kontroly

Znovu použít account-integrity, push-diagnostics a quality-history, sjednotit autorizaci a doplnit bezpečné limity. Integrity je indikace krátkého registračního burstu, ne seznam účtů jedné osoby. Diagnostika push neodesílá zprávy. Provoz uvádí výsledky skutečných kontrol, nikoli zelený stav z pouhého otevření stránky. Pro verzi/SHA použít serverem publikovaná bezpečná metadata; Vercel ani Supabase servisní klíče nepatří klientovi. Runtime API nebudou zavádět obecný proxy přístup k infrastruktuře.

### 8. Druhá etapa má oddělené operace a schválení rozsahu

Navržené rozšíření pro případy více účtů: auditovaný přesun konkrétního členství, samostatná korekce přiřazení výsledků za vybrané období a zvláštní odpojení ověřené identity. Každá operace potřebuje serverový dry-run, přesné UUID, důvod, aktuální předpoklady/revizi, transakci, idempotenci a audit před/po. Kontrola `players_family_name_ci` musí proběhnout před zápisem a současně uvnitř transakce. Přesun členství sám nepřepíše staré výsledky; korekce soutěžních dat vyžaduje zvláštní potvrzení dopadu. Historii účtů zachovat. Toto není součást prvního release ani automatické svolení opakovat minulý zásah z chatu.

## Risks / Trade-offs

- [Neúplná telemetrie] → Viditelná coverage, datum počátku měření, nezralé kohorty; neblokovat bezpečné recovery kvůli chybějící analytice.
- [Drahý dashboard] → Dávkové souhrny, indexy, stránkování, omezená období, nezávislé načítání a měřená cache; zkontrolovat query plán.
- [Chybný výběr jednoho z více účtů] → Stabilní UUID, porovnání, pevné potvrzení cíle, ochrana souběhu a žádné automatické slučování.
- [Stará větev auth] → Přenos funkcí PR 118 na nový main, nové regresní testy včetně dnešního Google flow.
- [Selhání e-mailu po DB kroku] → Stavový automat, cleanup/idempotence, audit a ověřený průchod v izolaci.
- [Preview používá produkční DB] → Statický návrh bez API; pro implementaci testovací prostředí s ověřeným projektem a blokací produkčních mutací. Nepovažovat suffix vercel.app za důkaz izolace.
- [Přestavba zkomplikuje běžné použití] → První obrazovka s konkrétní frontou a proklikem, české názvy, historie filtrů, postupné zveřejnění hotových bloků.

## Migration Plan

1. Znovu ověřit produkční SHA, nový main, souběžné větve a DB. Po přijetí návrhu pracovat v samostatné implementační větvi a draft PR; PR 118 nemergovat samostatně bez vyřešení nalezených problémů.
2. Připravit backendové změny aditivně a potřebné migrace ověřit v izolovaném fixture prostředí podle `tests/current/README.md`. Společně udržet release/cache kontrakt, pokud se adminové assety účastní PWA cache.
3. Dokončit nový shell, opravené seznamy/XP a hlášení, recovery se zabezpečením; poté zapojit obsah, diagnostiku a prokázané měření. Nedokončené měření má otevřený stav, nikoliv vymyšlená čísla.
4. Ověřit autorizační matici, recovery E2E na vyhrazené testovací schránce a DB, chování při selhání, plný dotčený gate a browser průchody mobil/Fold/desktop + obě témata. Produkční hráči nejsou fixture.
5. Připravit konkrétní release candidate a preview k finálnímu rozhodnutí o nasazení. Produkční migrace a vydání provést až v autorizovaném realizačním kroku, se znovu ověřeným cílem.
6. Po vydání ověřit `/admin.html`, přístup neownerů, správnost známého souhrnu bez mutace, datum zdrojů a chybové logy. Zapsat datum/SHA/deployment/ověření/otevřené body.

Rollback musí zachovat owner-only ochranu a opravy challenge lifecycle. Návrat na původní nezabezpečené recovery chování není přijatelný. Lze samostatně vypnout recovery zápisy nebo vrátit kompatibilní shell; aditivní DB změny ponechat, žádný automatický destruktivní rollback. Analytická historie zůstane verzovaná.

## Open Questions

Pro produktový směr první etapy není nutná další odpověď. Před vydáním zbývá doložit pokrytí eventů, autorizovanou testovací schránku, skutečné zdroje posledních cron běhů a finální produkční RC. Rozsah citlivých operací druhé etapy se rozhodne samostatně nad jejich konkrétním návrhem.
