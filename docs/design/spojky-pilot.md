# Spojky v Propletu

**25. 11. 2026.** Samostatný čtyřtýdenní pilot připravený ke kontrole. Vznikl ve větvi `preview/spojky-pilot-20261125` z produkční verze 4.10.50, commit `4b5f00ba6c8dc2eae0fd94b5e6b54a45680d2584`. Vercel v den přípravy přiřazoval `hrajproplet.cz` deploymentu `dpl_BcH4wQUM8qreP5DgXr2yxKbn1VFk`. Produkční databází je Supabase `proplet`. Herní stav v náhledu uchovává jen prohlížeč.

Vstup je `/design/spojky/index.html`. V modelovém kalendáři začínají týdny v pondělí 30. listopadu a 7., 14. a 21. prosince 2026. Výchozí odkaz během pilotu vybírá týden podle pražského data. V nabídce **Náhled** lze přepnout na libovolný týden. Dnes ukazuje modelovou středu s běžnou výzvou, Extra, denní Tajenkou s archivem a rozehranou volnou hrou. Hrát jde celá cesta Spojek od první ukázky až po vyřešený řetěz. Čtení autorského řešení na `#reseni` ponechá stav dané desky zachovaný.

## Jak vyhodnotit pilot po schválení

V existujícím registru produktových událostí lze přidat tři typy událostí pro každý ze čtyř týdnů. Týden je součástí povoleného názvu události, například `spojky_w1_today_open`. Využije se stávající identita hráče a při každém výpočtu se započte hráč na jednu desku jen jednou.

| Co chceme vědět | Kdy zaznamenat | Co počítat |
|---|---|---|
| Kolik lidí Spojky z Dnes otevřelo | `today_seen` při zobrazení karty na obrazovce a `today_open` při jejím prvním otevření z Dnes | Počet unikátních otevření a podíl vůči hráčům, kteří kartu viděli |
| Kolik jich dohrálo | `complete` při prvním uznání třetí spojky, po návratu z offline hry s deduplikací | Unikátní dokončení a podíl vůči otevřením stejné desky |
| Kdo přišel pro další desku | V každém z týdnů 2, 3 a 4 porovnat unikátní hráče s účastníky prvního týdne | Počet a procento hráčů z prvního týdne, kteří otevřeli konkrétní další desku. Vynechaný mezitýden je z porovnání nevyřadí. |

Návštěvy redakčního preview a prohlížení řešení patří mimo tyto počty. U anonymních hráčů měření zachytí návrat stejné instalace prohlížeče. Termín ostrého vydání a zapnutí měření čekají na schválení.

## Ověření prohlížeče

V Chromiu prošly všechny čtyři desky přes běžné ovládání, obnovení rozehrané desky, oprava kartiček při zachovaném slově a nezávislé čtení řešení. Celá karta Dnes se vešla do výřezů 360 × 640, 390 × 844, 344 × 882, 768 × 1024, 1024 × 768 a 800 × 800 CSS pixelů v obou motivech. Při dvojnásobném písmu na telefonu fungoval svislý posun. Šlo o emulaci.

## Kontrola obsahu

<details>
<summary>Ověřené cesty a jiné možné odpovědi (obsahuje řešení)</summary>

25. 11. 2026. První dvě mřížky, pořadí kartiček, slova a první stupeň nápovědy jsou převzaté z prototypu. Další dvě mřížky i jejich obsah jsou ručně sestavené.

| Deska | Rozměry | Spojky | Legální cesty jednotlivých slov | Ověřená pořadí |
|---|---|---|---|---|
| 1 | 5 × 3 | HŘBET · LIST · KORUNA | 1 · 1 · 1 | 6 ze 6 |
| 2 | 4 × 4 | SRDCE · JAZYK · PŘEZKA | 1 · 1 · 1 | 6 ze 6 |
| 3 | 4 × 3 | PĚNA · VLNA · HLAS | 1 · 1 · 1 | 6 ze 6 |
| 4 | 6 × 3 | LÍČENÍ · VLEČKA · PRAŽEC | 1 · 1 · 1 | 6 ze 6 |

Pro každé slovo prošlo hledání všechny začátky a navazující kroky nahoru, dolů, vlevo a vpravo bez opakování políčka. Po každém možném nálezu se použitá políčka zamkla a znovu se hledala všechna zbývající slova. Každé z 24 úplných pořadí pokryje celou příslušnou desku.

Pro kontrolu jiných odpovědí byly vypsány všechny složitelné položky z české rozpoznávací banky Propletu a lexikonů v2 a v3, dohromady přes 104 tisíc různých záznamů. Na deskách postupně vyšlo 33, 10, 20 a 18 položek, včetně vlastních jmen a cizích slov. U každé ze šesti dvojic prošly redakční kontrolou také výrazy mimo tento seznam. Příklady v posledním sloupci se na dané mřížce vyznačit nedají.

| Týden | Dvojice | Spojka | Příklady prověřených dalších výrazů |
|---|---|---|---|
| 1 | Pes · Kniha | HŘBET | tělo, hlava, obal |
| 1 | Pes · Strom | | klacek, kořen, růst |
| 1 | Pes · Král | | rodokmen, pán, rod |
| 1 | Kniha · Strom | LIST | papír, dřevo, listy, listí |
| 1 | Kniha · Král | | titul, jméno, pečeť |
| 1 | Strom · Král | KORUNA | rodokmen, rod, žezlo |
| 2 | Zvon · Člověk | SRDCE | hlas, hlava, tělo, rameno, ústa |
| 2 | Zvon · Bota | | kování, řemen, obruba |
| 2 | Zvon · Opasek | | kov, kování, řemen |
| 2 | Člověk · Bota | JAZYK | pata, špička, kůže, nárt |
| 2 | Člověk · Opasek | | pas, kůže, bok |
| 2 | Bota · Opasek | PŘEZKA | řemen, kůže, spona, dírka |
| 3 | Pivo · Moře | PĚNA | hladina, voda, bublinky |
| 3 | Pivo · Rádio | | šum, šumění, reklama |
| 3 | Pivo · Volby | | kolo, lístek |
| 3 | Moře · Rádio | VLNA | šum, signál, bouře |
| 3 | Moře · Volby | | příliv, odliv, proud |
| 3 | Rádio · Volby | HLAS | přenos, výsledky, zpráva |
| 4 | Soud · Nevěsta | LÍČENÍ | svědek, svědci, slib |
| 4 | Soud · Železnice | | řád, správa, síť |
| 4 | Soud · Kytara | | síň, spor, jednání |
| 4 | Nevěsta · Železnice | VLEČKA | vlak, cesta |
| 4 | Nevěsta · Kytara | | krk, tělo, pas, píseň |
| 4 | Železnice · Kytara | PRAŽEC | pražce, kov, drát, ocel |

Z přirozených samostatných odpovědí v jednotném i množném čísle vyšly jen zadané spojky. Na první desce lze ještě číst pádové tvary HŘBETU a KORUN, na třetí PĚN a VLN. Jde o stejná slova ve tvarech, které se do odpovědi „Co mají společného?“ nehodí. Složitelná KOST z první desky se nabízí u psa, ovšem zbylé tři kartičky k ní rovnocennou vazbu nemají. Jazykové posouzení odpovídá běžnému užití v češtině.

</details>
