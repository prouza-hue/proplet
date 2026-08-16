from __future__ import annotations

from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f"{label}: expected exactly one match, got {n}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, repl: str, label: str) -> str:
    out, n = re.subn(pattern, repl, text, count=1, flags=re.S)
    if n != 1:
        raise RuntimeError(f"{label}: expected exactly one regex match, got {n}")
    return out


# ---------------------------------------------------------------------------
# server.py
# ---------------------------------------------------------------------------
server = read("server.py")
server = replace_once(server, 'APP_VERSION = "3.29.0"', 'APP_VERSION = "3.30.0-preview.1"', "server version")
server = replace_once(
    server,
    'CRON_SECRET = os.environ.get("CRON_SECRET", "").strip()\n',
    'CRON_SECRET = os.environ.get("CRON_SECRET", "").strip()\nVERCEL_ENV = os.environ.get("VERCEL_ENV", "").strip().lower()\n',
    "vercel env",
)
server = replace_once(
    server,
    '    if request.url.path.startswith("/api/"):\n        response.headers["Cache-Control"] = "no-store"\n',
    '    if request.url.path == "/api/puzzles":\n        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=86400"\n    elif request.url.path.startswith("/api/"):\n        response.headers["Cache-Control"] = "no-store"\n',
    "puzzle API cache header",
)
server = replace_once(
    server,
    'class PushSubscriptionCreate(BaseModel):\n    endpoint: str = Field(min_length=20, max_length=2048)\n    p256dh: str = Field(min_length=20, max_length=512)\n    auth: str = Field(min_length=8, max_length=256)\n    user_agent: Optional[str] = Field(default=None, max_length=300)\n',
    'class PushSubscriptionCreate(BaseModel):\n    endpoint: str = Field(min_length=20, max_length=2048)\n    p256dh: str = Field(min_length=20, max_length=512)\n    auth: str = Field(min_length=8, max_length=256)\n    user_agent: Optional[str] = Field(default=None, max_length=300)\n    # None means an older client: preserve the historical Daily-only semantics.\n    daily_enabled: Optional[bool] = None\n    content_enabled: Optional[bool] = None\n',
    "push subscription model",
)

content_helpers = r'''

def _parse_content_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def effective_content_date(request: Optional[Request] = None, requested: Optional[str] = None) -> date:
    """Production always uses Prague today; preview deployments may simulate a release date."""
    actual = current_prague_date()
    if VERCEL_ENV == "production":
        return actual
    candidate = requested
    if not candidate and request is not None:
        candidate = request.headers.get("x-proplet-preview-as-of")
    return _parse_content_date(candidate) or actual


def puzzle_release_date(puzzle: dict) -> Optional[date]:
    return _parse_content_date((puzzle.get("meta") or {}).get("availableFrom"))


def is_puzzle_released(puzzle: dict, as_of: Optional[date] = None) -> bool:
    released = puzzle_release_date(puzzle)
    return released is None or released <= (as_of or current_prague_date())


def released_free_bank(difficulty: str, as_of: Optional[date] = None) -> list[dict]:
    return [p for p in load_puzzles().get("free", {}).get(difficulty, []) if is_puzzle_released(p, as_of)]


def _released_batches(as_of: date) -> tuple[list[dict], Optional[str]]:
    rolling = load_puzzles().get("rollingContent") or {}
    batches = list(rolling.get("batches") or [])
    released = [b for b in batches if (_parse_content_date(b.get("availableFrom")) or date.max) <= as_of]
    future = [b for b in batches if (_parse_content_date(b.get("availableFrom")) or date.min) > as_of]
    released.sort(key=lambda b: str(b.get("availableFrom") or ""))
    future.sort(key=lambda b: str(b.get("availableFrom") or ""))
    return released, (future[0].get("availableFrom") if future else None)


def released_puzzle_payload(as_of: date) -> dict:
    source = load_puzzles()
    payload = {k: v for k, v in source.items() if k not in {"free", "rollingContent"}}
    payload["free"] = {d: released_free_bank(d, as_of) for d in ("easy", "medium", "hard", "hardcore")}
    rolling = dict(source.get("rollingContent") or {})
    rolling.pop("batches", None)  # never ship future puzzle IDs or batch contents to clients
    released_batches, next_release = _released_batches(as_of)
    latest = released_batches[-1] if released_batches else None
    payload["rollingContent"] = rolling
    payload["contentStatus"] = {
        "asOf": as_of.isoformat(),
        "latestBatch": latest,
        "nextRelease": next_release,
        "availableFreeCounts": {d: len(payload["free"][d]) for d in ("easy", "medium", "hard", "hardcore")},
    }
    return payload


def push_preferences_schema_ready() -> bool:
    if not supabase_ready():
        return False
    try:
        db_request("GET", "push_subscriptions", params={"select": "id,daily_enabled,content_enabled", "limit": "1"})
        db_request("GET", "push_delivery_log", params={"select": "id", "limit": "1"})
        return True
    except HTTPException:
        return False

'''
server = replace_once(
    server,
    '@lru_cache(maxsize=1)\ndef load_puzzles() -> dict:\n    return json.loads(PUZZLES_PATH.read_text(encoding="utf-8"))\n\n',
    '@lru_cache(maxsize=1)\ndef load_puzzles() -> dict:\n    return json.loads(PUZZLES_PATH.read_text(encoding="utf-8"))\n' + content_helpers + '\n',
    "content release helpers",
)

