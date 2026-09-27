# Mozkokalypsa III — osm nových desek, celý Lexikon v3

27. 9. 2026. Zadání převzato z nefunkčního Worku. Osm úrovní výslovně potvrzeno Pavlem; žádná kontrolní polovina. Příprava produkčního kola je oddělená od tohoto hratelného obsahového preview.

## Hotový obsah

- Plný pracovní lexikon: 4 290 hesel, všech 1 143 schválených nových slov zpracováno. Původní hesla/posudky, vyřazení, hráčské banky a prototypová dvanáctka zůstaly beze změny. Nedělá se nové hromadné schvalování slov.
- **8 nových desek mk3v3-01…08; 112 různých cílových slov.** Žádné přesné opakování uvnitř osmičky ani mezi jejími cíli a prvními dvěma playtesty.
- **87 ze 112 cílů (77,68 %) je z nového rozšíření.** 92 zápisů nebylo v žádné zahrnuté historické bance; nejde o měření osobní zkušenosti testerů. Zbylá původní slova byla redakčně vybrána z běžně srozumitelné vědy, kultury, fantazie a abstraktních pojmů, ne slepě importována z frekvenčního seznamu.
- Každá deska má alespoň 8 makrotémat, nanejvýš 3 slova jednoho tématu a žádnou opakovanou explicitní slovní rodinu. Pravopisné varianty se neopakují ani mezi deskami.
- Doplněn nezávislý doklad ZÁŠEVKU: Burda Style, „Jak na záševky?“, 19. 11. 2019. Původní zaznamenaná mezera v historickém posudku se nemaže; viz `working/editorial-addendum-20260927.json`.

## Náročnost: nepřizpůsobená malé první dávce

Zachovány rozměry 10×10, 14 slov, plných 100 políček a přesný původní délkový profil `[5,6,6,6,7,7,7,7,8,8,8,8,8,9]` na každé desce. Žádné zkracování slov kvůli malé kapacitě.

Na každé desce 2A/6B/6C — původní zamýšlená lexikální skladba plné Mozkokalypsy, ne změkčený profil prototypu. To jsou zděděné/redakční štítky známosti, **nikoli doklad stejné lidské obtížnosti**. Žádné nové slovo nebylo přeznačeno jen pro naplnění kvóty. V celé zásobě se nevyřazují A slova ani neprosazuje zákaz přejatých slov.

Geometrická minima jsou přísnější: alespoň 3 zatáčky každého slova, průměr alespoň 4,65, maximální podíl přímého úseku .55. Z 24 přesně ověřených umístění stejného slovního setu se vybírá to se silnějšími lokálně lákavými cestami i po odebrání části slov. Celá osmička má na stejné kontrolní slovní zásobě vyšší medián této pomocné metriky než kolo II, včetně stavu po polovině slov. **Není to předpověď času ani důkaz náročnosti pro TOP hráče; to musí potvrdit hraní.**

## Ověření řešení a poznatelné hranice

Všech osm desek znovu prošlo nezávislým solverem: platné ortogonální cesty, plné nepřekrývající se pokrytí, jediné úplné řešení a jednoznačné cílové cesty. Kontrola pracuje s **103 836 zápisy**: celá pracovní statická v3 + všechny přípustné české abecední položky skutečné runtime frekvenční tabulky wordfreq 3.1.1 + uvedené pravopisné varianty. Tím se oproti prototypu zahrnuje i zmrazená frekvenční vrstva. Budoucí změny runtime/prahování/slovníku vyžadují nové ověření.

První deska byla znovu vyrobena ze stejného seedu a plného fondu 24 umístění: shodný obsahový hash (`replay.json`). Lokálně prošlo osm převzatých testů základu a jedenáct testů Gen6 včetně pěti nových kontrol úplné osmičky, širšího slovníku, špatné provenience a odmítnutí timeoutu.

Lokální Chromium se spustí, ale navigace na loopback byla administrativně blokována. Žádný snímek nebyl nahrazen maketou. Skutečný browser test je připraven jako `tools/test_gen6_eight_browser.py` pro povolené izolované CI; jeho výsledek a skutečné snímky budou doloženy samostatným reportem. Nejde o test fyzického Samsungu Fold.

## Reprodukce

Základ je skutečný Git strom `84d2e75076d8422db03c8f229db19523da039acf`. Nový výrobní kód i všechny čtené vstupy mají SHA-256 v `verification.json`; sourceSha je převzatá baseline, nikoli tvrzení, že nový kód již tehdy existoval. Produkce byla při převzetí `f04c99e…` a nebyla měněna.

```sh
python -m pip install wordfreq==3.1.1
python -m tools.gen6.eight --output lab-output/gen6/new-independent-run --seed 2026092708 --pool-size 24 --seconds-per-board 180
python -m unittest discover -s tests/lexicon_v3 -v
python -m unittest discover -s tests/gen6 -v
python tools/build_gen6_eight_preview.py
```

Frekvenční cache v textu není nutná ani součástí tohoto PR: stejná data se reprodukují ze stejné knihovny a kontrolují přesným hashem. Statické preview má rozpoznávací data oddělená od banky a uvádí jejich zdroje/licenci. Kód nepoužívá produkční API/DB, neposílá analytiku a nepřipisuje XP. Produkční sestavení preview builder odmítne.

## Další kroky

1. Po skutečném browser ověření ukázat obsah Pavlovi. Osmičku nepovažovat za změřeně těžkou jen proto, že projde solverem.
2. Zapojit schválenou sadu do stávajícího playtestového toku Propletu: samostatná identita kola, zachované výsledky II, osm desek, hodnocení a odměny, serverová uzávěrka a lokální odpočet bez pollingu. Termín konce III a případné změny účastníků/odměn potvrdit před aktivací. Kolo II končí 28. 9. ve 24:00 českého času; žádný automatický launch jen dosažením data.
3. Po vyhodnocení zábavnosti, náročnosti a novosti použít dokončený Lexikon v3 pro ostatní obtížnosti. Společný verzovaný manifest ID bude zachovávat `rozehráno → první nedokončená deska trasy`, původní katalog, XP i žebříčky podle identity desky. Nové desky mají přijít brzy, ne až na konec staré banky. Tato fáze se nyní nezapíná.

PR #148 zůstává preview-only draft s odlišnou konfigurací Vercelu. Není určený k přímému sloučení do produkce. Produkční integrace musí oddělit tuto dočasnou konfiguraci a projít skutečnými produkčními kontrolami.
