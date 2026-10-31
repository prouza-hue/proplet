"""Native Chromium UI QA with explicitly labeled isolated read scenarios; no DB or real accounts.

The monthly response is intercepted. This proves UI states and layout, not backend rules.
Every non-GET and every external-origin request is blocked before reaching a server.
"""
import argparse
import copy
import json
import traceback
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


def scenario(status="open", valid_days=23):
    players = [
        {"playerId": "qa-1", "name": "Zvídavá sova", "rank": 1, "points": 2400, "countedDays": 20, "validDays": 23},
        {"playerId": "qa-2", "name": "Klidný jezevec", "rank": 1, "points": 2400, "countedDays": 20, "validDays": 21},
        {"playerId": "qa-3", "name": "Tajemná volavka", "rank": 3, "points": 2380, "countedDays": 20, "validDays": 22},
        {"playerId": "qa-4", "name": "Propletený mýval", "rank": 4, "points": 2340, "countedDays": 20, "validDays": 23},
        {"playerId": "qa-5", "name": "Hbitá vydra", "rank": 5, "points": 2320, "countedDays": 20, "validDays": 22},
        {"isMine": True, "name": "Pavel · izolovaný účet", "rank": 6, "points": 2300, "countedDays": min(20, valid_days), "validDays": valid_days},
    ]
    me = copy.deepcopy(players[-1])
    me["days"] = [{"date": f"2026-11-{i:02}", "points": 100 if i % 4 == 0 else 120, "clean": i % 4 != 0, "counted": i <= 20} for i in range(1, valid_days+1)]
    if valid_days < 20:
        me.update(points=sum(d["points"] for d in me["days"]), rank=1)
        players = [{k: v for k, v in me.items() if k != "days"}]
    return {"enabled": True, "month": "2026-11", "start": "2026-11-01", "end": "2026-12-01", "closesAt": "2026-12-03T00:00:00+01:00", "status": status, "standings": players, "me": me, "previousPodium": [], "badges": [{"month": "2026-11", "rank": 1}] if status == "closed" else []}