# Never accept a future Free result in production even if somebody guesses the puzzle ID.
server = replace_once(
    server,
    '        info = free_puzzle_info(payload.puzzle_id, payload.difficulty)\n        if not info:\n            raise HTTPException(400, "Neznámá úroveň volné hry")\n',
    '        info = free_puzzle_info(payload.puzzle_id, payload.difficulty)\n        if not info or not is_puzzle_released(info.get("puzzle") or {}, effective_content_date(request)):\n            raise HTTPException(400, "Neznámá nebo zatím nevydaná úroveň volné hry")\n',
    "future result guard",
)
# Logged-in played-level summaries must not reveal the size of the unreleased reserve.
server = replace_once(
    server,
    'return {"difficulty": difficulty, "total": len(bank), "completed": len(items), "actual": actual, "transferred": transferred, "levels": items, "legacyLevels": legacy_history}',
    'return {"difficulty": difficulty, "total": sum(1 for p in bank if is_puzzle_released(p, effective_content_date(request))), "completed": len(items), "actual": actual, "transferred": transferred, "levels": items, "legacyLevels": legacy_history}',
    "played levels released total",
)

puzzle_endpoint = r'''
@app.get("/api/puzzles")
def public_puzzle_bank(request: Request, preview_as_of: Optional[str] = Query(default=None, max_length=10)):
    """Release-gated puzzle bank. Future reserve content stays server-side."""
    as_of = effective_content_date(request, preview_as_of)
    return released_puzzle_payload(as_of)


'''
server = replace_once(server, '@app.get("/api/push/config")\n', puzzle_endpoint + '@app.get("/api/push/config")\n', "puzzle endpoint")
server = replace_once(
    server,
    'def push_config():\n    return {"available": push_ready(), "publicKey": VAPID_PUBLIC_KEY if push_ready() else None}\n',
    'def push_config():\n    return {"available": push_ready(), "publicKey": VAPID_PUBLIC_KEY if push_ready() else None, "preferencesVersion": 2, "preferencesReady": push_preferences_schema_ready()}\n',
    "push config v2",
)

push_preferences_endpoint = r'''

@app.get("/api/push/preferences")
def push_preferences(
    request: Request,
    endpoint: str = Query(min_length=20, max_length=2048),
    authorization: Optional[str] = Header(default=None),
):
    enforce_rate_limit(request, "push_preferences_read", limit=120, window_seconds=3600)
    player = auth_player(authorization)
    rows = db_select("push_subscriptions", endpoint=endpoint)
    row = next((r for r in rows if r.get("player_id") == player["id"]), None)
    ready = bool(row and "daily_enabled" in row and "content_enabled" in row) or push_preferences_schema_ready()
    if not row:
        return {"migrationReady": ready, "subscribed": False, "dailyEnabled": False, "contentEnabled": False}
    return {
        "migrationReady": ready,
        "subscribed": True,
        # Missing fields means a legacy DB row: it represented Daily consent only.
        "dailyEnabled": bool(row.get("daily_enabled", True)),
        "contentEnabled": bool(row.get("content_enabled", False)),
    }
'''
server = replace_once(server, '@app.post("/api/push/subscribe")\n', push_preferences_endpoint + '\n\n@app.post("/api/push/subscribe")\n', "push preferences endpoint")

server = regex_once(
    server,
    r'def push_subscribe\(payload: PushSubscriptionCreate, request: Request, authorization: Optional\[str\] = Header\(default=None\)\):.*?    return \{"ok": True\}\n\n\n@app.post\("/api/push/unsubscribe"\)',
    '''def push_subscribe(payload: PushSubscriptionCreate, request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "push_subscribe", limit=20, window_seconds=3600)
    player = auth_player(authorization)
    if not push_ready():
        raise HTTPException(503, "Push notifikace ještě nejsou na serveru nakonfigurované")
    existing = db_select("push_subscriptions", endpoint=payload.endpoint)
    daily_enabled = True if payload.daily_enabled is None else bool(payload.daily_enabled)
    content_enabled = False if payload.content_enabled is None else bool(payload.content_enabled)
    row = {
        "player_id": player["id"], "p256dh": payload.p256dh, "auth": payload.auth,
        "user_agent": payload.user_agent, "updated_at": datetime.now(TZ).isoformat(),
        "daily_enabled": daily_enabled, "content_enabled": content_enabled,
    }
    try:
        if existing:
            db_update("push_subscriptions", {"id": existing[0]["id"]}, row)
        else:
            db_insert("push_subscriptions", {"id": str(uuid.uuid4()), "endpoint": payload.endpoint, "created_at": datetime.now(TZ).isoformat(), **row})
    except HTTPException as exc:
        # Old cached clients can still restore the historical Daily-only subscription before
        # the v3.30 SQL migration. New category-aware clients wait for the migration instead.
        if payload.daily_enabled is None and payload.content_enabled is None:
            legacy_row = {k: v for k, v in row.items() if k not in {"daily_enabled", "content_enabled"}}
            if existing:
                db_update("push_subscriptions", {"id": existing[0]["id"]}, legacy_row)
            else:
                db_insert("push_subscriptions", {"id": str(uuid.uuid4()), "endpoint": payload.endpoint, "created_at": datetime.now(TZ).isoformat(), **legacy_row})
        else:
            raise HTTPException(503, "Nové nastavení upozornění čeká na databázovou migraci") from exc
    return {"ok": True, "dailyEnabled": daily_enabled, "contentEnabled": content_enabled}


@app.post("/api/push/unsubscribe")''',
    "category-aware push subscribe",
)

