from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def text(path): return (ROOT/path).read_text(encoding='utf-8')
def write(path,value): (ROOT/path).write_text(value,encoding='utf-8')
def replace_once(value,old,new,label):
    c=value.count(old)
    if c!=1: raise SystemExit(f'{label}: expected 1 occurrence, found {c}: {old[:100]!r}')
    return value.replace(old,new,1)

# ---------------- server ----------------
s=text('server.py')

s=replace_once(s,
'''class FamilyLeagueSettings(BaseModel):
    enabled: bool
    public_name: Optional[str] = Field(default=None, min_length=2, max_length=40)
    league_pin: Optional[str] = Field(default=None, max_length=32)  # backward compatibility with v3.8.1 clients
''',
'''class FamilyLeagueSettings(BaseModel):
    enabled: bool
    public_name: Optional[str] = Field(default=None, min_length=2, max_length=40)
    league_pin: Optional[str] = Field(default=None, max_length=32)  # backward compatibility with v3.8.1 clients


class PublicRankingsSet(BaseModel):
    enabled: bool
''','server model')

old='''def _ranking_visibility_ready() -> bool:
    try:
        db_request("GET", "players", params={"select": "id,public_rankings", "limit": "1"})
        return True
    except HTTPException:
        return False


def _ranking_player_visible(player: dict, viewer_id: str | None) -> bool:
    if viewer_id and str(player.get("id")) == viewer_id:
        return True
    return player.get("public_rankings") is not False
'''
new='''def rankings_v2_schema_ready() -> bool:
    try:
        db_request("GET", "players", params={"select": "id,public_rankings", "limit": "1"})
        db_request("GET", "results", params={"select": "id,team_code_at_completion", "limit": "1"})
        db_request("GET", "team_memberships", params={"select": "id,player_id,team_code,joined_at,left_at", "limit": "1"})
        return True
    except HTTPException:
        return False


def _ranking_visibility_ready() -> bool:
    try:
        db_request("GET", "players", params={"select": "id,public_rankings", "limit": "1"})
        return True
    except HTTPException:
        return False


def _ranking_player_visible(player: dict, viewer_id: str | None) -> bool:
    if viewer_id and str(player.get("id")) == viewer_id:
        return True
    # NULL means the player has not answered the one-time visibility notice yet.
    return player.get("public_rankings") is True
'''
s=replace_once(s,old,new,'ranking visibility helpers')

marker='''    return family


def _ranking_badge_counts(results: list[dict], rescues: list[dict]) -> dict[str, int]:
'''
insert='''    return family


def team_code_for_player_at(player: dict, completed_at: str | datetime | None) -> str | None:
    """Resolve the team a player belonged to at the actual completion timestamp.

    This is deliberately time-based so a delayed offline result cannot be credited to
    a team the player joined only later. After switching teams, old XP never moves.
    """
    completed = parse_timestamp(completed_at)
    player_id = str(player.get("id") or "")
    if not completed or not player_id:
        return None
    try:
        memberships = db_select("team_memberships", player_id=player_id)
        for membership in memberships:
            joined = parse_timestamp(membership.get("joined_at"))
            left = parse_timestamp(membership.get("left_at"))
            if joined and joined <= completed and (left is None or completed < left):
                family = norm_family(str(membership.get("team_code") or ""))
                if family and not family.startswith(SOLO_FAMILY_PREFIX):
                    return family
        return None
    except HTTPException:
        # Preview/backward-compatible fallback before the additive migration exists.
        return _ranking_result_team({"completed_at": completed.isoformat()}, player)


def _ranking_badge_counts(results: list[dict], rescues: list[dict]) -> dict[str, int]:
'''
s=replace_once(s,marker,insert,'team historical resolver')

