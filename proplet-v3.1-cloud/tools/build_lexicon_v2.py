#!/usr/bin/env python3
"""Build the production Proplet Lexicon v2 from reviewed and CC0 inputs.

The subtitle frequency list is evidence only.  New target answers must first be
Wikidata Lexeme base forms (or an explicit manual fun-D addition), then pass the
family/register deny list.  Nothing is promoted from subtitle word forms alone.
"""
from __future__ import annotations

from collections import Counter
import argparse
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "lexicon_v2_wikidata_raw.json"
FREQUENCY = ROOT / "data" / "source_cs_50k.txt"
OUT = ROOT / "data" / "lexicon_v2.json"
TIERS_OUT = ROOT / "data" / "answer_tiers.json"
CZ_WORD = re.compile(r"^[a-záčďéěíňóřšťúůýž]{4,10}$")

# These are legitimate-looking dictionary entries that are not suitable target
# answers in a family game.  The filter applies to new imports; the reviewed
# green seed has already passed its own editorial review.
TARGET_BLOCK = set("""
blbec blbost blbý bordel boxerky debil děvka felicia green hajzl heroin hovínko
hovno idiot kalhotky kokain kozy kurva masturbace mrtvola mučení nádor opilec
opilý panenství penis pitomec pitomý podprsenka porno potrat prdel prostitut
prostitutka rakovina sebevrah sebevražda sex slipy soulož tanga tumor vagína
vole zadek zadnice zabiják zabíjení znásilnění zvrhlost zvrhlý
body homosexuál house love prdelka union
angličanka arab babka brokovnice černo černoch černoška čokl čumák dcerka
dědek děloha drbna fotr gambler haraburdí hašiš hlaveň holčina honda huba
jump kojení lino lupus machr marod maturiťák maxima milostpaní močení měchýř
měsíčky níže novina odpust opium otrokyně papá polák porodnice psisko rajón
smrťák sociopat střelnice šumák švindl tatík terra till turek číča ňadra ženuška
alkohol dealer droga hazard kasino lesba pivo puška rum vodka whisky víno
""".split())

# Pavel explicitly asked for a bolder, still cultivated Tier D.  This is the
# human editorial layer: memorable Czech scientific, mythic, linguistic and
# exploratory words, not rare inflected forms or Scrabble curiosities.
FUN_D_BY_THEME = {
    "mystery/myth/adventure": set("""
        apokalypsa artefakt bazilišek cerberus démon dystopie kraken leviatan
        absurdno almanach amfora apokryf arkáda artefakt balista bazilišek
        cerberus démon druid dystopie faraon freska groteska heraldika katapult
        kodex koloseum kraken leviatan mastaba menhir mohyla monolit mumie
        mumifikace nekromant nekropole obelisk orákulum panteon pergamen
        relikviář sarkofág skarab skarabeus šotek trebuchet triréma valkýra zikkurat
    """.split()),
    "space/science/future": set("""
        aerogel akustika anoda antihmota apogeum astronaut bauxit biochemie
        biometrie bionika biočip biosféra cytologie červodíra derivace difrakce
        dodekaedr dualismus echolokace ekliptika ekologie elektron enzym etologie
        feromon fosilie foton geodézie genom grafen graviton grafit gyroskop
        hydrologie hyperbola ikosaedr imunita integrál izotop katalýza kinetika
        koróna kosmologie kosmonaut kryogenika křemen kvantum kvark lidar
        logaritmus lunochod magma magnetit meteoroid metaverzum mikroskop množina
        mnohostěn morfém mycelium nanobot neutrino neutron nihilismus observatoř
        ontologie orbitál organismus osciloskop parabola parazit patogen perigeum
        pentagram plankton plazma polygon predátor proton radiace radon
        relativita rezonance satelit seizmika simulátor skalár sofismus sonar
        spirála stoicismus syntax tensor topologie turbína vakuum xenon
    """.split()),
    "language/mind/illusion": set("""
        afázie akronym amnézie anafora anagram aliterace epifora etymologie foném
        kaligram kryptogram metonymie nocebo oxymóron palindrom pareidolie
        piktogram placebo pseudonym samizdat synekdocha synestezie sémantika
        tautologie telekineze telepatie
    """.split()),
    "technology/strange objects": set("""
        anamorfóza astroláb automat blockchain bumerang chronometr hieroglyf
        hromosvod kamufláž kryptoměna kyberpunk periskop sextant steampunk
        teleport teserakt vzducholoď
    """.split()),
    "unusual nature": set("""
        axolotl gejzír kasuár krakatice luskoun narval nautilus okapi ptakopysk
        sklípkan tsunami velemlok vombat zatmění
    """.split()),
}
FUN_D = set().union(*FUN_D_BY_THEME.values())