def server_snapshot_qa(args):
    """Read actual local server snapshot responses; monthly GETs are never intercepted."""
    origin = args.origin.rstrip("/")
    assert urlparse(origin).hostname in {"127.0.0.1", "localhost", "proplet-git-codex-monthly-competi-a7b681-pavel-prouzas-projects.vercel.app"}, "Only local QA or the authorized monthly preview"
    args.output.mkdir(parents=True, exist_ok=True)
    report = {"syntheticSnapshotUIOnly": True, "monthlyResponsesIntercepted": False, "onlineDatabase": False, "checks": [], "errors": [], "blockedWrites": [], "blockedExternal": []}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, service_workers="block")
        context.add_init_script("""localStorage.setItem('proplet-v3-7-required-onboarding','done');localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');localStorage.setItem('proplet:content-release:refresh300-v1','1');localStorage.setItem('proplet:content-release:mk100-v2','1');localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));""")

        def routing(route):
            req = route.request
            if not req.url.startswith(origin+"/"):
                report["blockedExternal"].append(req.url)
                route.abort()
            elif req.method not in {"GET", "HEAD"}:
                report["blockedWrites"].append({"url": req.url, "method": req.method})
                route.fulfill(status=200, json={"ok": True, "isolatedQa": True})
            else:
                route.continue_()

        context.route("**/*", routing)
        page = context.new_page()
        page.set_default_timeout(15000)
        page.on("pageerror", lambda error: report["errors"].append(str(error)))
        try:
            for scenario_name in ["over20", "upcoming", "closed", None]:
                url = origin + "/?open=monthly" + ("&monthlyScenario="+scenario_name if scenario_name else "")
                with page.expect_response(lambda response: "/api/competition/monthly?" in response.url) as awaited:
                    page.goto(url, wait_until="domcontentloaded")
                payload = awaited.value.json()
                page.wait_for_function("() => typeof currentScreen!=='undefined'&&currentScreen==='monthly'&&!!puzzleDB&&!document.getElementById('propletBootScreen')")
                monthly = page.locator("#screen-monthly")
                monthly.locator("#content[aria-busy=false]").wait_for()
                page.evaluate("document.fonts.ready")
                assert page.evaluate("getProfile()") is None, "No fake account needed for read-only isolated viewer"
                if scenario_name:
                    assert payload["isolatedScenario"] == scenario_name
                    assert payload["onlineBackend"] is False
                    assert "online soutěžní databáze není připojená" in monthly.locator("#scenarioNotice").inner_text()
                    if payload["month"] == "2026-10":
                        assert monthly.locator("#monthLabel").inner_text() == "Říjen 2026", "October SQL test snapshot must not appear as November"
                    assert monthly.locator("#previousMonth").is_disabled() and monthly.locator("#nextMonth").is_disabled()
                    if scenario_name == "over20":
                        assert monthly.locator(".personal-score strong").inner_text().replace("\u00a0", " ") == "2 400"
                        assert "společné umístění" in monthly.locator(".personal-rank").inner_text()
                        monthly.get_by_text("Rozpis tvých dnů", exact=True).click()
                        assert monthly.locator(".days li").count() == 25
                        assert monthly.locator(".days li.excluded").count() == 5
                        monthly.get_by_text("Rozpis tvých dnů", exact=True).click()
                    if scenario_name == "closed":
                        assert monthly.locator(".award").is_visible()
                else:
                    assert payload["enabled"] is False
                    assert monthly.locator("#scenarioNotice").is_hidden()
                    assert monthly.locator(".personal-score").count() == 0
                viewports = [("mobile-390",390,844),("fold",768,1024),("desktop",1440,1000)] if scenario_name == "over20" else [(scenario_name or "normal-disabled",390,844)]
                for label, width, height in viewports:
                    page.set_viewport_size({"width":width,"height":height})
                    for theme in ["light","dark"]:
                        page.evaluate("theme=>{document.documentElement.dataset.theme=theme}", theme)
                        page.wait_for_timeout(60)
                        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
                        path=args.output/f"server-{label}-{theme}.png"
                        page.screenshot(path=str(path), full_page=True)
                        report["checks"].append({"scenario": scenario_name, "month": payload.get("month"), "viewport": [width,height], "theme": theme, "screenshot":str(path)})
            assert not report["errors"], report["errors"]
            report["status"]="PASS"
        except Exception:
            report["status"]="FAIL"
            report["failure"]=traceback.format_exc()
            page.screenshot(path=str(args.output/"server-failure.png"),full_page=True)
        finally:
            (args.output/"server-browser-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
            browser.close()
    print(json.dumps({k:v for k,v in report.items() if k not in {"checks","blockedWrites","blockedExternal"}},ensure_ascii=False))
    assert report["status"]=="PASS"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--origin", default="http://127.0.0.1:8768")
    parser.add_argument("--server-snapshots", action="store_true")
    args = parser.parse_args()
    if args.server_snapshots:
        return server_snapshot_qa(args)
    origin = args.origin.rstrip("/")
    assert urlparse(origin).hostname in {"127.0.0.1", "localhost"}, "QA only permits a local origin"
    args.output.mkdir(parents=True, exist_ok=True)
    report = {"syntheticUIOnly": True, "backendVerifiedByThisScript": False, "checks": [], "errors": [], "blockedWrites": [], "blockedExternal": [], "screenshots": []}
    state = {"payload": scenario(), "mode": "normal", "label": "rozehraný měsíc · více než 20 dnů"}
    pending = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, service_workers="block")
        context.add_init_script("""localStorage.setItem('proplet-v3-7-required-onboarding','done');localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');localStorage.setItem('proplet:content-release:refresh300-v1','1');localStorage.setItem('proplet:content-release:mk100-v2','1');localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));localStorage.setItem('proplet-v2-profile',JSON.stringify({id:'qa-monthly-account',token:'isolated-synthetic-not-a-real-session',name:'Pavel · izolovaný účet',avatar:'🦊',supportMode:'none',stats:{totalPoints:0}}));""")

        def routing(route):
            req = route.request
            if not req.url.startswith(origin + "/"):
                report["blockedExternal"].append(req.url)
                route.abort()
            elif req.method not in {"GET", "HEAD"}:
                report["blockedWrites"].append({"url": req.url, "method": req.method})
                route.fulfill(status=200, json={"ok": True, "isolatedQa": True})
            elif "/api/competition/monthly" in req.url:
                if state["mode"] == "offline":
                    route.abort("internetdisconnected")
                elif state["mode"] == "loading":
                    pending.append(route)
                elif state["mode"] == "error":
                    route.fulfill(status=503, json={"detail": "Izolovaná testovací chyba"})
                else:
                    route.fulfill(status=200, json=state["payload"])
            elif "/api/account/snapshot" in req.url:
                route.fulfill(status=200, json={"id": "qa-monthly-account", "name": "Pavel · izolovaný účet", "completed": [], "stats": {"totalPoints": 0}, "supportMode": "none"})
            elif "/api/rankings/" in req.url:
                route.fulfill(status=200, json={"players": [], "teams": [], "visibilityReady": True})
            elif "/api/team-victories" in req.url:
                route.fulfill(status=200, json={"enabled": False, "reason": "non-production"})
            else:
                route.continue_()

        context.route("**/*", routing)
        page = context.new_page()
        page.set_default_timeout(15000)
        page.on("pageerror", lambda error: report["errors"].append(str(error)))
        monthly = page.locator("#screen-monthly")

        def label():
            page.evaluate("""text=>{let b=document.getElementById('monthlyIsolatedQa');if(!b){b=document.createElement('div');b.id='monthlyIsolatedQa';b.style.cssText='padding:5px 8px;background:#752d36;color:white;text-align:center;font:11px/1.3 system-ui;pointer-events:none';document.querySelector('.app-shell').prepend(b)}b.textContent='IZOLOVANÝ UI SCÉNÁŘ · syntetická data · '+text;}""", state["label"])

        def refresh(payload=None, name=None, mode="normal"):
            if payload is not None:
                state["payload"] = payload
            state["mode"] = mode
            if name:
                state["label"] = name
            page.evaluate("document.dispatchEvent(new CustomEvent('proplet:account-changed'))")
            if mode == "loading":
                monthly.locator("#content[aria-busy=true]").wait_for()
            else:
                monthly.locator("#content[aria-busy=false]").wait_for()
            label()

        def shot(name):
            path = args.output / name
            page.screenshot(path=str(path), full_page=True)
            report["screenshots"].append(str(path))

        try:
            page.goto(origin + "/?open=monthly", wait_until="domcontentloaded")
            page.wait_for_function("() => typeof currentScreen!=='undefined'&&currentScreen==='monthly'&&!!puzzleDB&&!document.getElementById('propletBootScreen')")
            monthly.locator(".personal-score").wait_for()
            page.evaluate("document.fonts.ready")
            label()
            assert monthly.locator(".ranking-view-tabs button").count() == 4
            assert monthly.locator('.ranking-view-tabs button[aria-current="page"]').inner_text() == "Měsíční soutěž"
            assert monthly.locator(".rank-list li.mine").count() == 1
            assert monthly.locator(".personal-rank").inner_text().startswith("6. místo")
            report["checks"].append("actual app boot and fourth active navigation, own rank outside top5")
            for name, width, height in [("mobile-320", 320, 740), ("mobile-390", 390, 844), ("fold-closed-portrait", 344, 882), ("fold-closed-landscape", 882, 344), ("fold-open-portrait", 768, 1024), ("fold-open-landscape", 1024, 768), ("desktop", 1440, 1000)]:
                page.set_viewport_size({"width": width, "height": height})
                for theme in ["light", "dark"]:
                    page.evaluate("theme=>{document.documentElement.dataset.theme=theme}", theme)
                    page.wait_for_timeout(80)
                    metrics = monthly.evaluate("host=>{const root=host.shadowRoot;return {pageOverflow:document.documentElement.scrollWidth>innerWidth+1,tabs:[...root.querySelectorAll('.ranking-view-tabs button')].map(b=>({text:b.textContent,width:b.clientWidth,scrollWidth:b.scrollWidth,height:b.getBoundingClientRect().height})),contentOverflow:root.querySelector('.wrap').scrollWidth>host.clientWidth+1}}")
                    assert not metrics["pageOverflow"], (name, theme, metrics)
                    assert not metrics["contentOverflow"], (name, theme, metrics)
                    assert all(b["scrollWidth"] <= b["width"]+1 and b["height"] <= 60 for b in metrics["tabs"]), (name, theme, metrics)
                    report["checks"].append({"viewport": name, "theme": theme, "metrics": metrics})
                    shot(f"{name}-{theme}.png")
            page.set_viewport_size({"width": 390, "height": 844})
            page.evaluate("document.documentElement.dataset.theme='light'")
            monthly.locator("[data-expand]").click()
            assert monthly.locator(".rank-list li.mine").count() == 1
            monthly.get_by_text("Rozpis tvých dnů", exact=True).click()
            assert monthly.locator(".days li").count() == 23
            assert monthly.locator(".days li.excluded").count() == 3
            shot("mobile-expanded-days.png")
            report["checks"].append("expand ranking and best20 day detail without duplicating own player")
            # Real tab switches reuse the same weekly/XP owners.
            monthly.get_by_role("button", name="Týdenní soutěž", exact=True).click()
            page.wait_for_function("currentScreen==='weekly'")
            weekly = page.locator("#screen-weekly")
            assert not weekly.locator("#back").is_visible()
            weekly.get_by_role("button", name="XP", exact=True).click()
            page.wait_for_function("currentScreen==='leaderboard'")
            page.locator("#screen-leaderboard").get_by_role("button", name="Měsíční soutěž", exact=True).click()
            page.wait_for_function("currentScreen==='monthly'")
            report["checks"].append("native monthly→weekly→XP→monthly tab navigation")
            refresh(scenario(valid_days=8), "rozehraný měsíc · 8 platných dnů")
            assert "8 / 20" in monthly.locator(".progress-label").inner_text()
            shot("mobile-under20-days.png")
            tied = scenario()
            tied["me"] = {**tied["me"], "rank": 1, "points": 2400, "sharedRank": True}
            tied["standings"][-1].update(rank=1, points=2400)
            refresh(tied, "shodné body · společné 1. místo")
            assert "společné umístění" in monthly.locator(".personal-rank").inner_text()
            shot("mobile-shared-first.png")
            refresh(scenario("provisional"), "předběžné výsledky · 48hodinová kontrola")
            assert "Uzávěrka" in monthly.locator("#content .notice").inner_text()
            shot("mobile-provisional.png")
            closed = scenario("closed", 8)
            refresh(closed, "uzavřený měsíc · získaný odznak")
            assert monthly.locator(".award").is_visible()
            shot("mobile-closed-badge.png")
            refresh({"enabled": True, "status": "upcoming", "month": "2026-11", "standings": [], "me": None}, "první sezóna · bez výsledků")
            assert monthly.locator(".rank-list li").count() == 0
            shot("mobile-first-season.png")
            refresh({"enabled": True, "status": "open", "month": "2026-11", "standings": [], "me": {"points": 0, "validDays": 0, "countedDays": 0, "days": []}}, "otevřený měsíc · bez výsledků")
            shot("mobile-empty-month.png")
            page.evaluate("localStorage.removeItem('proplet-v2-profile')")
            refresh(scenario(), "nepřihlášený návštěvník")
            assert monthly.locator("[data-account]").is_visible()
            shot("mobile-signed-out.png")
            refresh(name="chyba načítání", mode="error")
            assert monthly.locator(".error").is_visible()
            shot("mobile-error.png")
            refresh(name="načítání potvrzených bodů", mode="loading")
            shot("mobile-loading.png")
            for route in pending:
                route.fulfill(status=200, json=state["payload"])
            pending.clear()
            monthly.locator("#content[aria-busy=false]").wait_for()
            context.set_offline(True)
            refresh(name="offline · bez spojení se serverem", mode="offline")
            assert "Jsi offline" in monthly.locator(".error").inner_text()
            shot("mobile-offline.png")
            context.set_offline(False)
            report["checks"].append("under20, over20, clean/hinted days, ties, provisional, closed badge, first/empty season, signed-out, error/loading/offline")
            assert not report["errors"], report["errors"]
            report["status"] = "PASS"
        except Exception:
            report["status"] = "FAIL"
            report["failure"] = traceback.format_exc()
            try:
                shot("failure.png")
                report["body"] = page.locator("body").inner_text()
            except Exception:
                pass
        finally:
            (args.output / "browser-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
            browser.close()
    print(json.dumps({k: v for k, v in report.items() if k not in {"checks", "screenshots", "body", "blockedWrites", "blockedExternal"}}, ensure_ascii=False))
    assert report["status"] == "PASS"


if __name__ == "__main__":
    main()