# Existing Daily consent stays Daily-only: rows explicitly disabled for Daily are skipped.
server = replace_once(
    server,
    '    for sub in subscriptions:\n        if sub.get("player_id") in completed:\n            continue\n',
    '    for sub in subscriptions:\n        if sub.get("daily_enabled", True) is False:\n            continue\n        if sub.get("player_id") in completed:\n            continue\n',
    "daily category filter",
)

content_cron = r'''

def _reserve_push_delivery(sub: dict, event_key: str, category: str) -> Optional[str]:
    delivery_id = str(uuid.uuid4())
    try:
        db_insert("push_delivery_log", {
            "id": delivery_id,
            "subscription_id": sub["id"],
            "player_id": sub["player_id"],
            "event_key": event_key,
            "category": category,
            "status": "pending",
            "created_at": datetime.now(TZ).isoformat(),
        })
        return delivery_id
    except HTTPException as exc:
        if exc.status_code == 409:
            return None
        raise


@app.get("/api/cron/content-push")
def cron_content_push(request: Request, authorization: Optional[str] = Header(default=None)):
    if not CRON_SECRET or authorization != f"Bearer {CRON_SECRET}":
        raise HTTPException(401, "Neplatné cron oprávnění")
    today = current_prague_date()
    released, _ = _released_batches(today)
    batch = released[-1] if released else None
    if not batch:
        return {"ok": True, "sent": 0, "message": "Zatím není žádný rolling content batch"}
    release_date = _parse_content_date(batch.get("availableFrom"))
    # A weekly cron may be retried later in the same release week, but must never announce
    # an older drop after the next Monday has begun.
    if not release_date or not (0 <= (today - release_date).days <= 6):
        return {"ok": True, "sent": 0, "message": "Tento týden není nový content drop"}
    if not push_ready():
        return {"ok": False, "sent": 0, "message": "VAPID není nakonfigurovaný"}
    if not push_preferences_schema_ready():
        return {"ok": False, "sent": 0, "message": "Notifications v2 migrace ještě není nasazená", "migrationReady": False}
    subscriptions = db_request("GET", "push_subscriptions", params={"select": "*", "content_enabled": "eq.true"})
    event_key = f"content:{batch.get('id')}"
    payload = json.dumps({
        "title": "✨ 5 nových Propletů",
        "body": "Nová týdenní várka je venku. Jedna úroveň od každé obtížnosti a jedna navíc.",
        "url": f"/?open=free&new={batch.get('id')}",
        "tag": f"proplet-{event_key}",
    }, ensure_ascii=False)
    sent = failed = removed = duplicate = 0
    for sub in subscriptions:
        delivery_id = _reserve_push_delivery(sub, event_key, "content")
        if not delivery_id:
            duplicate += 1
            continue
        info = {"endpoint": sub.get("endpoint"), "keys": {"p256dh": sub.get("p256dh"), "auth": sub.get("auth")}}
        try:
            webpush(subscription_info=info, data=payload, vapid_private_key=VAPID_PRIVATE_KEY, vapid_claims={"sub": VAPID_SUBJECT}, ttl=86400)
            db_update("push_delivery_log", {"id": delivery_id}, {"status": "sent", "sent_at": datetime.now(TZ).isoformat()})
            sent += 1
        except Exception as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            try:
                db_delete("push_delivery_log", id=delivery_id)  # allow an explicit retry after transient failure
            except Exception:
                pass
            if status in (404, 410):
                try:
                    db_delete("push_subscriptions", id=sub["id"]); removed += 1
                except Exception:
                    pass
            else:
                failed += 1
                logger.warning("Content push failed for subscription %s: %s", sub.get("id"), exc)
    return {
        "ok": failed == 0,
        "batch": batch.get("id"),
        "releaseDate": batch.get("availableFrom"),
        "sent": sent, "failed": failed, "removed": removed, "duplicate": duplicate,
        "migrationReady": True,
    }

'''
server = replace_once(server, '@app.get("/api/health")\n', content_cron + '\n@app.get("/api/health")\n', "content push cron")