SCIENCE_HINTS = (
    "atom", "bio", "chem", "elektr", "fyz", "geo", "graf", "kosm", "logie",
    "metr", "neuro", "robot", "tech", "věd", "zool",
)
ABSTRACT_ENDINGS = (
    "ace", "ance", "ence", "ismus", "ita", "nost", "ologie", "ování", "ství",
)


def load_frequency() -> dict[str, int]:
    rows: dict[str, int] = {}
    for line in FREQUENCY.read_text(encoding="utf-8").splitlines():
        try:
            word, count = line.rsplit(" ", 1)
            rows[word.casefold()] = int(count)
        except ValueError:
            continue
    return rows


def familiarity(frequency: int | None, tier: str) -> int:
    if frequency is None:
        return {"A": 4, "B": 3, "C": 2, "D": 1}[tier]
    if frequency >= 10_000:
        return 5
    if frequency >= 3_000:
        return 4
    if frequency >= 800:
        return 3
    if frequency >= 250:
        return 2
    return 1


def infer_theme(word: str, seed_themes: list[str] | None = None) -> str:
    if seed_themes:
        return seed_themes[0]
    for theme, words in FUN_D_BY_THEME.items():
        if word in words:
            return theme
    if any(hint in word for hint in SCIENCE_HINTS):
        return "science/technology"
    if word.endswith(ABSTRACT_ENDINGS):
        return "ideas/society"
    return "people/everyday/world"


def fun_score(word: str, theme: str, *, reviewed_theme: bool) -> int:
    if word in FUN_D:
        return 5
    if reviewed_theme and any(token in theme for token in ("animals", "fantasy", "space", "tech", "fun")):
        return 4
    if theme == "science/technology":
        return 4
    if theme == "ideas/society" or word.endswith(ABSTRACT_ENDINGS):
        return 2
    return 3


def source_for(raw_entry: dict | None, origin: str) -> list[dict[str, str]]:
    sources: list[dict[str, str]] = []
    if raw_entry:
        sources.append(
            {
                "name": "Wikidata Lexemes",
                "id": raw_entry["lexeme_id"],
                "role": "lemma_and_part_of_speech",
                "license": "CC0-1.0",
            }
        )
    if origin.startswith("v1_") or origin.startswith("v2_") or origin == "manual_fun_d":
        sources.append({"name": "Proplet editorial review", "role": "target_approval"})
    return sources


