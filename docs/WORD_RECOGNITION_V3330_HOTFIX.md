# v3.33.0 Recognition Lexicon hotfix

## Cíl

Opravit falešně negativní rozpoznávání běžných českých slov, která nejsou řešením konkrétního Propletu. Hotfix nesmí rozšířit ani jinak změnit generační Lexicon V2.

## Architektura

Rozpoznání probíhá ve dvou vrstvách:

1. současný statický recognition index (`data/words.txt`, Lexicon V2, lowercase Wikidata lemmas, malý editorial overlay),
2. pouze při missu frequency-backed fallback přes `wordfreq` pro češtinu.

Fallback používá vyšší práh pro slova bez české diakritiky, kde je vyšší riziko cizojazyčného šumu. Výsledek je stále pouze `recognitionOnly`; nikdy se tím slovo nestává kandidátem pro generování puzzle.

## Regresní sada

Povinně musí projít:

- BRUSKA
- PNUTÍ
- PADNUTÍ
- HRUBKA
- TLUPA
- PULT

Současně je potřeba v preview ověřit několik náhodných nesmyslů a sledovat, zda fallback není příliš benevolentní.

## Závislost a licence

`wordfreq==3.1.1` je použito jako runtime dependency. Kód projektu je Apache-2.0; jeho distribuovaná jazyková data mají vlastní atribuční/licenční podmínky popsané v balíčku `wordfreq` (včetně CC BY-SA 4.0 a zdrojových atribucí). Balíček se používá na serveru jako knihovna, jeho vlastní NOTICE/licence zůstávají součástí instalované dependency.