ctx_marker='''    return players, results, rescues, player_by_id, league_by_code, public_team_names


@app.get("/api/rankings/xp")
'''
ctx_insert='''    return players, results, rescues, player_by_id, league_by_code, public_team_names


@app.post("/api/rankings/visibility")
def rankings_visibility(
    payload: PublicRankingsSet,
    request: Request,
    authorization: Optional[str] = Header(default=None),
):
    enforce_rate_limit(request, "rankings_visibility", limit=20, window_seconds=3600)
    player = auth_player(authorization)
    try:
        db_update("players", {"id": player["id"]}, {"public_rankings": bool(payload.enabled)})
    except HTTPException as exc:
        raise HTTPException(503, "Nové pořadí ještě čeká na databázovou aktualizaci") from exc
    return {"ok": True, "publicRankings": bool(payload.enabled)}


@app.get("/api/team-settings")
def team_settings(request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "team_settings_read", limit=120, window_seconds=3600)
    player = auth_player(authorization)
    family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
    if not family:
        return {"hasTeam": False}
    rows = db_select("leagues", code=family)
    if not rows:
        raise HTTPException(404, "Tým neexistuje")
    league = rows[0]
    return {
        "hasTeam": True,
        "leagueName": league.get("name") or family,
        "publicEnabled": league.get("public_opt_in") is True,
        "publicName": league.get("public_name") or league.get("name") or family,
    }


@app.post("/api/team-membership/leave")
def leave_team(request: Request, authorization: Optional[str] = Header(default=None)):
    enforce_rate_limit(request, "team_leave", limit=8, window_seconds=3600)
    player = auth_player(authorization)
    family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
    if not family:
        return {"ok": True, "familyCode": None, "leagueName": None}
    now = datetime.now(TZ).isoformat()
    try:
        memberships = db_select("team_memberships", player_id=player["id"])
    except HTTPException as exc:
        raise HTTPException(503, "Změna týmu ještě čeká na databázovou aktualizaci") from exc
    active = [row for row in memberships if not row.get("left_at")]
    for membership in active:
        db_update("team_memberships", {"id": membership["id"]}, {"left_at": now})
    new_solo = make_solo_family_code()
    db_update("players", {"id": player["id"]}, {"family_code": new_solo, "team_joined_at": None})
    return {"ok": True, "familyCode": None, "leagueName": None}


@app.get("/api/rankings/xp")
'''
s=replace_once(s,ctx_marker,ctx_insert,'rankings endpoints insert')

# Add the visibility state to profile responses.
s=replace_once(s,
'"hasPassword": bool(payload.password), "avatar": row.get("avatar") or "🙂", "supportMode": row.get("support_mode") or "none", "stats": stats,',
'"hasPassword": bool(payload.password), "avatar": row.get("avatar") or "🙂", "supportMode": row.get("support_mode") or "none", "publicRankings": row.get("public_rankings"), "stats": stats,',
'create profile response')
s=replace_once(s,
'"token": token, "hasPassword": True, "avatar": player.get("avatar") or "🙂", "supportMode": player.get("support_mode") or "none", "stats": player_stats(player["id"]),',
'"token": token, "hasPassword": True, "avatar": player.get("avatar") or "🙂", "supportMode": player.get("support_mode") or "none", "publicRankings": player.get("public_rankings"), "stats": player_stats(player["id"]),',
'login profile response')
s=replace_once(s,
'"hasPassword": bool(player.get("password_hash")), "avatar": player.get("avatar") or "🙂", "supportMode": player.get("support_mode") or "none", "stats": stats,',
'"hasPassword": bool(player.get("password_hash")), "avatar": player.get("avatar") or "🙂", "supportMode": player.get("support_mode") or "none", "publicRankings": player.get("public_rankings"), "stats": stats,',
'me profile response')
s=replace_once(s,
'"teamJoinedAt": player.get("team_joined_at"),\n            "hasPassword": bool(player.get("password_hash")),',
'"teamJoinedAt": player.get("team_joined_at"),\n            "publicRankings": player.get("public_rankings"),\n            "hasPassword": bool(player.get("password_hash")),',
'account export visibility')

