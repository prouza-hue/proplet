"""Production HTML/API proof for Archive layout hooks, both enabled and disabled.

Requires the same Python Playwright + Chromium as archive_integrated_review.py.
Run tools/build_archive_experience.py first; the immutable bank is used only by
this read-only fixture server, never injected into the production application.
"""
import datetime
import http.server
import json
import mimetypes
import os
from pathlib import Path
import re
import threading
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
BANK = json.loads((PUBLIC / "app/archive/boards.json").read_text())
CONFIG = json.loads((ROOT / "tests/fixtures/browser/config.json").read_text())
TAJENKA = json.loads((ROOT / "tests/fixtures/browser/tajenka.json").read_text())
TODAY = datetime.datetime.now(ZoneInfo("Europe/Prague")).date()
OFFSET = (TODAY - datetime.date(2026, 9, 12)).days
WEEK = 3 + OFFSET // 7 * 2 + int(OFFSET % 7 >= 4)
TAJENKA.update(week=WEEK, id=f"tajenka-v2-week-{WEEK:02d}")
state = {"enabled": False, "requests": []}
checks = []


class Fixture(http.server.BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def json(self, value, status=200):
        raw = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        self.json({"detail": "Isolated proof: writes disabled"}, 503)

    do_PUT = do_POST
    do_PATCH = do_POST
    do_DELETE = do_POST

    def do_GET(self):
        url = urlparse(self.path)
        state["requests"].append(url.path)
        if url.path == "/api/config":
            return self.json({**CONFIG, "environment": "production", "archiveEnabled": state["enabled"]})
        if url.path == "/api/tajenka":
            return self.json(TAJENKA)
        if url.path == "/api/archive":
            if not state["enabled"]:
                return self.json({}, 404)
            return self.json({"editionId": BANK["editionId"],
                "solutionPolicyRevision": BANK["boards"][0]["solutions"]["solutionPolicyRevision"],
                "boards": [{"puzzleId": row["puzzle"]["id"], "difficulty": row["puzzle"]["difficulty"],
                    **{key: row[key] for key in ("level", "rewardXp", "rewardSlotKey")}} for row in BANK["boards"]]})
        if url.path == "/api/archive/puzzle":
            wanted = parse_qs(url.query).get("puzzle_id", [None])[0]
            entry = next((row for row in BANK["boards"] if row["puzzle"]["id"] == wanted), None)
            return self.json({"editionId": BANK["editionId"], **entry,
                "difficulty": entry["puzzle"]["difficulty"]} if entry else {}, 200 if state["enabled"] and entry else 404)
        if url.path == "/api/daily-special":
            return self.json({"serverToday": TODAY.isoformat(), "special": None,
                "validUntil": (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)).isoformat()})
        if url.path in ("/api/free-order/config", "/api/play-session/config", "/api/referrals"):
            return self.json({"enabled": False})
        if url.path.startswith("/api/") and "rankings" in url.path:
            return self.json({"players": [], "teams": [], "rows": []})
        if url.path.startswith("/api/"):
            return self.json({"detail": "No synthetic fixture"}, 503)
        file = (PUBLIC / ("index.html" if url.path == "/" else url.path.lstrip("/"))).resolve()
        if not file.is_relative_to(PUBLIC) or not file.is_file():
            return self.json({}, 404)
        raw = file.read_bytes()
        if url.path == "/":
            html = raw.decode().replace(" data-archive-preview", "")
            raw = re.sub(r'\s*<script src="/app/archive/preview-isolation\.js"></script>', "", html).encode()
        if url.path == "/runtime-meta.js":
            raw = re.sub(r"const previewHost=.*;", "const previewHost=false;", raw.decode()).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/javascript" if file.suffix == ".js" else mimetypes.guess_type(file)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)


