#!/usr/bin/env python3
"""Fetch a reproducible CC0 snapshot of Czech Wikidata Lexeme lemmas.

Only lexical categories useful as Proplet target answers are retained.  The
snapshot is an input to curation, never an automatically approved answer list.
"""
from __future__ import annotations

from datetime import UTC, datetime
import json
from pathlib import Path
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "lexicon_v2_wikidata_raw.json"
ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "PropletLexiconResearch/2.0 (Czech educational word-game curation)"
CATEGORIES = {
    "Q1084": "noun",
    "Q34698": "adjective",
    "Q380057": "adverb",
    "Q24905": "verb",
}


def fetch() -> list[dict[str, str]]:
    values = " ".join(f"wd:{qid}" for qid in CATEGORIES)
    query = f"""
SELECT ?lexeme ?lemma ?category WHERE {{
  ?lexeme dct:language wd:Q9056;
          wikibase:lemma ?lemma;
          wikibase:lexicalCategory ?category.
  VALUES ?category {{ {values} }}
}}
"""
    url = ENDPOINT + "?" + urllib.parse.urlencode({"query": query, "format": "json"})
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"},
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        payload = json.load(response)

    rows: list[dict[str, str]] = []
    for binding in payload["results"]["bindings"]:
        category_id = binding["category"]["value"].rsplit("/", 1)[-1]
        rows.append(
            {
                "lexeme_id": binding["lexeme"]["value"].rsplit("/", 1)[-1],
                "lemma": binding["lemma"]["value"],
                "category_id": category_id,
                "part_of_speech": CATEGORIES[category_id],
            }
        )
    return sorted(rows, key=lambda row: (row["lemma"].casefold(), row["lexeme_id"]))


def main() -> None:
    rows = fetch()
    payload = {
        "version": 1,
        "language": "cs",
        "source": "Wikidata Lexemes",
        "source_url": "https://www.wikidata.org/wiki/Wikidata:Lexicographical_data",
        "license": "CC0-1.0",
        "retrieved_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "categories": CATEGORIES,
        "count": len(rows),
        "entries": rows,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {len(rows)} Czech lemmas to {OUT}")


if __name__ == "__main__":
    main()
