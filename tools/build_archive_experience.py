"""Build immutable Archive data and select an isolated preview or clean production shell."""
import gzip, hashlib, json, os, pathlib, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(ROOT))
from backend.archive import load_edition
edition = load_edition(str(ROOT))
out = edition["boards"]
target=ROOT/"public/app/archive/boards.json"
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps({"editionId":edition["editionId"],"boards":out,"editorialApproval":"2026-10-08","completeCovers":sum(len(x["solutions"]["solutionSets"]) for x in out)},ensure_ascii=False,separators=(",",":")))
print("Archive preview built:",len(out),"boards,",sum(len(x["solutions"]["solutionSets"]) for x in out),"complete approved covers")

# The reviewed preview and a production build share gameplay, never fake identity
# or API interception. Server-side gates remain off until the approved release.
if os.environ.get("VERCEL_ENV") == "production":
    index = ROOT / "public/index.html"
    html = index.read_text().replace(" data-archive-preview", "")
    html = re.sub(r'\s*<script src="/app/archive/preview-isolation\.js(?:\?[^"]*)?"></script>', '', html)
    index.write_text(html)
    sw = ROOT / "public/sw.js"
    sw.write_text(re.sub(r"'/app/archive/preview-isolation\.js(?:\?[^']*)?',?", '', sw.read_text()))
    (ROOT / "public/app/archive/preview-isolation.js").unlink(missing_ok=True)
    assert "data-archive-preview" not in html and "preview-isolation" not in html
    assert "preview-isolation" not in sw.read_text()
    print("Production shell: no fixture identity, API adapter or review controls")
