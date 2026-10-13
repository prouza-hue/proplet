"""Archive preview must retain the entire pinned production snapshot.
Only these reviewed integration seams may change. All other existing tracked
files (outside the explicitly reviewed archive/announcement/illustration seams) match.
"""
import json,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE="f31c8959323b8edae75e01ccd6b04ded168cf982"
ALLOWED={
 "public/theme-init.js":"invalidate lazy-loaded Archive production layout hooks in existing clients",
 "tests/current/test_s12a_account_session.js":"pin initializer/home cache revisions; preserve account flow assertions",
 ".github/workflows/archive-integrated-review.yml":"verify actual production-form HTML with archive enabled and disabled",
 "tools/test_v4001_pwa_startup.py":"pin Archive shell release while preserving app/SW marker equality and startup checks",
 "tools/test_v40124_supabase_rpc_auth.py":"pin current Archive shell; retain RPC credential and retry assertions",
 "tools/test_v40126_push_retention_p0.py":"pin current Archive shell; retain push retention and update behavior assertions",
 "tools/test_v40133_sync_quarantine.py":"pin current Archive shell; retain account-scoped quarantine assertions",
 "tools/test_v40135_profile_wide_layout.py":"pin current Archive shell; retain profile layout and existing theme asset revision",
 "tests/current/test_mk100_production.py":"script cache key independent release boundary",
 "tests/current/test_refresh300_production.py":"current release shell cache revision",
 "tests/current/test_mozkokalypsa_achievements.js":"new image-format integrity without changing reward predicates",
 'backend/config.py':'default-off archive capability',
 'backend/contracts.py':'optional bounded archive completion evidence',
 'backend/results.py':'validate archive admission before result mutation',
 'server.py':'read-only archive APIs and full-cover authority',
 'public/app/archive/experience.js':'production authority and isolated preview integration',
 'public/app/archive/experience.css':'production tokens and ordinary resume label',
 'public/app/archive/preview-isolation.js':'local API fixture for archive authority and claims',
 'public/app/content/daily-special-ui.js':'unified deferred announcement queue',
 'public/app/content/refresh-release.js':'retire old300; introduce combined Archive+Extra',
 'public/app/content/refresh-ui.js':'remove obsolete new-board counters',
 'public/app/mozkokalypsa-launch.js':'defer old announcement through shared queue',
 'public/referrals.js':'shared queue with async-avatar eligibility recheck',
 'public/rewards/printshop/manifest.json':'seven reviewed illustration assets',
 'public/ribbon-ui.js':'render the seven new WebP illustrations',
 'supabase/prepared/historical_free_rewards.sql':'read-only service-role claim-state RPC',
 'supabase/migrations/manifest.json':'prepared SQL checksum; not marked applied',
 'tests/current/manifest.json':'register archive and CTA behavior checks',
 'tests/current/test_s04_backend_foundation.py':'characterize additive archive contracts',
 'tests/current/test_s06_backend_dependencies.py':'add default-off archive config field',
 'tests/current/test_mk100_launch.js':'shared announcement behavior',
 'tests/current/test_refresh_release.cjs':'combined release behavior and retirement',
 'tests/current/test_refresh_ui_performance.cjs':'counter removal preserves history caching',
 'tools/generate_mozkokalypsa_achievements.py':'retire old flat vector draft generator',
 'tools/test_historical_free_rewards_db.py':'exercise service-only authoritative state RPC',

 "public/app.js":"add guarded archive lifecycle/reward hooks and match the Archive service-worker release marker",
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
