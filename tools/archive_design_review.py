"""Focused browser proof for the October 13 design feedback; isolated preview only."""
import functools, http.server, json, os, pathlib, subprocess, threading
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/review-evidence'; OUT.mkdir(exist_ok=True)
report={'testedSha':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'checks':[],'pageErrors':[],'writes':[]}
class Fixture(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if self.path.startswith('/api/'):
            self.send_response(503);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{"detail":"isolated design review"}');return
        super().do_GET()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Fixture,directory=str(ROOT/'public')))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
def layout(page):
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
def shot(page,name,full=True):page.screenshot(path=str(OUT/(name+'.png')),full_page=full,animations='disabled')
try:
    with sync_playwright() as p:
        options={}
        if os.environ.get('PROPLET_BROWSER_EXECUTABLE'):options={'executable_path':os.environ['PROPLET_BROWSER_EXECUTABLE'],'args':['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote']}
        browser=p.chromium.launch(**options)
        for width,height in [(320,720),(390,844),(690,950),(1440,950)]:
            ctx=browser.new_context(viewport={'width':width,'height':height},reduced_motion='reduce')
            page=ctx.new_page();page.set_default_timeout(20000)
            page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
            page.on('request',lambda r:report['writes'].append(r.url) if r.method not in ['GET','HEAD'] else None)
            page.goto(base+'/?archive-preview=1&review=announcement&reviewExtra=hardcore',wait_until='domcontentloaded')
            page.wait_for_selector('#archiveExperienceModal .ax-release-extra');page.evaluate('document.fonts.ready')
            page.wait_for_function("[...document.querySelectorAll('.ax-release img')].every(i=>i.complete&&i.naturalWidth)")
            geometry=page.locator('.ax-release-heading').evaluate("""e=>{const h=e.querySelector('h3'),a=e.querySelector('.ax-release-archive-art');return {fits:h.scrollWidth<=h.clientWidth+1,noOverlap:h.getBoundingClientRect().right<=a.getBoundingClientRect().left+1}}""")
            assert all(geometry.values()),(width,geometry)
            assert page.locator('.ax-release').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
            layout(page);shot(page,'design-announcement-'+str(width),False)
            page.locator('.ax-release [data-archive-action="extra"]').click()
            assert page.evaluate("currentScreen==='daily'&&dailySpecialUI().getState().selected==='special'")
            page.evaluate('PropletArchiveExperience.announcement()')
            page.locator('.ax-release [data-archive-action="enter"]').click()
            page.wait_for_selector('#screen-archive.active .ax-board');layout(page)
            assert page.locator('.ax-board').first.bounding_box()['y']<height*.72
            page.locator('#axSearch').fill('88');assert page.locator('[data-archive-board="g3-e-088"]').count()==1
            page.locator('#axSearch').fill('');shot(page,'design-archive-'+str(width))
            if width==390:
                # Actual off-day selection must open useful information, not silently leave base selected.
                page.goto(base+'/?archive-preview=1&review=announcement&reviewExtra=live',wait_until='domcontentloaded')
                page.wait_for_selector('.ax-release [data-archive-action="extra"]');page.locator('.ax-release [data-archive-action="extra"]').click()
                assert page.locator('#dailyWeekDialog').is_visible()
                assert '100 XP' in page.locator('#dailyWeekDialog').inner_text()
                page.locator('[data-close-daily-week]').click()
                page.evaluate("applyTheme('dark',{persist:true});PropletArchiveExperience.announcement()")
                shot(page,'design-announcement-dark-390',False)
            page.evaluate("PropletArchiveExperience.closeModal(); applyTheme('light',{persist:true}); updateAccountProfile({stats:{...getProfile().stats,points:158000}}); nav('profile'); renderProfile()")
            page.wait_for_selector('#profileContinuation:not([hidden])')
            assert page.locator('#profileContinuation .pc-seal').inner_text()=='8'
            page.wait_for_function("[...document.querySelectorAll('#profileContinuation img')].every(i=>i.complete&&i.naturalWidth===512)")
            page.locator('#profileContinuation').scroll_into_view_if_needed(); layout(page)
            shot(page,'release-continuation-'+str(width),False)
            page.locator('[data-pc-chapter]').click()
            assert 'Kapitola 8' in page.locator('#pcDetailTitle').inner_text()
            layout(page); shot(page,'release-chapter-'+str(width),False)
            page.keyboard.press('Escape')
            assert page.locator('[data-pc-chapter]').evaluate('(e)=>document.activeElement===e')
            for points,chapter in [(119999,None),(120000,1),(124999,1),(125000,2),(150000,7),(250000,27),(300000,37)]:
                page.evaluate('(points)=>{updateAccountProfile({stats:{...getProfile().stats,points}});renderProfile()}',points)
                assert page.locator('#profileContinuation').is_visible()==(chapter is not None)
                if chapter: assert page.locator('#profileContinuation .pc-seal').inner_text()==str(chapter)
                layout(page)
            page.locator('[data-pc-milestone="300000"]').click()
            assert 'Další obzor' in page.locator('#pcDetailTitle').inner_text()
            page.keyboard.press('Escape')
            page.evaluate("updateAccountProfile({stats:{...getProfile().stats,points:950000}});renderProfile()")
            page.locator('[data-pc-collection]').click()
            assert page.locator('#continuationDetail .pc-milestone').count()==12
            page.locator('[data-pc-page="1"]').click()
            assert page.locator('#continuationDetail .pc-milestone').count()==7
            page.keyboard.press('Escape')
            page.evaluate("PropletContinuation.renderProfile({...getProfile(),stats:{points:119999}},{points:250000})")
            assert page.locator('#profileContinuation').is_hidden()
            page.evaluate("updateAccountProfile({stats:{...getProfile().stats,points:124999}});renderProfile(); document.querySelector('#winModal').classList.remove('hidden'); updateAccountProfile({stats:{...getProfile().stats,points:125000}});renderProfile()")
            assert 'Kapitola 2 otevřena.' in page.locator('#continuationWin').inner_text()
            page.locator('[data-pc-celebration]').click()
            assert 'Kapitola 2 otevřena.' in page.locator('#pcDetailTitle').inner_text()
            page.keyboard.press('Escape')
            page.evaluate("document.querySelector('#winModal').classList.add('hidden');renderProfile()")
            assert page.locator('#continuationWin').count()==0
            page.evaluate("PropletContinuation.renderProfile({...getProfile(),id:'another-review-player',stats:{points:158000}},{});")
            assert page.locator('#continuationWin').count()==0
            page.evaluate("PropletContinuation.renderProfile(null,{points:300000})")
            assert page.locator('#profileContinuation').is_hidden()
            assert page.locator('.pc-future').count()==0
            report['checks'].append({'width':width,'nativeConfirmedXpBoundariesFocusPagination':'PASS'})
            page.goto(base+'/design/progression-continuation.html',wait_until='networkidle')
            stored=page.evaluate('JSON.stringify(localStorage)')
            layout(page)
            assert page.locator('#newCard .chapter-seal').inner_text()=='8'
            page.wait_for_function('[...document.images].every(i=>i.complete&&i.naturalWidth)')
            shot(page,'design-progression-'+str(width))
            page.locator('#celebrateChapter').click();assert 'Kapitola 9' in page.locator('#detailTitle').inner_text()
            assert page.locator('#xp').input_value()=='158000'
            layout(page);shot(page,'design-chapter-celebration-'+str(width),False)
            page.keyboard.press('Escape');assert page.locator('#celebrateChapter').evaluate('(e)=>document.activeElement===e')
            for points,chapter in [(119999,None),(120000,1),(124999,1),(125000,2),(150000,7),(250000,27),(300000,37)]:
                page.locator('#sample').select_option(str(points))
                seal=page.locator('#newCard .chapter-seal')
                assert (seal.count()==0) if chapter is None else (seal.inner_text()==str(chapter))
                assert page.locator('#celebrateChapter').is_disabled()==(chapter is None)
                layout(page)
            page.locator('[data-milestone="300000"]').click()
            page.wait_for_function("document.querySelector('.illustrated-detail').complete&&document.querySelector('.illustrated-detail').naturalWidth===512")
            assert 'Další obzor' in page.locator('#detailTitle').inner_text()
            page.keyboard.press('Escape')
            page.locator('#allAchievements').click();assert page.locator('.legacy-list li').count()==13
            assert page.evaluate('JSON.stringify(localStorage)')==stored
            report['checks'].append({'width':width,'height':height,'announcementDestinations':'PASS','archiveDensityAndSearch':'PASS','chapterBoundariesAndCelebration':'PASS','artAndLegacyCollection':'PASS'})
            ctx.close()
        browser.close()
    assert not report['pageErrors'],report['pageErrors']
    assert not report['writes'],report['writes']
    report['result']='PASS'
except Exception as e:
    report['result']='FAIL';report['error']=str(e)
    raise
finally:
    server.shutdown();(OUT/'design-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
