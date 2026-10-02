# Osvěžení běžné hry: 300 nových Propletů

Připraveno 2. října 2026 pro Pavla a navazující práci místního Codexu. Balíček obsahuje **100 nových desek pro Snadnou, 100 pro Střední a 100 pro Těžkou**, kompletní katalog, návrhy CTA a konkrétní společnou cestu. Všech 300 nových slovních sestav prošlo AI redakční kontrolou a samostatným technickým ověřením.

**Stav: hotový kandidátní obsah a hratelný návrh k prohlédnutí. Produkční nasazení ani migrace hráčských nastavení nejsou součástí této práce.**

Nejdřív otevři **[BALICEK.html](BALICEK.html)**. Funguje přímo z disku, bez serveru a bez internetu: obsahuje přehled, CTA, návrh průchodu i prohlížecí katalog všech 300 skutečných mřížek. Cílová slova jsou označená jako řešení a skrytá pod rozbalovacím prvkem. Katalog lze filtrovat podle obtížnosti, ID, čísla úrovně nebo slova.

Pro **hratelné preview** rozbal celý ZIP do jedné složky a ve Windows spusť `spustit-preview.cmd`. Pomocník spustí PowerShell server pouze na `127.0.0.1:8874` a otevře prohlížeč. Pro ukončení zavři okno serveru. Nevyžaduje instalaci Pythonu ani Node.js. Soubor `preview/index.html` potřebuje HTTP server; otevření přímo z disku je určené pro dokument `BALICEK.html`.

Preview obsahuje všechny nové desky, výběr obtížnosti, přímý katalog i ukázku společné cesty. Konkrétní desku lze otevřít bez postupného dohrání předchozích. Texty a chování CTA jsou návrh pro uvedení balíčku. Postup v ukázce je místní a oddělený od produkční hry; náhled neodesílá skutečné výsledky do serverových žebříčků.

## Co je v balíčku

| Soubor nebo složka | Co obsahuje |
|---|---|
| `BALICEK.html` | Samostatný obsahový přehled a katalog všech 300 mřížek se skrytými řešeními |
| `README.md` | Tento přehled zadání, rozhodnutí, copy, průchodu a hranic ověření |
| `spustit-preview.cmd`, `spustit-preview.ps1` | Spuštění místního hratelného preview ve Windows |
| `preview/` | Hra v původním UI s novým obsahem a navrženým společným pořadím |
| `content/gen6/free-refresh-300/` | Úplná banka, katalog CSV, manifest průchodu a redakční i technické podklady |
| `content/gen6/free-refresh-300/preview-verification/` | Záznam ověření hratelného preview a ukázky obrazovek |
| `content/gen6/free-refresh-300/preview-verification-final/` | Finální ověření distribuované hry a Windows spouštěče; aktuální screenshoty |
| `content/gen6/free-refresh-300/guide-verification/` | Ověření otevření přehledu z disku, filtrů a zobrazení skutečného řešení |
| `verification/restored-content-verification.json` | Dnešní kontrola shody původní banky, zdrojů a hotových důkazů |
| `work-free-refresh/` | Přesný snapshot výrobních nástrojů a vstupů pro navazující práci Codexu |
| `MANIFEST.json` | SHA256 každého souboru balíčku a přesný rozsah kontrol |

## Nové desky

| Obtížnost | Nové desky | Rozměry | Cílová slova na desce | Podíl slov z doplnění v3 |
|---|---:|---|---:|---:|
| Snadná | 100 | 75× 5×5, 25× 6×6 | 4–5 | 81,9 % |
| Střední | 100 | 7×7 | 6–7 | 75,9 % |
| Těžká | 100 | 9×9 | 8–9 | 65,9 % |

Celkem sada používá **1 284 různých cílových slov**. Jedno slovo se v celých 300 deskách objeví nejvýše třikrát. Podíl v3 se počítá z výskytů cílových slov, která přibyla schváleným doplněním zásoby; neznamená, že konkrétní hráč tato slova dosud neviděl.

