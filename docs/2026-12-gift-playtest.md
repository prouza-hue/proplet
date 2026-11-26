# Ještě jeden plech · druhý slepý průchod

Prosincová revize po hráčském testu. Na původním snímku dohrál hráč První plech za 14 sekund pěti tahy. Jedno z pěti slov dával přímo název kapitoly, další se četlo v přímce. Ve třetí desce revize zbývají z původních slov VŮNĚ a TROUBA. Všech osm cest mění směr a krátké slovo samo o sobě k dohrání nestačí.

## Nezávislé řešení

Řešič načetl písmena, masku, rozměry a požadované délky. Odpovědi a autorské trasy při hledání nepoužil. Vypsal ortogonální cesty bez opakování polí a každé slovo ověřil v herním rozpoznávači včetně wordfreq a binárního slovníku DAWG nebo v redakčním lexikonu v3. Následně hledal všechna úplná pokrytí s předepsaným počtem slov jednotlivých délek.

| Kapitola | Polí dříve → nyní | Slov | Zalomení na cílových trasách dříve → nyní | Platných slovních tras v nové mřížce | Úplných pokrytí |
|---|---:|---:|---:|---:|---:|
| Váleček | 24 → 32 | 6 | 10 → 15 | 90 | 1 |
| Formička | 21 → 36 | 6 | 10 → 17 | 82 | 1 |
| První plech | 26 → 46 | 8 | 8 → 27 | 120 | 1 |
| Linecké | 28 → 48 | 8 | 7 → 25 | 132 | 1 |
| Poslední kousek | 29 → 59 | 10 | 7 → 30 | 85 | 1 |

Všech 38 nalezených slov má právě jednu trasu. U žádného nestačí jet rovně. Každá samostatná platná slovní trasa se v tabulce počítá jednou, včetně těch, po kterých se již nedá pokrýt celá mřížka. Čtyři až sedm písmen na třetí desce dovolí např. MINUTU a KAPKU. Obě slova se podařilo skutečně obtáhnout. Hra je uznala jako platná mimo řešení. Správné MINUTKA a CHŇAPKA vyžadují jiné tahy. Ve čtvrté kapitole MARMELÁDA sleduje tři strany otvoru. V poslední zbude uprostřed dózy místo na SOUSTO.

Počty zakřivení, velikost mřížek a slepé cesty popisují změnu návrhu. Čas nového lidského dohrání bude možné porovnat až s dalším hráčským testem.

## Skutečné herní rozhraní

Pět kapitol prošlo na lokálním náhledu v Chromiu skutečnými tahy nalezenými při slepém průchodu. Matice zahrnovala úzký mobil 360 × 740 a rozložený Fold 690 × 829, vždy světlý a tmavý vzhled. Kontrola prvních čtyř výsledků a všech navazujících přehledů prošla i pro skryté popisky čtečky. Na třetím výsledku jsou tři neutrální otisky a „Dohráno 3 z 5“. Až po dokončení páté kapitoly se otevřelo závěrečné slovo NÁŠUP s podepsaným poděkováním. Kontrola textu a stromu přístupnosti zahrnula i úvodní obálku a jednotlivé rozehrané kapitoly. Odměna po nápovědě zůstala 300 osobních XP. Dohrání celé pětice dalo v každém profilu 1 500 náhledových XP a další odehrání první desky 0. Desky ani dialogy nepřetékaly vodorovně.

Další průchod na 320 × 700 vyzkoušel i dvě platná slova mimo řešení ve třetí kapitole. Po obou zůstal počet vyřešených slov na nule a desku šlo dál normálně dohrát. Všechny uvedené viewporty jsou emulované. Časy z prohlížečového automatu měří přehrání už nalezených cest.
