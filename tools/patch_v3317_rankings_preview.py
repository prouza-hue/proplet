from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one occurrence of {old!r}, found {count}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def regex_replace_once(path, pattern, replacement):
    p = ROOT / path
    text = p.read_text(encoding='utf-8')
    new, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{path}: pattern did not match exactly once: {pattern[:100]}')
    p.write_text(new, encoding='utf-8')


replace_once('server.py', 'APP_VERSION = "3.31.6.1"', 'APP_VERSION = "3.31.7"')
replace_once('public/app.js', "const APP_VERSION='3.31.6.1';", "const APP_VERSION='3.31.7';")
replace_once('public/sw.js', "const CACHE='proplet-v3.31.6.1-atomic-boot-compat';", "const CACHE='proplet-v3.31.7-rankings-teams';")

server_insert = r'''

def _ranking_period_start(period: str) -> datetime | None:
    now = datetime.now(TZ)
    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "week":
        start = now - timedelta(days=now.weekday())
        return start.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "all":
        return None
    raise HTTPException(400, "Neplatné období pořadí")


def _ranking_viewer(authorization: Optional[str]) -> dict | None:
    if not authorization:
        return None
    try:
        return auth_player(authorization)
    except HTTPException:
        return None


def _ranking_visibility_ready() -> bool:
    try:
        db_request("GET", "players", params={"select": "id,public_rankings", "limit": "1"})
        return True
    except HTTPException:
        return False


def _ranking_player_visible(player: dict, viewer_id: str | None) -> bool:
    if viewer_id and str(player.get("id")) == viewer_id:
        return True
    return player.get("public_rankings") is not False


def _ranking_result_team(row: dict, player: dict | None) -> str | None:
    # v3.31.7 migration stores the authoritative team at XP acquisition. Until the
    # additive migration is applied, preview falls back to the current one-team model.
    stored = norm_family(str(row.get("team_code_at_completion") or ""))
    if stored and not stored.startswith(SOLO_FAMILY_PREFIX):
        return stored
    if not player or is_solo_player(player):
        return None
    family = norm_family(str(player.get("family_code") or ""))
    if not family:
        return None
    joined = parse_timestamp(player.get("team_joined_at"))
    completed = parse_timestamp(row.get("completed_at"))
    if joined and completed and completed < joined:
        return None
    return family


def _ranking_badge_counts(results: list[dict], rescues: list[dict]) -> dict[str, int]:
    dates: dict[str, set[str]] = {}
    for row in results:
        if row.get("mode") == "daily" and row.get("daily_date") and row.get("player_id"):
            dates.setdefault(str(row["player_id"]), set()).add(str(row["daily_date"])[:10])
    for row in rescues:
        if row.get("status") == "passed" and row.get("missed_date") and row.get("player_id"):
            dates.setdefault(str(row["player_id"]), set()).add(str(row["missed_date"])[:10])
    out = {}
    for player_id, values in dates.items():
        _, longest = streaks(list(values))
        out[player_id] = sum(1 for badge in BADGES if longest >= int(badge["days"]))
    return out


def _ranking_assign_tied_ranks(rows: list[dict], score_key: str) -> None:
    previous = object()
    rank = 0
    for index, row in enumerate(rows, 1):
        score = row.get(score_key)
        if score != previous:
            rank = index
            previous = score
        row["rank"] = rank


def _ranking_context():
    players = db_select_all("players")
    leagues = db_select_all("leagues")
    results = db_select_all("results")
    try:
        rescues = db_select_all("streak_rescues")
    except HTTPException:
        rescues = []
    player_by_id = {str(p.get("id")): p for p in players if p.get("id")}
    league_by_code = {norm_family(str(l.get("code") or "")): l for l in leagues if l.get("code")}
    public_team_names = {
        code: (league.get("public_name") or league.get("name") or code)
        for code, league in league_by_code.items() if league.get("public_opt_in") is True
    }
    return players, results, rescues, player_by_id, league_by_code, public_team_names


@app.get("/api/rankings/xp")
def rankings_xp(
    request: Request,
    period: str = Query(default="today", pattern="^(today|week|all)$"),
    authorization: Optional[str] = Header(default=None),
):
    enforce_rate_limit(request, "rankings_xp_read", limit=300, window_seconds=3600)
    viewer = _ranking_viewer(authorization)
    viewer_id = str(viewer.get("id")) if viewer else None
    viewer_team = public_family_code(viewer.get("family_code"), viewer.get("team_joined_at")) if viewer else None
    players, results, rescues, player_by_id, league_by_code, public_team_names = _ranking_context()
    period_start = _ranking_period_start(period)
    period_results = [
        row for row in results
        if period_start is None or ((parse_timestamp(row.get("completed_at")) or datetime.min.replace(tzinfo=TZ)) >= period_start)
    ]
    lifetime_points: dict[str, int] = {}
    for row in results:
        pid = str(row.get("player_id") or "")
        if pid:
            lifetime_points[pid] = lifetime_points.get(pid, 0) + int(row.get("points") or 0)
    period_points: dict[str, int] = {}
    for row in period_results:
        pid = str(row.get("player_id") or "")
        if pid:
            period_points[pid] = period_points.get(pid, 0) + int(row.get("points") or 0)
    badge_counts = _ranking_badge_counts(results, rescues)

    player_rows = []
    for player in players:
        pid = str(player.get("id") or "")
        score = int(period_points.get(pid, 0))
        if score <= 0 and pid != viewer_id:
            continue
        if not _ranking_player_visible(player, viewer_id):
            continue
        family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
        team_name = public_team_names.get(family or "")
        if pid == viewer_id and family and not team_name:
            league = league_by_code.get(family)
            team_name = (league or {}).get("name") or family
        player_rows.append({
            "name": player.get("name") or "Hráč", "avatar": player.get("avatar") or "🙂",
            "xp": score, "lifetimePoints": int(lifetime_points.get(pid, 0)),
            "teamName": team_name, "badgeCount": int(badge_counts.get(pid, 0)),
            "isMine": pid == viewer_id, "isPrivate": player.get("public_rankings") is False,
        })
    player_rows.sort(key=lambda row: (-row["xp"], -row["lifetimePoints"], str(row["name"]).casefold()))
    _ranking_assign_tied_ranks(player_rows, "xp")

    team_points: dict[str, int] = {}
    for row in period_results:
        player = player_by_id.get(str(row.get("player_id") or ""))
        family = _ranking_result_team(row, player)
        if family:
            team_points[family] = team_points.get(family, 0) + int(row.get("points") or 0)
    current_members: dict[str, int] = {}
    for player in players:
        family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
        if family:
            current_members[family] = current_members.get(family, 0) + 1
    team_rows = []
    for family, score in team_points.items():
        if score <= 0:
            continue
        if family not in public_team_names and family != viewer_team:
            continue
        league = league_by_code.get(family) or {}
        name = public_team_names.get(family) or league.get("name") or family
        team_rows.append({
            "name": name, "xp": int(score), "memberCount": int(current_members.get(family, 0)),
            "isMine": bool(viewer_team and family == viewer_team),
        })
    team_rows.sort(key=lambda row: (-row["xp"], -row["memberCount"], str(row["name"]).casefold()))
    _ranking_assign_tied_ranks(team_rows, "xp")
    return {
        "kind": "xp", "period": period, "players": player_rows, "teams": team_rows,
        "visibilityReady": _ranking_visibility_ready(),
        "scoring": "awarded-xp",
        "teamAttribution": "result-team-at-completion" if _ranking_visibility_ready() else "joined-at-compatible-preview",
    }


@app.get("/api/rankings/daily")
def rankings_daily(
    request: Request,
    daily_date: Optional[str] = Query(default=None),
    authorization: Optional[str] = Header(default=None),
):
    enforce_rate_limit(request, "rankings_daily_read", limit=300, window_seconds=3600)
    selected_date = daily_date or current_prague_date().isoformat()
    try:
        date.fromisoformat(selected_date)
    except ValueError:
        raise HTTPException(400, "Neplatné datum")
    viewer = _ranking_viewer(authorization)
    viewer_id = str(viewer.get("id")) if viewer else None
    viewer_team = public_family_code(viewer.get("family_code"), viewer.get("team_joined_at")) if viewer else None
    players, results, rescues, player_by_id, league_by_code, public_team_names = _ranking_context()
    primary_puzzle_id = expected_daily_puzzle_id(selected_date)
    day_rows = [
        row for row in results
        if row.get("mode") == "daily" and str(row.get("daily_date") or "")[:10] == selected_date
        and row.get("puzzle_id") == primary_puzzle_id
    ]
    by_player: dict[str, dict] = {}
    for row in day_rows:
        pid = str(row.get("player_id") or "")
        if not pid:
            continue
        previous = by_player.get(pid)
        if previous is None or completion_time(row) < completion_time(previous):
            by_player[pid] = row
    ranked_all = sorted(by_player.values(), key=lambda row: (
        0 if row.get("clean_solve") is True else 1,
        int(row.get("hints_used") or 0), int(row.get("best_elapsed_ms") or 10**12),
        int(row.get("best_moves") or 10**9), completion_time(row), str(row.get("player_id") or ""),
    ))
    player_rows = []
    for row in ranked_all:
        pid = str(row.get("player_id") or "")
        player = player_by_id.get(pid)
        if not player or not _ranking_player_visible(player, viewer_id):
            continue
        family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
        team_name = public_team_names.get(family or "")
        if pid == viewer_id and family and not team_name:
            league = league_by_code.get(family) or {}
            team_name = league.get("name") or family
        player_rows.append({
            "name": player.get("name") or "Hráč", "avatar": player.get("avatar") or "🙂", "teamName": team_name,
            "elapsedMs": int(row.get("best_elapsed_ms") or 0), "moves": int(row.get("best_moves") or 0),
            "hintsUsed": int(row.get("hints_used") or 0), "cleanSolve": row.get("clean_solve") is True,
            "isMine": pid == viewer_id,
        })
    for index, item in enumerate(player_rows, 1):
        item["rank"] = index

    by_team: dict[str, list[float]] = {}
    for row in day_rows:
        player = player_by_id.get(str(row.get("player_id") or ""))
        family = _ranking_result_team(row, player)
        if family:
            by_team.setdefault(family, []).append(_daily_individual_score(row, day_rows))
    current_members: dict[str, int] = {}
    for player in players:
        family = public_family_code(player.get("family_code"), player.get("team_joined_at"))
        if family:
            current_members[family] = current_members.get(family, 0) + 1
    team_rows = []
    for family, scores in by_team.items():
        if family not in public_team_names and family != viewer_team:
            continue
        top = sorted(scores, reverse=True)[:3]
        if not top:
            continue
        league = league_by_code.get(family) or {}
        team_rows.append({
            "name": public_team_names.get(family) or league.get("name") or family,
            "score": round(sum(top) / len(top), 1), "players": len(top),
            "memberCount": int(current_members.get(family, 0)), "isMine": bool(viewer_team and family == viewer_team),
        })
    team_rows.sort(key=lambda row: (-row["score"], -row["players"], str(row["name"]).casefold()))
    _ranking_assign_tied_ranks(team_rows, "score")
    return {
        "kind": "daily", "date": selected_date, "puzzleId": primary_puzzle_id,
        "players": player_rows, "teams": team_rows,
        "playerScoring": "clean-hints-time-moves",
        "teamScoring": "average-best-up-to-3-normalized-0-100",
    }

'''

