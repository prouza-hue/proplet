from pathlib import Path

# 1) Dedicated Supabase recovery endpoint/template.
p=Path('account_auth.py')
s=p.read_text(encoding='utf-8')
needle='''    def send_magic_link(email: str, redirect_to: str, *, create_user: bool) -> None:\n        # Supabase's signInWithOtp endpoint sends a one-time Magic Link when the\n        # Magic Link template contains ConfirmationURL (the hosted default).\n        auth_request(\n            "POST",\n            "/auth/v1/otp",\n            body={"email": email, "create_user": bool(create_user)},\n            params={"redirect_to": redirect_to},\n            generic_error="Ověřovací e-mail se nepodařilo odeslat",\n        )\n'''
replacement=needle+'''\n    def send_recovery_link(email: str, redirect_to: str) -> None:\n        # Use GoTrue's dedicated recovery endpoint so the password-recovery\n        # template and recovery-specific rate limits are used instead of a\n        # generic Magic Link email.\n        auth_request(\n            "POST",\n            "/auth/v1/recover",\n            body={"email": email},\n            params={"redirect_to": redirect_to},\n            generic_error="Obnovovací e-mail se nepodařilo odeslat",\n        )\n'''
if needle not in s: raise SystemExit('magic link helper not found')
s=s.replace(needle,replacement,1)
old='''            send_magic_link(email, redirect_to, create_user=False)'''
new='''            send_recovery_link(email, redirect_to)'''
if old not in s: raise SystemExit('recovery sender call not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

# 2) Standard Google G asset in login/profile UI.
p=Path('public/account-auth.js')
s=p.read_text(encoding='utf-8')
old='''<button id="googleLoginBtn" type="button" class="google-auth-btn"><span class="google-g" aria-hidden="true">G</span><strong>Pokračovat přes Google</strong></button>'''
new='''<button id="googleLoginBtn" type="button" class="google-auth-btn"><img class="google-g" src="/google-g.svg" alt="" aria-hidden="true"><strong>Pokračovat přes Google</strong></button>'''
if old not in s: raise SystemExit('Google login markup not found')
s=s.replace(old,new,1)
old2='''<span>${d.googleLinked?'✅':'G'}</span><div><strong>${d.googleLinked?'Google je propojený':'Přihlášení přes Google'}'''
new2='''<span>${d.googleLinked?'✅':'<img class="google-g google-g-small" src="/google-g.svg" alt="" aria-hidden="true">'}</span><div><strong>${d.googleLinked?'Google je propojený':'Přihlášení přes Google'}'''
if old2 not in s: raise SystemExit('Google security markup not found')
s=s.replace(old2,new2,1)
p.write_text(s,encoding='utf-8')

# 3) Google-compliant visual treatment; keep logo on white even in dark mode.
p=Path('public/account-auth.css')
s=p.read_text(encoding='utf-8')
old='''.google-auth-btn{width:100%;min-height:46px;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #dcd8e5;border-radius:14px;background:#fff;color:#2d2b39;box-shadow:0 3px 10px rgba(46,39,72,.055);cursor:pointer}.google-auth-btn:active{transform:scale(.985)}.google-auth-btn strong{font-size:12.5px}.google-g{width:23px;height:23px;border-radius:50%;display:grid;place-items:center;font-family:Arial,sans-serif;font-size:16px;font-weight:900;color:#4285f4;background:conic-gradient(from -45deg,#4285f4 0 25%,#34a853 25% 50%,#fbbc05 50% 75%,#ea4335 75%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}'''
new='''.google-auth-btn{width:100%;min-height:46px;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #747775;border-radius:14px;background:#fff;color:#1f1f1f;box-shadow:0 3px 10px rgba(46,39,72,.055);cursor:pointer}.google-auth-btn:active{transform:scale(.985)}.google-auth-btn strong{font-size:14px;line-height:20px;font-weight:600}.google-g{display:block;width:20px;height:20px;flex:0 0 20px}.google-g-small{width:17px;height:17px;flex-basis:17px}'''
if old not in s: raise SystemExit('Google CSS block not found')
s=s.replace(old,new,1)
old_dark='''html[data-theme="dark"] .google-auth-btn{background:#211f2c;border-color:#413b4d;color:var(--ink)}'''
new_dark='''html[data-theme="dark"] .google-auth-btn{background:#fff;border-color:#747775;color:#1f1f1f}'''
if old_dark not in s: raise SystemExit('Google dark CSS block not found')
s=s.replace(old_dark,new_dark,1)
p.write_text(s,encoding='utf-8')

# 4) Cache the Google mark and bump auth assets.
p=Path('public/sw.js')
s=p.read_text(encoding='utf-8')
s=s.replace("const CACHE='proplet-v3.31.8-account-auth-r1';","const CACHE='proplet-v3.31.8-account-auth-r2';",1)
s=s.replace("'/account-auth.css','/account-auth.js','/puzzles.json'","'/account-auth.css','/account-auth.js','/google-g.svg','/puzzles.json'",1)
p.write_text(s,encoding='utf-8')

p=Path('public/theme-init.js')
s=p.read_text(encoding='utf-8')
s=s.replace("account-auth.css?v=2","account-auth.css?v=3",1).replace("account-auth.js?v=2","account-auth.js?v=3",1)
p.write_text(s,encoding='utf-8')

print('v3.31.8 auth refinements applied')
