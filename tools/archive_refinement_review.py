"""Targeted visual review of the isolated Archive proposal. No player writes."""
import functools, http.server, json, pathlib, subprocess, threading, urllib.request
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "public/previews/archive-20261008/evidence"
OUT.mkdir(exist_ok=True)
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def end_headers(self):
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'")
        super().end_headers()
server=http.server.ThreadingHTTPServer(("127.0.0.1",8765),functools.partial(Handler,directory=str(ROOT/"public")))
threading.Thread(target=server.serve_forever,daemon=True).start()
report={"testedSha":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),"checks":[],"screenshots":[]}
# Independent production read without Vercel tooling's extra query parameters.
try:
    with urllib.request.urlopen("https://hrajproplet.cz/api/daily",timeout=25) as r:
        data=json.load(r)
        report["productionDaily"]={"status":r.status,"dailyDate":data.get("dailyDate"),"puzzleId":data.get("puzzleId"),"bankVersion":data.get("bankVersion"),"serverToday":data.get("serverToday")}
except Exception as e: report["productionDaily"]={"error":str(e)}
with sync_playwright() as p:
    browser=p.chromium.launch()
    for width in [320,390,690,1440]:
        context=browser.new_context(viewport={"width":width,"height":950},device_scale_factor=1)
        page=context.new_page(); errors=[]
        page.on("pageerror",lambda err:errors.append(str(err)))
        page.goto("http://127.0.0.1:8765/previews/archive-20261008/index.html")
        page.evaluate("document.fonts.ready"); page.wait_for_timeout(700)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"),("overflow",width)
        assert page.locator(".board").count()==40
        page.locator("#board-search").fill("88")
        assert page.locator('[data-board="88"]').count()==1
        page.locator('[data-board="88"]').click()
        assert page.locator("dialog").evaluate("(e)=>e.open")
        assert "Deska 88" in page.locator("#dialog-title").inner_text()
        page.keyboard.press("Escape")
        assert page.locator('[data-board="88"]').evaluate("(e)=>e===document.activeElement")
        page.locator("#board-search").fill("")
        page.locator('[data-diff="hardcore"]').click()
        assert page.locator('[data-diff="hardcore"]').get_attribute("aria-pressed")=="true"
        assert "+100 XP" in page.locator("#board-results").inner_text()
        page.locator('[data-filter="reward"]').click()
        assert page.locator(".board.earned").count()==0
        page.locator('[data-filter="all"]').click()
        page.locator('[data-diff="easy"]').click()
        # Unplayed old slot can already have a paid reward.
        page.locator('[data-board="15"]').click()
        assert "ještě nehrál" in page.locator("#dialog-content").inner_text()
        assert "Odměna už je tvoje" in page.locator("#dialog-content").inner_text()
        page.keyboard.press("Escape")
        font_sizes=page.evaluate("""async()=>{const a=await document.fonts.load('750 30px Fraunces');const b=await document.fonts.load('400 15px Outfit');return [a.length,b.length]}""")
        assert all(font_sizes),("fonts missing",font_sizes)
        for view in ["archive","play","today","season"]:
            page.select_option("#view-select",view)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"),(view,width)
            name=f"{view}-{width}.png"
            page.screenshot(path=str(OUT/name),full_page=True)
            report["screenshots"].append(name)
        for modal in ["archive","season"]:
            page.locator('[data-action="'+modal+'-cta"]').click()
            page.screenshot(path=str(OUT/f"cta-{modal}-{width}.png"))
            assert page.locator("dialog").evaluate("(e)=>e.scrollWidth<=e.clientWidth")
            page.keyboard.press("Escape")
        if width in [390,690,1440]:
            page.locator('[data-action="theme"]').click()
            page.select_option("#view-select","archive")
            page.screenshot(path=str(OUT/f"archive-dark-{width}.png"),full_page=True)
            page.locator('[data-action="archive-cta"]').click()
            page.screenshot(path=str(OUT/f"cta-archive-dark-{width}.png"))
            page.keyboard.press("Escape")
        assert not errors,errors
        assert page.evaluate("localStorage.length")==0
        assert page.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.length)")==0
        report["checks"].append({"width":width,"result":"PASS","fontFaces":font_sizes,"pageErrors":errors})
        context.close()
    browser.close()
server.shutdown()
(OUT/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(report,ensure_ascii=False))
