#!/usr/bin/env python3
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'qa-v323-visual'; OUT.mkdir(exist_ok=True)

def inline_page(html_path, css_paths):
    soup=BeautifulSoup((ROOT/html_path).read_text(),'html.parser')
    for tag in soup.find_all('script'): tag.decompose()
    for tag in soup.find_all('link',rel='stylesheet'): tag.decompose()
    style=soup.new_tag('style'); style.string='\n'.join((ROOT/p).read_text() for p in css_paths); soup.head.append(style)
    return str(soup)

def assert_no_horizontal_overflow(page,tol=2):
    data=page.evaluate('(tol)=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,ok:document.documentElement.scrollWidth<=document.documentElement.clientWidth+tol})',tol)
    assert data['ok'], data

index=inline_page('public/index.html',['public/styles.css'])
privacy=inline_page('public/privacy.html',['public/legal.css'])
admin=inline_page('public/admin.html',['public/admin.css'])
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    # Mobile onboarding static layout
    page=b.new_page(viewport={'width':390,'height':844}); page.set_content(index)
    page.evaluate("""()=>{
      document.querySelector('#onboardingModal').classList.remove('hidden');
      document.querySelector('#screen-daily').classList.add('active');
      document.querySelector('#onboardDots').innerHTML='<i class=\"active\"></i><i></i><i></i>';
      document.querySelector('#onboardContent').innerHTML='<div class=\"onboard-content\"><span class=\"eyebrow\">ZAČNI ROVNOU HRÁT</span><h2>Najdi PES</h2><p class=\"muted\">Táhni přes <b>P → E → S</b>. Jen přes políčka vedle sebe.</p><div class=\"tutorial-wrap\"><div class=\"tutorial-board\"><div class=\"tutorial-cell\">P</div><div class=\"tutorial-cell\">E</div><div class=\"tutorial-cell\">L</div><div class=\"tutorial-cell\">A</div><div class=\"tutorial-cell\">S</div><div class=\"tutorial-cell\">K</div><div class=\"tutorial-cell\">M</div><div class=\"tutorial-cell\">O</div><div class=\"tutorial-cell\">C</div></div></div></div>';
      document.querySelector('#onboardNextBtn').textContent='Nejdřív najdi PES';
    }""")
    assert page.locator('#onboardingModal').is_visible(); assert page.locator('#onboardContent h2').inner_text()=='Najdi PES'; assert_no_horizontal_overflow(page)
    page.screenshot(path=str(OUT/'01-mobile-onboarding.png'),full_page=True); page.close()
    # Fold dark profile privacy controls
    page=b.new_page(viewport={'width':749,'height':654}); page.set_content(index)
    page.evaluate("""()=>{document.documentElement.dataset.theme='dark';document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));document.querySelector('#screen-profile').classList.add('active');['exportDataBtn','deleteAccountBtn'].forEach(id=>document.querySelector('#'+id).classList.remove('hidden'))}""")
    assert page.locator('#reportIssueBtn').is_visible() and page.locator('#deleteAccountBtn').is_visible(); assert_no_horizontal_overflow(page)
    page.screenshot(path=str(OUT/'02-fold-profile-dark.png'),full_page=True)
    page.evaluate("document.querySelector('#supportReportModal').classList.remove('hidden')"); assert page.locator('#supportReportModal').is_visible(); assert_no_horizontal_overflow(page)
    page.screenshot(path=str(OUT/'03-fold-support-dark.png'),full_page=True); page.close()
    # Privacy narrow dark
    page=b.new_page(viewport={'width':360,'height':740}); page.set_content(privacy); page.evaluate("document.documentElement.dataset.theme='dark'")
    assert page.locator('h1').inner_text()=='Ochrana soukromí'; assert_no_horizontal_overflow(page)
    page.screenshot(path=str(OUT/'04-privacy-mobile-dark.png'),full_page=True); page.close()
    # Admin launch layout static injection
    page=b.new_page(viewport={'width':1440,'height':1000}); page.set_content(admin)
    page.evaluate("""()=>{document.querySelector('#adminGate').classList.add('hidden');document.querySelector('#adminApp').classList.remove('hidden');document.querySelectorAll('.admin-tab').forEach(x=>x.classList.remove('active'));document.querySelector('#tab-launch').classList.add('active');document.querySelector('#launchContent').innerHTML='<div class="kpi-grid launch-kpis"><div class="kpi panel"><b>42</b><span>aktivních · 24 h</span></div><div class="kpi panel"><b>8</b><span>nových účtů · 24 h</span></div><div class="kpi panel"><b>40 %</b><span>D1 návrat</span></div><div class="kpi panel"><b>1</b><span>chyb · 24 h</span></div></div><div class="launch-grid"><section class="section-panel panel"><h2>Prvních 24 hodin</h2><p>Otevřelo Proplet 50 → Starter 39 → Daily 27</p></section><section class="section-panel panel"><h2>Spolehlivost</h2><p>1 chyba · 4 rate-limit zásahy</p></section></div>';document.querySelector('#launchSupportContent').innerHTML='<article class="report-card panel"><strong>Technická chyba</strong><div class="report-note">Ukázkové launch hlášení</div></article>'}""")
    assert page.locator('#tab-launch').is_visible() and '42' in page.locator('#launchContent').inner_text(); assert_no_horizontal_overflow(page)
    page.screenshot(path=str(OUT/'05-admin-launch.png'),full_page=True); page.close()
    b.close()
print('PASS: v3.23 static browser render covers onboarding, Fold privacy/support, legal and launch admin without horizontal overflow')
