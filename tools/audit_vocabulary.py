#!/usr/bin/env python3
"""Audit current Proplet puzzle answers against the curated A–D vocabulary policy.

This script is read-only. It never rewrites puzzles. It produces machine-readable JSON and a
human-readable Markdown report so content changes can be planned without touching played levels.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
import argparse
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import generate_puzzles as gp  # noqa: E402


def bank_rows(data: dict):
    for difficulty, bank in data.get("free", {}).items():
        for p in bank:
            yield "free", difficulty, p
    for p in data.get("daily", []):
        yield "daily", "daily", p
    for p in data.get("rescue", []):
        yield "rescue", "rescue", p


def puzzle_level(p: dict) -> int | None:
    value = (p.get("meta") or {}).get("level")
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def audit_puzzle(mode: str, difficulty: str, p: dict, tier_of: dict[str, str]) -> dict:
    policy_key = difficulty if mode == "free" else mode
    policy = gp.VOCAB_POLICIES[policy_key]
    words = [str(a.get("word") or "").lower() for a in (p.get("answers") or [])]
    tiers = [tier_of.get(w, "OOV") for w in words]
    counts = Counter(tiers)
    allowed = set(policy.get("allowed") or ())
    violations = []
    oov = [w for w in words if w not in tier_of]
    disallowed = [w for w in words if tier_of.get(w) not in allowed]
    if oov:
        violations.append("OOV")
    if disallowed:
        violations.append("tier")
    n = max(1, len(words))
    for tier, frac in (policy.get("min_fraction") or {}).items():
        if counts[tier] + 1e-9 < n * float(frac):
            violations.append(f"min_{tier}")
    for tier, frac in (policy.get("max_fraction") or {}).items():
        if counts[tier] - 1e-9 > n * float(frac):
            violations.append(f"max_{tier}")
    return {
        "mode": mode,
        "difficulty": difficulty,
        "puzzleId": p.get("id"),
        "level": puzzle_level(p),
        "words": words,
        "tiers": tiers,
        "tierCounts": dict(counts),
        "oovWords": oov,
        "disallowedWords": disallowed,
        "status": "PASS" if not violations else "FAIL",
        "violations": violations,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--puzzles", type=Path, default=ROOT / "data" / "puzzles.json")
    ap.add_argument("--json-out", type=Path, default=ROOT / "VOCABULARY_AUDIT_V3_11.json")
    ap.add_argument("--md-out", type=Path, default=ROOT / "VOCABULARY_AUDIT_V3_11_CZ.md")
    args = ap.parse_args()

    tiers, tier_of = gp.load_answer_tiers()
    data = json.loads(args.puzzles.read_text(encoding="utf-8"))
    rows = [audit_puzzle(mode, diff, p, tier_of) for mode, diff, p in bank_rows(data)]

    groups = defaultdict(list)
    for row in rows:
        key = row["difficulty"] if row["mode"] == "free" else row["mode"]
        groups[key].append(row)

    summary = {}
    for key, vals in groups.items():
        word_count = sum(len(v["words"]) for v in vals)
        oov_count = sum(len(v["oovWords"]) for v in vals)
        tc = Counter(t for v in vals for t in v["tiers"])
        summary[key] = {
            "puzzles": len(vals),
            "pass": sum(v["status"] == "PASS" for v in vals),
            "fail": sum(v["status"] == "FAIL" for v in vals),
            "answers": word_count,
            "oovAnswers": oov_count,
            "tierCounts": dict(tc),
        }

    out = {
        "tierCounts": {k: len(v) for k, v in tiers.items()},
        "totalTierWords": sum(len(v) for v in tiers.values()),
        "summary": summary,
        "rows": rows,
    }
    args.json_out.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Proplet v3.11 — audit slovní zásoby", "",
        "Tento report **nic nepřepisuje**. Porovnává současných 795 úloh s novým tierovaným slovníkem a pravidly budoucího generátoru.", "",
        "## Nový slovník", "",
        f"- Tier A: **{len(tiers['A'])}** slov — začínající čtenář / okamžitě známá slova",
        f"- Tier B: **{len(tiers['B'])}** slov — širší běžná slovní zásoba",
        f"- Tier C: **{len(tiers['C'])}** slov — starší dítě / běžný dospělý",
        f"- Tier D: **{len(tiers['D'])}** slov — kultivovaná dospělá slovní zásoba",
        f"- Celkem: **{sum(len(v) for v in tiers.values())}** ručně kontrolovaných cílových slov", "",
        "Frekvenční korpus zůstává pouze ve validačním solveru. Nesmí už dodávat cílové odpovědi.", "",
        "## Cílová pravidla", "",
        "| Režim | Slovník | Kompoziční pravidlo |",
        "|---|---|---|",
        "| Rescue | A | pouze A |",
        "| Snadná | A | pouze A |",
        "| Střední | A + B | alespoň 45 % B |",
        "| Těžká | B + C | alespoň 45 % C |",
        "| Mozkožrout | C + D | alespoň 40 % D |",
        "| Denní výzva | A + B + C | alespoň 35 % B, nejvýše 25 % C |",
        "", "## Současná banka vs. nový standard", "",
        "| Banka | Úloh | PASS | K úpravě | Odpovědí mimo nový slovník | Tier mix |",
        "|---|---:|---:|---:|---:|---|",
    ]
    order = ["easy", "medium", "hard", "hardcore", "daily", "rescue"]
    labels = {"easy":"Snadná","medium":"Střední","hard":"Těžká","hardcore":"Mozkožrout","daily":"Denní","rescue":"Rescue"}
    for key in order:
        s = summary[key]
        mix = ", ".join(f"{t}:{s['tierCounts'].get(t,0)}" for t in ("A","B","C","D","OOV") if s['tierCounts'].get(t,0))
        lines.append(f"| {labels[key]} | {s['puzzles']} | {s['pass']} | {s['fail']} | {s['oovAnswers']} | {mix} |")

    lines += ["", "## Odpovědi mimo nový slovník", ""]
    oov_places = defaultdict(list)
    for r in rows:
        for w in r["oovWords"]:
            tag = r["puzzleId"] + (f" / úroveň {r['level']}" if r["level"] else "")
            oov_places[w].append(tag)
    if oov_places:
        for w in sorted(oov_places):
            examples = ", ".join(oov_places[w][:5])
            suffix = f" (+{len(oov_places[w])-5})" if len(oov_places[w]) > 5 else ""
            lines.append(f"- **{w.upper()}** — {examples}{suffix}")
    else:
        lines.append("Žádné.")

    lines += ["", "## Bezpečný postup regenerace", "",
              "1. Z databáze získat množinu puzzle ID, která mají alespoň jeden start nebo dokončení.",
              "2. Tato ID **zmrazit** — jejich desku, slova i identitu už nikdy neměnit.",
              "3. Přegenerovat pouze dosud nedotčené Free úrovně, budoucí Daily a případně Rescue.",
              "4. Každý nový kandidát musí projít: tier policy → jediná lokální cesta každého cílového slova → jediné kompletní exact-cover řešení.",
              "5. Teprve potom vyměnit aktivní puzzle banku.", ""]
    args.md_out.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Wrote {args.md_out} and {args.json_out}")

if __name__ == "__main__":
    main()
