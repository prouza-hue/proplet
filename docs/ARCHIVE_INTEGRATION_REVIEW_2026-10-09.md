# Integrovaný Archiv a měsíční soutěž — review 9. 10. 2026

Základ: main 1627610426894e16044396a05a348cb1cf26e7bf (4.05.2, Daily Gen6 a uzavřený základ #177).
Oddělená větev preview/archive-integrated-20261009. Není určena ke sloučení ani spuštění bez dalšího schválení.

## Jedna skutečná aplikace
Root preview používá původní index, styly, hlavičku, navigaci a herní engine. Dnes zůstává dominantní Denní výzva; další vstupy tvoří Tajenka, Archiv, Volná hra, týdenní týmy a měsíční jednotlivci. Hrát je katalog s vysoko umístěným Archivem, původním přehledem úrovní; nastavení pořadí zůstává v Nastavení. Dnes / Hrát / Pořadí / Já zůstávají zachované podle návrhu z 30. 9.

Archiv nabízí libovolný výběr z 800 skutečných historických desek ve čtyřech obtížnostech. Přes skutečnou herní plochu lze hrát, použít nápovědu, přerušit, obnovit a dokončit. Řešení používají konečný seznam kompletních pokrytí, nikoli volné uznávání slovníku.

## Schválená redakční příprava
Dříve čekajících 15 pokrytí přijato jako konkrétní historické výjimky dle Pavelova schválení 8. 10. Výsledek: 79 schválených alternativ, 21 odmítnutých, 0 nerozhodnutých; 800 původních a celkem 879 úplných řešení. Původní gzip zůstává beze změny a jeho Git blob SHA se kontroluje při buildu. Toto schválení nerozšiřuje generační lexikon V3 ani Daily Gen6.

## Co je modelové
Preview má ukázkový profil Alex a izolovaný postup pouze v zařízení. Serverové zápisy jsou blokované. Denní výzva a Tajenka čtou pouze zveřejněný obsah. Měsíční listopadový žebříček je výslovně modelový, nemá vyhlášený termín spuštění. XP archivních slotů zde prokazují uživatelskou cestu lokálně; produkční atomický ledger a migrace z #177 se tím nenahrazují.

Měsíční pravidla: 100 bodů za první platné dokončení Denní výzvy v den zveřejnění, +20 bez nápovědy, nejlepších 20 dní, shody sdílejí soutěžní pořadí (1, 1, 3), čas Praha, 48 hodin po měsíci na kontrolu/reklamace, odznaky pro příčky 1–3 bez XP. Datum ostrého startu až po ověření serverového skórování a schválení.

## Zbývá před produkcí
- Runtime základ #177 je na produkci, historické odměny zůstávají explicitně vypnuté. SQL migrace nebyla aplikována. Před otevřením dokončit audit a řízené nasazení připravené migrace.
- Produkční archivní endpoint, autorizace/synchronizace rozehraných alternativ a serverová validace kompletního řešení.
- Měsíční serverové skórování, finální vyhodnocení, reklamace a přidělení trvalých odznaků; ukázková data odstranit.
- Schválit integrované UI, pak připravit vydání a naplánovat start Archivu i oznámení. Měsíční soutěž první celý měsíc po připravenosti.
- Daily Gen6 již dokončena #182: 99 dnů 8. 10. 2026–14. 1. 2027. Neprovádí se nové generování ani zveřejnění budoucích desek.

## Ověření
Cílený workflow archive-integrated-review.yml: reálný Chromium na 320 / 390 / 690 / 1440 px, canonical UI, archivní celá hra a návrat, přerušení/obnova, přechod Fold viewportu, XP jednou, historická odměna i při moderním dokončení, schválená alternativa VRTÍ + nápověda + obnova, všech 879 pokrytí. Výsledky a snímky public/review-evidence/report.json. Emulovaný Fold není ověření na fyzickém zařízení.

## Vizuální reference pro další práci
Pavelova schválená preference: CTA pro 300 nových Gen6 úrovní. Zachovat výrazný Fraunces, Outfit v běžném UI, jemné papírové barevné podbarvení, vlastní ilustrace/odznaky a jedno výrazné hlavní tlačítko. Archiv má teplou archivní barevnost, ukázkový listopad švestkovou. Integrace vždy přímo do kanonické aplikace; samostatný mockup nesplňuje zadání.

Lokální běh: integrovaný náhled se zapíná parametrem ?archive-preview=1, aby běžné lokální regresní testy nadále ověřovaly původní nové návštěvníky. Na samostatné Vercel preview adrese se zapíná automaticky. PWA se v tomto náhledu neregistruje; před ostrým vydáním bude potřeba samostatně ověřit offline chování Archivu.

Vercel FastAPI balí veřejné soubory ze zdrojového snapshotu. Generovaný boards.json proto cílený workflow ukládá spolu s důkazy do preview větve. Builder jej při každém sestavení znovu deterministicky vytvoří z neměnného zdroje; jde pouze o historickou banku. Po nasazení se samostatně kontroluje dostupnost tohoto souboru, nikoli jen úspěch buildu.

## Revize po vizuálním feedbacku 9. 10.
- Běžné karty používají typografii Outfit z aktuální aplikace, stejnou hierarchii a zarovnání. Fraunces zůstává v oznamovacích CTA podle schválené reference 300 úrovní.
- Archiv čte názvy obtížností přímo z DIFF; čtvrtá obtížnost je Mozkožrout. Interní klíč hardcore se hráči nezobrazuje.
- Hrát: odstraněny přidané odkazy Úrovně / Pořadí desek a text Další deska. Původní přehled úrovní je stále dostupný přes počet dokončených desek, pořadí přes Nastavení.
- Dnes: Denní výzva zůstává dominantní, dále Tajenka, Archiv, týdenní týmy, měsíční jednotlivci a Volná hra. Žádný společný slogan nad soutěžemi. Volná hra používá čtyři skutečné ilustrace obtížností.
- Archiv: volný výběr všech desek, čitelnější mobilní přepínače a odměny, větší dotykové plochy.
- Měsíční odznaky: odstraněny provizorní ploché SVG medaile. Používají skutečné ilustrace medaile / medal-2 / medal-3 z produkční Tiskařské dílny s označením XI · 2026. V malých navigačních ikonách se označení skrývá, aby zůstaly čitelné. Listopad je nadále model.
- Týmová karta používá existující ilustraci first-imprint z týmových vítězství.
- Vizuální reference produkce se pořizuje z hrajproplet.cz v anonymním prohlížeči a se zablokovanými zápisy. Nepoužívá hráčský účet.

Závěrečné ověření revize: zdrojový commit 1a9ada8fdd31de3b8f08996e8f2c043b56a36674. Integrovaný Chromium PASS, 50 snímků včetně produkční reference 4.05.2, 320/390/690/1440 px, žádné horizontální přetékání, chyby JavaScriptu ani síťové zápisy. Current runtime gate a isolated-result-database PASS. Náhledové JS/CSS se po nasazení přesně shodují s ověřenými soubory.
