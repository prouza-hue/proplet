"""Review-only prototype verification. No application server or live API calls."""
from __future__ import annotations

import functools
import http.server
import json
import subprocess
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/previews/archive-season-verification"
OUT.mkdir(parents=True, exist_ok=True)
CSP = next(
    header["value"]
    for section in json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))["headers"]
    for header in section["headers"]
    if header["key"].lower() == "content-security-policy"
)


class StaticHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, *_args):
        pass


handler = functools.partial(StaticHandler, directory=str(ROOT / "public"))
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{server.server_port}/previews/archive-season-20261004.html"
report = {
    "tested_sha": subprocess.check_output(
        ["git", "rev-parse", "HEAD"], text=True
    ).strip(),
    "production_csp": CSP,
    "checks": [],
    "screenshots": [],
    "source": "isolated Chromium; static prototype only; synthetic account",
}
console_errors = []
failed_requests = []


def assert_that(condition, message):
    if not condition:
        raise AssertionError(message)


def check_layout(page, label):
    size = page.evaluate("""() => ({
        width: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src),
        clippedDifficultyTitles: [...document.querySelectorAll('#view-free .diff-card h2')]
            .filter(n => n.getClientRects().length && n.scrollWidth > n.clientWidth + 1).map(n => n.textContent),
        fraunces: document.fonts.check('750 30px Fraunces'),
        outfit: document.fonts.check('400 15px Outfit')
    })""")
    assert_that(size["documentWidth"] <= size["width"] + 1, f"{label}: document overflow {size}")
    assert_that(size["bodyWidth"] <= size["width"] + 1, f"{label}: body overflow {size}")
    assert_that(not size["brokenImages"], f"{label}: broken images {size}")
    assert_that(not size["clippedDifficultyTitles"], f"{label}: clipped difficulty names {size}")
    assert_that(size["fraunces"] and size["outfit"], f"{label}: fonts unavailable {size}")
    report["checks"].append({"case": label, "layout": size})


def load(page, view="today", theme="light", suffix=""):
    page.goto(f"{BASE}?view={view}&theme={theme}{suffix}", wait_until="networkidle")
    page.locator('html[data-preview-ready="true"]').wait_for()
    page.evaluate("document.fonts.ready")
    faces = page.evaluate("""async () => ({
        fraunces: (await document.fonts.load('750 30px Fraunces', 'měsíční soutěž')).map(f => ({family: f.family, status: f.status})),
        outfit: (await document.fonts.load('400 15px Outfit', 'historická odměna')).map(f => ({family: f.family, status: f.status}))
    })""")
    assert_that(faces["fraunces"] and faces["outfit"], f"Actual font faces missing: {faces}")


def screenshot(page, name, full_page=True):
    page.screenshot(path=str(OUT / name), full_page=full_page, animations="disabled")
    report["screenshots"].append(name)


