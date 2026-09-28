"""Native app flow with synthetic local playtest state only, never production."""
import argparse,json,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
origin='http://127.0.0.1:8765';url=origin+'/?mozkokalypsa=preview'
key='proplet-playtest:mozkokalypsa-round3-interwoven-v2:qa'
report={'nativeApplication':True,'syntheticOnly':True,'physicalDevice':False,'checks':[],'errors':[]};requests=[]
def ready(page):
 page.goto(url,wait_until='domcontentloaded')
 page.locator('#mozkokalypsaInvite:not(.hidden)').wait_for()
 page.wait_for_function('!!puzzleDB && !document.documentElement.classList.contains("proplet-current-ui-booting") && !document.getElementById("propletBootScreen")')
 page.wait_for_timeout(400)
def shot(page,selector,name):page.locator(selector).screenshot(path=str(args.output/(name+'.png')))
def pointer_word(page,index):
 path=page.evaluate('(i)=>currentGame.puzzle.answers[i].path',index)
 points=[]
 for cell in path:
  b=page.locator(f'#board > .cell[data-index="{cell}"]').bounding_box();points.append((b['x']+b['width']/2,b['y']+b['height']/2))
 page.mouse.move(*points[0]);page.mouse.down()
 for point in points[1:]:page.mouse.move(*point,steps=2)
 page.mouse.up();page.wait_for_timeout(150)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True)
 ctx=browser.new_context(viewport={'width':390,'height':844});page=ctx.new_page();page.set_default_timeout(15000)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 page.on('request',lambda r:requests.append({'method':r.method,'url':r.url}))
 try:
  ready(page)
  assert page.locator('#mkInviteTitle').inner_text()=='Mozkokalypsa potřetí.'
  assert page.locator('#mkInviteProgress i').count()==8
  assert page.locator('#mkInviteNote').is_hidden()
  assert page.locator('.mk-invite-kicker').is_hidden()
  assert '1 600 XP' in page.locator('.mk-reward-cap').inner_text()
  normal=page.evaluate('JSON.stringify({completed:getState().completed,inProgress:getState().inProgress,queue:getQueue()})')
  before=page.locator('#mkInviteCountdown').inner_text();count=lambda:sum('/api/mozkokalypsa/status' in x['url'] for x in requests)
  n=count();page.wait_for_timeout(2100);assert before!=page.locator('#mkInviteCountdown').inner_text() and count()==n
  for name,w,h in [('narrow',320,780),('mobile',390,844),('fold',768,1024),('desktop',1440,1000)]:
   page.set_viewport_size({'width':w,'height':h})
   for theme in ['light','dark']:
    page.evaluate('(t)=>document.documentElement.dataset.theme=t',theme)
    page.locator('#mozkokalypsaInvite').scroll_into_view_if_needed();page.wait_for_timeout(100)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(name,theme)
    shot(page,'#mozkokalypsaInvite',f'invite-{name}-{theme}')
  page.set_viewport_size({'width':390,'height':844});page.evaluate("document.documentElement.dataset.theme='light'")
  page.evaluate('scrollTo(0,0)');page.screenshot(path=str(args.output/'today-mobile.png'),full_page=True)
  page.locator('#mkInviteButton').click();page.locator('#mkHubModal:not(.hidden)').wait_for()
  assert page.locator('#mkBoardList button').count()==8 and page.locator('#mkHubNote').is_hidden()
  assert page.locator('.mk-hub-kicker').is_hidden();shot(page,'#mkHubModal .modal-card','hub-mobile')
  page.locator('#mkBoardList button').first.click();page.wait_for_function("currentGame?.puzzle.id==='mk3w2-01'")
  pointer_word(page,0);assert page.evaluate('currentGame.found.length')==1
  page.locator('#hintBtn').click();page.locator('.hint-choice').first.click();assert page.evaluate('currentGame.hints')==1
  page.locator('#calmRunBtn').click()
  if page.locator('#confirmCalmBtn').is_visible():page.locator('#confirmCalmBtn').click()
  page.evaluate("nav('daily')");ready(page)
  page.locator('#mkInviteButton').click();page.locator('#mkBoardList button').first.click()
  page.wait_for_function("currentGame?.puzzle.id==='mk3w2-01'")
  assert page.evaluate('currentGame.found.length===1 && currentGame.hints===1 && currentGame.calmMode')
  # Preserve draft ratings across an actual read-only look at the completed board.
  page.evaluate('()=>{for(let i=1;i<14;i++){currentGame.path=[...currentGame.puzzle.answers[i].path];submitPath()}}')
  page.locator('#mkResultModal:not(.hidden)').wait_for()
  page.locator('#mkRatingDifficulty').select_option('4');page.locator('#mkRatingFun').select_option('5');page.locator('#mkRatingNote').fill('Soukromý syntetický QA záznam.')
  shot(page,'#mkResultModal .modal-card','result-mobile')
  beforeInspect=page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).attempts["mk3w2-01"].events.length',key)
  page.locator('#mkInspectBoard').click();page.locator('#mkReturnRating:not(.hidden)').wait_for()
  assert page.locator('#mkResultModal').is_hidden()
  assert page.evaluate('currentGame.finished && currentGame.found.length===14')
  page.screenshot(path=str(args.output/'inspect-board-mobile.png'),full_page=True)
  page.locator('#mkReturnRating').click();page.locator('#mkResultModal:not(.hidden)').wait_for()
  assert page.locator('#mkRatingDifficulty').input_value()=='4' and page.locator('#mkRatingFun').input_value()=='5'
  assert page.locator('#mkRatingNote').input_value()=='Soukromý syntetický QA záznam.'
  assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).attempts["mk3w2-01"].events.length',key)==beforeInspect
  page.locator('#mkResultNext').click()
  page.wait_for_function("currentGame?.puzzle.id==='mk3w2-02'")
  page.screenshot(path=str(args.output/'board-mobile.png'),full_page=True)
  # Existing native submitPath, not fabricated finish/result state.
  for ordinal in range(2,9):
   page.wait_for_function('(id)=>currentGame?.puzzle.id===id && !currentGame.finished',arg=f'mk3w2-{ordinal:02d}')
   page.evaluate('()=>{for(let i=0;i<14;i++){currentGame.path=[...currentGame.puzzle.answers[i].path];submitPath()}}')
   page.locator('#mkResultModal:not(.hidden)').wait_for()
   page.locator('#mkRatingDifficulty').select_option('4');page.locator('#mkRatingFun').select_option('5')
   page.locator('#mkResultNext').click()
  page.locator('#mkHubModal:not(.hidden)').wait_for()
  assert page.locator('#mkBoardList button').count()==8
  state=page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',key)
  assert len(state['attempts'])==8 and all(a['completed'] and a['feedback']['fun']==5 for a in state['attempts'].values())
  assert normal==page.evaluate('JSON.stringify({completed:getState().completed,inProgress:getState().inProgress,queue:getQueue()})')
  shot(page,'#mkHubModal .modal-card','hub-complete')
  page.locator('#mkHubClose').click();shot(page,'#mozkokalypsaInvite','invite-complete')
  assert page.locator('#mkInviteTitle').inner_text()=='Třetí kolo rozpletené.'
  # Test fresh touch contexts at the two important device widths.
  for name,w,h in [('phone',390,844),('fold',768,1024)]:
   tc=browser.new_context(viewport={'width':w,'height':h},is_mobile=True,has_touch=True)
   tp=tc.new_page();tp.set_default_timeout(15000);tp.on('pageerror',lambda e:report['errors'].append(str(e)))
   tp.on('request',lambda r:requests.append({'method':r.method,'url':r.url}))
   ready(tp);tp.locator('#mkInviteButton').tap();tp.locator('#mkBoardList button').first.tap()
   tp.wait_for_function("currentGame?.puzzle.id==='mk3w2-01'")
   points=[]
   for cell in tp.evaluate('currentGame.puzzle.answers[0].path'):
    b=tp.locator(f'#board>.cell[data-index="{cell}"]').bounding_box();points.append({'x':b['x']+b['width']/2,'y':b['y']+b['height']/2})
   cdp=tc.new_cdp_session(tp);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[points[0]]})
   for point in points[1:]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[point]})
   cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});tp.wait_for_function('currentGame.found.length===1')
   tp.locator('#hintBtn').tap();tp.locator('#hintModal:not(.hidden)').wait_for();tp.locator('.hint-choice').first.tap()
   assert tp.evaluate('currentGame.hints')==1
   tp.screenshot(path=str(args.output/f'touch-{name}.png'),full_page=True);tc.close()
  assert not [x for x in requests if x['method'] not in ('GET','HEAD') and any(p in x['url'] for p in ('/api/mozkokalypsa','/api/result','/api/word-discovery/claim'))],requests
  assert not report['errors'],report['errors']
  report['checks']=['native-today-invitation','8-unchanged-approved-boards','quiet-live-countdown-no-polling','no-eyebrow-or-removed-notes','320-390-768-1440-light-dark','native-pointer-hint-calm-resume','rating-board-inspection-preserves-draft-no-duplicate-finish','all-8-native-completions-local-ratings','no-normal-XP-progression-or-server-results','real-phone-and-fold-emulated-touch']
  report['status']='PASS'
 except Exception:
  report['status']='FAIL';report['failure']=traceback.format_exc()
  page.screenshot(path=str(args.output/'failure.png'),full_page=True)
  report['body']=page.locator('body').inner_text()[-7000:]
 finally:
  report['requests']=requests;(args.output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');browser.close()
print(json.dumps({k:v for k,v in report.items() if k not in ('requests','body')},ensure_ascii=False));assert report['status']=='PASS'