Skladba střídá přírodu, domácnost, jídlo, řemeslo, činnosti, kulturu i pohádkové motivy. Snadná používá výhradně tier A. Střední míchá A a B. Těžká přidává C a větší geometrickou výzvu. Zachované profily určují i délky, počet aktivních polí, ohyby a odstup opakovaných slov.

Pro představu jsou první sestavy společné cesty:

| Obtížnost | První nová deska | Cílová slova |
|---|---|---|
| Snadná | `g6-refresh-easy-001` | DLAŽBA, TRÁM, PLYŠÁK, SNÍT |
| Střední | `g6-refresh-medium-001` | DUPOT, ŠÁLEK, ŠŇŮRA, SÝČEK, ÚSVIT, MUDRC |
| Těžká | `g6-refresh-hard-001` | HMOŽDINKA, REHEK, FÓLIOVNÍK, SKICA, VEDRO, TĚŽIŠTĚ, CHYT, CHŘEST |

[Katalog všech 300 desek](content/gen6/free-refresh-300/catalog-300.csv) uvádí každou desku, slova, profil i původ zásoby. [Úplná banka](content/gen6/free-refresh-300/bank.json) obsahuje samotné desky včetně cest řešení.

## Doporučené uvedení a CTA

Doporučuji věcnou variantu **„300 nových Propletů“**. Hráč hned ví, co přibylo, a může si vybrat vlastní obtížnost.

| Místo nebo situace | Text | CTA / chování |
|---|---|---|
| Karta na Dnes a Hrát | **300 nových Propletů** · „100 nových desek v každé ze tří obtížností.“ | **Vybrat hru** → výběr obtížnosti |
| Karta po části dohraného balíčku | „{N} nových desek ještě čeká.“ | Zbývající počet vychází z dohraných ID nových desek |
| Dnes po dohrání všech 300 | Karta se skryje | Přímý katalog zůstává dostupný |
| Ručně otevřená ukázka úvodního modalu | **300 nových Propletů** · „Snadná, Střední a Těžká. V každé 100 nových desek s pestřejšími slovy.“ | **Vybrat obtížnost** / **Teď ne** |
| Karta obtížnosti | „Nové desky: {X} / 100“ | X je počet dohraných nových desek v dané obtížnosti |
| Vysvětlení doporučené cesty | „Společné pořadí pro všechny. Dohrané desky přeskakujeme.“ | Použije se navržená společná cesta |
| Katalog | **Všech 300 nových desek** · „Každou můžeš otevřít přímo. Číslování původních úrovní zůstává zachované.“ | Přímé otevření vybrané desky |

Modal je v preview otevřený na výslovnou akci. Automatické zobrazení návratovým hráčům zatím navrženo není. CTA nerozhoduje obtížnost za hráče.

Dvě alternativy k doporučené hlavní kartě jsou připravené k výběru; v preview zůstává doporučená varianta:

| Varianta | Nadpis | Doprovodný text | Hlavní CTA |
|---|---|---|---|
| Hravější | **Čerstvá slova jsou na stole** | „100 nových desek ve Snadné, Střední i Těžké. Vyber si, na co máš dnes chuť.“ | **Pustit se do luštění** |
| Pro návratové hráče | **Nové desky pro tvoji hru** | „Ve třech obtížnostech čeká dalších 300 Propletů. Tvůj dosavadní postup zůstává.“ | **Vybrat obtížnost** |

## Konkrétní společný průchod

Navržený manifest `shared-refresh-v1` definuje stejnou posloupnost ID pro každého hráče v dané obtížnosti. Nabídka dalších desek se řídí dohráním, ne osobně náhodným přeskupením.

| Krok | Co se hráči otevře |
|---|---|
| 1. Návrat do zvolené obtížnosti | Jeho rozehraná deska, pokud existuje |
| 2. Po dohrání nebo bez rozehrané desky | První nedohrané ID ve společné posloupnosti |
| 3. Úvod nové sady | `g6-refresh-{obtížnost}-001` až `100` v pevně daném pořadí |
| 4. Po nové stovce | Dosavadních 300 aktivních desek téže obtížnosti; již dohraná ID se přeskočí |
| Kdykoliv v katalogu | Hráč může otevřít konkrétní desku podle jejího původního čísla |