server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f"http://127.0.0.1:{server.server_address[1]}"
try:
    with sync_playwright() as playwright:
        launch = {"headless": True}
        if os.environ.get("CHROME_PATH"):
            launch.update(executable_path=os.environ["CHROME_PATH"], args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-zygote"])
        browser = playwright.chromium.launch(**launch)
        try:
            for enabled in (True, False):
                state.update(enabled=enabled, requests=[])
                context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce", service_workers="block")
                context.route("**/*", lambda route: route.continue_() if route.request.url.startswith(origin + "/") else route.abort())
                context.add_init_script("""
                    localStorage.setItem('proplet-v3-7-required-onboarding','done');
                    localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');
                    localStorage.setItem('proplet-v3-32-8-rule-principle-seen','1');
                    localStorage.setItem('proplet-v3-16-2-helper-mode','none');
                    localStorage.setItem('proplet-v3-settings',JSON.stringify({theme:'light',sound:false,haptics:false}));
                    document.addEventListener('proplet:ready',()=>{window.__productionHooksReady=true},{once:true});
                """)
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(origin + "/", wait_until="domcontentloaded")
                page.wait_for_function("window.__productionHooksReady")
                page.wait_for_function("window.__propletHomeLayoutInstalled && window.__PROPLET_TAJENKA_CARD_POLISH__")
                assert not page.evaluate("!!window.PROPLET_ARCHIVE_PREVIEW")
                assert page.evaluate("window.PROPLET_RUNTIME_META.environment") == "production"
                assert page.locator('script[src*="preview-isolation"]').count() == 0
                assert not any("preview-isolation" in item for item in state["requests"])
                assert page.evaluate("PropletArchiveExperience.isEnabled()") == enabled
                page.evaluate("""()=>{
                    const state=tajenkaState();state.completions??={};
                    state.completions[tajenkaPuzzle.id]={puzzleId:tajenkaPuzzle.id,found:[],moves:8,elapsedMs:45000,hints:0,completedAt:new Date().toISOString(),rewarded:true,rewardXp:200};
                    saveTajenkaState(state);renderDaily();renderFree();PropletHomeLayout.applyDailyLayout();
                }""")
                page.wait_for_selector("#tajenkaPreviewCard.completed")
                page.wait_for_function("flag=>document.querySelectorAll('#tajenkaPreviewCard h2').length===(flag?1:0)&&document.querySelectorAll('#tajenkaPlayCard h2').length===(flag?1:0)", arg=enabled)
                for screen in ("free", "daily", "free", "daily"):
                    page.evaluate("screen=>{nav(screen);PropletHomeLayout.applyDailyLayout()}", screen)
                page.wait_for_timeout(150)
                assert page.locator("#tajenkaPreviewCard h2").count() == int(enabled)
                assert page.locator("#tajenkaPlayCard h2").count() == int(enabled)
                if enabled:
                    assert page.locator("#axHomeArchive").is_visible()
                    assert not page.locator("#homeCompetitionCard").is_visible()
                    order = page.evaluate("""()=>{
                        const rows=[...document.querySelector('#screen-daily').children];
                        return ['tajenkaPreviewCard','axHomeGames','axHomeCompetitions','axHomeFree'].map(id=>rows.indexOf(document.getElementById(id)));
                    }""")
                    assert all(value >= 0 for value in order) and order == sorted(order), order
                    page.locator('#axHomeArchive [data-archive-action="open"]').click()
                    page.wait_for_selector(".ax-board")
                    assert page.locator(".ax-board").count() == 40
                    assert "/api/archive" in state["requests"]
                    assert "/app/archive/boards.json" not in state["requests"]
                else:
                    assert page.locator("#axHomeArchive,#screen-archive").count() == 0
                    assert page.locator("#homeCompetitionCard").is_visible()
                assert not errors, errors
                checks.append({"archiveEnabled": enabled, "productionHtml": True, "previewAdapterLoaded": False,
                    "nativeHomeOrdering": "PASS", "completedTajenkaHeadings": "PASS"})
                print(f"PASS production HTML without preview adapter: archiveEnabled={enabled}; native home ordering and completed Tajenka headings")
                context.close()
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()

report = Path(os.environ.get("ARCHIVE_HOOKS_REPORT", PUBLIC / "review-evidence/archive-production-hooks.json"))
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(json.dumps({"result": "PASS", "checks": checks}, ensure_ascii=False, indent=2) + "\n")