server_marker = '@app.get("/api/free-archive")\ndef free_archive('
server = (ROOT / 'server.py').read_text(encoding='utf-8')
if server_marker not in server:
    raise SystemExit('server.py: free archive marker missing')
server = server.replace(server_marker, server_insert + '\n' + server_marker, 1)
(ROOT / 'server.py').write_text(server, encoding='utf-8')

new_leaderboard_html = '''    <section id="screen-leaderboard" class="screen">
      <div class="screen-title"><span class="eyebrow">POŘADÍ</span><h1>Kdo dnes vládne?</h1><p class="muted">XP ukazuje postup. Denní výzva zase to, kdo stejný Proplet zahrál nejlépe.</p></div>

      <div id="rankingPrivacyNote" class="ranking-privacy-note card">
        <span class="ranking-privacy-icon">👀</span>
        <div><strong>Společné pořadí, minimum profilu</strong><small>V preview se ukazuje jen emoji avatar, herní jméno a případně veřejný název týmu. Žádné interní ID ani účetní údaje.</small></div>
      </div>

      <section class="ranking-section card">
        <div class="ranking-section-head"><div><span class="eyebrow">🏆 XP</span><h2>Nasbírané XP</h2><p class="muted">Jednoduše: kdo v daném období získal nejvíc XP.</p></div></div>
        <div class="ranking-control-row">
          <div class="ranking-segment" role="tablist" aria-label="XP pořadí hráči nebo týmy">
            <button class="ranking-scope-tab active" data-ranking-xp-scope="players">Hráči</button>
            <button class="ranking-scope-tab" data-ranking-xp-scope="teams">Týmy</button>
          </div>
          <div class="ranking-segment ranking-period-segment" role="tablist" aria-label="Období XP pořadí">
            <button class="ranking-period-tab active" data-ranking-period="today">Dnes</button>
            <button class="ranking-period-tab" data-ranking-period="week">Týden</button>
            <button class="ranking-period-tab" data-ranking-period="all">Celkem</button>
          </div>
        </div>
        <div id="xpLeaderboardList" class="leaderboard-list"></div>
      </section>

      <section class="ranking-section card daily-ranking-card">
        <div class="ranking-section-head"><div><span class="eyebrow">☀️ DNEŠNÍ VÝZVA</span><h2>Kdo ji zahrál nejlépe?</h2><p class="muted">Čisté řešení → méně nápověd → čas → tahy.</p></div></div>
        <div class="ranking-segment ranking-daily-segment" role="tablist" aria-label="Denní pořadí hráči nebo týmy">
          <button class="ranking-daily-tab active" data-ranking-daily-scope="players">Hráči</button>
          <button class="ranking-daily-tab" data-ranking-daily-scope="teams">Týmy</button>
        </div>
        <div id="dailyLeaderboardList" class="leaderboard-list"></div>
        <div id="dailyTeamMethod" class="ranking-method hidden"><strong>Týmové Daily:</strong> průměr až tří nejlepších dnešních výkonů týmu, každý převedený na 0–100. Menší tým není penalizovaný počtem členů.</div>
      </section>

      <div id="rankingTeamCard" class="ranking-team-card card"></div>
      <button id="familyLeagueSettingsBtn" class="hidden" type="button" aria-hidden="true"></button>
    </section>
'''
regex_replace_once('public/index.html', r'    <section id="screen-leaderboard" class="screen">.*?    </section>\n\n    <section id="screen-profile"', new_leaderboard_html + '\n    <section id="screen-profile"')

