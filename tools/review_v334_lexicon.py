#!/usr/bin/env python3
"""Prepare a human-review shortlist for the v3.34 target lexicon cleanup.

Nothing in this script removes or re-tiers a word. It only ranks candidates for
product-owner/editorial review and shows whether they are already used in active
or reserved content. Recognition vocabulary is intentionally out of scope.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TIERS = ROOT / "data" / "answer_tiers.json"
PUZZLES = ROOT / "data" / "puzzles.json"
ROLLING = ROOT / "data" / "rolling_content_v1.json"
DEFAULT_OUT = ROOT / "tmp" / "V334_LEXICON_REVIEW_CANDIDATES.md"

USER_MUST_REVIEW = {"červodíra", "blockchain", "pulsar", "tensor"}

# Seeded from the current C/D target list. These are *questions*, not deletions:
# specialist terminology, proper-name leakage, family-tone mismatches, or words
# whose delight-to-obscurity ratio deserves a human decision.
EDITORIAL_SEED = {
    "afázie", "agregace", "akronym", "aliterace", "anafora", "anamorfóza",
    "anoda", "apogeum", "astroláb", "bauxit", "cerberus", "chronometr",
    "cytologie", "derivace", "difrakce", "dodekaedr", "dualismus", "ekliptika",
    "epifora", "etologie", "foném", "geodézie", "grafen", "graviton",
    "heraldika", "heuristika", "hydrologie", "ikosaedr", "katalýza",
    "kauzalita", "kinetika", "koherence", "korelace", "kosmologie",
    "kryogenika", "lidar", "magnetit", "mastaba", "metaverzum", "metonymie",
    "mnohostěn", "modalita", "morfém", "mycelium", "nautilus", "nekropole",
    "neutrino", "nihilismus", "ontologie", "orbitál", "pareidolie", "poetika",
    "relevance", "seizmika", "skalár", "synekdocha", "synestezie",
    "tautologie", "telekineze", "teserakt", "topologie", "triréma", "zikkurat",
    # C-tier sanity checks caught while reviewing the current source of truth.
    "alexandr", "františek", "feťačka",
}

PROPER_NAME_SUSPECTS = {"alexandr", "františek"}
TONE_SUSPECTS = {"feťačka"}


def answer_counter(payload) -> Counter[str]:
    counter: Counter[str] = Counter()

    def walk(node):
        if isinstance(node, dict):
            answers = node.get("answers")
            if isinstance(answers, list):
                for answer in answers:
                    if isinstance(answer, dict) and answer.get("word"):
                        counter[str(answer["word"]).casefold()] += 1
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(payload)
    return counter


def active_counter(payload: dict) -> Counter[str]:
    subset = {
        "free": payload.get("free") or {},
        "daily": payload.get("daily") or [],
        "rescue": payload.get("rescue") or [],
    }
    return answer_counter(subset)


def review_score(word: str, tier: str, meta: dict, active: int, reserved: int) -> tuple[int, list[str]]:
    score = 0
    reasons: list[str] = []
    familiarity = int(meta.get("familiarity", 3) or 3)
    complexity = int(meta.get("complexity", 2) or 2)
    fun = int(meta.get("fun", 3) or 3)
    age_floor = int(meta.get("age_floor", 0) or 0)
    register = str(meta.get("register") or "").casefold()

    if word in USER_MUST_REVIEW:
        score += 100
        reasons.append("výslovně označeno product ownerem")
    if word in EDITORIAL_SEED:
        score += 24
        reasons.append("editorial seed")
    if word in PROPER_NAME_SUSPECTS:
        score += 30
        reasons.append("podezření na vlastní jméno")
    if word in TONE_SUSPECTS:
        score += 24
        reasons.append("rodinný tón")
    if tier == "D":
        score += 6
    if familiarity <= 1:
        score += 9
        reasons.append("familiarity 1")
    elif familiarity == 2:
        score += 5
        reasons.append("familiarity 2")
    if complexity >= 4:
        score += 5
        reasons.append(f"complexity {complexity}")
    elif complexity == 3:
        score += 2
    if register in {"educated", "specialist", "technical", "scientific", "academic", "literary"}:
        score += 4
        reasons.append(register)
    if age_floor >= 14:
        score += 4
        reasons.append(f"age {age_floor}+")
    elif age_floor >= 12:
        score += 2
    if fun <= 2:
        score += 4
        reasons.append(f"fun {fun}")
    # Existing usage raises review priority: changing it needs an explicit migration decision.
    if active:
        score += 3
        reasons.append(f"aktivně použito {active}×")
    if reserved:
        score += 2
        reasons.append(f"v rezervě {reserved}×")
    return score, reasons


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--limit", type=int, default=70)
    args = ap.parse_args()

    tdata = json.loads(TIERS.read_text(encoding="utf-8"))
    pdata = json.loads(PUZZLES.read_text(encoding="utf-8"))
    rdata = json.loads(ROLLING.read_text(encoding="utf-8")) if ROLLING.exists() else {}
    metadata = tdata.get("metadata") or {}
    tier_of = {
        str(word).casefold(): tier
        for tier, words in (tdata.get("tiers") or {}).items()
        for word in words
    }
    active = active_counter(pdata)
    reserved = answer_counter(rdata)

    rows = []
    for word, tier in tier_of.items():
        if tier not in {"C", "D"} and word not in USER_MUST_REVIEW:
            continue
        meta = dict(metadata.get(word) or {})
        score, reasons = review_score(word, tier, meta, active[word], reserved[word])
        if word in USER_MUST_REVIEW or word in EDITORIAL_SEED or score >= 17:
            rows.append({
                "word": word,
                "tier": tier,
                "score": score,
                "familiarity": meta.get("familiarity", "?"),
                "complexity": meta.get("complexity", "?"),
                "fun": meta.get("fun", "?"),
                "register": meta.get("register", "?"),
                "age": meta.get("age_floor", "?"),
                "active": active[word],
                "reserved": reserved[word],
                "reasons": reasons,
            })

    rows.sort(key=lambda row: (
        0 if row["word"] in USER_MUST_REVIEW else 1,
        -row["score"],
        row["tier"],
        row["word"],
    ))
    chosen = rows[: max(4, args.limit)]

    lines = [
        "# Proplet v3.34 — kandidáti k lexikálnímu review",
        "",
        "> **REVIEW ONLY.** Tento dokument nic automaticky nemaže ani nepřesouvá. Cílový lexikon a recognition lexikon zůstávají oddělené.",
        "",
        "## Výslovné kandidáty od product ownera",
        "",
    ]
    for word in sorted(USER_MUST_REVIEW):
        row = next((item for item in rows if item["word"] == word), None)
        if row:
            lines.append(f"- **{word.upper()}** — Tier {row['tier']}, aktivně {row['active']}×, v rezervě {row['reserved']}×")
        else:
            lines.append(f"- **{word.upper()}** — v aktuálním target lexikonu nenalezeno")

    lines += [
        "",
        "## Shortlist pro společný průchod",
        "",
        "| Slovo | Tier | Fam. | Comp. | Fun | Registr | Věk | Aktivní | Rezerva | Proč je na stole |",
        "|---|:---:|---:|---:|---:|---|---:|---:|---:|---|",
    ]
    for row in chosen:
        reason = "; ".join(row["reasons"][:4]) or "kombinace metadat"
        lines.append(
            f"| **{row['word'].upper()}** | {row['tier']} | {row['familiarity']} | {row['complexity']} | {row['fun']} | "
            f"{row['register']} | {row['age']} | {row['active']} | {row['reserved']} | {reason} |"
        )

    lines += [
        "",
        "## Jak s tím pracovat",
        "",
        "Pro každý výraz společně rozhodnout **ponechat / přesunout tier / vyřadit z target generation**. Vyřazení z target generation neznamená vyřazení z recognition lexikonu. Aktivní či historické puzzle se tím zpětně nemažou; změna se projeví až v nové Generation 4.",
        "",
        f"Celkem zobrazeno: **{len(chosen)}** kandidátů. Candidate scoring je pouze třídicí pomůcka, nikoli automatické rozhodnutí.",
        "",
    ]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {len(chosen)} review candidates to {args.output}")
    print("User must-review:")
    for word in sorted(USER_MUST_REVIEW):
        row = next((item for item in rows if item["word"] == word), None)
        print(f"  {word}: tier={row['tier'] if row else '?'} active={row['active'] if row else 0} reserved={row['reserved'] if row else 0}")


if __name__ == "__main__":
    main()
