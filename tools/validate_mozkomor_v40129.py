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
    for p in bank:
        meta=p.get("meta") or {}
        assert meta.get("generationProfile")=="mozkomor-core"
        assert meta.get("verifiedUnique") is True
        assert meta.get("wideVerifiedUnique") is True
        assert 72<=len(p.get("mask") or [])<=80
        assert 10<=len(p.get("answers") or [])<=11
        assert 18.0<=float(meta.get("localAmbiguityScore") or 0)<=60.0
        assert 3.8<=float(meta.get("meanTurns") or 0)<=5.3
        for a in p.get("answers") or []:
            word=str(a.get("word") or "").casefold()
            assert word in tier_of, f"Target missing from reviewed tiers: {word}"
            tier_counts[tier_of[word]]+=1
            lengths.append(len(word))
            answer_turns.append(int(a.get("turns") or 0))
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
        "wordLength":{"min":min(lengths),"median":median(lengths),"max":max(lengths)},
        "ambiguity":{"min":min(mz_amb),"median":median(mz_amb),"p90":pct(mz_amb,.9),"max":max(mz_amb)},
        "meanTurns":{"min":min(mz_turns),"median":median(mz_turns),"p90":pct(mz_turns,.9),"max":max(mz_turns)},
        "activeCells":{"min":min(mz_cells),"median":median(mz_cells),"max":max(mz_cells)},
        "comparisonToMozkozrout":{
            "mozkozroutAmbiguityMedian":median(hc_amb),
            "mozkomorAmbiguityMedian":median(mz_amb),
            "mozkozroutMeanTurnsMedian":median(hc_turns),
            "mozkomorMeanTurnsMedian":median(mz_turns),
            "mozkozroutActiveCellsMedian":median(hc_cells),
            "mozkomorActiveCellsMedian":median(mz_cells),
        },
    }
    AUDIT.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(audit,ensure_ascii=False,indent=2))


if __name__=="__main__":
    main()