server = replace_once(
    server,
    '        "xpEconomyVersion": 2,\n',
    '        "xpEconomyVersion": 2,\n        "rollingContentVersion": int((data.get("rollingContent") or {}).get("version") or 0),\n        "rollingContentCadence": (data.get("rollingContent") or {}).get("cadence"),\n        "rollingContentFirstRelease": (data.get("rollingContent") or {}).get("firstRelease"),\n        "rollingContentReservedThrough": (data.get("rollingContent") or {}).get("reservedThrough"),\n        "rollingContentAvailableCounts": {d: len(released_free_bank(d, current_prague_date())) for d in ("easy", "medium", "hard", "hardcore")},\n        "notificationsV2Migration": push_preferences_schema_ready(),\n',
    "health rolling fields",
)
write("server.py", server)


# ---------------------------------------------------------------------------
# public/index.html
# ---------------------------------------------------------------------------
html = read("public/index.html")
html = replace_once(
    html,
    '      <div class="screen-title"><span class="eyebrow">VOLNÁ HRA</span><h1>Na co si troufáš?</h1><p class="muted">Každá nová úroveň přidá XP. Série roste jen Denní výzvou.</p></div>\n      <div id="difficultyCards" class="difficulty-grid"></div>',
    '      <div class="screen-title"><span class="eyebrow">VOLNÁ HRA</span><h1>Na co si troufáš?</h1><p class="muted">Každá nová úroveň přidá XP. Série roste jen Denní výzvou.</p></div>\n      <div id="newContentBanner" class="new-content-banner hidden"></div>\n      <div id="difficultyCards" class="difficulty-grid"></div>',
    "free content banner slot",
)
html = regex_once(
    html,
    r'      <div class="card settings-card push-card">\n        <div class="section-head"><div><span class="eyebrow">DENNÍ PŘIPOMÍNKA</span><h2>Nový Proplet na mobil</h2></div></div>\n        <p class="muted push-copy">.*?</div>\n      </div>',
    '''      <div class="card settings-card push-card">
        <div class="section-head"><div><span class="eyebrow">UPOZORNĚNÍ</span><h2>Co ti má Proplet připomenout?</h2></div></div>
        <p class="muted push-copy">Každý typ upozornění ovládáš zvlášť. Současný souhlas s Denní výzvou jsme na nic dalšího nerozšířili.</p>
        <div class="notification-pref-list">
          <div class="notification-pref-row">
            <div class="notification-pref-icon">☀️</div>
            <div class="notification-pref-copy"><strong>Denní výzva</strong><small>Ráno připomeň jen nevyřešenou Denní výzvu.</small><div id="pushStatusText" class="push-status muted"></div></div>
            <button id="pushToggleBtn" class="secondary-btn notification-pref-btn">Nastavit</button>
          </div>
          <div class="notification-pref-row">
            <div class="notification-pref-icon">✨</div>
            <div class="notification-pref-copy"><strong>Nové Proplety</strong><small>Dej mi vědět, když v pondělí přibude nová týdenní várka.</small><div id="contentPushStatusText" class="push-status muted"></div></div>
            <button id="contentPushToggleBtn" class="secondary-btn notification-pref-btn">Nastavit</button>
          </div>
        </div>
      </div>''',
    "notification settings card",
)
write("public/index.html", html)


# ---------------------------------------------------------------------------
# public/app.js
# ---------------------------------------------------------------------------
app = read("public/app.js")
app = replace_once(app, "const APP_VERSION='3.29.0';", "const APP_VERSION='3.30.0-preview.1';", "client version")
for diff in ("Snadných", "Středních", "Těžkých", "Mozkožroutů"):
    app = app.replace(f"Dokonči všech 200 {diff}", f"Dokonči 200 {diff}")

