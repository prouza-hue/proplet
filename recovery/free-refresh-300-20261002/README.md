# Osvěžení běžné hry: 300 nových Propletů

Připraveno 2. října 2026 pro Pavla a navazující práci místního Codexu. Balíček obsahuje **100 nových desek pro Snadnou, 100 pro Střední a 100 pro Těžkou**, kompletní katalog, návrhy CTA a konkrétní společnou cestu. Všech 300 nových slovních sestav prošlo AI redakční kontrolou a samostatným technickým ověřením.

**Stav: hotový kandidátní obsah a hratelný návrh k prohlédnutí. Produkční nasazení ani migrace hráčských nastavení nejsou součástí této práce.**

Hratelné preview je v místním souboru `_free_preview_slim_trial.zip` (23 567 731 bytů), který byl vytvořený a ověřený před odpojením místního prostředí. Obsahuje všechny nové desky, výběr obtížnosti, přímý katalog i ukázku společné cesty. Vyzkoušet lze konkrétní desku bez postupného dohrání předchozích. Texty a chování CTA jsou návrh pro uvedení balíčku.

ZIP rozbal a v jeho kořenové složce spusť místní HTTP server, například `python -m http.server 8874 --bind 127.0.0.1`. Pak v prohlížeči otevři `http://127.0.0.1:8874/`. Dvojklik na index.html nestačí kvůli absolutním cestám původního Propletu. Na originální produkci se tento statický export nepřipojuje; postup je pouze místní.

**Omezení předání po výpadku:** Git archiv zachraňuje tento přehled, původní redakční poznámky a rekonstruované zdroje preview. Banka, katalog CSV, manifest cesty a úplné reporty zůstávají ve složce `work-free-refresh/content/gen6/free-refresh-300/` v odpojeném místním prostředí. V této Git větvi tyto datové soubory nejsou. ZIP nebyl po odpojení znovu zpřístupněný ani nahraný a hostovaný hratelný odkaz není připravený. Nový cloudový replay ani nová cloudová kontrola neproběhly. Původní lokální ověření se vztahuje na původní ZIP, ne na zrekonstruované zdroje.

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

Katalog všech 300 desek (`content/gen6/free-refresh-300/catalog-300.csv` v místní pracovní složce) uvádí každou desku, slova, profil i původ zásoby. Úplná banka (`content/gen6/free-refresh-300/bank.json` v místní pracovní složce) obsahuje samotné desky včetně cest řešení.

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

Přesná posloupnost všech 400 ID na obtížnost i číselný katalog jsou v manifestu průchodu (`content/gen6/free-refresh-300/shared-route-manifest.json` v místní pracovní složce).

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

- Redakční posudek všech 300 desek (`content/gen6/free-refresh-300/editorial-review.json` v místní pracovní složce) váže každé rozhodnutí na přesný otisk obsahu.
- Samostatné technické ověření (`content/gen6/free-refresh-300/independent-verification.json` v místní pracovní složce) uchovává důkazy solveru.
- Přehled obsahu (`content/gen6/free-refresh-300/content-summary.json` v místní pracovní složce) uvádí počty, podíly, tiery a rozměry.
- Evidence redakční opravy (`content/gen6/free-refresh-300/editorial-repairs.json` v místní pracovní složce) zachovává původní i náhradní sestavu.

Výrobní obsah vychází z produkčního SHA `5fc234e8e481950a68a25bf77f0103fab936532f` s nasazenou Mozkokalypsou. UI preview používá následně ověřený SHA `202899e93c8298207a9d33cce1d9cee442a3009e`; mezi nimi se výrobní slovní banky nezměnily. Pracovní větev pro navazující převzetí je `work/free-refresh-300-20261002`. Otisk finální nové banky je `7048e9bc26c8e7670bab4aad158bb87f73ff1bbf86e6215a7e262d2c3905635e`.

Pro vydání zbývá vybrat finální copy a konkrétní pořadí, prohlédnout hratelné desky, doplnit lidský playtest a samostatně implementovat serverový přechod ze současného `pestre-v1` na společnou verzi. Při převzetí místní Codex znovu ověří aktuální produkci a datové prostředí. Bývalé nastavení je potřeba zachovat pro návrat zpět a XP musí zůstat vázané na původní dokončení ID. Nasazení se provede teprve po schválení konkrétního výsledku.