# Backfill membership history for legacy cached account creation that still supplied a team.
s=replace_once(s,
'''    stats = player_stats(player_id)
    public_family = public_family_code(family, row.get("team_joined_at"))
''',
'''    if not solo and row.get("team_joined_at"):
        try:
            db_insert("team_memberships", {
                "id": str(uuid.uuid4()), "player_id": player_id, "team_code": family,
                "joined_at": row["team_joined_at"], "created_at": row["team_joined_at"],
            })
        except HTTPException:
            logger.warning("Could not create initial team_membership for player %s", player_id)
    stats = player_stats(player_id)
    public_family = public_family_code(family, row.get("team_joined_at"))
''','legacy create membership')

# Team join: preserve current behavior but also open an immutable membership interval.
s=replace_once(s,
'''    db_update("players", {"id": player["id"]}, {"family_code": family, "team_joined_at": datetime.now(TZ).isoformat()})
    return {"ok": True, "familyCode": family, "leagueName": league_name_for(family)}
''',
'''    joined_at = datetime.now(TZ).isoformat()
    db_update("players", {"id": player["id"]}, {"family_code": family, "team_joined_at": joined_at})
    try:
        db_insert("team_memberships", {
            "id": str(uuid.uuid4()), "player_id": player["id"], "team_code": family,
            "joined_at": joined_at, "created_at": joined_at,
        })
    except HTTPException as exc:
        # Avoid a half-switched player if the new history layer is unavailable.
        db_update("players", {"id": player["id"]}, {"family_code": current_family, "team_joined_at": player.get("team_joined_at")})
        raise HTTPException(503, "Týmová aktualizace se nepodařila dokončit") from exc
    return {"ok": True, "familyCode": family, "leagueName": league_name_for(family)}
''','team join history')

# Awarded XP is stamped with the team active at the actual completion timestamp.
needle='db_insert("results", {'
if s.count(needle)!=1:
    raise SystemExit(f'result insert count = {s.count(needle)}')
s=s.replace(needle, needle+'\n                **({"team_code_at_completion": team_code_for_player_at(player, official_completed_at)} if rankings_v2_schema_ready() else {}),',1)

# If a delayed offline completion proves the official first completion was earlier,
# correct the team attribution to the membership active at that earlier timestamp too.
pat=r'(elif incoming_is_earlier[^\n]*:\n\s*db_update\("results", \{"id": old\["id"\]\}, \{\n)(\s*)'
s,n=re.subn(pat,lambda m:m.group(1)+m.group(2)+'**({"team_code_at_completion": team_code_for_player_at(player, official_completed_at)} if rankings_v2_schema_ready() else {}),\n'+m.group(2),s)
if n!=2: raise SystemExit(f'expected 2 incoming-earlier team patches, got {n}')

# Health capability flag.
s=replace_once(s,'"xpEconomyVersion": 2,','"xpEconomyVersion": 2,\n        "rankingsVersion": 2,','health base version')
s=replace_once(s,
'''        "xpMigration": xp_migration,
        "helperSystem": True,
''',
'''        "xpMigration": xp_migration,
        "rankingsV2Migration": rankings_v2_schema_ready(),
        "helperSystem": True,
''','health success flag')

write('server.py',s)

