# Czech bonus-word recognition

This dictionary broadens recognition of **bonus words**. It does not select words
for boards and does not change the curated generation lexicon. The existing
editorial recognition list remains a separate additional source.

## Source and license

The vendored Hunspell Czech spelling dictionary comes from
[LibreOffice/dictionaries](https://github.com/LibreOffice/dictionaries/tree/b3a1c0be50d1ad0b404070124463fb4af90bbe39/cs_CZ),
commit `b3a1c0be50d1ad0b404070124463fb4af90bbe39`.
The original dictionary was created by Petr Kolář and numerous contributors;
the 2021 update is by Miroslav Pošta. Original Czech and English notices are
preserved without edits under `hunspell-cs/`. The Czech notice includes GNU GPL
version 2; an additional plain-text copy is provided as `COPYING`.

The compiled dictionary and the dictionary transformation are distributed under
GNU GPL version 2. The corresponding source, license, original notices and exact
builder are downloadable at `/recognition/bonus-cs-v1-source.zip`. The archive is
produced deterministically by the builder. No unrelated thesaurus or hyphenation
data is used.

`hunspell-cs/source.json` pins every source checksum. The generator uses only
Python's standard library and makes no network requests:

```sh
python tools/build_bonus_recognition.py
python tools/build_bonus_recognition.py --check
```

## Recognition policy

* Include source stems already entirely lowercase. Exclude proper names **before**
  case normalization, so `Praha` does not become a bonus word `praha`.
* Expand the dictionary's prefix/suffix flags and their explicit continuation
  flags, including inflection, comparison and negative forms. Honor cross-product
  flags. This pinned source uses one prefix and at most two suffixes, single-
  character flags, and no compound-word rules or complex prefixes.
* Preserve Czech accents; accept only the Czech/Latin board alphabet and lengths
  4–24 characters. No arbitrary suffix guessing, generated compounds, acronyms,
  punctuation, foreign-script tokens or accent-stripped matches.
* Remove `FORBIDDENWORD` entries, including when a generated form would otherwise
  match them. `NOSUGGEST` means "do not propose as a spelling correction", not
  "incorrect word"; it is not treated as a forbidden word.
* Recognition is exact, not probabilistic. Invalid strings cannot pass through a
  Bloom-filter collision. Dictionary loading failures remain errors and must not
  be persisted as negative word judgments.

The result has 3,264,888 distinct **word forms**, derived from 155,186 eligible
lowercase source roots. These are not 3.2 million distinct lemmas. The source has
261,167 total entries. Output is 1,625,850 bytes before HTTP compression.

The Python runtime reads `data/recognition/` so serverless packaging does not
depend on static public files. The browser reads the byte-identical public copy
under `public/recognition/`. Both manifests record the same SHA-256.

## Binary format PRLX0001

All integers are unsigned, little endian. The automaton is a minimal acyclic
deterministic word graph, constructed by suffix-state minimization of the sorted
word trie.

| Offset | Field |
| --- | --- |
| 0 | Eight ASCII bytes `PRLX0001` |
| 8 | uint32 node count |
| 12 | uint32 edge count |
| 16 | uint32 root node ID |
| 20 | uint32 accepted word-form count |
| 24 | uint32 alphabet length (at most 64) |
| 28 | Alphabet as alphabet-length UTF-16LE code units |
| next | `(node count + 1)` uint32 edge-start offsets |
| next | `edge count` uint32 edge records |

The high bit of each node's offset marks an accepting node; mask it with
`0x7fffffff` to obtain the edge index. The additional final offset marks the end
of the final node. A record is `(target node ID << 6) | alphabet index`. Edges of
each node are sorted by alphabet index and searched by binary search. Readers
validate bounds, structure and alphabet; the backend also verifies the manifest
checksum before accepting the data.
