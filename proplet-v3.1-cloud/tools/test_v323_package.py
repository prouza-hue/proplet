#!/usr/bin/env python3
from pathlib import Path
import hashlib, re
from bs4 import BeautifulSoup
import tinycss2
ROOT=Path(__file__).resolve().parents[1]
read=lambda p:(ROOT/p).read_text(encoding='utf-8')
server=read('server.py'); app=read('public/app.js'); html=read('public/index.html'); css=read('public/styles.css'); sw=read('public/sw.js'); admin=read('public/admin.html'); adminjs=read('public/admin.js'); vercel=read('vercel.json'); setup=read('SUPABASE_SETUP.sql'); mig=read('SUPABASE_MIGRATION_V3_23.sql')
# Version / release markers
assert 'APP_VERSION = "3.23.0"' in server
assert "const APP_VERSION='3.23.0'" in app
assert 'Proplet v3.23.0' in html
assert 'proplet-v3.23.0-launch-readiness' in sw
for token in ['"launchReadinessSprint": "3.23"','"publicErrorDetails": False','"apiDocsPublic": False','"securityHeaders": True','"accountExport": True','"accountDeletion": True','"supportChannel": True','"launchDashboard": True']:
    assert token in server, token
# Immutable gameplay content / prior migration
EXPECTED_PUZZLE='ae74c21be87af921bccb0386197eefc1c3274f253f15423848b98f9aeb3aea23'
EXPECTED_SQL21='739f0b7b48fd3c18577b25b5ded7a9ca52f7ca01520f3b70e38adfbce884bed3'
sha=lambda p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
assert sha('data/puzzles.json')==EXPECTED_PUZZLE==sha('public/puzzles.json')
assert sha('SUPABASE_MIGRATION_V3_21.sql')==EXPECTED_SQL21
# v3.22.x gameplay/layout safety retained
for token in ['cellByW=Math.max(4,(aw-colGap*(p.cols-1))/p.cols)','cellByH=Math.max(4,(ah-rowGap*(p.rows-1))/p.rows)','wrap.style.height=`${targetH}px`','gridTemplateRows=`repeat(${p.rows},minmax(0,1fr))`','gridTemplateColumns=`repeat(${p.cols},minmax(0,1fr))`']:
    assert token in app, token
assert '@media (max-width:999px)' in css and '@media (min-width:1000px) and (min-height:650px)' in css
for token in ['landscapeGameBlocker','Otoč telefon na výšku','shouldBlockPhoneLandscape',"pauseGameClock('landscape')"]:
    assert token not in app+html+css, token
assert 'display-mode: standalone' not in css.lower()
# Launch static files / trust controls
for rel in ['public/theme-init.js','public/privacy.html','public/terms.html','public/legal.css','public/robots.txt','public/sitemap.xml','SUPABASE_MIGRATION_V3_23.sql','SUPABASE_VERIFY_V3_23.sql','SECURITY_AUDIT_V3_23_CZ.md','LAUNCH_CHECKLIST_V3_23_CZ.md','QA_V3_23_CZ.md','RELEASE_V3_23_CZ.md','UPDATE_V3_23_CZ.md','V3_23_MANIFEST.json']:
    assert (ROOT/rel).exists(), rel
for id_ in ['reportIssueBtn','exportDataBtn','deleteAccountBtn','supportReportModal','deleteAccountModal']:
    assert f'id="{id_}"' in html, id_
assert 'tab-launch' in admin and 'Launch radar' in admin
assert '/api/admin/launch' in adminjs and '/api/admin/support' in adminjs
# SW includes launch-critical legal/theme assets
for token in ['/theme-init.js','/privacy.html','/terms.html','/legal.css']:
    assert token in sw, token
# CSP and hardening headers
for token in ["Content-Security-Policy","script-src 'self'","frame-ancestors 'none'","X-Content-Type-Options","nosniff","X-Frame-Options","DENY","Strict-Transport-Security"]:
    assert token in vercel, token
# no inline scripts / event handlers that would violate strict script CSP
for rel in ['public/index.html','public/admin.html','public/privacy.html','public/terms.html']:
    soup=BeautifulSoup(read(rel),'html.parser')
    for script in soup.find_all('script'):
        assert script.get('src'), f'inline script in {rel}'
        assert not (script.string or '').strip(), f'inline script body in {rel}'
    for tag in soup.find_all(True):
        assert not any(k.lower().startswith('on') for k in tag.attrs), f'inline handler in {rel}: {tag.name}'
# DOM: IDs unique; bind-style selectors resolve
soup=BeautifulSoup(html,'html.parser')
ids=[x.get('id') for x in soup.find_all(id=True)]
assert len(ids)==len(set(ids)), 'duplicate IDs in index.html'
# Static launch controls referenced by bind() must exist; many render-time selectors are dynamic by design.
for selector in ['reportIssueBtn','exportDataBtn','deleteAccountBtn','saveSupportReportBtn','closeSupportReportModal','confirmDeleteAccountBtn','cancelDeleteAccountBtn','closeDeleteAccountModal']:
    assert selector in set(ids), f'missing static launch control #{selector}'
# CSS parses without syntax errors
for rel in ['public/styles.css','public/admin.css','public/legal.css']:
    rules=tinycss2.parse_stylesheet(read(rel), skip_comments=True, skip_whitespace=True)
    errs=[x for x in rules if x.type=='error']
    assert not errs, f'{rel}: {errs}'
# v3.23 SQL is represented in clean setup and does not touch gameplay rows
assert '-- Proplet v3.23 clean-install parity' in setup
for token in ['security_rate_limits','operational_events','support_reports','proplet_rate_limit','proplet_launch_housekeeping']:
    assert token in mig and token in setup, token
for forbidden in ['delete from public.results','delete from public.puzzle_runs','delete from public.puzzle_attempts','drop table public.results','truncate public.results']:
    assert forbidden not in mig.lower(), forbidden
# post-migration verifier is present, checks service-only RPCs and never touches gameplay tables
verify=read('SUPABASE_VERIFY_V3_23.sql').lower()
for token in ['verification', 'pass', 'admin_audit_log_admin_player_id_fkey', 'set null', 'proplet_rate_limit', 'proplet_launch_housekeeping']:
    assert token in verify, token
for forbidden in ['delete from public.results','delete from public.players','delete from public.puzzle_runs','delete from public.puzzle_attempts']:
    assert forbidden not in verify, forbidden
# direct prod deps pinned
req=read('requirements.txt')
for token in ['fastapi==0.128.2','starlette==0.50.0','uvicorn[standard]==0.48.0','pydantic==2.13.4','httpx==0.28.1','pywebpush==2.3.0']:
    assert token in req, token
print('PASS: v3.23 package integrity, CSP, launch UI, immutable puzzle content and clean-install parity')
