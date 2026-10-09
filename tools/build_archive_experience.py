"""Build the isolated Archive preview from immutable historical boards."""
import gzip, hashlib, json, os, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
if os.environ.get("VERCEL_ENV")=="production":
    raise SystemExit("Archive integration is a preview awaiting Pavel's release approval.")
base=ROOT/"content/archives/free-gen3-v1"
manifest=json.loads((base/"manifest.json").read_text())
raw=(ROOT/manifest["originalBank"]["path"]).read_bytes()
blob=hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest()
assert blob==manifest["originalBank"]["gitBlobSha"],"historical source changed"
bank=json.loads(gzip.decompress(raw))
approved=json.loads((base/"approved-solutions.json").read_text())
out=[]
for row in manifest["boards"]:
    node=bank
    for key in row["sourcePointer"].strip("/").split("/"): node=node[int(key)] if isinstance(node,list) else node[key]
    assert node["id"]==row["puzzleId"]
    out.append({"puzzle":node,"level":row["historicalLevel"],"difficulty":row["difficulty"],"rewardXp":row["rewardXp"],"rewardSlotKey":row["rewardSlotKey"],"solutions":approved["boards"].get(node["id"],{"puzzleId":node["id"],"gameplayScope":"archive","solutionPolicyRevision":approved["solutionPolicyRevision"],"solutionSets":[node["answers"]]})})
for row in out:
    row["solutions"]["solutionSets"].extend(approved.get("additionalApprovedCovers",{}).get(row["puzzle"]["id"],[]))
assert len(out)==800 and all(sum(x["difficulty"]==d for x in out)==200 for d in ["easy","medium","hard","hardcore"])
target=ROOT/"public/app/archive/boards.json"
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps({"editionId":manifest["editionId"],"boards":out,"editorialApproval":"2026-10-08","completeCovers":sum(len(x["solutions"]["solutionSets"]) for x in out)},ensure_ascii=False,separators=(",",":")))
print("Archive preview built:",len(out),"boards,",sum(len(x["solutions"]["solutionSets"]) for x in out),"complete approved covers")
