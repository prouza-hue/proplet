import json, os, time, urllib.request
from playwright.sync_api import sync_playwright

from urllib.parse import urlparse
URL=os.environ.get('TEST_URL','http://127.0.0.1:8765').rstrip('/')
assert urlparse(URL).hostname in ('localhost','127.0.0.1','::1'), 'loopback fixture required'
CHROME=os.environ.get('CHROME_PATH')
OUT=os.environ.get('SMOKE_OUT','artifacts/printshop-smoke');os.makedirs(OUT,exist_ok=True)

deadline=time.time()+120
while True:
    try:
        with urllib.request.urlopen(URL+'/api/health?qa='+str(time.time()),timeout=8) as r:
            health=json.loads(r.read().decode('utf-8'))
        if health.get('ok') is True and health.get('isolatedFixture') is True and health.get('sha') == os.environ['EXPECTED_SHA']:
            break
    except Exception:
        pass
    if time.time()>deadline:
        raise AssertionError('isolated checkout identity did not match EXPECTED_SHA')
    time.sleep(2)

def settle_returning_player(page):
    # The smoke tests the returning-player application, not onboarding.
    # Wait until the real onboarding patches have finished installing,
    # then close through the canonical production function so no later
    # async installer can reopen the modal and invalidate navigation.
    page.wait_for_function("()=>window.__PROPLET_ONBOARDING_MODEL_V3328__===true && window.__PROPLET_ONBOARDING_RETURN_V3332__===true",timeout=8000)
    page.evaluate("""()=>{
      try{
        localStorage.setItem('proplet-v3-7-required-onboarding','done');
        localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');
        localStorage.setItem('proplet-v3-32-8-rule-principle-seen','1');
        sessionStorage.setItem('proplet-gen4-release-modal-v1','1');
      }catch(e){}
      try{if(typeof closeOnboarding==='function')closeOnboarding(true)}catch(e){}
      window.PropletRefreshRelease?.close();
      window.PropletContentRelease?.close();
      document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));
      document.querySelector('.release-notes-v3331-backdrop')?.remove();
      document.body.classList.remove('release-notes-v3331-open');
      document.documentElement.classList.remove('gen4-preview-booting');
    }""")
    page.wait_for_function("()=>document.querySelector('#onboardingModal')?.classList.contains('hidden')!==false",timeout=5000)

