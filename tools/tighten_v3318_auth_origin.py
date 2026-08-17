from pathlib import Path
p=Path('account_auth.py')
s=p.read_text(encoding='utf-8')
old='''        allowed = host == "proplet-nine.vercel.app" or host.endswith("-pavel-prouzas-projects.vercel.app") or host.endswith(".vercel.app")\n'''
new='''        allowed = host == "proplet-nine.vercel.app" or host.endswith("-pavel-prouzas-projects.vercel.app")\n'''
if old not in s:
    raise SystemExit('origin pattern not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('auth origin whitelist tightened')
