# Proplet Lexicon v2 — produkční specifikace

## Výsledek

Produkční Lexicon v2 obsahuje **3 153 cílových lemmat**:

| Tier | Počet | Role |
|---|---:|---|
| A | 510 | nejběžnější a nejpřístupnější slova |
| B | 750 | širší běžná slovní zásoba |
| C | 1 568 | náročnější, ale stále přirozená slova |
| D | 325 | kultivovaná, objevná a herně šťavnatá slova |

Tier D obsahuje 197 slov se zábavností 4–5 a jeho průměrná zábavnost je 4,04/5.

## Metadata

Každý záznam v `data/lexicon_v2.json` obsahuje:

- `word` a `tier`,
- `familiarity` — běžnost 1–5,
- `complexity` — jazyková náročnost,
- `fun` — herní přitažlivost 1–5,
- `theme`, `register` a `age_floor`,
- slovní druh, frekvenční evidenci, původ a zdrojovou stopu,
- stav kurátorského review.

## Kurátorská pravidla

- Cílem je lemma vhodné jako odpověď ve hře, nikoli libovolný platný skloňovaný či časovaný tvar.
- Vlastní jména, vulgární a věkově nevhodné výrazy, problematické registry a neohrabané tvary jsou blokované.
- Nízká frekvence sama o sobě neposílá slovo do D. Tier D vyžaduje ediční důvod: objevnost, vědu, dobrodružství, kulturu nebo výraznou herní šťávu.
- Scrabble-validita může být validační signál, nikdy však automatické doporučení do Propletu.
- Finální rozhodnutí dělá náš kurátorovaný seznam a produkční blocklist.

## Generátor

`tools/generate_puzzles.py` používá tier i `fun` při výběru odpovědí. Mozkožrout vyžaduje nejméně 50 % odpovědí Tier D, průměrnou zábavnost alespoň 3,5 a nejméně čtyři odpovědi s `fun` 4–5 na desku. Ostatní obtížnosti mají vlastní tier mix a minimální hranice zábavnosti.

Daily používá rodinný mix A/B/C: nejméně 15 % A, nejméně 35 % B a nejvýše 25 % C. Každá deska má průměr `fun` alespoň 3,0 a nejméně jednu odpověď s `fun` 4–5. Stejné slovo se v kruhové roční rotaci nesmí zopakovat dříve než po 24 mezilehlých dnech.

Reprodukovatelný build lexikonu zajišťuje `tools/build_lexicon_v2.py`; zdrojový snapshot kandidátů je uložen lokálně v `data/lexicon_v2_wikidata_raw.json`.