content_ui = r'''
function latestContentBatch(){return puzzleDB?.contentStatus?.latestBatch||null}
function latestContentIsFresh(){const b=latestContentBatch(),asOf=puzzleDB?.contentStatus?.asOf;if(!b?.availableFrom||!asOf)return false;return asOf>=b.availableFrom&&asOf<=addDaysISO(b.availableFrom,6)}
function latestContentPuzzles(){
 const batch=latestContentBatch();if(!batch||!latestContentIsFresh())return[];
 return (batch.levels||[]).map(row=>sortedFreeBank(row.difficulty).find(p=>p.id===row.id)).filter(Boolean);
}
function latestContentUnplayed(){const s=getState();return latestContentPuzzles().filter(p=>!s.completed?.[`free:${p.id}`])}
function newContentCount(diff){return latestContentPuzzles().filter(p=>p.difficulty===diff).length}
function startLatestContent(){const list=latestContentUnplayed(),all=latestContentPuzzles(),p=list[0]||all[0];if(p)startGame(p,'free')}
function renderNewContentBanner(){
 const root=$('#newContentBanner');if(!root)return;const batch=latestContentBatch();
 if(!batch||!latestContentIsFresh()){root.classList.add('hidden');root.innerHTML='';return}
 const all=latestContentPuzzles(),unplayed=latestContentUnplayed(),extra=DIFF[batch.extraDifficulty]?.label||'',done=!unplayed.length;
 root.classList.remove('hidden');
 root.innerHTML=`<div class="new-content-main"><span class="new-content-spark">✨</span><div><span class="eyebrow">NOVÁ TÝDENNÍ VÁRKA</span><h2>${done?'Nové Proplety máš hotové':'5 nových Propletů'}</h2><p>${done?'Paráda. Další várka dorazí zase v pondělí.':`Jedna úroveň od každé obtížnosti${extra?` · ${extra} je tentokrát dvakrát`:''}.`}</p></div></div><div class="new-content-actions"><button id="playNewContentBtn" class="primary-btn" ${all.length?'':'disabled'}>${done?'Zahrát znovu':'Hrát nové →'}</button><button id="contentDropNotifyBtn" class="text-btn">🔔 Upozornit na další</button></div>`;
 $('#playNewContentBtn').onclick=startLatestContent;$('#contentDropNotifyBtn').onclick=enableContentPushFromDrop;
 updatePushUI().catch(()=>{});
}

'''
app = replace_once(app, 'function renderFree(){\n', content_ui + 'function renderFree(){\n renderNewContentBanner();\n', "rolling content UI")
app = replace_once(
    app,
    '<span class="eyebrow">${progressLabel}</span><h2>${d.label}</h2></div></div>',
    '<span class="eyebrow">${progressLabel}</span><div class="difficulty-heading-line"><h2>${d.label}</h2>${newContentCount(key)?`<span class="fresh-level-badge">${newContentCount(key)} NOVÉ</span>`:""}</div></div></div>',
    "difficulty new badge",
)

# Preview date is also sent to server-side result guards, but production ignores it.
app = replace_once(
    app,
    " const p=getProfile(),headers={'Content-Type':'application/json',...(opts.headers||{})};if(p?.token)headers.Authorization=`Bearer ${p.token}`;else headers['X-Proplet-Anon-ID']=getAnonymousId();",
    " const p=getProfile(),headers={'Content-Type':'application/json',...(opts.headers||{})};if(p?.token)headers.Authorization=`Bearer ${p.token}`;else headers['X-Proplet-Anon-ID']=getAnonymousId();if(CONTENT_PREVIEW_DATE)headers['X-Proplet-Preview-As-Of']=CONTENT_PREVIEW_DATE;",
    "preview header in API",
)