# ---------------- index.html ----------------
h=text('public/index.html')
old_modal='''  <div id="familyLeagueModal" class="modal hidden" role="dialog" aria-modal="true">
    <div class="modal-card left family-league-modal-card">
      <button id="closeFamilyLeagueModal" class="modal-close" aria-label="Zavřít">×</button>
      <span class="eyebrow">🌍 LIGA TÝMŮ</span>
      <h2>Pošli tým do světa</h2>
      <p class="muted">Veřejně se ukáže jen název týmu a společné skóre. Jména hráčů ani interní kód týmu nikdo cizí neuvidí. Nastavení může změnit kterýkoli přihlášený člen týmu.</p>
      <label>Veřejný název týmu<input id="familyLeaguePublicName" maxlength="40" placeholder="např. Prouzovi nebo Brutální Propletači" /></label>
      <small class="field-note">PIN týmu slouží jen jako pozvánka při přidání hráče do týmu.</small>
      <div id="familyLeagueModalError" class="form-error"></div>
      <button id="enableFamilyLeagueBtn" class="primary-btn big">Zařadit tým do Ligy týmů 🌍</button>
      <button id="disableFamilyLeagueBtn" class="secondary-btn hidden">Vystoupit z Ligy týmů</button>
    </div>
  </div>
'''
new_modal='''  <div id="familyLeagueModal" class="modal hidden" role="dialog" aria-modal="true">
    <div class="modal-card left family-league-modal-card">
      <button id="closeFamilyLeagueModal" class="modal-close" aria-label="Zavřít">×</button>
      <span class="eyebrow">👥 NASTAVENÍ TÝMU</span>
      <h2 id="teamSettingsTitle">Tvůj tým</h2>
      <p class="muted">Tým může být vidět v globálním pořadí pod veřejným názvem. Interní kód, PIN ani účty hráčů se nezveřejňují.</p>
      <label>Veřejný název týmu<input id="familyLeaguePublicName" maxlength="40" placeholder="např. Prouzovi nebo Brutální Propletači" /></label>
      <small class="field-note">PIN slouží jen jako pozvánka pro další členy.</small>
      <div id="familyLeagueModalError" class="form-error"></div>
      <button id="enableFamilyLeagueBtn" class="primary-btn big">Zobrazit tým v pořadí</button>
      <button id="disableFamilyLeagueBtn" class="secondary-btn hidden">Skrýt tým z veřejného pořadí</button>
      <div class="team-settings-separator"></div>
      <button id="leaveTeamBtn" class="danger-btn">Opustit tým</button>
      <small class="field-note">Tvoje dříve získané týmové XP zůstanou tam, kde vznikly. Do nového týmu si historii nepřeneseš.</small>
    </div>
  </div>

  <div id="rankingPrivacyModal" class="modal hidden" role="dialog" aria-modal="true">
    <div class="modal-card left ranking-privacy-modal-card">
      <button id="closeRankingPrivacyModal" class="modal-close" aria-label="Zavřít">×</button>
      <span class="eyebrow">🏆 NOVÉ POŘADÍ</span>
      <h2>Pořadí je teď společné</h2>
      <p class="muted">Když se zapojíš, ostatní uvidí jen tvůj emoji avatar, herní jméno a případně veřejný název týmu. Nic dalšího z účtu nezveřejňujeme.</p>
      <div class="ranking-privacy-preview"><span id="rankingPrivacyPreviewAvatar">🙂</span><div><strong id="rankingPrivacyPreviewName">Hráč</strong><small>Takto bude vypadat tvůj veřejný profil.</small></div></div>
      <button id="acceptRankingPrivacyBtn" class="primary-btn big">Rozumím · zapojit mě</button>
      <button id="hideRankingPrivacyBtn" class="secondary-btn bigish">Nezobrazovat mě</button>
    </div>
  </div>
'''
h=replace_once(h,old_modal,new_modal,'team/privacy modal html')
write('public/index.html',h)

# ---------------- app.js ----------------
a=text('public/app.js')

# Profile copy: team != league.
a=replace_once(a,
"<span>Týmové pořadí a Liga týmů jsou aktivní. PIN slouží jen jako pozvánka pro další hráče.</span>",
"<span>Týmové pořadí je aktivní. PIN slouží jen jako pozvánka pro další hráče.</span>",
'profile team copy')

