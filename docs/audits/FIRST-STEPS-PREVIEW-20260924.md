# Nový začátek Propletu — preview, 24. 9. 2026

Zadání: implementovat preview podle navazujícího návrhu aktivace nového hráče. Produkční nasazení této změny není autorizované. Výchozí main `4ffe88ad3f421280c26baf79a87d43fff23dbc4d` obsahuje již nasazenou opravu měření z PR #140.

## Hotový průchod

1. Nový anonymní hráč rovnou hraje skutečnou desku 3×3. PES učí rovný tah, LES zatáčku a ČAJ samostatné dokončení. Tři slova pokrývají všech devět polí. Nejde o úvodní obrázek nebo samostatnou obrazovku před hrou.
2. Pomoc ukáže konkrétní cestu po osmi sekundách bez pokroku nebo dvou chybných pokusech u aktuálního slova. Tlačítko nápovědy ji zpřístupní okamžitě. Slovo se nikdy neoznačí za nalezené bez hráčova tahu. Pomoc nesnižuje odměnu tréninku.
3. Jediné hlavní pokračování: „Hrát první hru“. Vybraná existující snadná deska `g4-e-001` má běžná slova UPÍR, STŮL, DRAK, TĚLO, SEDM, BOBR, ÚKOL. Její obsah, ID, XP a výsledky jsou původní; není závislá na obtížnosti dnešní výzvy. Aktivní sdílená pozvánka má přednost.
4. Po této skutečné výhře nabídka účtu přímo na výsledkovce: Google jedním kliknutím, menší alternativa, viditelné pokračování bez účtu. Žádný další registrační modal před Googlem. Alternativa používá existující přezdívku/heslo, e-mail pro obnovu je nepovinný. Netvrdíme, že už máme registraci pouze e-mailem.
5. Po přihlášení se hráč vrací k výsledku, poté pokračuje další snadnou hrou. Potvrzení cloudového uložení vyžaduje úspěšný sync, prázdnou frontu a nepřítomnost preview režimu. Chyba synchronizace ponechá výsledek místně a nabídne opakování. Zrušené přihlášení vrací stejnou nabídku bez ztráty výhry.
6. Účetní, push a instalační pobídky jsou v této první relaci odložené. Standardní chování ostatních hráčů je zachováno. Stav varianty je oddělený podle anonymní identity; nepřepisuje účty, dokončené hry ani jejich pořadí.

## Identita a měření

Trénink zachovává původní once-per-player odměnovou identitu `starter-v1` a 10 XP, aby explicitní opakování tutoriálu nepřidalo další odměnu. Obsahová varianta má `starterVersion:3` a měření `board-v3-short`; původní `board-v2` zůstává oddělené. Nejde o změnu ID či obsahu žádné volné herní desky. Legacy start/completion události si zachovávají význam. Nové additive eventy: `first_steps_v1_assisted`, `offer`, `google`, `manual`, `saved`, `continue` (vše s prefixem `first_steps_v1_`). `saved` nesmí vzniknout při preview nebo neúspěšné synchronizaci.

Poškozené či nedostupné úložiště nesmí vést k předstíranému cloudovému uložení. Návratový záznam neobsahuje token ani osobní údaje a má platnost 30 minut. OAuth využívá stávající endpoint a původní kontrolu identity. Nedochází k posílání přihlašovacích tokenů nebo postupu do URL pro přechod mezi prohlížeči.

## Preview a hranice ověření

Vercel preview nadále blokuje produkční herní zápisy. Přihlášení může používat existující účetní infrastrukturu; na výsledkovce je výslovně uvedeno, že hraní v náhledu zůstává na tomto zařízení. Toto není slib synchronizace testovacích výsledků do ostrého účtu. Mozkokalypsa je v této preview větvi standardně skrytá svým stávajícím production-only oprávněním; její kód, obsah, pozvánky ani produkce se nemění.

V detekovaném vloženém mobilním prohlížeči je u Google přihlášení vysvětlení a funkční alternativa přezdívka/heslo. Žádné automatické přepínání do jiného prohlížeče se ztrátou místního postupu. Fyzický Samsung Fold a skutečný Facebook/Instagram OAuth musí být ověřeny před případným produkčním nasazením; syntetický UA není totéž. CI testuje callback i přesměrování s explicitně syntetickým poskytovatelem, ne přihlášení ke skutečnému Google účtu.

## Ověření

- Unit test ověřuje skutečná slova, ortogonální cesty, přesné pokrytí desky, neměnnou odměnu, oddělení variant a čerstvou kopii herních dat.
- Původní browser scénáře z PR #140 nadále běží na explicitní legacy variantě fixture; jejich scope nebyl nahrazen novým průchodem.
- Nová browser matice: myš a CDP dotyk, dokončení 3×3 i první volné hry, přesné počty událostí, konkrétní pomoc bez automatického vyřešení, přímý Google round-trip, registrace formulářem, zrušení, selhání sync a opakování, alternativa ve vloženém prohlížeči, pozvánka, vracející se hráč. Síť mimo loopback je blokovaná; žádná skutečná data testerů se nevytvářejí.
- Screenshoty a JSON reporty vznikají v CI artefaktu; finální ověřený commit, preview URL a výsledky jsou v popisu PR.

## Další rozhodnutí

Cílových 20–35 sekund je návrhový cíl, ne naměřený produkční výsledek. Účet je v této variantě po první běžné desce. Neprovádíme současně experiment s okamžikem registrace po tutoriálu; ten má přijít samostatně. Primární metrika budoucího experimentu: nový hráč, skutečná hra a účet s potvrzeným přenosem postupu do 24 hodin. Kontrolovat dokončení první hry, D1 a chyby přihlášení. Produkční data před opravou fronty nejsou čistá srovnávací baseline.

Rollback preview: návrat na původní větev/URL. Při případném budoucím produkčním rollbacku použít nový společný release marker app/SW, nesmazat hráčská úložiště ani výsledky. Žádná SQL migrace není součástí změny.
