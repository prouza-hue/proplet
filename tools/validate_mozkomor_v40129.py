#!/usr/bin/env python3
"""Validate the committed v4.01.29 Mozkomor bank as a Gen4 endgame extension."""
# The committed bank is the release source; generation is intentionally not repeated in CI.
from __future__ import annotations

from collections import Counter, deque
import json
from pathlib import Path
from statistics import median
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
from validate_gen4_release import canonical_hash

PUZZLES=ROOT/"data"/"puzzles.json"
TIERS=ROOT/"data"/"answer_tiers.json"
AUDIT=ROOT/"data"/"audits"/"mozkomor_v40129.json"


def pct(values:list[float],p:float)->float:
    values=sorted(values)
    return float(values[round((len(values)-1)*p)])


def main()->None:
    data=json.loads(PUZZLES.read_text(encoding="utf-8"))
    bank=list((data.get("free") or {}).get("mozkomor") or [])
    hardcore=list((data.get("free") or {}).get("hardcore") or [])
    assert len(hardcore)==200, f"Expected 200 base Mozkozrout boards, got {len(hardcore)}"
    assert len(bank)==100, f"Expected 100 Mozkomor boards, got {len(bank)}"
    assert [int((p.get("meta") or {}).get("level") or 0) for p in bank]==list(range(1,101))
    assert [p.get("id") for p in bank]==[f"g4-z-{i:03d}" for i in range(1,101)]
    assert all(p.get("difficulty")=="mozkomor" for p in bank)

    profiles=json.loads((ROOT/"data"/"gen4_profiles_v334.json").read_text(encoding="utf-8"))
    policy=profiles.get("mozkomorPolicy") or {}
    assert policy.get("unlock",{}).get("requiresDifficulty")=="hardcore"
    assert int(policy.get("unlock",{}).get("requiresCurrentBaseLevels") or 0)==200
    assert int(policy.get("requiredLevels") or 0)==100
    assert int(policy.get("targetCooldown") or 0)==12

    unlock=data.get("mozkomorUnlock") or {}
    assert unlock.get("requiresDifficulty")=="hardcore"
    assert int(unlock.get("requiresCurrentBaseLevels") or 0)==200

    # Keep Mozkomor metadata out of the historical four-tier Gen4 contract.
    assert "mozkomor" not in ((profiles.get("requiredActiveBanks") or {}).get("free") or {})
    legacy_cooldown=((data.get("targetCooldownPolicy") or {}).get("free") or {})
    assert "mozkomor" not in legacy_cooldown

    ids=[str(p.get("id") or "") for p in bank]
    hashes=[canonical_hash(p) for p in bank]
    assert len(set(ids))==100
    assert len(set(hashes))==100
    other=[
        p for diff,values in (data.get("free") or {}).items() if diff!="mozkomor"
        for p in values or []
    ]+list(data.get("daily") or [])+list(data.get("rescue") or [])
    assert not (set(hashes)&{canonical_hash(p) for p in other})

    # Target cooldown crosses the Mozkozrout -> Mozkomor boundary.
    history=deque(maxlen=12)
    for p in hardcore[-12:]:
        history.append({str(a.get("word") or "").casefold() for a in p.get("answers") or []})
    for level,p in enumerate(bank,1):
        words={str(a.get("word") or "").casefold() for a in p.get("answers") or []}
        blocked=set().union(*history) if history else set()
        overlap=words&blocked
        assert not overlap, f"Target cooldown violation at Mozkomor {level}: {sorted(overlap)}"
        history.append(words)

    tiers=json.loads(TIERS.read_text(encoding="utf-8")).get("tiers") or {}
    tier_of={str(word).casefold():tier for tier,words in tiers.items() for word in words}
    tier_counts=Counter()
    lengths=[]
    answer_turns=[]
    candidate_rows=[]
    for p in bank:
        meta=p.get("meta") or {}
        assert meta.get("generationProfile")=="mozkomor-core"
        assert meta.get("verifiedUnique") is True
        assert meta.get("wideVerifiedUnique") is True
        assert 72<=len(p.get("mask") or [])<=80
        assert 10<=len(p.get("answers") or [])<=11
        assert 18.0<=float(meta.get("localAmbiguityScore") or 0)<=60.0
        assert 3.8<=float(meta.get("meanTurns") or 0)<=5.3
        puzzle_words=[]
        puzzle_tiers=[]
        puzzle_turns=[]
        for a in p.get("answers") or []:
            word=str(a.get("word") or "").casefold()
            assert word in tier_of, f"Target missing from reviewed tiers: {word}"
            tier=tier_of[word]
            tier_counts[tier]+=1
            lengths.append(len(word))
            answer_turns.append(int(a.get("turns") or 0))
            puzzle_words.append(word)
            puzzle_tiers.append(tier)
            puzzle_turns.append(int(a.get("turns") or 0))
        min_len=min(map(len,puzzle_words))
        avg_len=sum(map(len,puzzle_words))/len(puzzle_words)
        ambiguity=float(meta.get("localAmbiguityScore") or 0)
        mean_turns=float(meta.get("meanTurns") or 0)
        cells=len(p.get("mask") or [])
        curl_paths=int(meta.get("curlPathCount") or 0)
        max_curl=int(meta.get("maxCurlRun") or 0)
        short_anchors=sum(1 for w in puzzle_words if len(w)<=5)
        brutality=(
            ambiguity*1.25
            + mean_turns*8.0
            + cells*0.35
            + avg_len*2.2
            + curl_paths*1.1
            + max_curl*1.8
            - short_anchors*4.5
        )
        candidate_rows.append({
            "id":p["id"],
            "level":int(meta["level"]),
            "score":round(brutality,3),
            "ambiguity":round(ambiguity,3),
            "meanTurns":round(mean_turns,3),
            "activeCells":cells,
            "minWordLength":min_len,
            "avgWordLength":round(avg_len,3),
            "curlPathCount":curl_paths,
            "maxCurlRun":max_curl,
            "tierDTargets":puzzle_tiers.count("D"),
            "words":puzzle_words,
        })
    assert min(lengths)>=5
    assert max(lengths)<=11
    total=sum(tier_counts.values())
    d_share=tier_counts.get("D",0)/total
    assert d_share<=0.18

    # Endgame must be meaningfully harder than the real 200-board Mozkozrout bank.
    mz_amb=[float(p["meta"]["localAmbiguityScore"]) for p in bank]
    hc_amb=[float(p["meta"]["localAmbiguityScore"]) for p in hardcore]
    mz_turns=[float(p["meta"]["meanTurns"]) for p in bank]
    hc_turns=[float(p["meta"]["meanTurns"]) for p in hardcore]
    mz_cells=[len(p.get("mask") or []) for p in bank]
    hc_cells=[len(p.get("mask") or []) for p in hardcore]
    assert median(mz_amb)>median(hc_amb)
    assert median(mz_turns)>median(hc_turns)
    assert median(mz_cells)>median(hc_cells)

    # Hardcore playtest: first try the genuinely hardest, clean-vocabulary tail
    # of the committed bank before deciding to throw away/regenerate all 100 boards.
    clean=[r for r in candidate_rows if r["tierDTargets"]==0 and r["minWordLength"]>=6]
    if len(clean)<10:
        clean=[r for r in candidate_rows if r["tierDTargets"]==0]
    brutal10=sorted(clean,key=lambda r:(r["score"],r["ambiguity"],r["meanTurns"]),reverse=True)[:10]
    assert len(brutal10)==10
    brutal_amb=[r["ambiguity"] for r in brutal10]
    brutal_turns=[r["meanTurns"] for r in brutal10]
    brutal_cells=[r["activeCells"] for r in brutal10]
    assert all(r["tierDTargets"]==0 for r in brutal10)

    audit={
        "version":2,
        "kind":"mozkomor-v40129-committed-bank-audit",
        "count":100,
        "unlock":{"difficulty":"hardcore","baseLevels":200},
        "targetCooldown":12,
        "duplicateBoardHashesVsActiveGen4":0,
        "transitionCooldownViolations":0,
        "tierCounts":dict(sorted(tier_counts.items())),
        "tierDShare":round(d_share,4),
        "wordLength":{"min":min(lengths),"median":round(median(lengths),3),"max":max(lengths)},
        "ambiguity":{"min":min(mz_amb),"median":round(median(mz_amb),3),"p90":pct(mz_amb,.9),"max":max(mz_amb)},
        "meanTurns":{"min":min(mz_turns),"median":round(median(mz_turns),3),"p90":pct(mz_turns,.9),"max":max(mz_turns)},
        "activeCells":{"min":min(mz_cells),"median":round(median(mz_cells),3),"max":max(mz_cells)},
        "brutal10Playtest":{
            "selectionRule":"top composite brutality; zero Tier D; prefer min target length >= 6",
            "count":10,
            "ambiguityMedian":round(median(brutal_amb),3),
            "meanTurnsMedian":round(median(brutal_turns),3),
            "activeCellsMedian":round(median(brutal_cells),3),
            "levels":brutal10,
        },
        "comparisonToMozkozrout":{
            "mozkozroutAmbiguityMedian":round(median(hc_amb),3),
            "mozkomorAmbiguityMedian":round(median(mz_amb),3),
            "mozkozroutMeanTurnsMedian":round(median(hc_turns),3),
            "mozkomorMeanTurnsMedian":round(median(mz_turns),3),
            "mozkozroutActiveCellsMedian":round(median(hc_cells),3),
            "mozkomorActiveCellsMedian":round(median(mz_cells),3),
        },
    }
    AUDIT.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(audit,ensure_ascii=False,indent=2))


if __name__=="__main__":
    main()
