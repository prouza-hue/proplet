"""Archive preview must retain the entire pinned production snapshot.
Only these reviewed integration seams may change. All other existing tracked
files (including referrals, Extra, result UI, API, migrations and banks) match.
"""
import json,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE="f31c8959323b8edae75e01ccd6b04ded168cf982"
ALLOWED={
 "public/app.js":"add guarded archive lifecycle/reward hooks",
 "public/bootstrap-hydrator.js":"include the archive custom route",
 "public/home-layout.js":"delegate preview placement without losing native nodes",
 "public/index.html":"load isolated archive assets",
 "public/printshop-release-polish.js":"one Tajenka placement owner",
 "public/sw.js":"match preview asset references",
 "public/tajenka-card-polish.js":"keep the completed Tajenka title in preview",
 "public/tajenka-release-fix.js":"bind native clone handlers before removing IDs",
 "public/valid-word-feedback-v3330.js":"approved historical solution adapter",
 "vercel.json":"explicitly isolate this preview build",
}
def git(*args):return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()
head=git("rev-parse","HEAD")
subprocess.run(["git","merge-base","--is-ancestor",BASE,head],cwd=ROOT,check=True)
before={line.split("\t",1)[1]:line.split()[2] for line in git("ls-tree","-r",BASE).splitlines()}
after={line.split("\t",1)[1]:line.split()[2] for line in git("ls-tree","-r",head).splitlines()}
unexpected=[path for path,sha in before.items() if path not in ALLOWED and after.get(path)!=sha]
assert not unexpected,("Production files changed outside reviewed integration seams",unexpected)
assert not any(path.startswith("public/app/archive/season") for path in after),"Monthly assets belong to a separate release"
index=(ROOT/"public/index.html").read_text()
assert "season-view" not in index,"Monthly bundle must not load"
result={"baseSha":BASE,"headSha":head,"result":"PASS","unchangedExistingFiles":sum(after.get(p)==sha for p,sha in before.items()),"reviewedIntegrationSeams":{p:reason for p,reason in ALLOWED.items() if after.get(p)!=before.get(p)}}
out=ROOT/"public/review-evidence";out.mkdir(exist_ok=True)
(out/"production-parity.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(result,ensure_ascii=False))
