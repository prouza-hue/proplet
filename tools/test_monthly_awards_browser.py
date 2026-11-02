"""Verify the recovered November/December collections in the actual app UI.

Catalog and artwork load from the selected local/preview origin. No real account,
external browser requests, game results or backend writes are permitted.
"""
import argparse
from datetime import datetime, timezone
import json
import traceback
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", default="http://127.0.0.1:8768")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    origin = args.origin.rstrip("/")
    parsed = urlparse(origin)
    assert parsed.hostname in {"127.0.0.1", "localhost"} or (parsed.scheme == "https" and parsed.hostname.endswith(".vercel.app")), "Use a local server or authorized Vercel preview"
    args.output.mkdir(parents=True, exist_ok=True)
    report = {"origin": origin, "checks": [], "screenshots": [], "errors": [], "blockedWrites": [], "blockedExternal": [], "monthlyReads": []}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, service_workers="block")
        context.add_init_script("""localStorage.setItem('proplet-v3-7-required-onboarding','done');localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');localStorage.setItem('proplet:content-release:refresh300-v1','1');localStorage.setItem('proplet:content-release:mk100-v2','1');localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));""")

        def routing(route):
            req = route.request
            if not req.url.startswith(origin + "/"):
                report["blockedExternal"].append(req.url)
                route.abort()
            elif req.method not in {"GET", "HEAD"}:
                report["blockedWrites"].append({"url": req.url, "method": req.method})
                route.fulfill(status=200, json={"ok": True, "isolatedQa": True})
            else:
                if "/api/competition/monthly?" in req.url:
                    report["monthlyReads"].append(req.url)
                route.continue_()

        context.route("**/*", routing)
        page = context.new_page()
        page.clock.install(time=datetime(2026, 12, 2, 12, tzinfo=timezone.utc))
        page.set_default_timeout(15000)
        page.on("pageerror", lambda error: report["errors"].append(str(error)))
        monthly = page.locator("#screen-monthly")

        def screenshot(name, locator=None):
            path = args.output / name
            if locator is None:
                page.screenshot(path=str(path), full_page=True)
            else:
                locator.screenshot(path=str(path))
            report["screenshots"].append(str(path))

        def open_collection(key):
            page.goto(origin + "/?open=monthly&panel=awards&collection=" + key, wait_until="domcontentloaded")
            monthly.locator(".collection-award").first.wait_for()
            page.wait_for_function("!!puzzleDB&&!document.getElementById('propletBootScreen')")
            page.evaluate("document.fonts.ready")
            monthly.locator(".collection-award img").evaluate_all("nodes=>Promise.all(nodes.map(img=>img.decode()))")
            assert page.evaluate("getProfile()") is None
            assert monthly.locator(".collection-award").count() == 3
            assert monthly.locator(".collection-award small").all_inner_texts() == ["Náhled odznaku"] * 3
            assert monthly.locator('[data-monthly-panel="awards"]').get_attribute("aria-pressed") == "true"

        try:
            for key, label in [("2026-11", "november"), ("2026-12", "december")]:
                open_collection(key)
                assert monthly.locator(".collection-award img").evaluate_all("nodes=>nodes.every(img=>img.complete&&img.naturalWidth>0)")
                assert monthly.locator(".collection-award img").evaluate_all("nodes=>nodes.every(img=>img.getAttribute('src').includes('/rewards/monthly/" + key + "/'))")
                for name, width, height in [("mobile-320", 320, 740), ("mobile-390", 390, 844), ("fold-closed-portrait", 344, 882), ("fold-closed-landscape", 882, 344), ("fold-open-portrait", 768, 1024), ("fold-open-landscape", 1024, 768), ("desktop", 1440, 1000)]:
                    page.set_viewport_size({"width": width, "height": height})
                    for theme in ["light", "dark"]:
                        page.evaluate("theme=>document.documentElement.dataset.theme=theme", theme)
                        page.wait_for_timeout(60)
                        metrics = monthly.evaluate("host=>({overflow:document.documentElement.scrollWidth>innerWidth+1,tiles:[...host.shadowRoot.querySelectorAll('.collection-award')].map(b=>({width:b.clientWidth,scroll:b.scrollWidth,image:b.querySelector('img').getBoundingClientRect().height}))})")
                        assert not metrics["overflow"], (key, name, theme, metrics)
                        assert all(tile["scroll"] <= tile["width"]+1 for tile in metrics["tiles"]), (key, name, theme, metrics)
                        report["checks"].append({"collection": key, "viewport": name, "theme": theme, "metrics": metrics})
                        screenshot(f"{label}-{name}-{theme}.png")
                page.set_viewport_size({"width": 1440, "height": 1000})
                page.evaluate("document.documentElement.dataset.theme='light'")
                screenshot(f"{label}-gallery.png", monthly.locator(".collection-grid"))
                # Actual mouse and keyboard interaction, enlarged art and exact original copy.
                for index in range(3):
                    button = monthly.locator(".collection-award").nth(index)
                    button.click()
                    monthly.locator("#awardDetail[open]").wait_for()
                    assert monthly.locator(".award-quote").inner_text().startswith("„")
                    assert monthly.locator(".detail-art").get_attribute("src") == button.locator("img").get_attribute("src")
                    if key == "2026-12" and index == 1:
                        assert monthly.locator(".award-quote").inner_text() == "„Letos hlídám cukroví. Zatím chybí šest kousků.“"
                    screenshot(f"{label}-detail-{index+1}.png", monthly.locator("#awardDetail"))
                    page.keyboard.press("Escape")
                    assert monthly.locator("#awardDetail").get_attribute("open") is None
                    assert button.evaluate("b=>b===b.getRootNode().activeElement"), "Escape must restore focus to original badge"
                page.set_viewport_size({"width": 390, "height": 844})
                monthly.locator(".collection-award").nth(1).click()
                screenshot(f"{label}-mobile-390-detail.png")
                page.set_viewport_size({"width": 882, "height": 344})
                metrics=monthly.locator("#awardDetail").evaluate("d=>{const a=d.getBoundingClientRect(),c=d.querySelector('#awardDetailClose').getBoundingClientRect();return {x:a.x,y:a.y,width:a.width,height:a.height,closeY:c.y,closeBottom:c.bottom,viewport:innerHeight}}")
                assert metrics["y"] >= 0 and metrics["height"] <= metrics["viewport"] and metrics["closeY"] >= 0 and metrics["closeBottom"] <= metrics["viewport"], metrics
                screenshot(f"{label}-fold-landscape-detail.png")
                page.keyboard.press("Escape")
                report["checks"].append({"collection": key, "detailInteraction": "three actual clicks, exact catalog copy, Escape, focus restoration, narrow landscape close reachable"})
            # Collection arrows only change the catalog; they never request a different competition month.
            reads_before_arrows = list(report["monthlyReads"])
            monthly.locator("#previousMonth").click()
            assert "collection=2026-11" in page.url
            assert monthly.locator("#monthLabel").inner_text() == "Listopad 2026"
            monthly.locator("#nextMonth").click()
            assert "collection=2026-12" in page.url
            assert monthly.locator("#monthLabel").inner_text() == "Prosinec 2026"
            assert report["monthlyReads"] == reads_before_arrows
            # The ordinary disabled view still exposes the same award entry.
            monthly.locator('[data-monthly-panel="standings"]').click()
            monthly.locator("#content[aria-busy=false]").wait_for()
            monthly.locator('[data-monthly-panel="awards"]').click()
            monthly.locator(".collection-award").first.wait_for()
            page.clock.set_fixed_time(datetime(2026, 11, 2, 12, tzinfo=timezone.utc))
            open_collection("2026-12")
            assert monthly.locator("#monthLabel").inner_text() == "Listopad 2026"
            assert monthly.locator(".month-nav").is_hidden(), "November must not offer future award browsing"
            screenshot("november-first-season-no-arrows.png")
            monthly.locator('[data-monthly-panel="standings"]').click()
            assert monthly.locator(".month-nav").is_hidden(), "The first competition month has no history arrows"
            assert not report["errors"], report["errors"]
            report["status"] = "PASS"
        except Exception:
            report["status"] = "FAIL"
            report["failure"] = traceback.format_exc()
            try:
                screenshot("failure.png")
            except Exception:
                pass
        finally:
            (args.output / "awards-browser-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
            browser.close()
    print(json.dumps({k:v for k,v in report.items() if k not in {"checks","screenshots","blockedWrites","blockedExternal","monthlyReads"}},ensure_ascii=False))
    assert report["status"] == "PASS"


if __name__ == "__main__":
    main()