privacy_helpers=r'''async function ensureRankingProfileState(){
 const p=getProfile();if(!p?.token)return p;
 if(Object.prototype.hasOwnProperty.call(p,'publicRankings'))return p;
 try{const fresh=await api('/api/me');saveProfile({...p,...fresh,token:p.token});return getProfile()}catch{return p}
}
function renderRankingPrivacyNote(){
 const box=$('#rankingPrivacyNote'),p=getProfile();if(!box)return;
 if(!p?.token){box.innerHTML='<span class="ranking-privacy-icon">👀</span><div><strong>Společné pořadí, minimum profilu</strong><small>Veřejný profil tvoří jen emoji avatar, herní jméno a případně veřejný název týmu.</small></div>';return}
 const state=p.publicRankings;
 const title=state===true?'Jsi ve veřejném pořadí':state===false?'V globálním pořadí jsi skrytý':'Vyber si, jestli chceš být vidět';
 const copy=state===true?'Ostatní vidí jen avatar, herní jméno a případně veřejný tým.':state===false?'Tvoje individuální výsledky se ostatním neukazují. Týmové součty tím nejsou ovlivněné.':'Dokud volbu nepotvrdíš, ostatním se tvoje jméno neukáže.';
 const action=state===true?'Skrýt mě':state===false?'Zobrazit mě':'Nastavit';
 box.innerHTML=`<span class="ranking-privacy-icon">👀</span><div><strong>${title}</strong><small>${copy}</small></div><button id="rankingPrivacyActionBtn" class="text-btn">${action}</button>`;
 setTimeout(()=>{const b=$('#rankingPrivacyActionBtn');if(b)b.onclick=()=>state===true?saveRankingVisibility(false):state===false?saveRankingVisibility(true):openRankingPrivacyModal()},0)
}
function openRankingPrivacyModal(){
 const p=getProfile();if(!p?.token){openProfileModal('create');return}
 $('#rankingPrivacyPreviewAvatar').textContent=p.avatar||'🙂';$('#rankingPrivacyPreviewName').textContent=p.name||'Hráč';$('#rankingPrivacyModal').classList.remove('hidden')
}
async function saveRankingVisibility(enabled){
 try{const result=await api('/api/rankings/visibility',{method:'POST',body:JSON.stringify({enabled})}),p=getProfile();saveProfile({...p,publicRankings:result.publicRankings});$('#rankingPrivacyModal').classList.add('hidden');renderRankingPrivacyNote();showToast(enabled?'Jsi ve společném pořadí 🏆':'V globálním pořadí jsi skrytý');await renderLeaderboard()}catch(e){showToast(e.message)}
}
function maybeShowRankingPrivacyNotice(){const p=getProfile();if(p?.token&&p.publicRankings==null)openRankingPrivacyModal()}

'''
a=replace_once(a,'async function renderLeaderboard(){',privacy_helpers+'async function renderLeaderboard(){','ranking privacy helpers')
a=replace_once(a,
'''async function renderLeaderboard(){
 const xpList=$('#xpLeaderboardList'),dailyList=$('#dailyLeaderboardList');
 if(!xpList||!dailyList)return;
''',
'''async function renderLeaderboard(){
 const xpList=$('#xpLeaderboardList'),dailyList=$('#dailyLeaderboardList');
 if(!xpList||!dailyList)return;
 await ensureRankingProfileState();
 renderRankingPrivacyNote();
 maybeShowRankingPrivacyNotice();
''','ranking render privacy state')

