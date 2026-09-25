"""Round-two invitation visual/timer regression checks. Loopback + synthetic QA only."""
import argparse,json,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);args=p.parse_args();args.output.mkdir(parents=True,exist_ok=True)
origin='http://127.0.0.1:8765'
report={'syntheticOnly':True,'checks':[],'errors':[],'sizes':[]}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True)
 context=browser.new_context(viewport={'width':390,'height':844})
 page=context.new_page();page.set_default_timeout(15000)
 page.on('pageerror',lambda e:report['errors'].append(str(e)))
 requests=[];page.on('request',lambda r:requests.append({'url':r.url,'method':r.method}))
 try:
  page.goto(origin+'/?mozkokalypsa=preview',wait_until='domcontentloaded')
  page.locator('#mozkokalypsaInvite:not(.hidden)').wait_for()
  page.wait_for_function('!!puzzleDB && !document.documentElement.classList.contains("proplet-current-ui-booting") && !document.getElementById("propletBootScreen")')
  page.wait_for_timeout(400)
  assert page.locator('.mk-round-stamp').inner_text()=='Druhé kolo'
  assert page.locator('#mkInviteTitle').inner_text()=='Mozkokalypsa se vrací.'
  assert 'Psst' not in page.locator('#mozkokalypsaInvite').inner_text()
  assert 'mozkokalypsa-v2.svg' in page.locator('.mk-invite-art').get_attribute('src')
  assert page.locator('#mkInviteCountdown').get_attribute('aria-live')=='off'
  first=page.locator('#mkInviteCountdown').inner_text()
  api_count=lambda:len([r for r in requests if '/api/mozkokalypsa/status' in r['url']])
  before=api_count();page.wait_for_timeout(2200)
  assert first!=page.locator('#mkInviteCountdown').inner_text(),'Seconds must visibly run'
  assert before==api_count(),'Countdown must not poll the backend'
  page.evaluate('for(let i=0;i<40;i++)PropletPlaytest.render()');page.wait_for_timeout(1200)
  assert before==api_count(),'Rerendering must not create network timers'
  report['checks']+=['visible-second-ticks','no-ticker-API-polling','repeated-render-safe','approved-artwork','distinct-round-two-copy','quiet-screenreader-clock']
  for name,width,height in [('narrow',320,780),('mobile',390,844),('fold',768,1024),('desktop',1440,1000)]:
   page.set_viewport_size({'width':width,'height':height})
   for theme in ['light','dark']:
    page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
    page.locator('#mozkokalypsaInvite').scroll_into_view_if_needed();page.wait_for_timeout(100)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'{name} {theme}: page overflow'
    layout=page.locator('#mozkokalypsaInvite').evaluate('(el)=>({width:el.clientWidth,scroll:el.scrollWidth,height:el.clientHeight})')
    assert layout['scroll']<=layout['width']+1,f'{name} {theme}: card overflow {layout}'
    assert page.locator('#mkInviteButton').is_visible()
    assert page.locator('#mkInviteButton').bounding_box()['height']>=44
    page.locator('#mozkokalypsaInvite').screenshot(path=str(args.output/f'invite-{name}-{theme}.png'))
    report['sizes'].append({'viewport':name,'theme':theme,**layout})
  report['checks'].append('320-390-768-1440-light-dark-no-overflow')
  page.set_viewport_size({'width':390,'height':844});page.evaluate("document.documentElement.dataset.theme='light'")
  page.locator('#mkInviteButton').click();page.locator('#mkHubModal:not(.hidden)').wait_for()
  page.wait_for_timeout(1100)
  assert page.evaluate('document.querySelector("#mkHubCountdown").innerText===document.querySelector("#mkInviteCountdown").innerText'),'Hub and invite clocks must agree'
  assert page.locator('#mkBoardList button').count()==12
  page.locator('#mkHubModal .modal-card').screenshot(path=str(args.output/'invite-hub-mobile.png'))
  page.locator('#mkHubClose').click()
  # A deterministic synthetic deadline tests visible expiry without waiting days.
  expiry=browser.new_context(viewport={'width':390,'height':844},storage_state=context.storage_state());ep=expiry.new_page()
  ep.on('pageerror',lambda e:report['errors'].append(str(e)))
  ep.on('request',lambda r:requests.append({'url':r.url,'method':r.method}))
  def soon(route):
   response=route.fetch();data=response.json()
   from datetime import datetime,timezone,timedelta
   now=datetime.now(timezone.utc)
   data.update(qa=False,serverNow=now.isoformat(),closesAt=(now+timedelta(seconds=8)).isoformat())
   route.fulfill(response=response,json=data)
  ep.route('**/api/mozkokalypsa/status*',soon)
  ep.goto(origin+'/?mozkokalypsa=preview',wait_until='domcontentloaded')
  ep.locator('#mozkokalypsaInvite:not(.hidden)').wait_for()
  ep.wait_for_function('!!puzzleDB && !document.documentElement.classList.contains("proplet-current-ui-booting") && !document.getElementById("propletBootScreen")');ep.evaluate('closeOnboarding(true)')
  ep.locator('#mkInviteButton').click();ep.locator('#mkHubModal:not(.hidden)').wait_for()
  ep.wait_for_function('document.querySelector("#mozkokalypsaInvite").classList.contains("hidden") && document.querySelector("#mkHubModal").classList.contains("hidden")',timeout=10000)
  report['checks']+=['one-clock-for-invite-and-hub','deadline-hides-invite-and-hub-without-refresh']
  expiry.close()
  assert not [r for r in requests if '/api/mozkokalypsa' in r['url'] and r['method']=='POST'],'UI QA must not write any playtest result'
  if report['errors']:raise AssertionError(report['errors'])
  report['status']='PASS'
 except Exception:
  report['status']='FAIL';report['failure']=traceback.format_exc()
  page.screenshot(path=str(args.output/'invite-failure.png'),full_page=True)
 finally:
  (args.output/'invite-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  browser.close()
print(json.dumps(report,ensure_ascii=False));assert report['status']=='PASS'