push_block = r'''
function getPushNudgeState(){try{return JSON.parse(localStorage.getItem(PUSH_NUDGE_KEY)||'{}')}catch{return {}}}
function savePushNudgeState(v){localStorage.setItem(PUSH_NUDGE_KEY,JSON.stringify(v))}
function pushNudgeDue(){
 const st=getPushNudgeState();if(st.accepted||st.done||st.disabledByUser||st.systemDenied)return false;
 if(!st.nextOfferDate)return true;return pragueDateISO()>=st.nextOfferDate;
}
async function browserPushState(){
 const p=getProfile();if(!p?.token)return {account:false,sub:null,dailyEnabled:false,contentEnabled:false,migrationReady:false};
 if(!('Notification' in window)||!('PushManager' in window))return {account:true,unsupported:true,sub:null,dailyEnabled:false,contentEnabled:false,migrationReady:false};
 const cfg=await api('/api/push/config');if(!cfg.available)return {account:true,unavailable:true,config:cfg,sub:null,dailyEnabled:false,contentEnabled:false,migrationReady:!!cfg.preferencesReady};
 const reg=await getPushRegistration(),sub=await reg.pushManager.getSubscription();if(!sub)return {account:true,config:cfg,sub:null,dailyEnabled:false,contentEnabled:false,migrationReady:!!cfg.preferencesReady};
 try{const pref=await api(`/api/push/preferences?endpoint=${encodeURIComponent(sub.endpoint)}`);return {account:true,config:cfg,sub,dailyEnabled:!!pref.dailyEnabled,contentEnabled:!!pref.contentEnabled,migrationReady:!!pref.migrationReady}}catch{return {account:true,config:cfg,sub,dailyEnabled:true,contentEnabled:false,migrationReady:false}}
}
async function persistPushCategories(dailyEnabled,contentEnabled){
 const cfg=await api('/api/push/config');if(!cfg.available)throw new Error('Push ještě není nakonfigurovaný na serveru.');if(!cfg.preferencesReady)throw new Error('Nové nastavení upozornění čeká na databázovou migraci.');
 const reg=await getPushRegistration();let sub=await reg.pushManager.getSubscription();
 if(!dailyEnabled&&!contentEnabled){if(sub){try{await api('/api/push/unsubscribe',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint})})}catch{}await sub.unsubscribe()}return {dailyEnabled:false,contentEnabled:false}}
 if(!sub){const permission=await Notification.requestPermission();if(permission!=='granted'){savePushNudgeState({...getPushNudgeState(),done:true,systemDenied:true,deniedAt:new Date().toISOString()});throw new Error('Oznámení nejsou povolená. Později je můžeš zapnout v nastavení webu/prohlížeče.')}sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(cfg.publicKey)})}
 const j=sub.toJSON();await api('/api/push/subscribe',{method:'POST',body:JSON.stringify({endpoint:sub.endpoint,p256dh:j.keys?.p256dh,auth:j.keys?.auth,user_agent:navigator.userAgent.slice(0,240),daily_enabled:!!dailyEnabled,content_enabled:!!contentEnabled})});return {dailyEnabled:!!dailyEnabled,contentEnabled:!!contentEnabled}
}
async function shouldOfferPushNudge(){
 const p=getProfile(),g=currentGame;if(!p?.token||g?.mode!=='daily'||g?.justCompleted!==true||!pushNudgeDue())return false;if(!('Notification' in window)||!('PushManager' in window)||Notification.permission==='denied')return false;
 try{const state=await browserPushState();if(state.dailyEnabled){savePushNudgeState({accepted:true,acceptedAt:new Date().toISOString()});return false}return !!state.config?.available}catch{return false}
}
async function maybeOfferPushNudge(action){if(!(await shouldOfferPushNudge()))return false;postWinEngagementNudgeShown=true;pendingPushPostWinAction=action;$('#winModal').classList.add('hidden');$('#pushNudgeModal').classList.remove('hidden');return true}
function finishPushNudgeFlow(){const action=pendingPushPostWinAction;pendingPushPostWinAction=null;$('#pushNudgeModal').classList.add('hidden');if(action)performPostWinAction(action)}
function dismissPushNudge(){const st=getPushNudgeState(),declines=(st.declines||0)+1,today=pragueDateISO();if(declines>=3)savePushNudgeState({...st,declines,done:true,lastDeclinedAt:new Date().toISOString()});else savePushNudgeState({...st,declines,nextOfferDate:addDaysISO(today,declines===1?1:7),lastDeclinedAt:new Date().toISOString()});finishPushNudgeFlow()}
async function enablePushReminder(){const state=await browserPushState(),result=await persistPushCategories(true,!!state.contentEnabled);savePushNudgeState({accepted:true,acceptedAt:new Date().toISOString()});return result}
async function acceptPushNudge(){if(pushUiBusy)return;pushUiBusy=true;$('#pushNudgeEnableBtn').disabled=true;try{await enablePushReminder();showToast('Denní připomínka zapnutá 🔔');finishPushNudgeFlow()}catch(e){showToast(e.message)}finally{pushUiBusy=false;$('#pushNudgeEnableBtn').disabled=false;updatePushUI()}}
async function updatePushUI(){
 const dailyBtn=$('#pushToggleBtn'),contentBtn=$('#contentPushToggleBtn'),dailyText=$('#pushStatusText'),contentText=$('#contentPushStatusText'),dropBtn=$('#contentDropNotifyBtn');if(!dailyBtn||!contentBtn||pushUiBusy)return;
 const p=getProfile();if(!p?.token){dailyBtn.disabled=false;contentBtn.disabled=false;dailyBtn.textContent='☁️ Uložit postup';contentBtn.textContent='☁️ Uložit postup';dailyText.textContent='Připomínka se váže k tvému uloženému účtu.';contentText.textContent='Nové Proplety jsou samostatný opt-in.';dropBtn?.classList.remove('hidden');return}
 if(!('Notification' in window)||!('PushManager' in window)){dailyBtn.disabled=true;contentBtn.disabled=true;dailyBtn.textContent=contentBtn.textContent='🔕 Nepodporováno';dailyText.textContent=contentText.textContent='Na tomto zařízení/prohlížeči Web Push není dostupný.';return}
 try{const state=await browserPushState();if(state.unavailable){dailyBtn.disabled=true;contentBtn.disabled=true;dailyBtn.textContent=contentBtn.textContent='🔔 Push čeká na server';dailyText.textContent=contentText.textContent='Hraní funguje normálně. Push není nakonfigurovaný.';return}
  dailyBtn.disabled=false;dailyBtn.textContent=state.dailyEnabled?'Vypnout':'Zapnout';dailyText.textContent=state.dailyEnabled?'Zapnuto · nevyřešenou Daily připomeneme ráno.':Notification.permission==='denied'?'Oznámení jsou v prohlížeči zablokovaná.':'Vypnuto.';
  contentBtn.disabled=!state.migrationReady;contentBtn.textContent=state.contentEnabled?'Vypnout':'Zapnout';contentText.textContent=!state.migrationReady?'Čeká na Notifications v2 migraci.':state.contentEnabled?'Zapnuto · v pondělí dáme vědět o nové várce.':'Vypnuto · současný Daily souhlas jsme nerozšířili.';dropBtn?.classList.toggle('hidden',!!state.contentEnabled||!state.migrationReady);
 }catch(e){dailyBtn.disabled=true;contentBtn.disabled=true;dailyText.textContent=contentText.textContent=e.message}
}
async function togglePushCategory(category){
 const p=getProfile();if(!p?.token){openProfileModal('create');return}if(pushUiBusy)return;pushUiBusy=true;const dailyBtn=$('#pushToggleBtn'),contentBtn=$('#contentPushToggleBtn');dailyBtn.disabled=true;contentBtn.disabled=true;
 try{const state=await browserPushState();if(!state.migrationReady)throw new Error('Nové nastavení upozornění čeká na databázovou migraci.');let daily=!!state.dailyEnabled,content=!!state.contentEnabled;if(category==='daily')daily=!daily;else content=!content;await persistPushCategories(daily,content);if(category==='daily'){if(daily)savePushNudgeState({accepted:true,acceptedAt:new Date().toISOString()});else savePushNudgeState({...getPushNudgeState(),done:true,disabledByUser:true,disabledAt:new Date().toISOString()})}showToast(category==='daily'?(daily?'Denní připomínka zapnutá 🔔':'Denní připomínka vypnutá.'):(content?'Upozornění na nové Proplety zapnuté ✨':'Upozornění na nové Proplety vypnuté.'))}catch(e){showToast(e.message)}finally{pushUiBusy=false;updatePushUI()}
}
async function togglePushReminder(){return togglePushCategory('daily')}
async function toggleContentPushReminder(){return togglePushCategory('content')}
async function enableContentPushFromDrop(){const p=getProfile();if(!p?.token){openProfileModal('create');return}if(pushUiBusy)return;pushUiBusy=true;try{const state=await browserPushState();if(state.contentEnabled){showToast('Upozornění na nové Proplety už máš zapnuté ✨');return}await persistPushCategories(!!state.dailyEnabled,true);showToast('Dáme vědět o další várce ✨')}catch(e){showToast(e.message)}finally{pushUiBusy=false;updatePushUI()}}
'''
app = regex_once(app, r'function getPushNudgeState\(\)\{.*?\n\nfunction bind\(\)\{', push_block + '\n\nfunction bind(){', "notifications v2 client block")
app = replace_once(
    app,
    "$('#openAllGamesBtn').onclick=()=>nav('free');$('#pushToggleBtn').onclick=togglePushReminder;$('#pushNudgeEnableBtn').onclick=acceptPushNudge;",
    "$('#openAllGamesBtn').onclick=()=>nav('free');$('#pushToggleBtn').onclick=togglePushReminder;$('#contentPushToggleBtn').onclick=toggleContentPushReminder;$('#pushNudgeEnableBtn').onclick=acceptPushNudge;",
    "bind content push toggle",
)