try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(viewport={"width": 390, "height": 950}, device_scale_factor=1)
        page = context.new_page()
        page.on("pageerror", lambda error: console_errors.append(str(error)))
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        page.on("requestfailed", lambda request: failed_requests.append({"url": request.url, "failure": request.failure}))

        def block_live_requests(route):
            url = route.request.url
            if url.startswith(BASE.split("/previews")[0]) or url.startswith("https://fonts.googleapis.com/") or url.startswith("https://fonts.gstatic.com/"):
                route.continue_()
            else:
                failed_requests.append({"url": url, "failure": "unexpected external request"})
                route.abort()

        page.route("**/*", block_live_requests)

        for theme in ("light", "dark"):
            for width in (320, 390, 768, 1440):
                page.set_viewport_size({"width": width, "height": 950})
                for view in ("today", "play", "archive", "season"):
                    load(page, view, theme)
                    check_layout(page, f"{view}/{theme}/{width}")
                    if view == "today":
                        assert_that(page.locator("#view-daily .diff-card").count() == 0, "Dnes contains free difficulty cards")
                    if view == "play":
                        archive = page.locator("#view-free .archive-banner").bounding_box()
                        difficulties = page.locator("#diffGrid").bounding_box()
                        assert_that(archive and difficulties and archive["y"] < difficulties["y"], "Archive is below difficulty grid")
                        assert_that(archive["y"] < 650, "Archive not visible near the top")
                    if width == 390 and theme == "light":
                        screenshot(page, f"{view}-390.png")
                    if width == 768 and theme == "light" and view == "archive":
                        screenshot(page, "archive-768.png")
                    if width == 1440 and theme == "light" and view == "season":
                        screenshot(page, "season-1440.png")

        page.set_viewport_size({"width": 390, "height": 950})
        load(page, "play")
        page.locator('[data-testid="open-archive"]').click()
        page.locator("#boardSearch").fill("88")
        page.locator('[data-testid="archive-level-88"]').click()
        board = page.locator('[data-testid="archive-level-detail"]')
        assert_that(board.is_visible(), "Direct archive selection did not open")
        assert_that("Mozkožrout · deska 88" in board.inner_text(), "Unexpected directly selected board")
        assert_that("+100 XP" in board.inner_text(), "Unclaimed archive reward not represented")
        screenshot(page, "archive-board-88-390.png", False)
        page.keyboard.press("Escape")
        assert_that(not board.is_visible(), "Escape did not close board dialog")
        report["checks"].append({"case": "direct-board-88", "result": "PASS; no sequential unlocking"})

        for theme in ("light", "dark"):
            load(page, "today", theme)
            opener = page.locator('[data-testid="monthly-launch"]')
            opener.click()
            modal = page.locator('[data-testid="season-modal"]')
            assert_that(modal.is_visible(), "Season modal did not open")
            modal_text = modal.inner_text()
            for rule in ("100", "20", "2 400"):
                assert_that(rule in modal_text, f"Missing rule {rule}")
            for _ in range(18):
                page.keyboard.press("Tab")
                assert_that(page.evaluate("document.activeElement.closest('dialog')?.id") == "seasonDialog", "Focus escaped open modal")
            check_layout(page, f"season-modal/{theme}/390")
            screenshot(page, f"season-modal-{theme}-390.png", False)
            modal.locator('[data-testid="season-primary"]').click()
            assert_that(not modal.is_visible(), "CTA did not close modal")
            assert_that(page.locator("#view-daily").is_visible(), "CTA did not return to Daily")
            assert_that(page.evaluate("document.activeElement.hasAttribute('data-demo-daily')"), "CTA did not focus Daily")

        page.set_viewport_size({"width": 320, "height": 740})
        load(page, "today", "light", "&modal=season")
        check_layout(page, "season-modal/light/320")
        screenshot(page, "season-modal-light-320.png", False)
        page.keyboard.press("Escape")
        assert_that(not page.locator("#seasonDialog").is_visible(), "Escape did not close season modal")

        page.set_viewport_size({"width": 390, "height": 950})
        load(page, "today", "light", "&navLabel=competition&tone=january")
        assert_that(page.locator('[data-testid="nav-today"]').inner_text().strip() == "Soutěže", "Competition navigation variant missing")
        assert_that("Leden" in page.locator("#view-daily").inner_text(), "January theme missing")
        screenshot(page, "today-january-competition-390.png")
        report["checks"].append({"case": "navigation-and-season-variants", "result": "PASS"})

        assert_that(not console_errors, f"Browser errors: {console_errors}")
        assert_that(not failed_requests, f"Failed requests: {failed_requests}")
        report["result"] = "PASS"
        report["browser_version"] = browser.version
        browser.close()
except Exception as error:
    report["result"] = "FAIL"
    report["error"] = str(error)
    raise
finally:
    report["console_errors"] = console_errors
    report["failed_requests"] = failed_requests
    (OUT / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    server.shutdown()
