"""Real Chromium pointer/touch checks of isolated eight-board static output.

Only loopback static files and synthetic localStorage. Never opens a user account
or writes a result to any server. Viewport/touch emulation, not a physical Fold.
"""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import traceback
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--chromium',default=None)
    args=ap.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    static=ROOT/'.vercel/output/static'
    class Quiet(SimpleHTTPRequestHandler):
        def log_message(self,*_):pass
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(static)))
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    origin=f'http://127.0.0.1:{server.server_port}'
    report={'environment':'loopback-only-static','physicalDeviceTested':False,'checks':[],'errors':[],'screenshots':[]}
    requests=[];mp=None
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path=args.chromium)
        context=browser.new_context(viewport={'width':1440,'height':1080})
        page=context.new_page();page.set_default_timeout(12000)
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('request',lambda r:requests.append((r.method,r.url,r.resource_type)))
        def open_menu(p):
            p.goto(origin,wait_until='domcontentloaded');p.locator('#previewBoards button').first.wait_for()
            assert p.locator('#previewBoards button').count()==8
        def draw_mouse(path):
            positions=[]
            for cell in path:
                box=page.locator(f'#board .cell[data-index="{cell}"]').bounding_box()
                positions.append((box['x']+box['width']/2,box['y']+box['height']/2))
            page.mouse.move(*positions[0]);page.mouse.down()
            for x,y in positions[1:]:page.mouse.move(x,y,steps=2)
            page.mouse.up()
        try:
            open_menu(page)
            page.screenshot(path=str(args.output/'menu-desktop.png'))
            page.locator('#previewBoards button').first.click()
            page.wait_for_function('currentGame && document.querySelectorAll("#board .cell").length===100')
            answers=page.evaluate('currentGame.puzzle.answers')
            draw_mouse(answers[0]['path']);page.wait_for_function('currentGame.found.length===1')
            assert '1 tah'==page.locator('#moves').inner_text()
            page.reload(wait_until='domcontentloaded');page.locator('#previewBoards button').first.click()
            assert page.evaluate('currentGame.found.length')==1
            report['checks'].append('real-mouse-word-and-reload-progress')
            for width,height,name in [(320,820,'narrow'),(390,844,'mobile'),(768,1024,'fold'),(1440,1080,'desktop')]:
                page.set_viewport_size({'width':width,'height':height})
                for theme in ('light','dark'):
                    page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme);page.wait_for_timeout(150)
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(name,theme,'overflow')
                    assert page.locator('#hintBtn').is_visible()
                    filename=f'board-{name}-{theme}.png';page.screenshot(path=str(args.output/filename),full_page=True)
                    report['screenshots'].append(filename)
            page.set_viewport_size({'width':1440,'height':1080})
            page.evaluate("document.documentElement.dataset.theme='light'")
            # Complete every board through actual pointer gestures, not by
            # setting found/finished or invoking the completion callback.
            finished=[]
            for ordinal in range(8):
                answers=page.evaluate('currentGame.puzzle.answers.filter(a=>!currentGame.found.some(f=>f.word===a.word))')
                for answer in answers:
                    before=page.evaluate('currentGame.found.length')
                    draw_mouse(answer['path'])
                    page.wait_for_function('(n)=>currentGame.found.length===n+1',arg=before)
                page.locator('#finishModal:not(.hidden)').wait_for()
                assert page.evaluate('currentGame.found.length')==14
                finished.append(page.evaluate('currentGame.puzzle.id'))
                if ordinal==0:page.screenshot(path=str(args.output/'first-complete.png'),full_page=True)
                page.locator('#nextBoard').click()
            assert page.locator('#screen-preview').evaluate('el=>el.classList.contains("active")')
            assert page.locator('#previewBoards .done').count()==8
            report['completedThroughPointer']=finished
            report['checks']+=['all-eight-real-pointer-completions','all-eight-menu-done','320-390-768-1440-light-dark-no-overflow']
            # Real CDP touch events in an independent mobile context.
            mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
            mp=mobile.new_page();mp.set_default_timeout(12000)
            mp.add_init_script('window.__touchEvents=[]; for(const type of ["pointerdown","pointerup","click"]) document.addEventListener(type,e=>{if(e.target.closest?.("button"))window.__touchEvents.push({type,id:e.target.closest("button").id,text:e.target.textContent?.slice(0,50)});},true)')
            mp.on('pageerror',lambda e:report['errors'].append(str(e)))
            mp.on('request',lambda r:requests.append((r.method,r.url,r.resource_type)))
            open_menu(mp);mp.locator('#previewBoards button').first.tap();mp.wait_for_timeout(250)
            cdp=mobile.new_cdp_session(mp)
            answer=mp.evaluate('currentGame.puzzle.answers[0]')
            points=[]
            for cell in answer['path']:
                box=mp.locator(f'#board .cell[data-index="{cell}"]').bounding_box()
                points.append({'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':1})
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[points[0]]})
            for point in points[1:]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[point]})
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            mp.wait_for_function('currentGame.found.length===1')
            mp.locator('#hintBtn').tap()
            report['afterHintTap']=mp.evaluate('({events:window.__touchEvents,modal:document.querySelector("#hintModal").className,found:currentGame.found.length,dragging:currentGame.dragging,hints:currentGame.hints})')
            mp.locator('#hintModal:not(.hidden)').wait_for()
            mp.locator('#hintChoices button').first.tap();mp.wait_for_timeout(400)
            assert mp.evaluate('currentGame.hints')==1
            mp.locator('#calmRunBtn').tap();mp.wait_for_timeout(400)
            assert mp.locator('.game-clock').evaluate('el=>getComputedStyle(el).visibility')=='hidden'
            mp.locator('#calmRunBtn').tap();mp.wait_for_timeout(400)
            assert mp.locator('.game-clock').evaluate('el=>getComputedStyle(el).visibility')=='visible'
            mp.reload(wait_until='domcontentloaded');mp.locator('#previewBoards button').first.tap()
            assert mp.evaluate('currentGame.found.length')==1
            assert mp.evaluate('currentGame.hints')==1
            mp.screenshot(path=str(args.output/'touch-mobile-restored.png'),full_page=True)
            report['checks']+=['emulated-touch-drag','hint','calm-hide-and-show','mobile-reload-progress-and-hint']
            # The actual coarse-pointer Fold layout differs from a resized desktop.
            mp.set_viewport_size({'width':768,'height':1024})
            mp.wait_for_function('document.documentElement.dataset.gameLayoutMode==="tablet-portrait-rail"')
            answer=mp.evaluate('currentGame.puzzle.answers.find(a=>!currentGame.found.some(f=>f.word===a.word))')
            points=[]
            for cell in answer['path']:
                box=mp.locator(f'#board .cell[data-index="{cell}"]').bounding_box()
                points.append({'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':1})
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[points[0]]})
            for point in points[1:]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[point]})
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            mp.wait_for_function('currentGame.found.length===2')
            mp.locator('#hintBtn').tap();mp.locator('#hintModal:not(.hidden)').wait_for()
            mp.locator('#hintModal [data-close]').tap();mp.wait_for_timeout(400)
            assert not mp.locator('#hintModal').is_visible()
            assert mp.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            mp.locator('#calmRunBtn').focus();mp.keyboard.press('Enter')
            assert mp.locator('.game-clock').evaluate('el=>getComputedStyle(el).visibility')=='hidden'
            mp.keyboard.press('Enter')
            assert mp.locator('.game-clock').evaluate('el=>getComputedStyle(el).visibility')=='visible'
            mp.screenshot(path=str(args.output/'touch-fold-restored.png'),full_page=True)
            report['checks']+=['coarse-fold-layout-and-touch-drag','touch-hint-close','keyboard-activation','no-delayed-double-hint-or-toggle']
            mobile.close()
            assert not [r for r in requests if r[0]!='GET' or '/api/' in r[1] or r[2] in ('fetch','xhr','websocket')]
            report['checks'].append('zero-gameplay-network-or-result-writes')
            if report['errors']:raise AssertionError(report['errors'])
            report['status']='PASS'
        except Exception:
            report['status']='FAIL';report['failure']=traceback.format_exc()
            page.screenshot(path=str(args.output/'failure.png'),full_page=True)
            if mp and not mp.is_closed():
                mp.screenshot(path=str(args.output/'mobile-failure.png'),full_page=True)
                report['mobileFailureState']=mp.evaluate('({events:window.__touchEvents,modal:document.querySelector("#hintModal")?.className,found:currentGame?.found.length,dragging:currentGame?.dragging,hints:currentGame?.hints,body:document.body.className})')
        finally:
            browser.close();server.shutdown()
    (args.output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False));assert report['status']=='PASS'


if __name__=='__main__':main()
