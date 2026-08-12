# Proplet v3.11 — návrh tierované slovní zásoby

## Cíl

Obtížnost Propletu má vznikat hlavně **geometrií cesty, počtem slov, velikostí desky a množstvím možností**, ne tím, že hráč narazí na podivný nebo neznámý tvar z frekvenčního korpusu.

Proto jsou od v3.11 dvě jazykové vrstvy striktně oddělené:

1. **Cílová slova** — pouze ručně kontrolovaný slovník A–D.
2. **Solverový slovník** — velký frekvenční korpus, který hledá nechtěná alternativní česká slova a pomáhá ověřovat unikátnost desky.

Frekvenční korpus už **nikdy nesmí být fallback zdrojem cílových odpovědí**.

## Tiery

### A — okamžitě známá slova

Začínající čtenář / první stupeň. Převážně konkrétní každodenní slova, zvířata, jídlo, rodina, tělo, barvy, jednoduché činnosti a velmi běžné pojmy.

Příklady: `AUTO`, `KOČKA`, `JABLKO`, `BABIČKA`, `SLUNCE`, `MODRÁ`, `PLAVAT`, `NAROZENINY`.

### B — širší běžná slovní zásoba

Mladší školní věk. Stále běžná a férová slova, ale méně okamžitá, delší nebo pravopisně/pojmově náročnější.

Příklady: `DINOSAURUS`, `DALEKOHLED`, `MRAVENEC`, `PRAVÍTKO`, `PŘESTÁVKA`, `TEPLOMĚR`, `TRAMVAJ`.

### C — starší dítě / běžný dospělý

Abstraktnější, školní, společenská a obecně-vzdělaná slovní zásoba. Slova mají být známá, ale už vyžadují širší slovník.

Příklady: `DŮSLEDEK`, `MOTIVACE`, `POZORNOST`, `PRAVIDLO`, `PROSTŘEDÍ`, `ROZHODNUTÍ`, `VÝZKUM`.

### D — kultivovaná dospělá slovní zásoba

Mozkožrout. Rozpoznatelná slova vzdělaného dospělého, nikoli obskurní slovníkové rarity.

Příklady: `ANALOGIE`, `ARGUMENT`, `INTUICE`, `KONTEXT`, `METAFORA`, `PARADOX`, `STRATEGIE`, `SYMETRIE`.

## Velikost v1

- A: **488**
- B: **278**
- C: **194**
- D: **148**
- celkem: **1 108** ručně kontrolovaných cílových slov

## Politika generátoru

| Režim | Povolené tiery | Povinný mix |
|---|---|---|
| Rescue | A | pouze A |
| Snadná | A | pouze A |
| Střední | A + B | alespoň 45 % B |
| Těžká | B + C | alespoň 45 % C |
| Mozkožrout | C + D | alespoň 40 % D |
| Denní výzva | A + B + C | alespoň 35 % B, nejvýše 25 % C |

Denní výzva je záměrně rodinná: nikdy nepoužívá Tier D.

## Co v3.11 aktivně mění

- budoucí Denní výzvy od **13. 8. 2026** jsou přegenerované tierovaným slovníkem,
- 1. 1. až 12. 8. 2026 zůstává přesně beze změny,
- všechny Free úrovně a Rescue zatím zůstávají beze změny,
- generátor nových puzzle už používá pouze tierovaný slovník.

## Proč zatím neměníme Free banky

Jediné férové pravidlo je:

> Jakmile má puzzle alespoň jeden start nebo dokončení od kteréhokoli hráče, jeho deska a slova jsou navždy zmrazené.

Proto je v balíku read-only SQL `PLAYED_PUZZLES_FREEZE_QUERY.sql`. Vrátí jednu JSON množinu všech puzzle ID, která kdy někdo spustil nebo dokončil.

Teprve s tímto manifestem lze spustit `tools/regenerate_tiered_unplayed.py`. Skript bez manifestu z bezpečnostních důvodů odmítne pracovat.

Staré nahrazené Free puzzle se při budoucí regeneraci archivují do `legacyFree`, aby mohl doběhnout i opožděný offline sync.

## Kontrola kvality

Každý nově generovaný kandidát stále musí projít všemi původními logickými podmínkami:

- ortogonální cesty,
- každé aktivní políčko právě v jednom cílovém slově,
- právě jedna lokální cesta každého cílového slova,
- právě jedno kompletní exact-cover řešení podle solveru,
- limity krátkých slov u Těžké/Mozkožrouta,
- žádná duplicitní deska v aktivní bance.

Tierování je tedy **další filtr kvality**, nikoli náhrada logického solveru.
