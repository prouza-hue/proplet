#!/usr/bin/env python3
"""Generate one deliberately brutal Mozkomor calibration board.

This is NOT a production generator. It preserves Generation 4 invariants and the
reviewed vocabulary, but deliberately pushes geometry and local ambiguity beyond
both production Mozkozrout and the current v4.01.29 Mozkomor bank.

Ten playtest levels are generated independently from deterministic, disjoint
SHA-256 vocabulary partitions so target words cannot repeat across the set.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import random
from statistics import mean
import sys
import time

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
import generate_gen4_candidates as g4

PUZZLES_PATH=ROOT/"data"/"puzzles.json"
PROFILE_NAME="mozkomor-masochist-playtest"

POLICY={
    "allowed":("B","C","D"),
    "weights":{"B":1,"C":5,"D":4},
    "min_fraction":{"C":0.50,"D":0.20},
    "max_fraction":{"B":0.15,"C":0.70,"D":0.40},
    "min_avg_fun":3.0,
    "min_fun_words":2,
}

PROFILE={
    "rows":10,
    "cols":10,
    "cells":(80,86),
    "words":(10,11),
    "min_len":6,
    "max_len":11,
    "turn_bias":2.45,
    "min_bbox_rows":10,
    "min_bbox_cols":10,
    "min_curvy_share":0.90,
    "max_mean_straight_share":0.42,
    "geometry_profile":"gen4-mozkomor-masochist-playtest-10x10",
    "policy":POLICY,
    "max_curl_paths":10,
    "max_curl_run":7,
    "min_mean_turns":5.20,
    "max_mean_turns":6.80,
    "max_blank_components":8,
    "max_isolated_blanks":1,
    "ambiguity":(30.0,70.0),
}

MIN_CURL_PATHS=9
MIN_AVG_WORD_LENGTH=7.60
MIN_MAX_WORD_LENGTH=9
TARGET_ACCEPTED_PER_LEVEL=2


def brutal_min_turns(length:int,difficulty:str)->int:
    if difficulty=="hardcore":
        if length>=10:
            return 5
        if length>=8:
            return 4
        if length>=6:
            return 3
        return 2
    return g4.min_turns(length,difficulty)


def target_bucket(word:str,count:int)->int:
    digest=hashlib.sha256(word.casefold().encode("utf-8")).digest()
    return int.from_bytes(digest[:4],"big")%count


def brutality_score(p:dict)->float:
    meta=p["meta"]
    lengths=[len(str(a.get("word") or "")) for a in p["answers"]]
    return round(
        float(meta["localAmbiguityScore"])*1.65
        +float(meta["meanTurns"])*15.0
        +len(p["mask"])*0.55
        +mean(lengths)*3.0
        +float(meta.get("curlPathCount") or 0)*2.0
        +float(meta.get("maxCurlRun") or 0)*2.5,
        3,
    )


def main()->None:
    ap=argparse.ArgumentParser()
    ap.add_argument("--level",type=int,required=True)
    ap.add_argument("--seed",type=int,required=True)
    ap.add_argument("--partition-index",type=int,required=True)
    ap.add_argument("--partition-count",type=int,default=10)
    ap.add_argument("--output",type=Path,required=True)
    ap.add_argument("--max-shape-retries",type=int,default=1400)
    args=ap.parse_args()
    if not 1<=args.level<=10:
        raise SystemExit("Playtest level must be 1..10")
    if not 0<=args.partition_index<args.partition_count:
        raise SystemExit("Invalid vocabulary partition")

    gp=g4.v3.cal.load_generator()
    tiers,tier_of=gp.load_answer_tiers()
    metadata=gp.load_answer_metadata()
    fun_of={word:int(meta.get("fun",3)) for word,meta in metadata.items()}
    frequency=gp.load_frequency_words()
    all_answers=[word for tier in ("A","B","C","D") for word in tiers[tier]]
    dictionary=[word for word,_ in frequency if word not in gp.FUNCTION_WORDS]
    dictionary=list(dict.fromkeys(
        dictionary[:g4.v3.cal.WIDE_DICTIONARY_SIZE]
        +all_answers
        +sorted(gp.EDITORIAL_VALIDATOR_WORDS)
    ))
    prefixes=g4.prefix_index(set(dictionary))
    weighted=g4.v3.cal.weighted_pool(tiers,metadata,POLICY)

    existing=json.loads(PUZZLES_PATH.read_text(encoding="utf-8"))
    current_mozkomor_words={
        str(a.get("word") or "").casefold()
        for p in (existing.get("free") or {}).get("mozkomor") or []
        for a in p.get("answers") or []
    }
    hardcore_tail_words={
        str(a.get("word") or "").casefold()
        for p in list((existing.get("free") or {}).get("hardcore") or [])[-12:]
        for a in p.get("answers") or []
    }
    avoid_words=current_mozkomor_words|hardcore_tail_words
    pool=[w for w in weighted if target_bucket(w,args.partition_count)==args.partition_index]
    unique_pool=set(pool)
    if len(unique_pool)<170:
        raise SystemExit(f"Vocabulary partition too small: {len(unique_pool)} unique targets")

    g4.PROFILES[PROFILE_NAME]=deepcopy(PROFILE)
    g4.PREFIXES["mozkomor"]="z"
    g4.v3.PROFILES[PROFILE_NAME]=deepcopy(PROFILE)
    g4.v3.cal.PROFILES["hardcore"]=deepcopy(PROFILE)
    g4.v3.cal.min_turns_for=brutal_min_turns

    rng=random.Random(args.seed)
    accepted=[]
    reject=Counter()
    ambiguity_seen=[]
    started=time.time()

    for shape_retry in range(1,args.max_shape_retries+1):
        try:
            candidate=g4.v3.cal.build_puzzle(
                gp,"hardcore",args.level,rng,pool,dictionary,tier_of,fun_of,avoid_words
            )
        except RuntimeError:
            reject["build"]+=1
            continue

        candidate["difficulty"]="mozkomor"
        g4.annotate(candidate,"free","mozkomor",args.level,PROFILE_NAME,prefixes)
        candidate["id"]=f"g4-mt-{args.level:03d}"
        meta=candidate["meta"]
        ambiguity=float(meta.get("localAmbiguityScore") or 0)
        ambiguity_seen.append(ambiguity)
        turns=float(meta.get("meanTurns") or 0)
        lengths=[len(str(a.get("word") or "")) for a in candidate["answers"]]
        curl_paths=int(meta.get("curlPathCount") or 0)
        max_curl=int(meta.get("maxCurlRun") or 0)

        if int(meta.get("cutoutComponents") or 0)>PROFILE["max_blank_components"]:
            reject["cutout-components"]+=1;continue
        if int(meta.get("isolatedCutoutCells") or 0)>PROFILE["max_isolated_blanks"]:
            reject["isolated-cutouts"]+=1;continue
        if not PROFILE["ambiguity"][0]<=ambiguity<=PROFILE["ambiguity"][1]:
            reject["ambiguity"]+=1;continue
        if not PROFILE["min_mean_turns"]<=turns<=PROFILE["max_mean_turns"]:
            reject["turns"]+=1;continue
        if curl_paths<MIN_CURL_PATHS:
            reject["curl-paths"]+=1;continue
        if min(lengths)<PROFILE["min_len"] or max(lengths)>PROFILE["max_len"]:
            reject["length-range"]+=1;continue
        if mean(lengths)<MIN_AVG_WORD_LENGTH:
            reject["avg-word-length"]+=1;continue
        if max(lengths)<MIN_MAX_WORD_LENGTH:
            reject["no-long-anchor"]+=1;continue
        board_tiers=Counter(
            tier_of.get(str(a.get("word") or "").casefold())
            for a in candidate["answers"]
        )
        if any(t not in {"B","C","D"} for t in board_tiers):
            reject["tier-outside-bcd"]+=1;continue
        if board_tiers["D"]<2 or board_tiers["D"]>4:
            reject["tier-d-share"]+=1;continue
        if board_tiers["B"]>2:
            reject["tier-b-relief"]+=1;continue
        if board_tiers["C"]<5:
            reject["tier-c-core"]+=1;continue

        meta.update({
            "calibrationOnly":True,
            "masochistPlaytest":True,
            "playtestProfile":PROFILE_NAME,
            "playtestSeed":args.seed,
            "playtestPartition":{"index":args.partition_index,"count":args.partition_count},
            "shapeRetry":shape_retry,
            "brutalityScore":brutality_score(candidate),
            "vocabTiers":dict(board_tiers),
        })
        accepted.append(candidate)
        print(
            f"accepted level={args.level} #{len(accepted)} retry={shape_retry} "
            f"cells={len(candidate['mask'])} turns={turns:.3f} "
            f"amb={ambiguity:.3f} curls={curl_paths} maxCurl={max_curl} "
            f"avgLen={mean(lengths):.2f} score={meta['brutalityScore']}",
            flush=True,
        )
        if len(accepted)>=TARGET_ACCEPTED_PER_LEVEL:
            break

    if not accepted:
        seen=(
            f"{min(ambiguity_seen):.3f}..{max(ambiguity_seen):.3f}"
            if ambiguity_seen else "none"
        )
        raise RuntimeError(
            f"No masochist candidate for level {args.level}; "
            f"rejects={dict(reject)} ambiguitySeen={seen}"
        )

    accepted.sort(key=brutality_score,reverse=True)
    best=accepted[0]
    payload={
        "version":1,
        "kind":"mozkomor-masochist-playtest-level",
        "level":args.level,
        "seed":args.seed,
        "partition":{"index":args.partition_index,"count":args.partition_count},
        "profile":{k:v for k,v in PROFILE.items() if k!="policy"}|{"vocabularyPolicy":POLICY},
        "puzzle":best,
        "alternatesConsidered":len(accepted),
        "rejections":dict(reject),
        "seconds":round(time.time()-started,2),
    }
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({
        "level":args.level,
        "id":best["id"],
        "score":best["meta"]["brutalityScore"],
        "ambiguity":best["meta"]["localAmbiguityScore"],
        "meanTurns":best["meta"]["meanTurns"],
        "activeCells":len(best["mask"]),
        "curlPathCount":best["meta"].get("curlPathCount"),
        "maxCurlRun":best["meta"].get("maxCurlRun"),
        "words":[a["word"] for a in best["answers"]],
    },ensure_ascii=False,indent=2))


if __name__=="__main__":
    main()