replace_once('public/app.js', "let globalLeagueData=null;", "let globalLeagueData=null;\nlet rankingXpScope='players';\nlet rankingXpPeriod='today';\nlet rankingDailyScope='players';")

new_render = r'''async function renderLeaderboard(){
 const xpList=$('#xpLeaderboardList'),dailyList=$('#dailyLeaderboardList');
 if(!xpList||!dailyList)return;
 $$('.ranking-scope-tab').forEach(b=>b.classList.toggle('active',b.dataset.rankingXpScope===rankingXpScope));
 $$('.ranking-period-tab').forEach(b=>b.classList.toggle('active',b.dataset.rankingPeriod===rankingXpPeriod));
 $$('.ranking-daily-tab').forEach(b=>b.classList.toggle('active',b.dataset.rankingDailyScope===rankingDailyScope));
 $('#dailyTeamMethod')?.classList.toggle('hidden',rankingDailyScope!=='teams');
 renderRankingTeamCard();
 xpList.innerHTML='<div class="ranking-loading">Načítám XP pořadí…</div>';
 dailyList.innerHTML='<div class="ranking-loading">Načítám dnešní pořadí…</div>';
 try{
  const [xp,daily]=await Promise.all([
   api(`/api/rankings/xp?period=${rankingXpPeriod}`),
   api(`/api/rankings/daily?daily_date=${pragueDateISO()}`)
  ]);
  renderXpRanking(xp);
  renderDailyRanking(daily);
  const privacy=$('#rankingPrivacyNote');
  if(privacy&&xp.visibilityReady===true)privacy.dataset.visibilityReady='true';
 }catch(e){
  const msg=`<div class="ranking-empty"><strong>Pořadí se teď nepodařilo načíst.</strong><small>${esc(e.message)}</small></div>`;
  xpList.innerHTML=msg;dailyList.innerHTML=msg;
 }
}
function rankingRows(data,scope){return scope==='teams'?(data?.teams||[]):(data?.players||[])}
function rankingRankBadge(rank){return rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`${rank}.`}
function renderXpRanking(data){
 const list=$('#xpLeaderboardList'),rows=rankingRows(data,rankingXpScope);
 if(!rows.length){list.innerHTML=`<div class="ranking-empty"><strong>${rankingXpScope==='teams'?'Týmy':'Hráči'} zatím nemají XP v tomto období.</strong><small>První body tu udělají pořádek velmi rychle. 😄</small></div>`;return}
 list.innerHTML=rows.map(r=>{
  if(rankingXpScope==='teams')return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>👥 ${esc(r.name)}</strong><small>${countCz(r.memberCount||0,'člen','členové','členů')}</small></div><div class="leader-score"><strong>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</strong><small>${rankingXpPeriod==='today'?'dnes':rankingXpPeriod==='week'?'tento týden':'celkem'}</small></div></div>`;
  const level=levelFor(Number(r.lifetimePoints||0)),team=r.teamName?` · 👥 ${esc(r.teamName)}`:'';
  return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>${esc(r.avatar||'🙂')} ${esc(r.name)}${r.isMine?' <span class="ranking-you">Ty</span>':''}</strong><small><span class="ranking-rank-chip">${level.current.icon} ${esc(level.current.name)}</span>${r.badgeCount?` · 🏅 ${r.badgeCount}`:''}${team}</small></div><div class="leader-score"><strong>${Number(r.xp||0).toLocaleString('cs-CZ')} XP</strong><small>${rankingXpPeriod==='today'?'dnes':rankingXpPeriod==='week'?'tento týden':'celkem'}</small></div></div>`
 }).join('')
}
function renderDailyRanking(data){
 const list=$('#dailyLeaderboardList'),rows=rankingRows(data,rankingDailyScope);
 if(!rows.length){list.innerHTML='<div class="ranking-empty"><strong>Dnešní startovní rošt je zatím prázdný.</strong><small>Stačí dokončit Denní výzvu.</small></div>';return}
 list.innerHTML=rows.map(r=>{
  if(rankingDailyScope==='teams')return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>👥 ${esc(r.name)}</strong><small>${countCz(r.players||0,'výkon','výkony','výkonů')} v dnešním skóre · ${countCz(r.memberCount||0,'člen','členové','členů')}</small></div><div class="leader-score"><strong>${Number(r.score||0).toLocaleString('cs-CZ',{maximumFractionDigits:1})}</strong><small>/ 100</small></div></div>`;
  const quality=r.cleanSolve===true?'✨ Čistě':r.hintsUsed?`💡 ${r.hintsUsed}×`:'Bez nápovědy',team=r.teamName?` · 👥 ${esc(r.teamName)}`:'';
  return `<div class="leader-row ranking-row ${r.isMine?'me':''}"><div class="leader-rank">${rankingRankBadge(r.rank)}</div><div class="leader-name"><strong>${esc(r.avatar||'🙂')} ${esc(r.name)}${r.isMine?' <span class="ranking-you">Ty</span>':''}</strong><small>${quality} · ${countCz(r.moves||0,'tah','tahy','tahů')}${team}</small></div><div class="leader-score"><strong>${fmtTime(r.elapsedMs)}</strong><small>dnešní výzva</small></div></div>`
 }).join('')
}
function renderRankingTeamCard(){
 const box=$('#rankingTeamCard'),p=getProfile();if(!box)return;
 if(!p?.token){box.innerHTML='<div><span class="eyebrow">👥 TÝMY</span><strong>Chceš soutěžit i za partu?</strong><small>Pořadí můžeš sledovat bez účtu. Pro vlastní tým si nejdřív ulož postup.</small></div><button id="rankingAccountBtn" class="secondary-btn">☁️ Uložit postup</button>';setTimeout(()=>$('#rankingAccountBtn')&&($('#rankingAccountBtn').onclick=()=>openProfileModal('create')),0);return}
 if(!p.familyCode){box.innerHTML='<div><span class="eyebrow">👥 TÝMY</span><strong>Jsi zatím bez týmu</strong><small>Účet funguje samostatně. Tým můžeš přidat kdykoli, bez vlivu na předchozí XP.</small></div><button id="rankingJoinTeamBtn" class="secondary-btn">Přidat / založit tým</button>';setTimeout(()=>$('#rankingJoinTeamBtn')&&($('#rankingJoinTeamBtn').onclick=openTeamMembershipModal),0);return}
 box.innerHTML=`<div><span class="eyebrow">👥 TVŮJ TÝM</span><strong>${esc(p.leagueName||p.familyCode)}</strong><small>Do týmových XP se počítají jen XP získané během členství.</small></div><button id="rankingTeamSettingsBtn" class="secondary-btn">Nastavení týmu</button>`;
 setTimeout(()=>$('#rankingTeamSettingsBtn')&&($('#rankingTeamSettingsBtn').onclick=openFamilyLeagueModal),0)
}

async function renderGlobalLeague(){'''
regex_replace_once('public/app.js', r'async function renderLeaderboard\(\)\{.*?\n\}\nfunction renderLeaderData\(data\)\{.*?\n\}\n\nasync function renderGlobalLeague\(\)\{', new_render)