def enrich(
    word: str,
    tier: str,
    origin: str,
    frequency: int | None,
    raw_entry: dict | None,
    seed_themes: list[str] | None = None,
) -> dict:
    theme = infer_theme(word, seed_themes)
    reviewed_theme = bool(seed_themes)
    part_of_speech = raw_entry["part_of_speech"] if raw_entry else "editorial_lemma"
    if origin == "manual_fun_d":
        register = "cultivated_or_specialized"
    elif origin == "wikidata_frequency_candidate":
        register = "neutral"
    else:
        register = {"A": "everyday", "B": "neutral", "C": "educated", "D": "cultivated"}[tier]
    return {
        "word": word,
        "tier": tier,
        "familiarity": familiarity(frequency, tier),
        "complexity": {"A": 1, "B": 2, "C": 3, "D": 4}[tier],
        "fun": fun_score(word, theme, reviewed_theme=reviewed_theme),
        "theme": theme,
        "register": register,
        "age_floor": {"A": 6, "B": 8, "C": 10, "D": 12}[tier],
        "part_of_speech": part_of_speech,
        "frequency_evidence": frequency,
        "origin": origin,
        "review": "approved",
        "sources": source_for(raw_entry, origin),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=Path, required=True, help="Reviewed green-core JSON")
    args = parser.parse_args()

    frequency = load_frequency()
    raw_payload = json.loads(RAW.read_text(encoding="utf-8"))
    raw_by_word: dict[str, dict] = {}
    for entry in raw_payload["entries"]:
        # Prefer a noun analysis when Wikidata has homonymous lexemes.
        old = raw_by_word.get(entry["lemma"])
        if old is None or (entry["part_of_speech"] == "noun" and old["part_of_speech"] != "noun"):
            raw_by_word[entry["lemma"]] = entry

    seed = json.loads(args.seed.read_text(encoding="utf-8"))
    entries: dict[str, dict] = {}
    seed_words: set[str] = set()
    for item in seed["entries"]:
        word = item["word"].casefold()
        if not CZ_WORD.fullmatch(word):
            raise RuntimeError(f"Invalid reviewed seed answer: {word!r}")
        entries[word] = enrich(
            word,
            item["tier"],
            item.get("origin", "v2_green_core"),
            item.get("frequency_evidence", frequency.get(word)),
            raw_by_word.get(word),
            item.get("themes"),
        )
        seed_words.add(word)

    # Broad but safe expansion: common-noun Lexeme base forms which have real-use
    # frequency evidence.  Adjectives/adverbs are not bulk-imported; the reviewed
    # seed already contains useful ones and generic forms tend to be dull answers.
    for word, raw_entry in raw_by_word.items():
        if raw_entry["part_of_speech"] != "noun":
            continue
        if word in entries or word in TARGET_BLOCK or not CZ_WORD.fullmatch(word):
            continue
        count = frequency.get(word)
        if count is None:
            continue
        adjusted = count / (1.35 if len(word) >= 9 else 1.0)
        # Rarity alone must never manufacture a Mozkožrout word. Generic low-
        # frequency nouns stay in C; D requires reviewed intellectual/adventure
        # value or a recognizable science/technology concept.
        theme = infer_theme(word)
        tier = "B" if adjusted >= 3_500 else "D" if adjusted < 700 and theme == "science/technology" else "C"
        entries[word] = enrich(word, tier, "wikidata_frequency_candidate", count, raw_entry)

    # The fun-D layer is explicit and small enough to review word by word.  It may
    # include terms not yet represented as Wikidata Lexemes.
    for word in sorted(FUN_D):
        if not CZ_WORD.fullmatch(word):
            raise RuntimeError(f"Invalid manual fun-D lemma: {word!r}")
        if word in TARGET_BLOCK or word in seed_words:
            continue
        entries[word] = enrich(word, "D", "manual_fun_d", frequency.get(word), raw_by_word.get(word))

    ordered = sorted(entries.values(), key=lambda item: (item["tier"], item["word"]))
    counts = Counter(item["tier"] for item in ordered)
    fun_counts = Counter(item["fun"] for item in ordered)
    if not 3_000 <= len(ordered) <= 5_000:
        raise RuntimeError(f"Production lexicon must contain 3,000–5,000 entries, got {len(ordered)}")
    if counts["D"] < 300 or sum(1 for item in ordered if item["tier"] == "D" and item["fun"] >= 4) < 150:
        raise RuntimeError(f"Tier D is not broad/fun enough: {counts}")

    payload = {
        "version": 2,
        "status": "production",
        "language": "cs-CZ",
        "principles": [
            "Target answers are reviewed dictionary/base forms, never subtitle forms promoted by frequency alone.",
            "Wikidata Lexemes supplies CC0 lemma/POS evidence; frequency only supports familiarity.",
            "Tier and fun are separate: demanding words should still be satisfying to discover.",
            "Tier D is cultivated and adventurous, not archaic, dialectal or merely Scrabble-valid.",
        ],
        "counts": dict(sorted(counts.items())),
        "fun_counts": dict(sorted(fun_counts.items())),
        "entries": ordered,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    tiers_payload = {
        "version": 2,
        "language": "cs-CZ",
        "source": "data/lexicon_v2.json",
        "principles": payload["principles"],
        "tiers": {tier: [item["word"] for item in ordered if item["tier"] == tier] for tier in "ABCD"},
        "metadata": {item["word"]: {key: item[key] for key in ("familiarity", "complexity", "fun", "theme", "register", "age_floor", "part_of_speech")} for item in ordered},
    }
    TIERS_OUT.write_text(json.dumps(tiers_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Lexicon v2: {len(ordered)} entries; tiers {dict(counts)}; fun {dict(fun_counts)}")


if __name__ == "__main__":
    main()
