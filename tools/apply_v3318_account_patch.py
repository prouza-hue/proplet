from pathlib import Path

p=Path('server.py')
s=p.read_text(encoding='utf-8')

repls=[]
repls.append(("APP_VERSION = \"3.31.7\"", "APP_VERSION = \"3.31.8\""))
repls.append((
'''class PlayerLogin(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    # New accounts log in with name + password. Team remains an optional
''',
'''class PlayerLogin(BaseModel):
    # v3.31.8: accepts either the historical display name or a verified email.
    name: str = Field(min_length=1, max_length=254)
    # New accounts log in with name + password. Team remains an optional
'''))
repls.append((
'''    family = norm_family(payload.family_code or "")
    name = " ".join(payload.name.strip().split())
    if family:
        candidates = [p for p in db_select("players", family_code=family) if p.get("name", "").casefold() == name.casefold()]
    else:
        # Teamless login is intentionally simple for the player. We only use
        # team when an old duplicate name needs disambiguation.
        candidates = [p for p in db_select("players") if p.get("name", "").casefold() == name.casefold()]
''',
'''    family = norm_family(payload.family_code or "")
    identifier = " ".join(payload.name.strip().split())
    if "@" in identifier:
        # Recovery email becomes a login identifier only after ownership was verified.
        email = identifier.casefold()
        candidates = [p for p in db_select("players") if p.get("email_verified_at") and str(p.get("email") or "").casefold() == email]
    elif family:
        candidates = [p for p in db_select("players", family_code=family) if p.get("name", "").casefold() == identifier.casefold()]
    else:
        # Teamless login is intentionally simple for the player. We only use
        # team when an old duplicate name needs disambiguation.
        candidates = [p for p in db_select("players") if p.get("name", "").casefold() == identifier.casefold()]
'''))

install='''\n\n# v3.31.8 — additive identity bridge. Existing Proplet sessions/passwords stay canonical.\nfrom account_auth import install_account_auth\ninstall_account_auth(\n    app,\n    supabase_url=SUPABASE_URL,\n    supabase_key=SUPABASE_SECRET_KEY,\n    tz=TZ,\n    db_select=db_select,\n    db_insert=db_insert,\n    db_update=db_update,\n    db_delete=db_delete,\n    auth_player=auth_player,\n    new_session=new_session,\n    hash_password=hash_password,\n    verify_password=verify_password,\n    enforce_rate_limit=enforce_rate_limit,\n    player_stats=player_stats,\n    public_family_code=public_family_code,\n    league_name_for=league_name_for,\n)\n\n'''
mount_marker='''# Lokální spuštění přes uvicorn: Vercel obslouží public/ sám z CDN.\nif not os.environ.get("VERCEL"):\n'''
if install.strip() not in s:
    if mount_marker not in s:
        raise SystemExit('mount marker not found')
    s=s.replace(mount_marker,install+mount_marker,1)

for old,new in repls:
    if old not in s:
        raise SystemExit(f'patch pattern not found: {old[:90]!r}')
    s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
print('v3.31.8 server patch applied')