bind_anchor = "$$('.leader-tab').forEach(b=>b.onclick=()=>{leaderTab=b.dataset.leaderTab;$$('.leader-tab').forEach(x=>x.classList.toggle('active',x===b));renderLeaderboard()});"
bind_add = bind_anchor + "\n $$('.ranking-scope-tab').forEach(b=>b.onclick=()=>{rankingXpScope=b.dataset.rankingXpScope;renderLeaderboard()});$$('.ranking-period-tab').forEach(b=>b.onclick=()=>{rankingXpPeriod=b.dataset.rankingPeriod;renderLeaderboard()});$$('.ranking-daily-tab').forEach(b=>b.onclick=()=>{rankingDailyScope=b.dataset.rankingDailyScope;renderLeaderboard()});"
replace_once('public/app.js', bind_anchor, bind_add)

css_append = r'''

/* v3.31.7 Rankings & Teams */
.ranking-privacy-note{display:flex;align-items:flex-start;gap:11px;padding:13px 14px;margin-bottom:12px;background:linear-gradient(145deg,#f8f5ff,#f1fbf7)}
.ranking-privacy-icon{font-size:22px;line-height:1}.ranking-privacy-note strong,.ranking-privacy-note small{display:block}.ranking-privacy-note strong{font-size:12px}.ranking-privacy-note small{font-size:10px;color:var(--muted);line-height:1.35;margin-top:2px}
.ranking-section{padding:16px;margin-bottom:12px}.ranking-section-head h2{margin:3px 0;font-size:22px;letter-spacing:-.03em}.ranking-section-head p{margin:0 0 12px;font-size:12px;line-height:1.35}
.ranking-control-row{display:grid;grid-template-columns:1fr 1.35fr;gap:8px;margin-bottom:12px}.ranking-segment{display:flex;background:#ebe6f3;padding:4px;border-radius:14px}.ranking-segment button{flex:1;border:0;background:transparent;color:#737083;border-radius:10px;padding:8px 7px;font-size:12px;font-weight:850;cursor:pointer}.ranking-segment button.active{background:white;color:#312e47;box-shadow:0 3px 9px rgba(70,55,111,.08)}.ranking-daily-segment{max-width:245px;margin-bottom:12px}
.ranking-row.me{outline:2px solid rgba(108,92,231,.28);background:linear-gradient(145deg,#fbf9ff,#f4f0ff)}.ranking-row:first-child.me{background:linear-gradient(145deg,#fffdf6,#fff4ca)}.ranking-you{display:inline-flex;vertical-align:1px;margin-left:4px;padding:2px 5px;border-radius:999px;background:#eee9ff;color:#5d4ed0;font-size:8px;font-weight:950;text-transform:uppercase;letter-spacing:.08em}.ranking-rank-chip{font-weight:800;color:#5d586d}.ranking-loading,.ranking-empty{padding:18px 10px;text-align:center;color:var(--muted)}.ranking-empty strong,.ranking-empty small{display:block}.ranking-empty strong{font-size:13px;color:var(--ink)}.ranking-empty small{font-size:10px;margin-top:4px}
.ranking-method{margin-top:11px;padding:10px 11px;border-radius:13px;background:#f5f1fa;color:#696579;font-size:10px;line-height:1.4}.ranking-method strong{color:#4a465b}.ranking-team-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px}.ranking-team-card>div{min-width:0}.ranking-team-card strong,.ranking-team-card small{display:block}.ranking-team-card strong{font-size:15px;margin:3px 0}.ranking-team-card small{font-size:10px;line-height:1.35;color:var(--muted)}.ranking-team-card button{flex:0 0 auto}
@media(max-width:520px){.ranking-control-row{grid-template-columns:1fr}.ranking-period-segment{order:2}.ranking-team-card{align-items:flex-start;flex-direction:column}.ranking-team-card button{width:100%}.ranking-section{padding:14px}.ranking-row{grid-template-columns:40px minmax(0,1fr) auto;padding:11px 10px}.ranking-row .leader-score strong{font-size:13px}.ranking-row .leader-name strong{font-size:13px}}
'''
styles = ROOT / 'public/styles.css'
styles.write_text(styles.read_text(encoding='utf-8') + css_append, encoding='utf-8')

