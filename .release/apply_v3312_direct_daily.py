from pathlib import Path

root = Path(__file__).resolve().parents[1]
app_path = root / 'public' / 'app.js'
sw_path = root / 'public' / 'sw.js'
server_path = root / 'server.py'

app = app_path.read_text(encoding='utf-8')
sw = sw_path.read_text(encoding='utf-8')
server = server_path.read_text(encoding='utf-8')

def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, got {n}')
    return text.replace(old, new, 1)

app = replace_once(app, "const APP_VERSION='3.31.1-preview.1';", "const APP_VERSION='3.31.2-preview.1';", 'app version')
server = replace_once(server, 'APP_VERSION = "3.31.1-preview.1"', 'APP_VERSION = "3.31.2-preview.1"', 'server version')
sw = replace_once(sw, "const CACHE='proplet-v3.31.1-preview.1-onboarding-boot';", "const CACHE='proplet-v3.31.2-preview.1-direct-daily';", 'sw cache')

old = "if(mode==='starter'){if(action==='menu'){nav('free',{replace:true});return}nav('daily',{replace:true});showStarterDailyNudge();return}"
new = "if(mode==='starter'){if(action==='menu'){nav('free',{replace:true});return}startDaily();return}"
app = replace_once(app, old, new, 'starter primary action')

app_path.write_text(app, encoding='utf-8')
sw_path.write_text(sw, encoding='utf-8')
server_path.write_text(server, encoding='utf-8')
print('v3.31.2 direct Daily preview patch applied')
