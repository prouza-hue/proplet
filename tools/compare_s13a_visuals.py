#!/usr/bin/env python3
"""Pixel + geometry comparator for the Sprint 13A behavior-preserving CSS slice."""

from __future__ import annotations
import argparse
import json
from pathlib import Path
from PIL import Image


RECT_KEYS=("gameMain","boardStage","control","currentWord","gameAction","winCard","winUtility")
SCALAR_KEYS=("theme","layoutMode","gameMainColumns","currentWordFont","cellFont","winTitleFont")


def pixel_diff(a_path: Path,b_path: Path):
    a=Image.open(a_path).convert("RGB")
    b=Image.open(b_path).convert("RGB")
    if a.size!=b.size:
        return 1.0,255,a.size,b.size
    changed=0; max_delta=0; total=a.width*a.height
    for pa,pb in zip(a.getdata(),b.getdata()):
        d0=abs(pa[0]-pb[0]);d1=abs(pa[1]-pb[1]);d2=abs(pa[2]-pb[2])
        if d0 or d1 or d2:
            changed+=1
            max_delta=max(max_delta,d0,d1,d2)
    return changed/total,max_delta,a.size,b.size


def rect_delta(a,b):
    if a is None or b is None:
        return 0.0 if a is b else float("inf")
    return max(abs(float(a[k])-float(b[k])) for k in ("x","y","width","height"))


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--baseline",type=Path,required=True)
    p.add_argument("--current",type=Path,required=True)
    p.add_argument("--max-changed-ratio",type=float,required=True)
    p.add_argument("--max-channel-delta",type=int,required=True)
    p.add_argument("--max-geometry-delta",type=float,required=True)
    args=p.parse_args()
    old=json.loads((args.baseline/"summary.json").read_text(encoding="utf-8"))
    new=json.loads((args.current/"summary.json").read_text(encoding="utf-8"))
    failures=[]; report={}
    if set(old["results"])!=set(new["results"]):
        failures.append("case set changed")
    for case_id in sorted(set(old["results"]) & set(new["results"])):
        om=old["results"][case_id]["metrics"]; nm=new["results"][case_id]["metrics"]
        for key in SCALAR_KEYS:
            if om.get(key)!=nm.get(key):
                failures.append(f"{case_id}: {key} {om.get(key)!r} -> {nm.get(key)!r}")
        geometry={}
        for key in RECT_KEYS:
            delta=rect_delta(om.get(key),nm.get(key)); geometry[key]=delta
            if delta>args.max_geometry_delta:
                failures.append(f"{case_id}: {key} geometry delta {delta:.3f}px")
        ratio,max_delta,old_size,new_size=pixel_diff(args.baseline/f"{case_id}.png",args.current/f"{case_id}.png")
        if ratio>args.max_changed_ratio:
            failures.append(f"{case_id}: changed pixel ratio {ratio:.8f} > {args.max_changed_ratio:.8f}")
        if max_delta>args.max_channel_delta:
            failures.append(f"{case_id}: max channel delta {max_delta} > {args.max_channel_delta}")
        report[case_id]={"changed_pixel_ratio":ratio,"max_channel_delta":max_delta,"geometry":geometry,"size":[old_size,new_size]}
    (args.current/"comparison.json").write_text(json.dumps({"limits":{"max_changed_ratio":args.max_changed_ratio,"max_channel_delta":args.max_channel_delta,"max_geometry_delta":args.max_geometry_delta},"report":report,"failures":failures},indent=2)+"\n",encoding="utf-8")
    if failures:
        print("\n".join("VISUAL BLOCKER "+x for x in failures))
        return 1
    worst=max((v["changed_pixel_ratio"] for v in report.values()),default=0)
    print(f"PASS S13A visual parity: worst changed ratio={worst:.8f}, cases={len(report)}")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