migration = r'''-- Proplet v3.31.7 Rankings & Teams
-- Additive migration. Safe to apply while v3.31.6.1 is still serving traffic.

alter table public.players
  add column if not exists public_rankings boolean not null default true;

alter table public.results
  add column if not exists team_code_at_completion text;

create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_code text not null,
  joined_at timestamptz not null,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  constraint team_memberships_time_check check (left_at is null or left_at >= joined_at)
);

alter table public.team_memberships enable row level security;
revoke all on public.team_memberships from anon, authenticated;
grant all on public.team_memberships to service_role;

create unique index if not exists team_memberships_one_active_per_player
  on public.team_memberships(player_id) where left_at is null;
create index if not exists team_memberships_team_time_idx
  on public.team_memberships(team_code, joined_at, left_at);
create index if not exists results_team_completion_idx
  on public.results(team_code_at_completion, completed_at);

-- Current product has never allowed switching teams, so team_joined_at is a reliable
-- start boundary for all existing real memberships. SOLO_* namespaces are not teams.
insert into public.team_memberships (player_id, team_code, joined_at)
select p.id, p.family_code, p.team_joined_at
from public.players p
where p.team_joined_at is not null
  and p.family_code is not null
  and p.family_code not like 'SOLO\_%' escape '\\'
on conflict do nothing;

update public.results r
set team_code_at_completion = p.family_code
from public.players p
where r.player_id = p.id
  and r.team_code_at_completion is null
  and p.team_joined_at is not null
  and p.family_code is not null
  and p.family_code not like 'SOLO\_%' escape '\\'
  and r.completed_at >= p.team_joined_at;
'''
(ROOT / 'SUPABASE_MIGRATION_V3_31_7.sql').write_text(migration, encoding='utf-8')

print('v3.31.7 preview patch applied')