loader = r'''const EXPECTED_PUZZLE_DB_VERSION=10;
const CONTENT_PREVIEW_DATE=typeof location!=='undefined'?String(new URLSearchParams(location.search).get('contentPreview')||'').slice(0,10):'';
function puzzleDatabaseUrl(){return CONTENT_PREVIEW_DATE?`/api/puzzles?preview_as_of=${encodeURIComponent(CONTENT_PREVIEW_DATE)}`:'/api/puzzles'}
function showPuzzleBootLoading(){
 const dailyMeta=$('#dailyMeta');if(dailyMeta&&!dailyMeta.textContent)dailyMeta.textContent='Načítám dnešní výzvu…';
 const grid=$('#difficultyCards');if(grid&&!grid.children.length)grid.innerHTML='<div class="card" style="grid-column:1/-1;padding:24px"><strong>Načítám úrovně…</strong><p class="muted" style="margin:6px 0 0">Připravuju herní banku.</p></div>';
}
async function loadPuzzleDatabase(){
 const url=puzzleDatabaseUrl(),headers=CONTENT_PREVIEW_DATE?{'X-Proplet-Preview-As-Of':CONTENT_PREVIEW_DATE}:{};
 if('caches' in window){
  try{const cached=await caches.match(url);if(cached){const data=await cached.clone().json();if(data?.version===EXPECTED_PUZZLE_DB_VERSION){fetch(url,{cache:'no-store',headers}).then(r=>r.ok?r.json():null).then(fresh=>{if(fresh?.version===EXPECTED_PUZZLE_DB_VERSION){puzzleDB=fresh;renderDaily();renderFree();renderProfile()}}).catch(()=>{});return data}}}catch{}
 }
 try{const r=await fetch(url,{cache:'no-store',headers});if(!r.ok)throw new Error('puzzle-api');const data=await r.json();if(data?.version!==EXPECTED_PUZZLE_DB_VERSION)throw new Error('puzzle-db-version');return data}catch(e){
  // Static fallback contains only the original released bank — never future reserve content.
  const r=await fetch('/puzzles.json',{cache:'no-store'});if(!r.ok)throw e;const data=await r.json();if(data?.version!==EXPECTED_PUZZLE_DB_VERSION)throw e;return data;
 }
}

async function boot(){'''
app = regex_once(app, r'const EXPECTED_PUZZLE_DB_VERSION=9;.*?\n\nasync function boot\(\)\{', loader, "dynamic release-gated puzzle loader")
app = replace_once(
    app,
    'document.body.classList.remove(\'landscape-game-blocked\');migrateScopedStorage();bind();bindClientErrorReporting();initNavigation();updateProfileChip();',
    'document.body.classList.remove(\'landscape-game-blocked\');migrateScopedStorage();bind();bindClientErrorReporting();initNavigation();const requestedOpen=new URLSearchParams(location.search).get(\'open\');if(requestedOpen===\'free\')nav(\'free\',{replace:true});updateProfileChip();',
    "notification deep link",
)
write("public/app.js", app)