Příklad: někdo má dohranou novou 001 a 003, ale nemá rozehranou hru. Dostane 002 a potom 004. Hráč s uloženou rozehranou starší deskou nejprve dokončí tuto desku. Oba tím zůstávají na stejném společném pořadí, jen přeskakují vlastní hotová ID.

V každé obtížnosti je v návrhu **400 aktivních desek: 100 nových + 300 dosavadních**. Žebříček používá ID desky, takže rozdílná historie hráčů nevytváří další kopie žebříčku. Koncentraci účasti společná cesta podporuje; zaplněný žebříček bez dostatečného počtu hráčů sama nevytvoří.

Číselný katalog nadále seřazuje původní obsah a za něj nové desky. Nová výroba neresetuje generaci hráčského postupu: runtime zůstává v generaci 4, označení Gen6 popisuje výrobní nástroj. Nové runtime úrovně jsou 318–417 ve Snadné a 317–416 ve Střední a Těžké. Číselné mezery vyhrazeného obsahu se nepřečíslovávají a rezervované rolling desky se tímto návrhem nezveřejňují.

První povinná deska a existující onboardingový experiment zůstávají před společnou cestou. Rozehraná offline deska se dokončuje na původním ID a verzi. Nová aktualizace používá další výslovně vydanou verzi manifestu.

Přesná posloupnost všech 400 ID na obtížnost i číselný katalog jsou v [manifestu průchodu](content/gen6/free-refresh-300/shared-route-manifest.json).

## Schválené základy a nový návrh

| Oblast | Stav |
|---|---|
| Úplná zásoba Lexikonu v3 | Již schválená; neměníme hesla, tiery ani dřívější jazyková rozhodnutí |
| Kalibrované profily obtížností | Zachované, včetně střídání 5×5 a 6×6 na Snadné |
| Jedna společná relativní cesta na obtížnost, přednost rozehrané hry, přeskakování hotových ID | Dříve schválený princip |
| Zachování ID, postupu, XP, původních výsledků a číselného katalogu | Dříve schválená podmínka |
| Těchto 300 konkrétních desek | Nově vyrobené a technicky i redakčně ověřené AI; čekají na uživatelské prohlédnutí |
| První nová stovka a za ní celý dosavadní aktivní katalog | Konkrétní nový návrh pořadí |
| Společná cesta jako default pro Snadnou, Střední a Těžkou | Předvedena v izolovaném preview; konkrétní přechod současných hráčů ještě potřebuje implementaci |
| Doporučené CTA a alternativy | Nový návrh copy; automatický návratový modal není zapnutý |

