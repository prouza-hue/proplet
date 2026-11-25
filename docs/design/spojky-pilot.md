# Spojky v Propletu

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