# ---------------------------------------------------------------------------
# public/styles.css
# ---------------------------------------------------------------------------
css = read("public/styles.css")
css += r'''

/* v3.30 — weekly rolling content + independent notification preferences */
.new-content-banner{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 16px;padding:16px 18px;border:1px solid #ddd5f5;border-radius:20px;background:linear-gradient(135deg,#f3efff 0%,#fff 58%,#effaf5 100%);box-shadow:0 10px 28px rgba(52,42,94,.08)}
.new-content-main{display:flex;align-items:center;gap:13px;min-width:0}.new-content-spark{width:48px;height:48px;display:grid;place-items:center;flex:0 0 48px;border-radius:16px;background:#ebe5ff;font-size:24px}.new-content-main h2{margin:2px 0 3px;font-size:19px}.new-content-main p{margin:0;color:var(--muted);font-size:12px;line-height:1.4}.new-content-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.new-content-actions .primary-btn{white-space:nowrap}.new-content-actions .text-btn{white-space:nowrap}
.difficulty-heading-line{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.difficulty-heading-line h2{margin-right:2px}.fresh-level-badge{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;background:#6c5ce7;color:#fff;font-size:9px;font-weight:900;letter-spacing:.06em;line-height:1}
.notification-pref-list{display:grid;gap:9px;margin-top:13px}.notification-pref-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:11px;align-items:center;padding:12px;border:1px solid #e7e1ed;border-radius:16px;background:#faf9fc}.notification-pref-icon{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:#f0ecff;font-size:21px}.notification-pref-copy strong,.notification-pref-copy small{display:block}.notification-pref-copy strong{font-size:13px}.notification-pref-copy small{margin-top:2px;color:var(--muted);font-size:11px;line-height:1.35}.notification-pref-copy .push-status{margin-top:4px;font-size:10px}.notification-pref-btn{min-width:74px;padding:8px 10px;font-size:11px}
html[data-theme="dark"] .new-content-banner{background:linear-gradient(135deg,#29243b,#24212e 58%,#21332c);border-color:#443b5c;box-shadow:none}html[data-theme="dark"] .new-content-spark{background:#39324f}html[data-theme="dark"] .notification-pref-row{background:#292631;border-color:#403a49}html[data-theme="dark"] .notification-pref-icon{background:#39324f}
@media(max-width:600px){.new-content-banner{align-items:flex-start;flex-direction:column;padding:14px}.new-content-actions{width:100%;justify-content:flex-start}.new-content-actions .primary-btn{flex:1}.notification-pref-row{grid-template-columns:38px minmax(0,1fr);align-items:start}.notification-pref-icon{width:38px;height:38px}.notification-pref-btn{grid-column:2;justify-self:start}}
'''
write("public/styles.css", css)


# ---------------------------------------------------------------------------
# public/sw.js
# ---------------------------------------------------------------------------
sw = read("public/sw.js")
sw = regex_once(sw, r"const CACHE='[^']+';", "const CACHE='proplet-v3.30.0-preview.1-rolling-content';", "sw cache")
sw = replace_once(
    sw,
    "  if(u.pathname.startsWith('/api/'))return; // API se nikdy necachuje.\n  if(u.pathname==='/puzzles.json'){",
    "  if(u.pathname==='/api/puzzles'||u.pathname==='/puzzles.json'){",
    "sw release bank special case",
)
sw = replace_once(
    sw,
    "    return;\n  }\n  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{",
    "    return;\n  }\n  if(u.pathname.startsWith('/api/'))return; // Ostatní API se nikdy necachuje.\n  e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{",
    "sw non puzzle API no cache",
)
write("public/sw.js", sw)


# ---------------------------------------------------------------------------
# vercel.json
# ---------------------------------------------------------------------------
vercel = json.loads(read("vercel.json"))
crons = vercel.setdefault("crons", [])
content_cron_row = {"path": "/api/cron/content-push", "schedule": "0 16 * * 1"}
if content_cron_row not in crons:
    crons.append(content_cron_row)
write("vercel.json", json.dumps(vercel, ensure_ascii=False, indent=2) + "\n")

print("v3.30 runtime patch applied")
