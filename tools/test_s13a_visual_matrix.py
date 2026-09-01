#!/usr/bin/env python3
"""Capture Sprint 13A visual characterization from the exact checked-out commit."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
MATRIX = ROOT / "tests/current/s13a-screenshot-matrix.json"


def wait_http(url: str, timeout: float = 12.0) -> None:
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=1.5) as response:
                if response.status == 200:
                    return
        except Exception as exc:
            last = exc
        time.sleep(0.1)
    raise RuntimeError(f"local server did not start: {last!r}")


def free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def dismiss_overlays(page) -> None:
    page.evaluate("""()=>{
      document.querySelector('#qualityReleaseModal')?.classList.add('hidden');
      document.querySelector('#onboardingModal')?.classList.add('hidden');
      document.querySelector('.release-notes-v3331-backdrop')?.remove();
      document.body.classList.remove('release-notes-v3331-open');
      document.documentElement.classList.remove('gen4-preview-booting');
    }""")


def apply_safe_area_fixture(page, safe: dict) -> None:
    if not any(int(safe.get(k, 0) or 0) for k in ("top", "right", "bottom", "left")):
        return
    top, right, bottom, left = (int(safe.get(k, 0) or 0) for k in ("top", "right", "bottom", "left"))
    page.add_style_tag(content=f"""
      /* Test-only equivalent of env(safe-area-inset-*), used identically before/after refactor. */
      body.playing .app-shell {{
        padding-top: calc({top}px + 7px) !important;
        padding-right: max({right}px, 10px) !important;
        padding-bottom: calc({bottom}px + 7px) !important;
        padding-left: max({left}px, 10px) !important;
      }}
      .phone-landscape-guard {{
        padding-top: max(18px, {top}px) !important;
        padding-right: max(18px, {right}px) !important;
        padding-bottom: max(18px, {bottom}px) !important;
        padding-left: max(18px, {left}px) !important;
      }}
    """)


def game_fixture(page, state: str) -> None:
    page.evaluate("""()=>{
      const p=puzzleDB?.free?.medium?.[0] || Object.values(puzzleDB?.free||{}).flat()[0];
      if(!p) throw new Error('No Free puzzle loaded');
      startGame(p,'free');
    }""")
    page.wait_for_function("document.body.classList.contains('playing') && !!document.querySelector('#board .cell')")
    page.wait_for_timeout(350)
    if state in ("game-progress", "game-hint"):
        page.evaluate("""()=>{
          const a=currentGame?.puzzle?.answers?.[0];
          if(!a) throw new Error('No answer for progress fixture');
          currentGame.path=[...a.path];
          submitPath();
        }""")
        page.wait_for_timeout(250)
    if state == "game-hint":
        page.evaluate("""()=>{
          const answer=currentGame?.puzzle?.answers?.find((a,i)=>!currentGame.found?.some?.(f=>f.answerIndex===i)) || currentGame?.puzzle?.answers?.[1];
          (answer?.path||[]).slice(0,4).forEach((idx,n)=>{
            const cell=document.querySelector('#board .cell[data-index="'+idx+'"]');
            if(cell){cell.classList.add('hint-route');cell.dataset.hintOrder=String(n+1)}
          });
          const msg=document.querySelector('#gameMessage');
          if(msg) msg.textContent='Nápověda ukazuje začátek cesty.';
        }""")
        page.wait_for_timeout(180)
    page.evaluate("""(state)=>{try{if(typeof stopTimer===\'function\')stopTimer()}catch(e){}const t=document.querySelector(\'#timer\');if(t)t.textContent=state===\'game-pre\'?\'00:00\':\'00:01\'}""",state)


def result_fixture(page, comparison: bool) -> None:
    game_fixture(page, "game-progress")
    page.evaluate("""(comparison)=>{
      const modal=document.querySelector('#winModal');
      modal.classList.remove('hidden');
      modal.classList.toggle('comparison-loaded',comparison);
      document.querySelector('#winBadge').textContent='🧩';
      document.querySelector('#winTitle').textContent='Hotovo!';
      const praise=document.querySelector('#winPraise');praise.textContent='Pěkně sis s tím poradil.';praise.classList.remove('hidden');
      document.querySelector('#winText').textContent='1:23 · 18 tahů · Střední';
      const xp=document.querySelector('#winXp');xp.textContent='+25 XP';xp.classList.remove('hidden');
      const clean=document.querySelector('#winClean');clean.textContent='✨ Čistě';clean.classList.remove('hidden','hinted');
      const words=document.querySelector('#winWords');words.innerHTML='<span class="win-word">JABLKO</span><span class="win-word">MRAK</span><span class="win-word">AUTO</span>';
      document.querySelector('#winPrimaryBtn').textContent='Hrát další';
      for(const id of ['winShareBtn','winReplayBtn','winMenuBtn']) document.querySelector('#'+id)?.classList.remove('hidden');
      const box=document.querySelector('#levelLeaderboardBox');
      box.classList.remove('hidden');
      box.innerHTML='<div class="level-board-head"><div><strong>Pořadí této úrovně</strong><small>Stejná deska, stejné podmínky</small></div><span>5. místo</span></div><div class="daily-world-neighbours"><div class="mini-leader-row"><b>4.</b><span><strong>Soupeř</strong><small>1:17 · čistě</small></span><em>420</em></div><div class="mini-leader-row mine"><b>5.</b><span><strong>Ty</strong><small>1:23 · čistě</small></span><em>400</em></div><div class="mini-leader-row"><b>6.</b><span><strong>Soupeř</strong><small>1:31 · 1 nápověda</small></span><em>365</em></div></div>';
      document.querySelector('#winDetails')?.removeAttribute('open');
    }""", comparison)
    page.wait_for_timeout(300)


def metrics(page, case: dict) -> dict:
    return page.evaluate("""(caseId)=>{
      const r=e=>{if(!e)return null;const x=e.getBoundingClientRect();return {x:+x.x.toFixed(2),y:+x.y.toFixed(2),width:+x.width.toFixed(2),height:+x.height.toFixed(2)}};
      const css=e=>e?getComputedStyle(e):null;
      const main=document.querySelector('.game-main'),stage=document.querySelector('#boardStage'),control=document.querySelector('.game-control-column'),cw=document.querySelector('.current-word'),cell=document.querySelector('#board .cell'),win=document.querySelector('#winModal .win-card'),title=document.querySelector('#winTitle'),utility=document.querySelector('.win-secondary-actions .win-utility-btn:not(.hidden)');
      const action=document.querySelector('.game-actions .secondary-btn:not(.hidden)');
      return {
        caseId,
        theme:document.documentElement.dataset.theme||null,
        themePreference:document.documentElement.dataset.themePreference||null,
        layoutMode:document.documentElement.dataset.gameLayoutMode||null,
        bodyClasses:document.body.className,
        overflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        viewport:{width:innerWidth,height:innerHeight},
        gameMain:r(main),gameMainColumns:css(main)?.gridTemplateColumns||null,
        boardStage:r(stage),control:r(control),currentWord:r(cw),
        currentWordFont:css(cw?.querySelector('strong'))?.fontSize||null,
        cellFont:css(cell)?.fontSize||null,
        gameAction:r(action),
        winCard:r(win),winTitleFont:css(title)?.fontSize||null,winUtility:r(utility),
        mainSecondaryGap:(()=>{const a=document.querySelector('#winModal .win-main-actions'),b=document.querySelector('#winModal .win-secondary-actions');if(!a||!b)return null;return +(b.getBoundingClientRect().top-a.getBoundingClientRect().bottom).toFixed(2)})(),
        loadedStyles:[...document.styleSheets].map(s=>{try{return new URL(s.href).pathname}catch{return null}}).filter(Boolean)
      };
    }""", case["id"])


def main() -> int:
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--public-root",type=Path,default=PUBLIC)
    parser.add_argument("--baseline",type=Path)
    args=parser.parse_args()
    out=args.output.resolve();out.mkdir(parents=True,exist_ok=True)
    public_root=args.public_root.resolve()
    matrix=json.loads(MATRIX.read_text(encoding="utf-8"))
    port=free_port()
    server=subprocess.Popen([sys.executable,"-m","http.server",str(port),"--bind","127.0.0.1","--directory",str(public_root)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    base=f"http://127.0.0.1:{port}"
    results={}
    try:
        wait_http(base+"/")
        with sync_playwright() as pw:
            chrome=next((p for p in ("/usr/bin/google-chrome","/usr/bin/google-chrome-stable","/usr/bin/chromium","/usr/bin/chromium-browser") if os.path.exists(p)),None)
            browser=pw.chromium.launch(headless=True,executable_path=chrome,args=["--no-sandbox","--disable-dev-shm-usage","--disable-font-subpixel-positioning","--font-render-hinting=none","--disable-lcd-text"] if chrome else [])
            for case in matrix["cases"]:
                w,h=case["viewport"];sw,sh=case["screen"]
                touch=w<900
                ctx=browser.new_context(
                    viewport={"width":w,"height":h},screen={"width":sw,"height":sh},
                    has_touch=touch,is_mobile=touch,service_workers="block",device_scale_factor=1,
                    color_scheme=case["system"],reduced_motion=case["motion"]
                )
                theme=case["theme"]
                ctx.add_init_script(script=f"""()=>{{try{{localStorage.setItem('proplet-v3-settings',JSON.stringify({{theme:{json.dumps(theme)}}}));localStorage.setItem('proplet-onboarding-v1','done');localStorage.setItem('proplet-helper-onboarding-v1','done');sessionStorage.setItem('proplet-gen4-release-modal-v1','1')}}catch(e){{}}}}""")
                page=ctx.new_page();page_errors=[]
                page.on("pageerror",lambda e, bag=page_errors: bag.append(str(e)))
                page.goto(base,wait_until="domcontentloaded",timeout=30000)
                page.wait_for_function("typeof startGame==='function' && !!puzzleDB?.free?.medium?.[0]",timeout=15000)
                dismiss_overlays(page)
                apply_safe_area_fixture(page,case["safe_area"])
                state=case["state"]
                if state.startswith("result"):
                    result_fixture(page,state=="result-comparison")
                else:
                    game_fixture(page,state)
                page.wait_for_function("document.documentElement.dataset.theme === "+json.dumps(case["system"] if theme=="auto" else theme))
                page.evaluate("()=>document.fonts?.ready")
                page.wait_for_timeout(450)
                m=metrics(page,case)
                if m["overflowX"]>1:
                    raise AssertionError(f"{case['id']}: horizontal overflow {m['overflowX']}")
                shot=out/f"{case['id']}.png"
                page.screenshot(path=str(shot),full_page=True,animations="disabled")
                digest=hashlib.sha256(shot.read_bytes()).hexdigest()
                if page_errors:
                    raise AssertionError(f"{case['id']}: page errors: {page_errors}")
                results[case["id"]]={"sha256":digest,"metrics":m}
                ctx.close()
            browser.close()
    finally:
        server.terminate()
        try: server.wait(timeout=3)
        except subprocess.TimeoutExpired: server.kill()

    summary={"schema_version":1,"matrix":matrix,"results":results}
    (out/"summary.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

    if args.baseline and args.baseline.is_file():
        baseline=json.loads(args.baseline.read_text(encoding="utf-8"))
        expected=baseline.get("results",{})
        failures=[]
        for case_id,row in results.items():
            old=expected.get(case_id)
            if not old:
                failures.append(f"{case_id}: missing baseline")
                continue
            if row["sha256"]!=old.get("sha256"):
                failures.append(f"{case_id}: screenshot hash changed {old.get('sha256')} -> {row['sha256']}")
            # Structural metrics get a tiny rounding tolerance; screenshot equality remains the strongest gate.
            om=old.get("metrics",{});nm=row["metrics"]
            for key in ("theme","themePreference","layoutMode","gameMainColumns"):
                if key in om and om.get(key)!=nm.get(key): failures.append(f"{case_id}: {key} {om.get(key)!r} -> {nm.get(key)!r}")
        if failures:
            print("\n".join("VISUAL DIFF "+x for x in failures))
            return 1
    print(json.dumps({k:v["sha256"] for k,v in results.items()},indent=2))
    return 0


if __name__=="__main__":
    raise SystemExit(main())
