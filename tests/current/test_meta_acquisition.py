from types import SimpleNamespace
from backend.measurement import request_context
from pathlib import Path

safe={'x-proplet-acquisition-source':'ig','x-proplet-acquisition-campaign':'52512345','x-proplet-acquisition-ad':'52523456','x-proplet-acquisition-adset':'52534567'}
capture=lambda headers:request_context(SimpleNamespace(headers=headers),'preview')['_event_context']
assert capture(safe)['acquisition']=={'source':'ig','campaign':'52512345','ad':'52523456','adset':'52534567'}
for bad in ['person@example.com','https://example.com/secret','a'*10000,'123','']:
    assert capture({**safe,'x-proplet-acquisition-ad':bad})=={}
assert capture({})=={}
assert capture({**safe,'x-proplet-acquisition-source':'unknown'})=={}
app=Path('public/app.js').read_text(encoding='utf-8')
assert "accountCreated:authAction==='create'&&profile.accountCreated===true" in app
oauth=Path('public/account-auth.js').read_text(encoding='utf-8')
assert "cleanAuthUrl();if(typeof window!=='undefined')window.PropletMarketing?.registration({id:d.profile.id,accountCreated:d.accountCreated===true})" in oauth
print('PASS bounded acquisition context and registration wiring after authoritative response / clean OAuth URL')
