# Archiv G3: připravený obsah a podmínky zveřejnění

Stav k 4. 10. 2026: příprava na izolované větvi, nikoli spuštění Archivu. Základ je produkční commit a41c9e3b1ca55b86e3b6cf7935c30b6190e0e1db. Historické banky, originální desky, existující výsledky i jejich odměny zůstávají beze změny.

## Obsah a férové odměnové sloty

Manifest obsahuje 800 původních desek G3: 200 v každé ze čtyř obtížností. Každý z 800 historických slotů 1–200 zůstává v seznamu; hráč si zvolí libovolnou desku. Žádná nucená progrese ani automatický kredit za neodehraný obsah. Původní identity jsou převzaté z připnutého content catalogu; přidání variant mění samostatnou revizi pravidel řešení, nikoli původní contentKey nebo odměnový slot.

Historický fond G1–G3 je společný pro obtížnost a číslo úrovně. Dříve získaná historická odměna se opakováním nezíská znovu. Samostatně získaná odměna za moderní G4 a novější desku stejného čísla historický nárok neblokuje. Bodování zůstává 15/25/50/100 XP podle historické obtížnosti. Není důvod ručně dorovnávat Michaela či PiettraWal.

Zveřejnění vyžaduje samostatně ověřenou atomickou odměnu a oficiální výsledek. Tento obsahový PR nemění databázi ani odměnové funkce.

## Co audit skutečně ověřil

Všech 800 desek má platné ortogonální cesty, správná písmena, disjunktní úplné pokrytí masky a původní cílovou šablonu délek. Všech 7 626 původních cílových výskytů má schválený záznam v produkčním Lexiconu V2. To není tvrzení o nově provedeném ručním playtestu každé desky ani o přegenerování podle Lexikonu V3.

První přesný audit nad 13 441 statickými slovy (data/words.txt + schválený produkční lexikon + overlay) dává 785 desek s jedním úplným řešením a 15 s dvěma řešeními. Pro těchto 15 jsou uložená obě úplná řešení včetně konkrétních cest. MŮŽE v g3-e-100 je výslovná archivní redakční výjimka: běžný český tvar, který se tím nepřidává do generačního lexikonu ani do budoucího Gen6 obsahu.

Rozšířený audit nad reprodukovaným Gen6 snapshotem 103 836 slov mění obraz: 714 desek má jedno řešení, 75 dvě, 8 tři a 3 čtyři. Přibylo 71 nově označených desek a 3 z původních 15 mají další kandidáty. Všechny úplné kandidáty, cesty, původní slova, náhrady a vrstvy slovníku eviduje broad-review.json.

Část dodatečných kandidátů jsou skutečná česká slova či tvary; část tvoří cizí výrazy, názvy a frekvenční šum. Přítomnost v recognition/wordfreq není redakčním schválením cílového slova. Dvě nezávislá jazyková review a následné sjednocení projektového rozhodnutí posoudily všech 100 nekanonických úplných variant: 64 jsou přijaté, 21 odmítnutých a 15 zůstává podmíněných jazykovou politikou nebo doložením tvaru. Přijaté varianty jsou konkrétně doplněné do 57 desek jako celé řešení; celkem je připravených 864 coverů včetně 800 originálů. Všech 15 podmíněných variant na 12 deskách zůstává publikační bránou, zejména GAMMA, ŠLAK, HŮRA, FAKE, KALAŠ, NĚMA, SOLE a LHOTY. Jazykové doporučení a projektové rozhodnutí jsou samostatně uvedené v editorial-decisions.json. Žádná přijatá forma tím nerozšiřuje globální generační lexikon. Kvůli nejasnosti se žádný historický odměnový slot nezahazuje.

Oba exact-cover audity zachovávají původní počet cílových slov a multiset jejich délek. Hledají úplná řešení v rámci této hráči zobrazené šablony; netvrdí unikátnost proti libovolnému počtu slov jiné délky. Širší snapshot je konkrétní reprodukovatelný slovník, nikoli automatický důkaz rovnosti s každou dnešní živou Wikidata položkou nebo každým budoucím wordfreq výsledkem.

## Smlouva adaptéru hry

solution_contract.cjs je izolovaná příprava v tools/archive/. Živá aplikace jej neimportuje. Před aktivací musí archivní adaptér splnit následující:

- Loader ověří edici, původní ID i originalContentKey proti manifestu a zdrojové bance. Helper ověřuje ID, původní kanonické slovo/cestu a strukturu coveru; nevypočítává kryptografický hash.
- Rozhodování používá skutečné dvojice slovo + uspořádaná cesta. Kandidát projde pouze tehdy, když existuje schválené úplné řešení slučitelné se všemi nalezenými slovy a skutečně odhalenými informacemi nápověd. Alternativy se neslévají do jediného seznamu answers.
- Dokončení nastává až při nalezení přesného úplného schváleného řešení. Samotný počet words/answerIndex nestačí. Schválené alternativní slovo má stejné zacházení s tahy a čistotou jako původní cíl.
- Nápověda 1 ukáže první buňku a délku, nápověda 2 první tři buňky, nápověda 3 úplné slovo a cestu. Omezují se jen skutečně zobrazené údaje. M[2] o délce 4 v e100 ponechá MÍSA i MŮŽE; prefix MÍS zvolí kanonickou větev. Další nápověda po nalezení MŮŽE míří na SÍRA. Reset nesmaže počty nápověd, tahů ani čas.
- Nové rozehrávky ukládají revizi řešení, skutečná nalezená slova/cesty a odhalené prefixy. Stará kanonická rozehrávka se smí migrovat jen převodem původních indexů na přesně ověřené signatury. Neznámá revize nebo smíchaná sada se potichu neprohlásí za dokončenou. Existující staré výhry a XP se nepřepisují.
- Union všech schválených cílových slov dané desky je vyloučen z discovery +1 XP i ze zpětné vazby pro vedlejší slova. Nekompatibilní alternativní cíl není další bonusové slovo. Výjimka platí jen pro příslušnou archivní desku; globální generační lexikon se nerozšiřuje.
- Přehled odděluje zahranost konkrétní desky od zaplacení historického slotu. API i UI umožní přímé spuštění každé schválené desky bez kontroly předchozí úrovně.
- Před zveřejněním projdou skutečnou integrací vstup, nápovědy, autosave/restore, dokončení, feedback, discovery bonusy i atomická odměna; ověří se mobil a Fold. Samotné testy tohoto izolovaného kontraktu nejsou end-to-end ověřením živé aplikace.

## Reprodukce

Na připravené větvi:

    node tools/archive/test_archive_solution_contract.cjs

    node tools/archive/audit_exact_covers.cjs

Pro širší snapshot nejprve načíst připnutý historický commit, který pouze dodává zdrojová data:

    git fetch --depth=1 origin 553fb3578c958004b831068dfd268dbcb2a423ab

    node tools/archive/audit_exact_covers.cjs --broad-ref 553fb3578c958004b831068dfd268dbcb2a423ab

Workflow archive-content-preparation spouští stejný kontrakt a oba audity v Node. Stav testů se posuzuje až pro poslední SHA PR. Produkční spuštění vyžaduje vyřešené zbývající podmíněné jazykové případy, integrační adaptér, samostatnou odměnovou opravu a vizuální ověření.