result={'health':health}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=CHROME,args=['--no-sandbox','--disable-dev-shm-usage'])
    for label,viewport in [
        ('mobile',{'width':390,'height':844}),
        ('fold',{'width':768,'height':1000}),
        ('desktop',{'width':1440,'height':900}),
    ]:
        ctx=browser.new_context(viewport=viewport)
        # Seed canonical returning-player keys before any app script runs.
        ctx.add_init_script("""(()=>{
          try{
            localStorage.setItem('proplet-v3-7-required-onboarding','done');
            localStorage.setItem('proplet-v3-16-2-helper-onboarding','done');
            localStorage.setItem('proplet-v3-32-8-rule-principle-seen','1');
            sessionStorage.setItem('proplet-gen4-release-modal-v1','1');
            localStorage.setItem('proplet:content-release:g5-r1','1');
            localStorage.setItem('proplet:content-release:mk100-v2','1');
            localStorage.setItem('proplet:content-release:refresh300-v1','1');
          }catch(e){}
        })()""")
        page=ctx.new_page(); errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(URL,wait_until='domcontentloaded',timeout=30000)
        page.wait_for_function("()=>document.documentElement.classList.contains('tiskarna-ui')",timeout=15000)
        # Boot-ready invariant: renderFree() runs only after bind(), so a
        # populated difficulty grid means bottom-nav listeners are attached.
        page.wait_for_function("()=>typeof startGame==='function' && !!puzzleDB?.free?.medium?.[0] && document.querySelectorAll('#difficultyCards [data-play-free]').length>=4",timeout=15000)
        settle_returning_player(page)
        consent=page.get_by_role('button',name='Ne, díky',exact=True)
        if consent.is_visible(): consent.click()
        page.wait_for_timeout(250)

        base=page.evaluate("""()=>({
          overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
          dailyActive:document.querySelector('#screen-daily')?.classList.contains('active'),
          dailyVisible:!!document.querySelector('#playDailyBtn')&&getComputedStyle(document.querySelector('#playDailyBtn')).display!=='none',
          shareHidden:document.querySelector('#shareDailyBtn')?.classList.contains('hidden')===true,
          updateHidden:document.querySelector('#updateBanner')?.classList.contains('hidden')===true,
          printshopCss:[...document.styleSheets].some(s=>(s.href||'').includes('printshop-ui.css')),
          typographyCss:[...document.styleSheets].some(s=>(s.href||'').includes('typography-readability-v1.css')),
        })""")
        assert base['overflow']<=1,base
        assert base['dailyActive'] and base['dailyVisible'],base
        assert base['shareHidden'],base
        assert base['updateHidden'],base
        assert base['printshopCss'] and base['typographyCss'],base

        news=page.evaluate("""()=>{
          const today=document.querySelector('#todayNewContentBanner'),free=document.querySelector('#newContentBanner');
          return {
            directlyBelowDaily:document.querySelector('.daily-hero').nextElementSibling===document.querySelector('#mozkokalypsaInvite') && document.querySelector('#mozkokalypsaInvite').nextElementSibling===document.querySelector('#freeRefreshToday') && document.querySelector('#freeRefreshToday').nextElementSibling===today,
            pilotHidden:document.querySelector('#mozkokalypsaInvite').classList.contains('hidden'),
            separated:today.classList.contains('hidden') || today.getBoundingClientRect().top-document.querySelector('.daily-hero').getBoundingClientRect().bottom>=12,
            sameVisibility:today.classList.contains('hidden')===free.classList.contains('hidden'),
            sameContent:today.textContent===free.textContent,
            sameArtwork:today.querySelector('img')?.getAttribute('src')===free.querySelector('img')?.getAttribute('src'),
            noHeading:!document.querySelector('#quickPlayCard .quick-play-head'),
            noEyebrow:!today.querySelector('.eyebrow'),
            uniqueActions:document.querySelectorAll('#playNewContentBtn').length<=1 && document.querySelectorAll('#playTodayNewContentBtn').length<=1
          };
        }""")
        assert all(news.values()),news

        page.evaluate("window.__propletSmokeSentinel='alive'")
        for target in ('free','leaderboard','profile','daily'):
            page.locator(f'.bottom-nav [data-nav="{target}"]').click()
            page.wait_for_timeout(250)
            state=page.evaluate("""target=>({
              active:document.querySelector('#screen-'+target)?.classList.contains('active')===true,
              sentinel:window.__propletSmokeSentinel,
              updateHidden:document.querySelector('#updateBanner')?.classList.contains('hidden')===true,
            })""",target)
            assert state['active'] and state['sentinel']=='alive' and state['updateHidden'],(target,state)

        page.locator('.bottom-nav [data-nav="free"]').click();page.wait_for_timeout(250)
        free=page.evaluate("""()=>({
          calmQuick:!!document.querySelector('#freeCalmQuick'),
          cards:document.querySelectorAll('#difficultyCards [data-play-free]').length,
          mozkomorCopy:document.querySelector('[data-diff="mozkomor"]')?.innerText.includes('a vypusť Mozkomora')||false,
          mozkomorCounter:!!document.querySelector('[data-diff="mozkomor"] [role="progressbar"][aria-valuemax="200"]'),
          oldLockNote:!!document.querySelector('.mozkomor-lock-note'),
        })""")
        assert not free['calmQuick'] and free['cards']==6 and not free['mozkomorCopy'] and not free['mozkomorCounter'] and not free['oldLockNote'],free

        page.evaluate("()=>startGame(puzzleDB.free.medium[0],'free')")
        page.wait_for_function("()=>document.body.classList.contains('playing') && document.querySelectorAll('#board .cell').length>0",timeout=8000)
        page.screenshot(path=f'{OUT}/{label}.png',full_page=True)
        result[label]={'base':base,'free':free,'errors':errors}
        assert not errors,(label,errors)
        ctx.close()
    browser.close()

with open(f'{OUT}/summary.json','w',encoding='utf-8') as f: json.dump(result,f,ensure_ascii=False,indent=2)
print(json.dumps(result,ensure_ascii=False,indent=2))

