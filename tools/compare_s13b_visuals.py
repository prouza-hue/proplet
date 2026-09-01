#!/usr/bin/env python3
import argparse,json
from pathlib import Path
from PIL import Image
RECT=("appShell","active","screenTitle","primary","modal","firstRow")
SCALAR=("theme","themePreference")
def pd(a,b):
 a=Image.open(a).convert("RGB");b=Image.open(b).convert("RGB")
 if a.size!=b.size:return 1,255
 n=a.width*a.height;c=0;m=0
 for x,y in zip(a.getdata(),b.getdata()):
  d=max(abs(x[i]-y[i]) for i in range(3))
  if d:c+=1;m=max(m,d)
 return c/n,m
def rd(a,b):
 if a is None or b is None:return 0 if a is b else 999
 return max(abs(float(a[k])-float(b[k])) for k in ("x","y","width","height"))
def main():
 p=argparse.ArgumentParser();p.add_argument("--baseline",type=Path,required=True);p.add_argument("--current",type=Path,required=True);p.add_argument("--max-changed-ratio",type=float,default=.0007);p.add_argument("--max-channel-delta",type=int,default=3);p.add_argument("--max-geometry-delta",type=float,default=.25);a=p.parse_args()
 old=json.loads((a.baseline/"summary.json").read_text());new=json.loads((a.current/"summary.json").read_text());fails=[];report={}
 for cid in sorted(old["results"]):
  om=old["results"][cid]["metrics"];nm=new["results"][cid]["metrics"]
  for k in SCALAR:
   if om.get(k)!=nm.get(k):fails.append(f"{cid}: {k} changed")
  geo={}
  for k in RECT:
   d=rd(om.get(k),nm.get(k));geo[k]=d
   if d>a.max_geometry_delta:fails.append(f"{cid}: {k} geometry {d:.3f}px")
  ratio,delta=pd(a.baseline/f"{cid}.png",a.current/f"{cid}.png")
  if ratio>a.max_changed_ratio:fails.append(f"{cid}: pixels {ratio:.8f}>{a.max_changed_ratio:.8f}")
  if delta>a.max_channel_delta:fails.append(f"{cid}: channel {delta}>{a.max_channel_delta}")
  report[cid]={"ratio":ratio,"delta":delta,"geometry":geo}
 (a.current/"comparison.json").write_text(json.dumps({"report":report,"failures":fails},indent=2)+"\n")
 if fails:print("\n".join("VISUAL BLOCKER "+x for x in fails));return 1
 print("PASS S13B visual parity",max(v["ratio"] for v in report.values()),len(report));return 0
if __name__=="__main__":raise SystemExit(main())
