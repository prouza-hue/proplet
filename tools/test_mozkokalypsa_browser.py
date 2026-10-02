"""Real Chromium/native-game QA. Never uses a production origin or real account."""
import argparse,json,os,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
origin='http://127.0.0.1:8765'
report={'nativeGame':True,'syntheticOnly':True,'checks':[],'errors':[]}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True)
 context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1)
 context.add_init_script("localStorage.setItem('proplet:content-release:mk100-v2','1')")
 page=context.new_page();page.set_default_timeout(15000)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 requests=[];page.on('request',lambda r:requests.append({'url':r.url,'method':r.method}))
 try:
  page.goto(origin+'/?mozkokalypsa=preview',wait_until='domcontentloaded')
  page.locator('#mozkokalypsaInvite:not(.hidden)').wait_for();page.wait_for_function('!!puzzleDB && !document.documentElement.classList.contains("proplet-current-ui-booting") && !document.getElementById("propletBootScreen") && typeof document.querySelector("#mkInviteButton")?.onclick==="function"');page.wait_for_timeout(500)
  page.screenshot(path=str(args.output/'01-invite-mobile.png'),full_page=True)
  page.evaluate("document.documentElement.dataset.theme='dark'")
  page.screenshot(path=str(args.output/'01b-invite-dark-mobile.png'),full_page=True)
  page.evaluate("document.documentElement.dataset.theme='light'")
  assert page.locator('#onboardingModal').get_attribute('class').find('hidden')>=0
  baseline=page.evaluate('JSON.stringify({completed:getState().completed,inProgress:getState().inProgress,queue:getQueue()})')
  page.locator('#mkInviteButton').click();page.locator('#mkBoardList button').first.click()
  page.wait_for_function("currentGame?.mode==='playtest' && currentScreen==='game'")
  # One word through actual pointer gestures, using the frozen path as a test oracle.
  path=page.evaluate('currentGame.puzzle.answers[0].path')
  points=[]
  for cell in path:
   box=page.locator(f'#board > .cell[data-index="{cell}"]').bounding_box();points.append((box['x']+box['width']/2,box['y']+box['height']/2))
  page.mouse.move(*points[0]);page.mouse.down()
  for point in points[1:]:page.mouse.move(*point,steps=2)
  page.mouse.up();page.wait_for_timeout(250)
  assert page.evaluate('currentGame.found.length')==1,'Native pointer path did not submit'
  report['checks'].append('real-pointer-submission')
  page.locator('#hintBtn').click();page.locator('.hint-choice').first.click()
  assert page.evaluate('currentGame.hints')==1
  page.locator('#calmRunBtn').click()
  if page.locator('#confirmCalmBtn').is_visible():page.locator('#confirmCalmBtn').click()
  assert page.evaluate('currentGame.calmMode') is True
  page.evaluate("nav('daily')")
  first_id=page.evaluate('currentGame.puzzle.id')
  page.reload(wait_until='domcontentloaded');page.wait_for_function('!!puzzleDB');page.locator('#mkInviteButton').click();page.locator('#mkBoardList button').first.click()
  page.wait_for_function("currentGame?.mode==='playtest'")
  assert page.evaluate('currentGame.found.length')==1
  assert page.evaluate('currentGame.hints')==1
  assert page.evaluate('currentGame.calmMode') is True
  report['checks'].append('reload-resume-with-hint-and-calm')
  for n in range(12):
   page.wait_for_function("currentGame?.mode==='playtest' && !currentGame.finished")
   if n==1:
    assert page.locator('#board > .cell').count()==100
    page.locator('#calmRunBtn:not(.hidden)').wait_for()
    page.wait_for_timeout(200)
    report['checks'].append('calm-button-restored-on-next-board')
    page.screenshot(path=str(args.output/'02-full-board-mobile.png'),full_page=True)
    touch=browser.new_context(viewport={'width':768,'height':1024},has_touch=True,is_mobile=True,storage_state=context.storage_state())
    tp=touch.new_page();tp.set_default_timeout(15000)
    tp.on('pageerror',lambda e:report['errors'].append(str(e)))
    tp.on('request',lambda r:requests.append({'url':r.url,'method':r.method}))
    tp.goto(origin+'/?mozkokalypsa=preview',wait_until='domcontentloaded')
    tp.wait_for_function('!!puzzleDB && !document.documentElement.classList.contains("proplet-current-ui-booting") && !document.getElementById("propletBootScreen") && typeof document.querySelector("#mkInviteButton")?.onclick==="function"')
    tp.locator('#mkInviteButton').click();tp.locator('#mkBoardList button').nth(1).click()
    tp.wait_for_function("currentGame?.mode==='playtest' && document.body.classList.contains('game-tablet-portrait')")
    tp.wait_for_timeout(250)
    assert tp.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    tp.screenshot(path=str(args.output/'03-full-board-fold-emulation.png'),full_page=True)
    report['checks'].append('touch-fold-portrait-rail')
    touch.close();page.bring_to_front()
    page.wait_for_function('currentGame.pausedAt===null')
    page.set_viewport_size({'width':1440,'height':1000});page.wait_for_timeout(100)
    page.screenshot(path=str(args.output/'04-full-board-desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
   # The remaining words use the native submitPath entry point, not finish stubs.
   page.evaluate("""() => {const g=currentGame; for(let i=0;i<g.puzzle.answers.length;i++){
    if(g.found.some(f=>f.answerIndex===i))continue;
    g.path=[...g.puzzle.answers[i].path];submitPath();
   }}""")
   page.locator('#mkResultModal:not(.hidden)').wait_for()
   if n==0:
    # Finish alone is reviewable later; empty rating cannot advance for a reward.
    page.locator('#mkResultNext').click()
    assert page.locator('#mkResultModal').is_visible()
    page.locator('#mkResultMenu').click()
    page.locator('#mkInviteButton').click()
    page.locator('#mkHubModal:not(.hidden)').wait_for()
    assert 'doplnit hodnocení' in page.locator('#mkBoardList button').first.inner_text()
    page.locator('#mkBoardList button').first.click()
    page.locator('#mkResultModal:not(.hidden)').wait_for()
    report['checks'].append('missing-ratings-block-reward-and-completed-board-reopens-for-review')
   page.locator('#mkRatingDifficulty').select_option('4');page.locator('#mkRatingFun').select_option('5')
   page.locator('#mkRatingNote').fill('Syntetický ověřovací běh. Nejde o hodnocení člověka.')
   if n==1:page.screenshot(path=str(args.output/'05-result-mobile.png'),full_page=True)
   page.locator('#mkResultNext').click()
  page.locator('#mkHubModal:not(.hidden)').wait_for()
  assert page.locator('#mkBoardList button').count()==12
  after=page.evaluate('JSON.stringify({completed:getState().completed,inProgress:getState().inProgress,queue:getQueue()})')
  assert baseline==after,'Playtest polluted normal progression or result queue'
  state=page.evaluate("JSON.parse(localStorage.getItem('proplet-playtest:mozkokalypsa-round2-20260925:qa'))")
  assert len(state['attempts'])==12 and all(a['completed'] for a in state['attempts'].values())
  assert all(a.get('feedback',{}).get('fun')==5 for a in state['attempts'].values())
  assert all(a['progress']['firstCorrectMs'] is not None for a in state['attempts'].values())
  for event in [e for a in state['attempts'].values() for e in a['events']]:
   assert event['progress']['elapsedMs']>=0
  assert not [r for r in requests if '/api/mozkokalypsa' in r['url'] and r['method']=='POST'],'QA sent server metrics'
  assert not [r for r in requests if any(x in r['url'] for x in ['/api/result','/api/attempt/','/api/word-discovery/claim']) and r['method']=='POST']
  report['checks']+=['all-12-native-completions','100-full-cells','feedback-local','first-word-timestamps','no-normal-XP-or-progress','no-QA-server-writes']
  report['previewState']=state
  page.screenshot(path=str(args.output/'06-complete.png'),full_page=True)
  if report['errors']:raise AssertionError(report['errors'])
  report['status']='PASS'
 except Exception:
  report['status']='FAIL';report['failure']=traceback.format_exc()
  try:
   page.screenshot(path=str(args.output/'failure.png'),full_page=True)
   report['body']=page.locator('body').inner_text()
   report['runtime']=page.evaluate('({url:location.href,pilot:typeof PropletPlaytest,api:typeof window.api,bank:!!puzzleDB,game:currentGame,screen:currentScreen})')
  except Exception:pass
 finally:
  report['requests']=requests
  (args.output/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  browser.close()
print(json.dumps({k:v for k,v in report.items() if k not in ('requests','previewState')},ensure_ascii=False))
assert report['status']=='PASS'

