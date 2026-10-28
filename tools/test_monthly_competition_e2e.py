"""Real isolated monthly E2E: browser → public gameplay API → ledger → awards.

Writes require the exact monthly preview/eanz database capability and the explicit
CLI flag. No monthly/result/catalog responses are mocked, no result rows or score
totals are seeded. Test time/finalization use the protected isolated QA endpoint.
All accounts are created through the real app UI; credentials stay outside Git.
"""
from __future__ import annotations

import argparse
from datetime import datetime
import json
from pathlib import Path
import secrets
import time
import traceback
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from playwright.sync_api import sync_playwright

REF = "eanzztstmwlamwfdskbf"
BRANCH = "codex/monthly-competition-202611"
MONTH = "2026-11"
PRAGUE = ZoneInfo("Europe/Prague")
BLOCKED_API = {"/api/product-event", "/api/product-events", "/api/client-error", "/api/feedback", "/api/support-report"}


def sanitized(value):
    if isinstance(value, dict):
        return {k: ("[redacted]" if any(word in k.lower() for word in ("token", "password", "authorization", "secret")) else sanitized(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitized(item) for item in value]
    return value


class Run:
    def __init__(self, args):
        args.output=args.output.resolve()
        args.control_secret_file=args.control_secret_file.resolve()
        for path in (args.output,args.control_secret_file.parent):
            assert not any((parent/".git").exists() for parent in (path,*path.parents)),"E2E private credentials and browser sessions must remain outside every Git checkout"
        self.args = args
        self.origin = args.origin.rstrip("/")
        parsed = urlparse(self.origin)
        assert parsed.scheme == "https" and parsed.hostname.endswith(".vercel.app"), "Only the authorized Vercel preview origin is permitted"
        assert args.allow_isolated_writes, "Use --allow-isolated-writes only for this authorized isolated QA run"
        self.secret = args.control_secret_file.read_text(encoding="utf-8").strip()
        assert self.secret
        self.run_id = secrets.token_hex(3)
        self.report = {"runId": self.run_id, "origin": self.origin, "databaseRef": REF, "branch": BRANCH, "syntheticAccountsOnly": True,
                       "interceptedMonthlyResultsCatalog": False, "directLedgerWrites": False, "checks": [], "timeline": [], "gameResults": [], "screenshots": [], "blockedRequests": [], "pageErrors": [], "httpErrors": []}
        self.accounts = {}
        self.clients = {}
        self.args.output.mkdir(parents=True, exist_ok=True)

    def http(self, method, path, body=None, token=None):
        assert path.startswith("/api/") and not path.startswith("//")
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if token:
            headers["Authorization"] = "Bearer " + token
        request = Request(self.origin+path, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
        try:
            with urlopen(request, timeout=90) as response:
                return json.loads(response.read())
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")[:1500]
            raise AssertionError(f"HTTP {error.code} {method} {path}: {detail}") from None

    def control(self, action, now=None):
        value = self.http("POST", "/api/qa/monthly-control", {"action": action, **({"now": now} if now else {})}, self.secret)
        assert value.get("isolated") is True and value.get("databaseRef") == REF and value.get("branch") == BRANCH, sanitized(value)
        self.report["timeline"].append({"action": action, "now": now, "result": sanitized(value)})
        self.save()
        return value

    def clock(self, day, at="12:00:00"):
        return self.control("clock", f"{day}T{at}+01:00")

    def monthly(self, role=None, month=MONTH):
        account = self.accounts.get(role) if role else None
        state = self.http("GET", "/api/competition/monthly?month="+month, token=account.get("token") if account else None)
        assert state.get("enabled") is True and state.get("isolated") is True and not state.get("isolatedScenario"), sanitized(state)
        return state

    def save(self):
        (self.args.output/"e2e-report.json").write_text(json.dumps(sanitized(self.report), ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        # Actual synthetic credentials are deliberately a separate local private file.
        if self.accounts:
            (self.args.output/"private-synthetic-accounts.json").write_text(json.dumps(self.accounts, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        for role,(context,_) in self.clients.items():
            try:
                context.storage_state(path=str(self.args.output/f"private-browser-{role}.json"))
            except Exception:
                # Main's final report save may run after browser teardown.
                pass

    def check(self, name, evidence=None):
        self.report["checks"].append({"name": name, "evidence": sanitized(evidence)})
        self.save()

    def context(self, browser):
        context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1, service_workers="block")
        context.add_init_script("""window.__MONTHLY_E2E_READY=false;document.addEventListener('proplet:ready',()=>window.__MONTHLY_E2E_READY=true);localStorage.setItem('proplet-v3-7-required-onboarding','done');localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');localStorage.setItem('proplet:content-release:refresh300-v1','1');localStorage.setItem('proplet:content-release:mk100-v2','1');localStorage.setItem('proplet-marketing-consent-v1',JSON.stringify({value:'denied',at:Date.now()}));""")

        def route(request_route):
            request = request_route.request
            parsed = urlparse(request.url)
            if not request.url.startswith(self.origin+"/") or parsed.path in BLOCKED_API or parsed.path.startswith("/api/push/"):
                self.report["blockedRequests"].append({"host": parsed.hostname, "path": parsed.path, "method": request.method})
                request_route.abort("blockedbyclient")
            else:
                # The official APIs, catalog, assets and public gameplay writes pass through.
                request_route.continue_()

        context.route("**/*", route)
        page = context.new_page()
        page.set_default_timeout(60000)
        page.on("pageerror", lambda error: self.report["pageErrors"].append(str(error)))
        page.on("response",lambda response:self.report["httpErrors"].append({"path":urlparse(response.url).path,"status":response.status}) if response.status>=400 and "/api/" in response.url else None)
        return context, page

    def boot(self, page):
        page.goto(self.origin+"/", wait_until="domcontentloaded")
        page.wait_for_function("window.__MONTHLY_E2E_READY===true&&!!puzzleDB&&!document.getElementById('propletBootScreen')&&typeof startDaily==='function'")
        page.evaluate("document.fonts.ready")

    def create(self, browser, role):
        context, page = self.context(browser)
        self.boot(page)
        name = f"MQA-{self.run_id}-{role}"
        password = secrets.token_urlsafe(18)
        page.evaluate("openProfileModal('create')")
        page.locator("#playerNameInput").fill(name)
        page.locator("#playerPasswordInput").fill(password)
        with page.expect_response(lambda r: urlparse(r.url).path == "/api/player" and r.request.method == "POST") as pending:
            page.locator("#saveProfileBtn").click()
        response = pending.value
        assert response.status == 200, sanitized(response.json())
        value = response.json()
        assert value["name"] == name and value.get("token") and value.get("accountCreated") is True
        self.accounts[role] = {"id": value["id"], "name": name, "password": password, "token": value["token"]}
        self.clients[role] = (context, page)
        self.save()
        page.wait_for_function("id=>getProfile()?.id===id", arg=value["id"])
        page.wait_for_function("document.getElementById('profileModal').classList.contains('hidden')")
        self.check("real UI account created", {"role": role, "id": value["id"], "name": name})
        return page

    def refresh_day(self, role, day):
        context, page = self.clients[role]
        page.bring_to_front()
        self.clock(day)
        # Reload uses actual persisted account state and the real authoritative descriptor.
        self.boot(page)
        page.wait_for_function("day=>pragueDateISO()===day", arg=day)
        assert page.evaluate("getProfile()?.id") == self.accounts[role]["id"]
        stamp = page.evaluate("resultCompletedAt()")
        assert datetime.fromisoformat(stamp.replace("Z", "+00:00")).astimezone(PRAGUE).date().isoformat() == day, stamp
        return context, page

    def start(self, role, day, mode="daily"):
        context, page = self.refresh_day(role, day)
        if mode == "daily":
            page.locator("#playDailyBtn").click()
        elif mode == "free":
            page.evaluate("startFree('easy')")
        elif mode == "daily_special":
            page.evaluate("startSpecial()")
        elif mode == "starter":
            page.evaluate("startStarter()")
        elif mode == "tajenka":
            page.evaluate("startTajenka()")
        elif mode == "archive":
            page.evaluate("async()=>{const bank=await PropletArchiveExperience.loadBank();const board=bank.boards.find(b=>b.difficulty==='easy');if(!board)throw Error('Missing official archive board');await PropletArchiveExperience.start(board.puzzleId);}")
        else:
            raise AssertionError(mode)
        page.wait_for_function("mode=>currentScreen==='game'&&currentGame?.mode===mode&&!currentGame.finished", arg="free" if mode=="archive" else mode)
        if mode=="tajenka" and page.locator("#tajenkaRulesModal:not(.hidden)").count():
            page.locator("#tajenkaRulesDone").click()
        page.wait_for_function("currentGame.pausedAt===null&&!currentGame.resumePending")
        game = page.evaluate("({puzzleId:currentGame.puzzle.id,mode:currentGame.mode,dailyDate:currentGame.dailyDate,attemptId:currentGame.attemptId,fairPlay:currentGame.fairPlay,timingUnverified:currentGame.timingUnverified,cells:currentGame.puzzle.mask.length,answers:currentGame.puzzle.answers.length,archive:currentGame.puzzle.meta?.archiveExperience===true})")
        if mode not in {"starter","archive"}:
            assert game["fairPlay"] is True and not game["timingUnverified"], game
        if mode=="archive":
            assert game["archive"] is True
        return context, page, game

    def solve(self, role, day, *, mode="daily", hint=False, pointer=False, offline=False):
        context, page, game = self.start(role, day, mode)
        if hint:
            page.locator("#hintBtn").click()
            page.locator(".hint-choice").first.click()
            page.wait_for_function("currentGame.hints>0")
        if pointer:
            path = page.evaluate("currentGame.puzzle.answers[0].path")
            centers = []
            for cell in path:
                box = page.locator(f"#board > .cell[data-index='{cell}']").bounding_box()
                centers.append((box["x"]+box["width"]/2, box["y"]+box["height"]/2))
            page.mouse.move(*centers[0]);page.mouse.down()
            for center in centers[1:]:
                page.mouse.move(*center, steps=2)
            page.mouse.up()
            page.wait_for_function("currentGame.found.length>=1")
        # Official solution paths are obtained from the board already supplied by
        # the real server. Native submitPath validates words and drives completion.
        page.evaluate("""()=>{const g=currentGame;for(let i=0;i<g.puzzle.answers.length-1;i++){if(g.found.some(f=>f.answerIndex===i))continue;g.path=[...g.puzzle.answers[i].path];submitPath();}}""")
        page.wait_for_function("minimum=>gameElapsed(currentGame)>=minimum", arg=max(2500, game["cells"]*90)+350)
        if offline:
            context.set_offline(True)
            page.evaluate("()=>{const g=currentGame;g.path=[...g.puzzle.answers.at(-1).path];submitPath();}")
            page.locator("#winModal:not(.hidden)").wait_for()
            queued = page.evaluate("getQueue().find(r=>r.attemptId===currentGame.attemptId)")
            assert queued and queued.get("timingUnverified") is True, sanitized(queued)
            self.report["gameResults"].append({"role": role, "game": game, "offlineQueued": True, "completedAt": queued["completedAt"], "solver": "official paths through native game"})
            self.save()
            return {"context": context, "page": page, "game": game, "queue": queued}
        with page.expect_response(lambda r: urlparse(r.url).path == "/api/result" and r.request.method == "POST", timeout=90000) as pending:
            page.evaluate("()=>{const g=currentGame;g.path=[...g.puzzle.answers.at(-1).path];submitPath();}")
        response = pending.value
        assert response.status == 200, response.text()
        receipt, payload = response.json(), response.request.post_data_json
        assert payload["mode"] == ("free" if mode=="archive" else mode) and bool(payload["hints_used"]) == hint, sanitized(payload)
        if mode=="archive":
            assert payload.get("archive_solution"), "Archive result must carry the actual approved board solution proof"
        assert not payload.get("timing_unverified"), sanitized(payload)
        page.locator("#winModal:not(.hidden)").wait_for()
        page.wait_for_function("attempt=>!getQueue().some(r=>r.attemptId===attempt)", arg=game["attemptId"])
        self.report["gameResults"].append({"role": role, "game": game, "payload": sanitized(payload), "receipt": sanitized(receipt), "solver": "first word native pointer, remaining official paths" if pointer else "official paths through native game"})
        self.save()
        return {"context": context, "page": page, "game": game, "payload": payload, "receipt": receipt}

    def replay_daily_ui(self, role):
        _,page=self.clients[role]
        page.locator("#winReplayBtn").click()
        page.wait_for_function("currentGame?.isReplay===true&&!currentGame.finished")
        page.evaluate("()=>{const g=currentGame;for(let i=0;i<g.puzzle.answers.length-1;i++){g.path=[...g.puzzle.answers[i].path];submitPath();}}")
        page.wait_for_function("gameElapsed(currentGame)>=Math.max(2500,currentGame.puzzle.mask.length*90)+350")
        page.evaluate("()=>{const g=currentGame;g.path=[...g.puzzle.answers.at(-1).path];submitPath();}")
        page.locator("#winModal:not(.hidden)").wait_for()
        page.evaluate("syncQueue({announce:false,waitForProfile:false})")
        value=self.monthly(role)
        assert value["me"]["points"]==120 and value["me"]["validDays"]==1,value
        self.check("actual replayed Daily completion does not add a monthly day or points",value["me"])

    def sync_offline(self, role, pending, receive_day, at="12:00:00"):
        self.clock(receive_day, at)
        context, page = pending["context"], pending["page"]
        page.bring_to_front()
        with page.expect_response(lambda r: urlparse(r.url).path == "/api/result" and r.request.method == "POST", timeout=90000) as awaited:
            context.set_offline(False)
            page.evaluate("syncQueue({announce:false,waitForProfile:false})")
        response = awaited.value
        assert response.status == 200, response.text()
        payload = response.request.post_data_json
        assert payload["completed_at"] == pending["queue"]["completedAt"], "Offline completion must retain original day, never synchronization day"
        assert payload["timing_unverified"] is True
        page.wait_for_function("attempt=>!getQueue().some(r=>r.attemptId===attempt)", arg=pending["game"]["attemptId"])
        self.check("real offline queue synchronized retaining original completion", {"role": role, "completion": payload["completed_at"], "receivedDay": receive_day, "receipt": response.json()})

    def show_monthly(self, role):
        _, page = self.clients[role]
        page.bring_to_front()
        if page.locator("#winModal:not(.hidden)").count():
            page.locator("#winMenuBtn").click()
        page.evaluate("PropletMonthlyCompetition.open()")
        page.locator("#screen-monthly #content[aria-busy=false]").wait_for()
        page.wait_for_function("!document.getElementById('screen-monthly').shadowRoot.getElementById('scenarioNotice').hidden")
        assert "skutečné výsledky z testovací databáze" in page.locator("#screen-monthly #scenarioNotice").inner_text()
        return page

    def screenshots(self, role, prefix):
        page = self.show_monthly(role)
        for label, width, height in [("mobile",390,844),("fold-portrait",768,1024),("fold-landscape",1024,768),("desktop",1440,1000)]:
            page.set_viewport_size({"width":width,"height":height})
            for theme in ["light","dark"]:
                page.evaluate("theme=>document.documentElement.dataset.theme=theme",theme)
                assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
                path=self.args.output/f"{prefix}-{label}-{theme}.png"
                page.screenshot(path=str(path),full_page=True)
                self.report["screenshots"].append(str(path))
        self.save()

    def execute(self):
        health=self.http("GET","/api/health")
        meta=health.get("monthlyPreview") or {}
        assert meta.get("isolated") is True and meta.get("databaseRef")==REF and meta.get("branch")==BRANCH, sanitized(health)
        self.report["initialHealth"]=sanitized(health)
        self.control("status")
        existing=self.http("GET","/api/competition/monthly?month="+MONTH)
        if existing.get("enabled") is True:
            assert existing.get("isolated") is True and existing.get("status")!="closed" and not existing.get("standings"),"Refusing to rewind a closed or populated November test season; review/resume its actual QA actors instead"
        self.clock("2026-11-01")
        guest=self.monthly()
        assert guest.get("me") is None and not guest.get("badges")
        assert guest.get("status")=="open" and not guest.get("standings") and guest.get("totalPlayers",0)==0,"November must be an empty open isolated test season before this once-only E2E; never erase pre-existing results silently"
        self.check("guest reads actual isolated month without own results",guest)
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                for role in ("A","B","C"):
                    self.create(browser,role)
                first=self.solve("A","2026-11-01",pointer=True)
                a=self.monthly("A");assert a["me"]["points"]==120 and a["me"]["validDays"]==1,a
                self.check("native UI clean daily → official result → 120 monthly points",a["me"])
                replay=self.http("POST","/api/result",first["payload"],self.accounts["A"]["token"])
                assert self.monthly("A")["me"]["points"]==120
                self.check("exact public result replay is idempotent",replay)
                self.replay_daily_ui("A")
                self.solve("A","2026-11-01",mode="daily_special")
                assert self.monthly("A")["me"]["points"]==120
                self.solve("A","2026-11-01",mode="starter")
                assert self.monthly("A")["me"]["points"]==120
                self.check("actual Extra and training completions add no monthly points",self.monthly("A")["me"])
                self.solve("B","2026-11-01")
                self.solve("C","2026-11-01",hint=True)
                assert self.monthly("C")["me"]["points"]==100
                self.solve("A","2026-11-02",hint=True)
                assert self.monthly("A")["me"]["points"]==220
                self.solve("A","2026-11-02",mode="free")
                assert self.monthly("A")["me"]["points"]==220
                self.solve("A","2026-11-02",mode="archive")
                assert self.monthly("A")["me"]["points"]==220
                self.check("hinted basic daily100; genuine free and Archive completions add no monthly points",self.monthly("A")["me"])
                self.solve("B","2026-11-02")
                offline=self.solve("A","2026-11-03",offline=True)
                assert self.monthly("A")["me"]["points"]==220
                self.sync_offline("A",offline,"2026-11-04")
                assert self.monthly("A")["me"]["points"]==340
                self.solve("B","2026-11-03")
                self.screenshots("A","under20-real")
                for day in range(4,23):
                    date=f"2026-11-{day:02}"
                    self.solve("A",date)
                    if day==7:
                        previous=self.monthly("A")["me"]["points"]
                        self.solve("A",date,mode="tajenka")
                        assert self.monthly("A")["me"]["points"]==previous
                        self.check("actual Tajenka completion adds no monthly points",self.monthly("A")["me"])
                    if day<=20:
                        self.solve("B",date)
                a,b,c=(self.monthly(role) for role in ("A","B","C"))
                assert a["me"]["validDays"]==22 and a["me"]["countedDays"]==20 and a["me"]["points"]==2400,a["me"]
                assert b["me"]["validDays"]==20 and b["me"]["points"]==2400,b["me"]
                assert [a["me"]["rank"],b["me"]["rank"],c["me"]["rank"]]==[1,1,3],sanitized([a,b,c])
                assert a["me"]["sharedRank"] and b["me"]["sharedRank"]
                self.check("real22days best20 cap and 1–1–3 shared ranking",{"A":a["me"],"B":b["me"],"C":c["me"]})
                self.screenshots("A","over20-real")
                # Two actual offline finishes on month end: one before cutoff,
                # one accepted for XP after cutoff but excluded from frozen month.
                end_a=self.solve("A","2026-11-30",offline=True)
                end_c=self.solve("C","2026-11-30",offline=True)
                self.sync_offline("A",end_a,"2026-12-02")
                a=self.monthly("A");assert a["me"]["validDays"]==23 and a["status"]=="provisional" and not a["badges"],a
                self.clock("2026-12-02","23:59:00")
                before=self.control("finalize");assert before["result"]["finalized"]==0 and not self.monthly("A")["badges"],before
                xp_before={role:self.http("GET","/api/account/snapshot",token=self.accounts[role]["token"])["stats"]["totalPoints"] for role in ("A","B","C")}
                self.clock("2026-12-03","00:00:01")
                closed=self.control("finalize")
                a,b,c=(self.monthly(role) for role in ("A","B","C"))
                assert all(state["status"]=="closed" for state in (a,b,c))
                assert [[award["rank"] for award in state["badges"] if award["month"]==MONTH] for state in (a,b,c)]==[[1],[1],[3]],sanitized([a,b,c])
                xp_after={role:self.http("GET","/api/account/snapshot",token=self.accounts[role]["token"])["stats"]["totalPoints"] for role in ("A","B","C")}
                assert xp_after==xp_before,"Monthly badges must never add XP"
                repeated=self.control("finalize");assert repeated["result"]["finalized"]==0,repeated
                assert self.monthly("A")["badges"]==a["badges"]
                self.sync_offline("C",end_c,"2026-12-03","00:00:05")
                after=self.monthly("C");assert after["me"]["points"]==100 and after["me"]["validDays"]==1 and after["badges"]==c["badges"],after
                c_xp=self.http("GET","/api/account/snapshot",token=self.accounts["C"]["token"])["stats"]["totalPoints"]
                assert c_xp>=xp_before["C"]+100,"A late monthly-ineligible Daily still preserves its existing daily XP"
                self.check("48h cutoff, real offline month-end grace, frozen late sync and idempotent zero-XP badges",{"close":closed,"A":a,"B":b,"C":after,"xpBeforeBadge":xp_before,"xpAfterBadge":xp_after,"lateOfflineXp":c_xp})
                # Preserve the closed November ledger. Only the isolated test clock
                # moves to December1 for a fresh-device handover of the next season.
                self.clock("2026-12-01")
                assert self.monthly("A")["status"]=="closed"
                december=self.monthly("A","2026-12");assert december["status"]=="open" and december["me"]["points"]==0
                self.create(browser,"D")
                fresh=self.monthly("D","2026-12");assert fresh["me"]["points"]==0 and fresh["me"]["validDays"]==0 and not fresh["badges"],fresh
                self.check("fresh registered December account ready for independent QA",{"id":self.accounts["D"]["id"],"name":self.accounts["D"]["name"],"state":fresh})
                context,page=self.context(browser);self.boot(page)
                page.evaluate("openProfileModal('login')")
                page.locator("#playerNameInput").fill(self.accounts["A"]["name"])
                page.locator("#playerPasswordInput").fill(self.accounts["A"]["password"])
                page.locator("#saveProfileBtn").click()
                page.wait_for_function("id=>getProfile()?.id===id",arg=self.accounts["A"]["id"])
                page.wait_for_function("document.getElementById('profileModal').classList.contains('hidden')")
                self.clients["A"]=(context,page)
                self.screenshots("A","december-open-real")
                monthly=page.locator("#screen-monthly")
                monthly.locator('[data-monthly-panel="awards"]').click()
                monthly.locator(".collection-award .owned").wait_for()
                assert monthly.locator(".collection-award .owned").count()==1
                assert "Král listopadu" in monthly.locator(".collection-award").filter(has=page.locator(".owned")).inner_text()
                path=self.args.output/"november-earned-real.png";page.screenshot(path=str(path),full_page=True);self.report["screenshots"].append(str(path))
                monthly.locator(".collection-award").first.click()
                assert "Získáno" in monthly.locator(".award-ownership").inner_text()
                assert monthly.locator(".detail-art").get_attribute("src")=="/rewards/monthly/2026-11/king-v1.webp"
                self.check("actual closed November award persists after fresh-device login; December open",{"november":a["badges"],"december":december["me"]})
                assert not self.report["pageErrors"],self.report["pageErrors"]
                self.report["status"]="PASS"
            except Exception:
                self.report["failureStates"]={}
                for role,(_,page) in self.clients.items():
                    try:
                        path=self.args.output/f"failure-{role}.png";page.screenshot(path=str(path),full_page=True)
                        self.report["screenshots"].append(str(path))
                        self.report["failureStates"][role]=page.evaluate("({screen:currentScreen,player:getProfile()?.id,game:currentGame?{mode:currentGame.mode,puzzle:currentGame.puzzle?.id,finished:currentGame.finished,finishing:currentGame.finishing,timingUnverified:currentGame.timingUnverified,fairPlay:currentGame.fairPlay,pause:currentGame.pauseReason}:null,queue:getQueue(),formError:document.getElementById('profileFormError')?.textContent})")
                    except Exception:
                        pass
                raise
            finally:
                browser.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin",required=True)
    parser.add_argument("--output",required=True,type=Path)
    parser.add_argument("--control-secret-file",required=True,type=Path)
    parser.add_argument("--allow-isolated-writes",action="store_true")
    run=Run(parser.parse_args())
    try:
        run.execute()
    except Exception:
        run.report["status"]="FAIL"
        run.report["failure"]=traceback.format_exc()
    finally:
        run.save()
    print(json.dumps({"status":run.report.get("status"),"runId":run.run_id,"checks":len(run.report["checks"]),"report":str(run.args.output/"e2e-report.json"),"failure":run.report.get("failure")},ensure_ascii=False))
    assert run.report.get("status")=="PASS"


if __name__=="__main__":
    main()
