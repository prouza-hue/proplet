"""Focused real-browser proof: canonical application, read-only published content."""
import functools,http.server,json,pathlib,subprocess,threading,urllib.request,urllib.error,traceback
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"public/review-evidence";OUT.mkdir(exist_ok=True)
report={"testedSha":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),"checks":[],"screenshots":[],"pageErrors":[],"networkWrites":[],"layoutIssues":[]}
published={}
for path in ["/api/daily","/api/tajenka","/api/rolling-content"]:
    try:
        with urllib.request.urlopen("https://hrajproplet.cz"+path,timeout=20) as r:
            published[path]=(r.status,r.read())
    except urllib.error.HTTPError as e: published[path]=(e.code,e.read())
    except Exception as e: published[path]=(503,json.dumps({"error":str(e)}).encode())
report["publishedReads"]={k:{"status":v[0]} for k,v in published.items()}
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        path=self.path.split("?")[0]
        if path in published:
            status,data=published[path];self.send_response(status);self.send_header("Content-Type","application/json");self.end_headers();self.wfile.write(data);return
        super().do_GET()
server=http.server.ThreadingHTTPServer(("127.0.0.1",8765),functools.partial(Handler,directory=str(ROOT/"public")))
threading.Thread(target=server.serve_forever,daemon=True).start()
def shot(page,name):
    page.screenshot(path=str(OUT/(name+".png")),full_page="announcement" not in name);report["screenshots"].append(name+".png")
def overflow(page,view,width):
    issue=page.evaluate("""()=>document.documentElement.scrollWidth>innerWidth+1?[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&e.getBoundingClientRect().width).map(e=>({tag:e.tagName,id:e.id,cls:String(e.className),right:e.getBoundingClientRect().right})).slice(0,15):null""")
    if issue:report["layoutIssues"].append({"view":view,"width":width,"elements":issue})
def go(page,view):
    if view in ["daily","free","leaderboard","profile"]:page.locator('.bottom-nav [data-nav="'+view+'"]').click()
    elif view=="archive":
        go(page,"free");page.locator('#axPlayArchive [data-archive-action="open"]').click();page.wait_for_selector(".ax-board")
    elif view=="season":
        go(page,"daily");page.locator('#axHomeCompetitions [data-archive-action="season"]').click()
    page.wait_for_timeout(180)
def solve_word(page,answer):
    cells=page.locator("#board .cell")
    boxes=[page.locator('#board .cell[data-index="'+str(i)+'"]').bounding_box() for i in answer["path"]]
    assert all(boxes),("cells unavailable",answer["word"])
    page.mouse.move(boxes[0]["x"]+boxes[0]["width"]/2,boxes[0]["y"]+boxes[0]["height"]/2)
    page.mouse.down()
    for b in boxes[1:]:page.mouse.move(b["x"]+b["width"]/2,b["y"]+b["height"]/2,steps=3)
    page.mouse.up();page.wait_for_timeout(90)
