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

app = replace_once(app, "const APP_VERSION='3.31.0-preview.1';", "const APP_VERSION='3.31.1-preview.1';", 'app version')
server = replace_once(server, 'APP_VERSION = "3.31.0-preview.1"', 'APP_VERSION = "3.31.1-preview.1"', 'server version')
sw = replace_once(sw, "const CACHE='proplet-v3.31.0-preview.1-starter-coach';", "const CACHE='proplet-v3.31.1-preview.1-onboarding-boot';", 'sw cache')

app = replace_once(app, "let pendingSW=null;", "let pendingSW=null;\nlet reloadOnServiceWorkerChange=false;", 'sw reload state')

old_register = "let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()});"
new_register = "let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloadOnServiceWorkerChange||reloading)return;reloading=true;location.reload()});"
app = replace_once(app, old_register, new_register, 'controllerchange gate')

old_click = "$('#applyUpdateBtn').onclick=()=>pendingSW?.postMessage({type:'SKIP_WAITING'});"
new_click = "$('#applyUpdateBtn').onclick=()=>{if(!pendingSW)return;reloadOnServiceWorkerChange=true;pendingSW.postMessage({type:'SKIP_WAITING'})};"
app = replace_once(app, old_click, new_click, 'explicit update reload')

old_boot = "renderDaily();renderFree();renderProfile();renderInstallUI();refreshRollingContent().catch(()=>{});syncQueue({announce:false});refreshRescueStatus();setTimeout(()=>openOnboarding(false),260);\n registerServiceWorker();"
new_boot = "renderDaily();renderFree();renderProfile();renderInstallUI();const initialRollingContent=refreshRollingContent().catch(()=>null);syncQueue({announce:false});refreshRescueStatus();initialRollingContent.finally(()=>setTimeout(()=>openOnboarding(false),80));\n registerServiceWorker();"
app = replace_once(app, old_boot, new_boot, 'onboarding after content')

app_path.write_text(app, encoding='utf-8')
sw_path.write_text(sw, encoding='utf-8')
server_path.write_text(server, encoding='utf-8')
print('v3.31.1 onboarding boot fix applied')