Rozhodnutí dohledatelná v [registru společné cesty, #146](https://github.com/prouza-hue/proplet/issues/146#issuecomment-5848867176) a ve [schválení zásoby v3, #148](https://github.com/prouza-hue/proplet/pull/148#issuecomment-5849652613).

## Ověření a předání

Technická kontrola používá úplnou zmrazenou sadu uznávání s **103 836 slovy**, včetně produkčního rozšíření a připnutého wordfreq. Pro všechny nové desky ověřuje jediné řešení i jedinečnost cest cílových slov. Globální historie zahrnuje 2 797 datovaných desek včetně nasazené Mozkokalypsy; historii jednotlivého hráče z ní neodvozujeme.

AI redaktor přečetl všech 300 konkrétních sestav. Jedna původní sestava Těžké byla vrácena a celá deska přegenerována; náhrada znovu prošla kontrolou. **Lidský playtest těchto nových desek zatím neproběhl.** Geometrické a slovní metriky nenahrazují naměřenou dobu řešení nebo hráčskou zábavnost.

- [Redakční posudek všech 300 desek](content/gen6/free-refresh-300/editorial-review.json) váže každé rozhodnutí na přesný otisk obsahu.
- [Samostatné technické ověření](content/gen6/free-refresh-300/independent-verification.json) uchovává důkazy solveru.
- [Přehled obsahu](content/gen6/free-refresh-300/content-summary.json) uvádí počty, podíly, tiery a rozměry.
- [Evidence redakční opravy](content/gen6/free-refresh-300/editorial-repairs.json) zachovává původní i náhradní sestavu.

Výrobní obsah vychází z produkčního SHA `5fc234e8e481950a68a25bf77f0103fab936532f` s nasazenou Mozkokalypsou. UI preview používá následně ověřený SHA `202899e93c8298207a9d33cce1d9cee442a3009e`; mezi nimi se výrobní slovní banky nezměnily. Pracovní větev pro navazující převzetí je `work/free-refresh-300-20261002`. Otisk finální nové banky je `7048e9bc26c8e7670bab4aad158bb87f73ff1bbf86e6215a7e262d2c3905635e`.

Pro vydání zbývá vybrat finální copy a konkrétní pořadí, prohlédnout hratelné desky, doplnit lidský playtest a samostatně implementovat serverový přechod ze současného `pestre-v1` na společnou verzi. Při převzetí místní Codex znovu ověří aktuální produkci a datové prostředí. Bývalé nastavení je potřeba zachovat pro návrat zpět a XP musí zůstat vázané na původní dokončení ID. Nasazení se provede teprve po schválení konkrétního výsledku.

## Dokončení balíčku 2. října 2026

Po obnovení místního spojení byly všechny původní soubory znovu dostupné. **111 kontrol shody prošlo**: fyzické bajty finální banky, všech 300 původních solver důkazů a redakčních záznamů, 46 původních zdrojů, 28 vstupních kontrol v3 i šest neměnných výstupů. Důkaz solveru pochází z původního dokončeného auditu; při dokončení balíčku jsme solver znovu nespouštěli a žádnou desku nenahrazovali.

Aktuální distribuovaná aplikace prošla **32 browser kontrolami**. Všech 300 desek bylo otevřeno v nativní hře, po jedné desce na obtížnost se dohrálo, ověřily se XP bez opakovaného připsání, oba existující onboardingové průchody, CTA i mobilní šířky 320 a 390 px. Kontrola nezaznamenala skutečné API či externí síťové požadavky ani konzolové chyby. Společný průchod prošel **14 scénáři**, Windows spouštěč **8 kontrolami** a přehled otevřený z disku **7 kontrolami**. Nejde o ruční dohrání všech 300 desek ani o test fyzických mobilních zařízení nebo skutečných serverových žebříčků.

Při dokončení byl exportovaný slovník sjednocen s přesnou zmrazenou sadou 103 836 slov, verze společné cesty se čte z manifestu a do distribučního preview byl doplněn obrázek knihy potřebný pro nativní uvítání. Tyto úpravy nemění banku, schválený Lexikon v3 ani produkční aplikaci. Kompletní aktuální reporty a reprezentativní screenshoty jsou součástí balíčku.

Pro obyčejné prohlížení a hraní není nutná instalace dalších nástrojů. Pro opakování kontroly shody může místní Codex s Pythonem 3.12 spustit v kořeni rozbaleného balíčku `_verify_restored_content.py`; tento skript pouze kontroluje obsah a zapisuje vlastní report. Nástroje v `work-free-refresh/tools/` jsou vývojový snapshot. Novou výrobu ani redakční opravu nespouštěj při pouhém prohlížení balíčku; jejich běh vytváří nové výstupy. K případné integraci do plného repozitáře slouží Git baseline uvedený v `work-free-refresh/BASELINE.json` a přesné zdrojové otisky v `work-free-refresh/SOURCE_INPUTS_VERIFIED.json`.

Produkční `main` byl při dokončení znovu ověřen na SHA `202899e93c8298207a9d33cce1d9cee442a3009e`. Produkční nasazení ani zápisy do databáze se v tomto úkolu neprováděly. Konkrétní nové desky, copy a pořadí zůstávají kandidátem k uživatelskému prohlédnutí.
