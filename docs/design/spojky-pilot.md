# Spojky v Propletu

## Startovní sada a společné oznámení

**27. 11. 2026.** Ve větvi Spojek je připravený kandidát 4.11.0. Denní Tajenka už začala v produkční verzi 4.10.53 (`4f3a377`). První Spojky se po schválení mohou přidat hned. O vydání hry na hrajproplet.cz a použití připravené databázové migrace rozhodne Pavel.

| Co vyzkoušet | Odkaz do hratelného náhledu |
|---|---|
| Pavlův přehled všech vydání. „Hrát“ otevře skutečnou hru, „Řešení“ samostatně odhalí hotový řetěz a cesty. | [Osm týdnů Spojek](https://proplet-git-preview-spojky-prunik-65a488-pavel-prouzas-projects.vercel.app/design/spojky/vydani.html) |
| Hráč se poprvé dozví o obou novinkách. Každé tlačítko otevře příslušnou hru. | [Společné oznámení nad kartou Dnes](https://proplet-git-preview-spojky-prunik-65a488-pavel-prouzas-projects.vercel.app/?open=daily&tajenkaReview=1&tajenka=1&tajenka_week=25&spojkyReview=2026-11-27) |
| Hráč už četl o denní Tajence. Pozvánka představí týdenní Spojky. | [Pozvánka pro tohoto hráče](https://proplet-git-preview-spojky-prunik-65a488-pavel-prouzas-projects.vercel.app/?open=daily&tajenkaReview=1&tajenka=1&tajenka_week=25&spojkyReview=2026-11-27&spojkyNews=seen) |

První deska pokrývá pátek 27. listopadu až neděli 6. prosince. V pondělí 30. listopadu hráči zůstane rozehraný řetěz. Od 7. prosince se desky střídají v pondělí o pražské půlnoci. První čtyři vydání zachovávají desky z playtestu včetně jejich ID a pořadí. Další čtyři začínají 28. prosince a 4., 11. a 18. ledna. Poslední platí do neděle 24. ledna 2027.

Na skutečném Dnes pozná hráč novou desku, rozdělané Spojky i hotový řetěz. Při návratu na stejném zařízení se obnoví nálezy i rozdělaný tah. Po dohrání uvidí termín další desky, pokud je připravená. Zakládání a střídání účtů používá oddělený herní postup. Automatické oznámení je určeno přihlášeným hráčům s účtem před startem denní Tajenky a alespoň pěti různými dokončenými deskami. Databáze hlídá doručení napříč zařízeními. Ruční náhled otevře stejné oznámení bez zaznamenání převzetí.

Všech osm desek lze dohrát ve všech šesti pořadích nálezů. Zkouška čtyř nových vydání bez řešení odkryla u jedné desky druhý smysluplný řetěz. Po výměně kartičky jsme znovu prověřili všech šest dvojic. Na telefonu i rozloženém Foldu jsme vyzkoušeli oba vstupy z oznámení a návrat do rozehrané hry. Databázová zkouška potvrdila jediné převzetí pozvánky i při souběžném otevření z více zařízení. [Oznámení na mobilu](spojky-preview/launch-cta-mobil.png) · [Oznámení na rozloženém Foldu](spojky-preview/launch-cta-fold.png)

### Další vydání

Úkol „Doplnit týdenní Spojky“ kontroluje zásobu každé pondělí podle skutečně nasazené banky. Když první nepokryté pondělí nastane do 14 dní, připraví dalších osm desek do vlastní větve `preview/spojky-davka-YYYYMMDD` s datem první nové desky. Při současné zásobě vychází příprava na 11. ledna pro týden od 25. ledna. Rozpracovanou dávku dokončí ve stejné větvi. Pavel dostane odkaz k vyzkoušení a rozhodne o vydání.

Autorským zdrojem je `content/spojky/crossings.json`. Po doplnění desek spusť `python tools/generate_spojky_crossings.py`, následně `python tools/generate_spojky_crossings.py --check`. Generátor vytváří soukromou banku `data/spojky_weeks.json`. Pro každé vydání je třeba projít všech šest dvojic kartiček a hledat další přirozená řešení, která by hráč mohl v mřížce sestavit. Redakční zkoušku začni promíchanými kartičkami a mřížkou, bez klíče a nápověd. Na produkci vrací `/api/spojky` jen právě hratelnou desku. Po skončení poslední se dlaždice skryje.

Při schváleném vydání patří před aplikaci migrace `20261127010000_spojky_launch_news.sql`, která naváže na již doručená oznámení Tajenky. [Pořadí migrací](../SUPABASE_MIGRATION_MANIFEST.md)

## Dnes s denní Tajenkou a týdenními Spojkami

**26. 11. 2026.** Hratelný náhled ve větvi `preview/spojky-pruniky-navod-20261126` vychází z produkční verze 4.10.53 (`4f3a377`) a z předání denní Tajenky (`e34035a`). Ve středu 16. prosince se sejdou Střední denní výzva, třetí týden Spojek, denní Tajenka č. 41 a Extra Mozkožrout. Modelový hráč dokončil pondělní sadu a má rozehranou 12. úroveň volné hry. O nasazení Spojek do produkce rozhodne Pavel po náhledu. [Otevřít Dnes ve větvi Spojek](https://proplet-git-preview-spojky-prunik-65a488-pavel-prouzas-projects.vercel.app/design/spojky/index.html?datum=2026-12-16)

Denní výzva má největší kartu. Vedlejší týdenní rozvrh se na telefonu přesune pod ni. Následuje fialový pruh Spojek se vstupem do schválené hry s křížením. Extra, Tajenka, Rozehráno a Soutěže tvoří na telefonu dvě dvojice a na rozloženém Foldu jeden řádek. Pod hrami je „Podpořit Proplet“. Pod čarou jsou čtyři odkazy „Jak hrát“, „Soukromí“, „Podmínky“ a „Nahlásit chybu“. V samostatném náhledu vedou podpora a hlášení chyby k příslušným akcím na hrajproplet.cz.

Klepnutím na tělo Tajenky se otevře dnešní deska, uložené pokračování nebo hotový výsledek. Kalendář v rohu má vlastní dotykovou plochu a otevře sedm skutečných dat vydání. Pro modelovou středu jsou to 10.–16. prosince. Každé vydání má vlastní postup. Tlačítko „Zpět do kalendáře“ vrací hráče k původnímu seznamu. V nabídce „Náhled“ lze změnit den i výchozí stav volné hry. V úterý 15. prosince zaujme místo uvolněné po Extra Archiv.

Termíny a obtížnosti odpovídají produkčnímu rozpisu. V kalendáři si lze zahrát dříve vydané Tajenky. Denní výzva a Extra používají veřejné ukázkové desky odpovídající obtížnosti. Budoucí řešení tak zůstanou hráčům do dne vydání překvapením. Hraní ukládá postup do prohlížeče a vyčíslené odměny odpovídají pravidlům produkce.

Snímky ze stejného rozehraného profilu v dotykovém Chromiu jsou uložené zde. [Mobil, 390 × 844 CSS px](spojky-preview/dnes-mobil.png) · [Rozložený Fold, 690 × 829 CSS px](spojky-preview/dnes-fold.png)

## Předání k integraci Spojek na Dnes

**26. 11. 2026.** Pavel schválil všech 29 vydání denní Tajenky. Verze 4.10.53 je ověřená na hrajproplet.cz. Spuštění je nastavené na pátek 27. 11. v 00.00 pražského času. Pro začlenění Spojek použij aktuální `main`, který obsahuje [vydání denní Tajenky](https://github.com/prouza-hue/proplet/commit/4f3a37758990062e71818b36a038c6554aa91c4d).

Na kartě Dnes zůstává hlavní Denní výzva. Pod ní jsou akční dlaždice. Tělo dlaždice Tajenky otevře dnešní desku, rozehranou hru nebo výsledek podle stavu hráče. Samostatné tlačítko s kalendářem otevře posledních sedm vydání. První dokončení každé Tajenky přináší 200 XP.

Spojky přidej vedle stávajících dlaždic podle schváleného návrhu. Zachovej výzvu k podpoře, spodní odkazy a podmíněné zobrazení Extra i rozehrané hry. Při integraci vycházej ze souborů `public/today-one-screen.js`, `public/app/content/tajenka-editions.js` a `public/tajenka-editions.css` v novém vydání.

## Návod a průběh hry před vydáním

**26. 11. 2026.** Po dalším playtestu Pavel hodnotí křížení jako zábavnější. Větev `preview/spojky-pruniky-navod-20261126` navazuje na čtyři zkoušené desky ve verzi `7a03b6e`. O vydání se rozhodne po kontrole tohoto náhledu.

Na přímém odkazu `?tyden=3#navod` si hráč vyzkouší krátký cvičný řetěz a pak přejde na třetí desku. Hřeben a zip mají zuby. Po označeném Z projde také jezdec, který propojí zip se šachy. Běžná deska má čtyři kartičky a tři spojky. Ukázku lze přeskočit, otevřít znovu z pravidel nebo spustit v nabídce Náhled.

Hra ukazuje počet zbývajících spojek, na kartičkách jejich objevené značky a pohromadě už spojené úseky. Po dvou nálezech záleží na jejich uspořádání. Pokud už hráč spojil tři kartičky, hra pojmenuje čtvrtou, kterou zbývá připojit. Pokud má dvě oddělené dvojice, vyzve ho, aby je propojil. Celý řetěz se ukáže po dohrání.

Podobu podpory a patičky jsme porovnali s živou kartou Dnes na `hrajproplet.cz`, verze 4.10.52 (`270f383`). Pod herními kartami je „Podpořit Proplet“. Pod čarou jsou „Jak hrát“, „Soukromí“, „Podmínky“ a „Nahlásit chybu“. V samostatném náhledu podpora i hlášení vedou k příslušnému tlačítku na produkčním Dnes. Tam hráč otevře plnohodnotný dialog. Při začlenění do hlavní aplikace se použijí její stávající obsluhy tlačítek.

V mobilním Chromiu jsme prověřili oba možné tvary řetězu po dvou nálezech. Opakování návodu uprostřed třetí desky i obnovení stránky zachovalo nálezy, zvolenou dvojici, dvě použité nápovědy a dvě rozepsaná písmena. Desku šlo dokončit pokračováním téhož slova. Po napsání cvičného slova tahem první klepnutí otevřelo desku nebo vrátilo hráče k rozdělanému slovu. Při přeskočení návodu i otevření pravidel se provedla vždy právě jedna akce. Na telefonu se šířkou 360 a výškou 640 CSS pixelů se na Dnes vešly i podpora, patička a spodní navigace.

## Petřina varianta s křížením

**25. 11. 2026.** Po druhém kole hráči vyzdvihli třetí desku. Pořád ale řešili Spojky rychleji, než jim bylo milé. Na Petřin návrh vznikl samostatný experiment ve větvi `preview/spojky-pruniky-20261125`. Vychází z předchozího pilotu `55157977b487fca2c2356d9b1d803c6fa9854c8c`. O zařazení varianty do Propletu rozhodne další hráčská zkouška.

Dokončené slovo nechá všechna jeho písmena k dispozici. Hráč na nich může další tah začít, přejít přes ně nebo na nich skončit. V jednom slově se stejné políčko smí použít jednou. Po druhém nálezu je tak pro poslední spojku pořád otevřená celá mřížka. Ve třetím týdnu to znamená všech 30 polí, zatímco verze se zamykáním v té chvíli nabízela 18 nebo 19. Známá stopa zároveň může při hledání další cesty pomoct. Z délky trasy samotné nelze usoudit, jestli se tím partie prodlouží.

| Týden | Co má ověřit |
| --- | --- |
| 1 | První křížení na menší desce. Tři kartičky hráči znají z minula. Čtvrtá dovoluje propojit i poslední slovo. |
| 2 | Nové kartičky pro hráče, kteří už celé předchozí preview znají. |
| 3 | Přímé srovnání s oblíbeným třetím týdnem. Obě verze mají stejné kartičky ve stejném pořadí, stejné nápovědy a mřížku 5 × 6. Rozmístění písmen se přizpůsobilo pravidlu o křížení. |
| 4 | Druhá neznámá deska pro zkušené hráče. Jeden pojem potřebují přečíst ve dvou různých významech. |

U písmene zůstává po dokončení drobná značka příslušné spojky. Každé slovo má vlastní barvu, tvar a pozici značky. Na společném políčku jsou vidět všechny příslušné značky, zatímco rozepsané slovo má výraznou souvislou stopu. V dokončené desce lze vybrat libovolné nalezené slovo a prohlédnout si jeho přesnou cestu. Experiment má vlastní úložiště rozehraných desek. Odkaz na předchozí verzi třetího týdne je přímo v nabídce Náhled.

### Jak připravit další kříženou desku

Autorský vstup je v `content/spojky/crossings.json`. Obsahuje kartičky, jejich významové vazby, nápovědy, nežádoucí alternativy a číselný seed každého týdne. Příkaz `python tools/generate_spojky_crossings.py` z něj vytvoří hratelnou banku. S volbou `--check` ji znovu vygeneruje do paměti a porovná její přesné znění s verzí připravenou k vydání. Tahy se řídí sousedností ze stávajícího generátoru Propletu.

Generátor nejprve ověří, zda trojici vůbec propojí stejná písmena včetně diakritiky. Slova poskládá přes společná políčka, doplní klamné začátky a přidá zbývající písmena. Hotovou mřížku počítač projde všemi legálními cestami. Každé řešení musí jít napsat právě jednou a celý řetěz musí jít dohrát v libovolném pořadí. I když už jsou dvě spojky hotové, ta poslední vždy vede přes alespoň jedno dříve použité písmeno. Ruční posouzení dalších možných asociací zůstává součástí přípravy.

| Týden | Rozměr | Políčka ve více spojkách | Nejdelší slepá cesta pro každou spojku v pořadí řetězu |
| --- | --- | ---: | --- |
| 1 | 5 × 4 | 2 | 2 / 2 / 2 písmena |
| 2 | 5 × 5 | 2 | 3 / 4 / 4 písmena |
| 3 | 5 × 6 | 3 | 4 / 4 / 4 písmena |
| 4 | 5 × 6 | 3 | 4 / 5 / 5 písmen |

Čísla v posledním sloupci říkají, kolik správných počátečních písmen lze po chybné cestě přečíst, než už další písmeno nenaváže. Ve čtvrtém týdnu se každá dvojice řešených slov potká na jiném políčku. U všech čtyř desek proběhla kontrola všech šesti dvojic kartiček vůči dalším odpovědím sestavitelným z mřížky. Dvě nezávislá čtení nenašla další rovnocennou spojku. Kontrola všech 24 pořadí nálezů prošla.

V Chromiu byla čtvrtá deska dohrána dotykem přes dříve použitá písmena. Při zkoušce fungovala i nápověda na označeném políčku, oprava kartiček u hotového slova, obnova nálezů po načtení stránky a souběh dvou karet. V emulaci 344 × 882 a 768 × 1024 CSS pixelů se mřížka vešla na šířku a políčka měla přibližně 55 pixelů. Po opravě ukončení tahu otevřelo první klepnutí na výsledkovce detail cest. Každá zvýrazněná cesta odpovídala políčkům, přes která hráč skutečně táhl.

### Jak posoudit změnu s hráči

S lidmi, kteří už hráli předchozí čtyři týdny, začít novým druhým nebo čtvrtým týdnem. K porovnání obou pravidel rozdělit hráče, kteří třetí týden ještě neviděli, mezi obě verze téže sady. Každému dát jen jednu z nich. Druhé hraní stejných asociací by zvýhodnilo zapamatované odpovědi.

Pozorovatel si může poznamenat čas první, druhé a třetí spojky a použití nápovědy. Po hře stačí dvě otázky. „Co tě při posledním slově zdrželo?“ a „Který moment by sis chtěl zahrát znovu?“ Delší partie stojí za rozvoj, když hráče bavila další spojitost nebo návrat přes už známé písmeno. Pokud většinu času jen zjišťovali, jestli obarvené políčko ještě funguje, je potřeba přepracovat značení. Výsledek posuzujeme společně s délkou hry a chutí zahrát si další desku.

## Předchozí pilot se zamykáním

**25. 11. 2026.** Samostatný čtyřtýdenní pilot připravený ke kontrole. Vznikl ve větvi `preview/spojky-pilot-20261125` z produkční verze 4.10.50, commit `4b5f00ba6c8dc2eae0fd94b5e6b54a45680d2584`. Vercel v den přípravy přiřazoval `hrajproplet.cz` deploymentu `dpl_BcH4wQUM8qreP5DgXr2yxKbn1VFk`. Produkční databází je Supabase `proplet`. Herní stav v náhledu uchovává jen prohlížeč.

Vstup je `/design/spojky/index.html`. V modelovém kalendáři začínají týdny v pondělí 30. listopadu a 7., 14. a 21. prosince 2026. Výchozí odkaz během pilotu vybírá týden podle pražského data. V nabídce **Náhled** lze přepnout na libovolný týden. Dnes ukazuje modelovou středu s běžnou výzvou, Extra, denní Tajenkou s archivem a rozehranou volnou hrou. Hrát jde celá cesta Spojek od první ukázky až po vyřešený řetěz. Čtení autorského řešení na `#reseni` ponechá stav dané desky zachovaný.

## Druhé kolo playtestu

Hráči v prvním náhledu (`e044429`) ocenili spojování významů. Desky ale vyřešili příliš snadno a výběr písmene se jim nedařilo zrušit. V původních mřížkách vyplnila tři hledaná slova všechna políčka. Po dvou nálezech tedy zbývala přesně písmena třetího slova.

V nové sadě některá písmena zůstanou volná i po dohrání. Společné začátky a odbočky vyžadují, aby hráč dotáhl svůj nápad do celého slova. Všechna čtyři vydání mají pět sloupců. První, druhý a čtvrtý týden zachovávají původní asociace. Pro opakovaný playtest se stejnými lidmi má třetí týden nový řetěz, který lze otevřít přes `?tyden=3#hra`.

Opětovné klepnutí na poslední písmeno ho odebere. Klepnutí do prázdna zruší celé rozepsané slovo. Nový souvislý tah začíná pod prstem a při návratu na předchozí políčko se zkrátí o krok. Rozpoznané slovo počká na opravu chybně vybraných kartiček. Druhá sada má vlastní klíče pro ukládání postupu. Rozehranou desku z prvního testu lze dohrát na původním odkazu.

## Jak vyhodnotit pilot po schválení

V existujícím registru produktových událostí lze přidat tři typy událostí pro každý ze čtyř týdnů. Týden je součástí povoleného názvu události, například `spojky_w1_today_open`. Využije se stávající identita hráče a při každém výpočtu se započte hráč na jednu desku jen jednou.

| Co chceme vědět | Kdy zaznamenat | Co počítat |
|---|---|---|
| Kolik lidí Spojky z Dnes otevřelo | `today_seen` při zobrazení karty na obrazovce a `today_open` při jejím prvním otevření z Dnes | Počet unikátních otevření a podíl vůči hráčům, kteří kartu viděli |
| Kolik jich dohrálo | `complete` při prvním uznání třetí spojky, po návratu z offline hry s deduplikací | Unikátní dokončení a podíl vůči otevřením stejné desky |
| Kdo přišel pro další desku | V každém z týdnů 2, 3 a 4 porovnat unikátní hráče s účastníky prvního týdne | Počet a procento hráčů z prvního týdne, kteří otevřeli konkrétní další desku. Vynechaný mezitýden je z porovnání nevyřadí. |

Návštěvy redakčního preview a prohlížení řešení patří mimo tyto počty. U anonymních hráčů měření zachytí návrat stejné instalace prohlížeče. Termín ostrého vydání a zapnutí měření čekají na schválení.

## Ověření prohlížeče

V prvním kole prošla karta Dnes v Chromiu při rozměrech 360 × 640, 390 × 844, 344 × 882, 768 × 1024, 1024 × 768 a 800 × 800 CSS pixelů v obou motivech. Při dvojnásobném písmu na telefonu fungoval svislý posun.

V druhém kole šlo všechny čtyři desky dokončit dotykem. Emulace prověřila zrušení výběru, návrat při tažení, výměnu kartiček u rozepsaného i rozpoznaného slova, nápovědu po slepé odbočce, obnovu po načtení stránky a návrat z přímého odkazu třetího týdne. Při rozměrech 344 × 882, 390 × 844 a 768 × 1024 CSS pixelů mělo políčko přibližně 55 pixelů. Na úzkém zavřeném Foldu byla pod celou šestiřádkovou mřížkou vidět i nápověda. Obě sady si zachovaly vlastní stav.

## Kontrola obsahu

<details>
<summary>Řešení, odbočky a kontrola možných odpovědí ve druhém kole</summary>

Rozměry uvádíme jako počet sloupců × počet řádků. Čísla oddělená lomítky odpovídají třem slovům v daném řádku vždy v situaci, kdy zbývá najít právě toto slovo.

| Týden | Rozměr dříve → nyní | Volná pole po dohrání | Spojky | Slepé cesty po dvou nálezech | Nejdelší slepá cesta v písmenech |
| --- | --- | ---: | --- | --- | --- |
| 1 | 5 × 3 → 5 × 4 | 5 | HŘBET / LIST / KORUNA | 1 / 2 / 1 | 2 / 3 / 2 |
| 2 | 4 × 4 → 5 × 5 | 9 | SRDCE / JAZYK / PŘEZKA | 1 / 1 / 3 | 3 / 3 / 4 |
| 3 | 4 × 3 → 5 × 6 | 13 | KŘÍDLO / KUKLA / OBLOUK | 1 / 3 / 2 | 4 / 3 / 4 |
| 4 | 6 × 3 → 5 × 6 | 12 | LÍČENÍ / VLEČKA / PRAŽEC | 2 / 1 / 3 | 4 / 4 / 5 |

Slepá cesta v této tabulce přečte nejméně dvě správná písmena od začátku slova a skončí ve chvíli, kdy další potřebné písmeno není dostupné. V první sadě byl jejich počet po dvou nálezech ve všech 12 případech nulový. Ve čtvrtém týdnu se v nové mřížce dá jednou cestou dojít až k PRAŽE, ale poslední C na ni nenavazuje.

Každá z 12 spojek má po celé hře jedinou úplnou cestu. Kontrola prošla všechny přípustné tahy po stranách políček ze všech začátků. Po každém nálezu zamkla použitá písmena a ověřila dostupnost zbývajících slov. Všech šest pořadí funguje u každé ze čtyř desek. Jak dlouho budou novou sadu řešit zkušení hráči, ukáže další playtest.

Pro každou z 24 dvojic byly posouzeny i další přirozené odpovědi. Příklady v posledním sloupci nelze v dané mřížce vyznačit. Pomlčka označuje kartičky, které v řešeném řetězu nesousedí.

| Týden | Dvojice karet | Spojka | Vybrané prověřené konkurenční výrazy |
| --- | --- | --- | --- |
| 1 | Pes + Kniha | HŘBET | HŘBETY, UŠI, UCHO |
| 1 | Pes + Strom | — | KLACEK, VĚTEV, STÍN |
| 1 | Pes + Král | — | RODOKMEN, JMÉNO, OKO |
| 1 | Kniha + Strom | LIST | LISTY, LÍSTEK, PAPÍR |
| 1 | Kniha + Král | — | TITUL, JMÉNO, PEČEŤ |
| 1 | Strom + Král | KORUNA | KORUNY, KOŘENY, RODOKMEN |
| 2 | Zvon + Člověk | SRDCE | HLAS, TÓN, TĚLO |
| 2 | Zvon + Bota | — | ŘEMÍNEK, KOVÁNÍ, KŮŽE |
| 2 | Zvon + Opasek | — | KOV, OČKO, ŘEMEN |
| 2 | Člověk + Bota | JAZYK | JAZYKY, PATA, NÁRT |
| 2 | Člověk + Opasek | — | PAS, BOK, KŮŽE |
| 2 | Bota + Opasek | PŘEZKA | PŘEZKY, SPONA, PÁSEK, DÍRKA |
| 3 | Letadlo + Motýl | KŘÍDLO | KŘÍDLA, LET, LÉTÁ, TRUP |
| 3 | Letadlo + Svářeč | — | OCEL, STROJ, PŘILBA |
| 3 | Letadlo + Duha | — | NEBE, OBLOHA, MRAK |
| 3 | Motýl + Svářeč | KUKLA | KUKLY, PŘILBA, OCHRANA |
| 3 | Motýl + Duha | — | BARVA, BARVY, BARVU, PESTROST |
| 3 | Svářeč + Duha | OBLOUK | OBLOUKY, SVĚTLO, LESK, ZÁŘE |
| 4 | Soud + Nevěsta | LÍČENÍ | SVĚDEK, SVĚDKYNĚ, LÍČÍ |
| 4 | Soud + Železnice | — | ŘÁD, ŘÍZENÍ, SPRÁVA |
| 4 | Soud + Kytara | — | SÍŇ, HLAS, OZVĚNA |
| 4 | Nevěsta + Železnice | VLEČKA | VLEČKY, CESTA, VŮZ |
| 4 | Nevěsta + Kytara | — | KRK, TĚLO, PRSTY |
| 4 | Železnice + Kytara | PRAŽEC | PRAŽCE, PŘÍČKA, DRÁT, KOV |

Kontrola použila základní slovník Propletu, lexikony v2 a v3 a rozpoznávač bonusových tvarů. Z jejich společného seznamu šlo na čtyřech deskách sestavit postupně 31, 19, 57 a 105 různých výrazů. Dvě redakční čtení mezi nimi nenašla stejně přirozenou náhradní odpověď pro žádnou dvojici. Ve třetím týdnu může i letadlo při zatáčení opsat oblouk. Svařovací oblouk i oblouk duhy ale hráč pojmenuje přímo. Ve čtvrtém týdnu lze složit KLÍČ, který se nabízí u kytary. U zbylých tří kartiček jsme stejně silnou vazbu nenašli.

</details>