# Replace team settings functions; the old global 0-700 data is no longer a prerequisite.
start=a.index('function openFamilyLeagueModal(){')
end=a.index('\n\nasync function sendPuzzleFeedback',start)
team_funcs=r'''async function openFamilyLeagueModal(){
 const p=getProfile();if(!p?.token){openProfileModal('create');return}if(!p.familyCode){openTeamMembershipModal();return}
 try{const data=await api('/api/team-settings');if(!data.hasTeam){openTeamMembershipModal();return}$('#teamSettingsTitle').textContent=data.leagueName||'Tvůj tým';$('#familyLeaguePublicName').value=data.publicName||data.leagueName||'';$('#familyLeagueModalError').textContent='';$('#enableFamilyLeagueBtn').textContent=data.publicEnabled?'Uložit veřejný název':'Zobrazit tým v pořadí';$('#disableFamilyLeagueBtn').classList.toggle('hidden',!data.publicEnabled);$('#familyLeagueModal').classList.remove('hidden')}catch(e){showToast(e.message)}
}
async function saveFamilyLeagueSettings(enabled){
 const name=$('#familyLeaguePublicName').value.trim();$('#familyLeagueModalError').textContent='';if(enabled&&name.length<2){$('#familyLeagueModalError').textContent='Pojmenuj veřejný tým.';return}
 try{await api('/api/family-league/settings',{method:'POST',body:JSON.stringify({enabled,public_name:name||null})});$('#familyLeagueModal').classList.add('hidden');showToast(enabled?'Tým je ve veřejném pořadí 👥':'Tým je z veřejného pořadí skrytý');await renderLeaderboard()}catch(e){$('#familyLeagueModalError').textContent=e.message}
}
async function leaveCurrentTeam(){
 const p=getProfile();if(!p?.familyCode)return;if(!confirm(`Opravdu opustit tým ${p.leagueName||p.familyCode}? Dříve získané týmové XP zůstanou týmu.`))return;
 try{await api('/api/team-membership/leave',{method:'POST',body:'{}'});saveProfile({...p,familyCode:null,leagueName:null});$('#familyLeagueModal').classList.add('hidden');showToast('Tým jsi opustil. Historické XP zůstaly na místě.');renderProfile();await renderLeaderboard()}catch(e){$('#familyLeagueModalError').textContent=e.message}
}'''
a=a[:start]+team_funcs+a[end:]

# Bind new privacy/team controls.
a=replace_once(a,
"$('#familyLeagueSettingsBtn').onclick=openFamilyLeagueModal;$('#closeFamilyLeagueModal').onclick=()=>$('#familyLeagueModal').classList.add('hidden');$('#enableFamilyLeagueBtn').onclick=()=>saveFamilyLeagueSettings(true);$('#disableFamilyLeagueBtn').onclick=()=>saveFamilyLeagueSettings(false);",
"$('#familyLeagueSettingsBtn').onclick=openFamilyLeagueModal;$('#closeFamilyLeagueModal').onclick=()=>$('#familyLeagueModal').classList.add('hidden');$('#enableFamilyLeagueBtn').onclick=()=>saveFamilyLeagueSettings(true);$('#disableFamilyLeagueBtn').onclick=()=>saveFamilyLeagueSettings(false);$('#leaveTeamBtn').onclick=leaveCurrentTeam;$('#closeRankingPrivacyModal').onclick=()=>$('#rankingPrivacyModal').classList.add('hidden');$('#acceptRankingPrivacyBtn').onclick=()=>saveRankingVisibility(true);$('#hideRankingPrivacyBtn').onclick=()=>saveRankingVisibility(false);",
'bind privacy/team controls')

write('public/app.js',a)

# ---------------- styles ----------------
c=text('public/styles.css')
c += r'''

/* v3.31.7 privacy + durable teams */
.ranking-privacy-note{justify-content:flex-start}.ranking-privacy-note>div{flex:1;min-width:0}.ranking-privacy-note .text-btn{flex:0 0 auto;margin-left:auto;align-self:center;font-size:10px}
.ranking-privacy-preview{display:flex;align-items:center;gap:12px;padding:12px 13px;margin:14px 0;border-radius:15px;background:#f5f1fa}.ranking-privacy-preview>span{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:white;font-size:25px}.ranking-privacy-preview strong,.ranking-privacy-preview small{display:block}.ranking-privacy-preview small{font-size:10px;color:var(--muted);margin-top:2px}.team-settings-separator{height:1px;background:var(--line);margin:15px 0 12px}.family-league-modal-card .danger-btn{width:100%}
@media(max-width:520px){.ranking-privacy-note{flex-wrap:wrap}.ranking-privacy-note .text-btn{margin-left:32px}}
'''
write('public/styles.css',c)

print('v3.31.7 privacy/team-history phase 2 applied')