try:
    with sync_playwright() as p:
        browser=p.chromium.launch()
        for width in [390,690,1440,320]:
            context=browser.new_context(viewport={"width":width,"height":950},device_scale_factor=1,reduced_motion="reduce")
            page=context.new_page();page.set_default_timeout(12000)
            def capture_error(err):
                report["pageErrors"].append(err.stack or str(err))
                try:
                    report["failureText"]=page.locator("body").inner_text()[:9000]
                    shot(page,"runtime-error")
                except:pass
            page.on("pageerror",capture_error)
            page.on("request",lambda req:report["networkWrites"].append({"url":req.url,"method":req.method}) if req.method not in ["GET","HEAD"] else None)
            page.goto("http://127.0.0.1:8765/?archive-preview=1",wait_until="networkidle")
            page.wait_for_selector('html[data-archive-ready="1"]',timeout=35000)
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(300)
            shot(page,"initial-"+str(width))
            assert page.locator(".bottom-nav [data-nav]").all_text_contents()==["Dnes","Hrát","Pořadí","Já"] or page.locator(".bottom-nav [data-nav]").count()==4
            for view in ["daily","free","archive","season"]:
                go(page,view);overflow(page,view,width);shot(page,view+"-"+str(width))
            assert page.locator('#screen-season .ax-prize-grid button').count()==3
            page.locator('[data-archive-badge="1"]').click()
            assert "Vládce listopadu" in page.locator("#axModalTitle").inner_text()
            page.keyboard.press("Escape")
            for action in ["announcement","season-announcement"]:
                page.locator('#archiveReviewNotice button').click()
                page.locator('[data-archive-action="'+action+'"]').click()
                shot(page,action+"-"+str(width))
                assert page.locator("#archiveExperienceModal .ax-modal").evaluate("(e)=>e.scrollWidth<=e.clientWidth")
                page.keyboard.press("Escape")
            go(page,"archive")
            page.locator("#axSearch").fill("88");assert page.locator('[data-archive-board="g3-e-088"]').count()==1
            page.locator('[data-archive-board="g3-e-088"]').click()
            assert "Čeká na tebe 15 XP" in page.locator("#archiveExperienceModal").inner_text()
            page.keyboard.press("Escape")
            assert page.locator('[data-archive-board="g3-e-088"]').evaluate("(e)=>document.activeElement===e")
            page.locator("#axSearch").fill("")
            page.locator('[data-archive-diff="hardcore"]').click()
            assert "+100 XP" in page.locator("#axBoardResults").inner_text()
            page.locator('[data-archive-filter="reward"]').click();assert page.locator(".ax-board.ax-paid").count()==0
            page.locator('[data-archive-filter="all"]').click();page.locator('[data-archive-diff="easy"]').click()
            if width==320:
                page.set_viewport_size({"width":390,"height":950})
                bank=page.evaluate("PropletArchiveExperience.loadBank()")
                assert len(bank["boards"])==800 and bank["completeCovers"]==879
                contract=page.evaluate("""async()=>{const bank=await PropletArchiveExperience.loadBank();let count=0;for(const r of bank.boards){const c=PropletArchiveSolutions.create(r.puzzle,r.solutions);for(const cover of r.solutions.solutionSets){let s=c.emptyState();for(const a of cover){const out=c.submit(s,a.word,a.path);if(!out.accepted)throw Error(r.puzzle.id+': '+out.reason);s=out.state;}if(!c.evaluate(s).completed)throw Error('incomplete');count++;}}return count;}""")
                report["checks"].append({"approvedCovers":contract})
                # Newer completion at easy slot 20 must not suppress this historical award.
                assert page.evaluate("freeProgress('easy').done")>=20
                before=page.evaluate("freeProgress('easy').done")
                page.locator('[data-archive-board="g3-e-020"]').click();page.locator('[data-archive-start="g3-e-020"]').click()
                page.wait_for_selector("#screen-game.active")
                page.wait_for_timeout(350)
                shot(page,"archive-game-390")
                answers=page.evaluate("currentGame.puzzle.answers")
                solve_word(page,answers[0])
                assert page.evaluate("currentGame.found.length")==1
                page.evaluate("goBackFromGame()");page.wait_for_selector("#screen-archive.active")
                page.locator('[data-archive-board="g3-e-020"]').click();assert "Rozehráno" in page.locator("#archiveExperienceModal").inner_text()
                page.locator('[data-archive-start="g3-e-020"]').click();page.wait_for_selector("#screen-game.active")
                assert page.evaluate("currentGame.found.length")==1
                # Fold viewport changes only presentation.
                page.set_viewport_size({"width":690,"height":950});page.wait_for_timeout(150)
                assert page.evaluate("currentGame.puzzle.id")=="g3-e-020" and page.evaluate("currentGame.found.length")==1
                page.set_viewport_size({"width":390,"height":950});page.wait_for_timeout(150)
                for a in answers[1:]:solve_word(page,a)
                page.wait_for_selector("#winModal:not(.hidden)",timeout=10000)
                assert "+15 XP" in page.locator("#winXp").inner_text()
                assert page.evaluate("freeProgress('easy').done")==before
                shot(page,"archive-result-390")
                page.locator("#winMenuBtn").click();page.wait_for_selector("#screen-archive.active")
                page.locator('[data-archive-board="g3-e-020"]').click();assert "Odměna už je tvoje" in page.locator("#archiveExperienceModal").inner_text()
                page.locator('[data-archive-start="g3-e-020"]').click();page.wait_for_selector("#screen-game.active")
                for a in answers:solve_word(page,a)
                page.wait_for_selector("#winModal:not(.hidden)")
                assert "už získána" in page.locator("#winXp").inner_text()
                page.locator("#winMenuBtn").click();page.wait_for_selector("#screen-archive.active")
                # Approved VRTÍ alternative goes through actual input and restore.
                page.locator('[data-archive-board="g3-e-009"]').click();page.locator('[data-archive-start="g3-e-009"]').click();page.wait_for_selector("#screen-game.active")
                alt=next(r for r in bank["boards"] if r["puzzle"]["id"]=="g3-e-009")["solutions"]["solutionSets"][1]
                solve_word(page,next(a for a in alt if a["word"]=="VRTÍ"))
                assert page.evaluate("currentGame.found[0].word")=="VRTÍ"
                page.evaluate("applySmartHint(2)")
                page.evaluate("goBackFromGame()");page.wait_for_selector("#screen-archive.active")
                page.locator('[data-archive-board="g3-e-009"]').click();page.locator('[data-archive-start="g3-e-009"]').click();page.wait_for_selector("#screen-game.active")
                assert page.evaluate("currentGame.found[0].word")=="VRTÍ"
                assert page.evaluate("currentGame.archiveHints.length")==1
                for a in alt:
                    if a["word"]!="VRTÍ":solve_word(page,a)
                page.wait_for_selector("#winModal:not(.hidden)")
                assert "už získána" in page.locator("#winXp").inner_text()
                page.locator("#winMenuBtn").click();page.wait_for_selector("#screen-archive.active")
                # Verify current catalogue controls and both competitive entry points.
                go(page,"free")
                page.locator('[data-archive-order="easy"]').click()
                page.locator('[data-archive-order-mode="numeric"]').click()
                assert page.evaluate("freeOrder().record('easy').mode")=="numeric"
                page.locator('[data-archive-order="easy"]').click()
                page.locator('[data-archive-order-mode="varied"]').click()
                assert page.evaluate("freeOrder().record('easy').mode")=="varied"
                page.locator('[data-played-levels="easy"]').click()
                page.wait_for_selector("#playedLevelsModal:not(.hidden)")
                page.keyboard.press("Escape")
                go(page,"daily")
                page.locator('[data-archive-action="team"]').click()
                page.wait_for_timeout(250)
                assert page.locator('[data-ranking-xp-scope="teams"]').get_attribute("class").find("active")>=0
                assert page.locator('[data-ranking-period="week"]').get_attribute("class").find("active")>=0
                page.locator('#axRankingSeason').click()
                page.wait_for_selector("#screen-season.active")
                report["checks"].append({"catalogueOrder":"PASS","levels":"PASS","weeklyTeamEntry":"PASS","monthlyFromRankings":"PASS"})
                report["checks"].append({"actualGame":"PASS","resume":"PASS","foldResize":"PASS","xpOnce":"PASS","newerDoesNotBlockHistorical":"PASS","alternativeAndHintRestore":"PASS","modernProgressUnchanged":before})
            if width in [390,690,1440]:
                page.locator('#archiveReviewNotice button').click();page.locator('[data-archive-action="theme"]').click();page.keyboard.press("Escape")
                go(page,"daily");shot(page,"daily-dark-"+str(width));go(page,"archive");shot(page,"archive-dark-"+str(width));go(page,"season");shot(page,"season-dark-"+str(width))
            assert page.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.length)")==0
            report["checks"].append({"width":width,"result":"PASS"})
            context.close()
        browser.close()
    assert not report["layoutIssues"],report["layoutIssues"]
    assert not report["pageErrors"],report["pageErrors"]
    assert not report["networkWrites"],report["networkWrites"]
    report["result"]="PASS"
except Exception as e:
    report["result"]="FAIL";report["error"]=str(e);report["traceback"]=traceback.format_exc()
    try:shot(page,"failure");report["failureText"]=page.locator("body").inner_text()[:9000]
    except:pass
finally:
    server.shutdown()
    (OUT/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps(report,ensure_ascii=False))
assert report["result"]=="PASS",report.get("error")
