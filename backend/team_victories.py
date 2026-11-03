"""Weekly team trophies: authenticated reads/acknowledgements, never XP writes.

Finalization is exclusively an idempotent database job. HTTP requests do not
finalize weeks, so an ordinary read cannot accidentally mutate production.
"""
from __future__ import annotations

import os
from typing import Literal
from uuid import UUID
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import Header, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict
from backend.config import live_player_preview_enabled

MILESTONES = (
    ('first-print', 'První otisk', 1),
    ('golden-crew', 'Zlatá parta', 3),
    ('masters', 'Mistři dílny', 10),
    ('legend', 'Legendy Propletu', 25),
)


def production_enabled() -> bool:
    # Ordinary previews stay closed; the approved live preview serves real players.
    return os.environ.get('VERCEL_ENV') == 'production' or live_player_preview_enabled()


def _roman(number: int) -> str:
    pieces = []
    for value, letters in ((1000, 'M'), (900, 'CM'), (500, 'D'), (400, 'CD'),
                           (100, 'C'), (90, 'XC'), (50, 'L'), (40, 'XL'),
                           (10, 'X'), (9, 'IX'), (5, 'V'), (4, 'IV'), (1, 'I')):
        count, number = divmod(number, value)
        pieces.append(letters * count)
    return ''.join(pieces)


def enrich_state(payload: dict) -> dict:
    team = payload.get('team')
    if not team:
        return payload
    gold = max(0, int(team.get('totalGold') or 0))
    team['milestones'] = [dict(id=key, name=name, threshold=threshold,
                               achieved=gold >= threshold)
                          for key, name, threshold in MILESTONES]
    team['legendLevel'] = gold // 25
    following = next((dict(id=key, name=name, threshold=threshold)
                      for key, name, threshold in MILESTONES if threshold > gold), None)
    if following is None:
        level = gold // 25 + 1
        following = dict(id='legend', name=f'Legendy Propletu {_roman(level)}', threshold=level * 25)
    team['nextMilestone'] = following
    return payload


class Seen(BaseModel):
    model_config = ConfigDict(extra='forbid')
    kind: Literal['intro', 'award']
    awardId: UUID | None = None


def personal_state(rows: list[dict]) -> dict:
    # Recipients were frozen at closure. Current membership and acknowledgement
    # cannot grant, remove or transfer an individual player's history.
    awards = sorted((row['team_victory_awards'] for row in rows),
                    key=lambda award: (award['week_start'], award['id']), reverse=True)
    return {'enabled': True, 'totalGold': len(awards), 'history': [
        {'id': award['id'], 'weekStart': award['week_start'],
         'weekEnd': (date.fromisoformat(award['week_start']) + timedelta(days=7)).isoformat(),
         'teamName': award['team_name'], 'xp': award['xp'],
         'sharedFirst': award['shared_first']}
        for award in awards[:100]
    ]}


def _public_standings(rows: list[dict], leagues: list[dict], viewer_team: str) -> list[dict]:
    public = {row['code']: row for row in leagues}
    teams = []
    for row in rows:
        code = row['team_code']
        if code not in public:
            continue
        league = public[code]
        current_name = league.get('public_name') or league.get('name') or 'Tým'
        name = row.get('team_name') or current_name
        if name == code:
            name = current_name
        teams.append({'name': name, 'xp': row['xp'], 'rank': row['rank'],
                      'isMine': bool(viewer_team and viewer_team == code)})
    return teams


def install(app, *, auth_player, db_rpc, enforce_rate_limit, db_select_bounded=None):
    @app.get('/api/team-victories/competition')
    def competition(request: Request, week: date | None = None,
                    include_summary: bool = Query(default=True, alias="includeSummary"),
                    authorization: str | None = Header(default=None)):
        if not include_summary and week is None:
            raise HTTPException(422, 'Pro samostatný výsledek vyber týden.')
        if week is not None and week.weekday() != 0:
            raise HTTPException(422, 'Týden musí začínat pondělím.')
        if not production_enabled():
            return {'enabled': False, 'reason': 'non-production'}
        enforce_rate_limit(request, 'team_competition_read', limit=120, window_seconds=3600)
        viewer = auth_player(authorization) if authorization else None
        viewer_team = str((viewer or {}).get('family_code') or '').strip().upper()
        if db_select_bounded is None:
            raise HTTPException(503, 'Historie soutěže teď není dostupná.')
        settings = db_select_bounded('team_victory_settings', columns='enabled,launch_date',
                                    filters={'singleton': 'eq.true'}, max_rows=1)
        if not settings or settings[0].get('enabled') is not True:
            return {'enabled': False}
        today = datetime.now(ZoneInfo('Europe/Prague')).date()
        current = today - timedelta(days=today.weekday())
        launch = date.fromisoformat(settings[0]['launch_date'])
        if not include_summary:
            # Each archive read rechecks the feature and current public opt-ins.
            # No all-weeks index, award ledger or unrelated league identities cross
            # the database boundary when only one frozen result is requested.
            if week < launch or week >= current:
                raise HTTPException(404, 'Tento týden ještě není v historii soutěže.')
            snapshots = db_select_bounded('team_victory_rounds',
                columns='week_start,week_end,standings',
                filters={'week_start': f'eq.{week.isoformat()}',
                         'week_end': f'lte.{current.isoformat()}'}, max_rows=1)
            if not snapshots:
                raise HTTPException(404, 'Tento týden ještě není v historii soutěže.')
            snapshot = snapshots[0]
            if not isinstance(snapshot.get('standings'), list):
                raise HTTPException(503, 'Výsledky týdne teď nejsou dostupné.')
            # Snapshot codes are server-owned, never taken from a query parameter.
            codes = sorted({row['team_code'] for row in snapshot['standings']})
            leagues = db_select_bounded('leagues', columns='code,name,public_name',
                filters={'public_opt_in': 'eq.true', 'code': 'in.(' + ','.join(codes) + ')'},
                order='code.asc', max_rows=20000) if codes else []
            return {'enabled': True,
                    'selectedWeek': {'start': snapshot['week_start'], 'end': snapshot['week_end']},
                    'teams': _public_standings(snapshot['standings'], leagues, viewer_team)}
        rounds = db_select_bounded('team_victory_rounds', columns='week_start,week_end',
            filters={'week_start': f'gte.{launch.isoformat()}', 'week_end': f'lte.{current.isoformat()}'},
            order='week_start.desc', max_rows=2000)
        weeks = [{'start': row['week_start'], 'end': row['week_end']} for row in rounds]
        selected = next((row for row in weeks if row['start'] == str(week)), None)
        if week is not None and selected is None:
            raise HTTPException(404, 'Tento týden ještě není v historii soutěže.')
        leagues = db_select_bounded('leagues', columns='code,name,public_name',
            filters={'public_opt_in': 'eq.true'}, order='code.asc', max_rows=20000)
        public = {row['code']: row for row in leagues}
        def public_name(code):
            league = public[code]
            return league.get('public_name') or league.get('name') or 'Tým'
        teams = []
        if selected:
            snapshots = db_select_bounded('team_victory_rounds', columns='standings',
                filters={'week_start': f'eq.{week.isoformat()}'}, max_rows=1)
            if not snapshots or not isinstance(snapshots[0].get('standings'), list):
                raise HTTPException(503, 'Výsledky týdne teď nejsou dostupné.')
            teams = _public_standings(snapshots[0]['standings'], leagues, viewer_team)
        awards = db_select_bounded('team_victory_awards', columns='id,week_start,team_code',
            filters={'week_start': f'gte.{launch.isoformat()}'}, order='id.asc', max_rows=20000)
        finalized = {row['start'] for row in weeks}
        counts = {}
        for award in awards:
            code = award['team_code']
            if code in public and award['week_start'] in finalized:
                counts[code] = counts.get(code, 0) + 1
        gold = [{'name': public_name(code), 'gold': count,
                 'isMine': bool(viewer_team and viewer_team == code)} for code, count in counts.items()]
        gold.sort(key=lambda row: (-row['gold'], row['name'].casefold()))
        rank, previous = 0, None
        for index, row in enumerate(gold, 1):
            if row['gold'] != previous:
                rank, previous = index, row['gold']
            row['rank'] = rank
        return {'enabled': True, 'weeks': weeks, 'selectedWeek': selected,
                'teams': teams, 'goldTeams': gold}

    @app.get('/api/team-victories')
    def state(request: Request, authorization: str | None = Header(default=None)):
        if not production_enabled():
            return {'enabled': False, 'reason': 'non-production'}
        enforce_rate_limit(request, 'team_victories_read', limit=120, window_seconds=3600)
        player = auth_player(authorization)
        payload = db_rpc('proplet_team_victories_state_v1', {'p_player_id': str(player['id'])})
        if not isinstance(payload, dict):
            raise HTTPException(503, 'Týmová vitrína teď není dostupná.')
        return enrich_state(payload)

    @app.get('/api/team-victories/personal')
    def personal(request: Request, authorization: str | None = Header(default=None)):
        if not production_enabled():
            return {'enabled': False, 'reason': 'non-production'}
        enforce_rate_limit(request, 'team_victories_personal', limit=120, window_seconds=3600)
        player = auth_player(authorization)
        status = db_rpc('proplet_team_victories_state_v1', {'p_player_id': str(player['id'])})
        if not isinstance(status, dict):
            raise HTTPException(503, 'Týmové výhry se teď nepodařilo načíst.')
        if status.get('enabled') is not True:
            return {'enabled': False}
        if db_select_bounded is None:
            raise HTTPException(503, 'Týmové výhry se teď nepodařilo načíst.')
        rows = db_select_bounded(
            'team_victory_recipients',
            columns='award_id,team_victory_awards!inner(id,week_start,team_name,xp,shared_first)',
            filters={'player_id': f"eq.{player['id']}"}, order='award_id.asc', max_rows=5000,
        )
        return personal_state(rows)

    @app.post('/api/team-victories/seen')
    def seen(payload: Seen, request: Request, authorization: str | None = Header(default=None)):
        if not production_enabled():
            raise HTTPException(409, 'V preview se týmová ocenění nemění.')
        enforce_rate_limit(request, 'team_victories_seen', limit=60, window_seconds=3600)
        player = auth_player(authorization)
        if (payload.kind == 'award') != (payload.awardId is not None):
            raise HTTPException(422, 'Neplatné potvrzení ocenění.')
        result = db_rpc('proplet_team_victories_seen_v1', {
            'p_player_id': str(player['id']), 'p_kind': payload.kind,
            'p_award_id': str(payload.awardId) if payload.awardId else None,
        })
        if not isinstance(result, dict):
            raise HTTPException(503, 'Potvrzení ocenění teď není dostupné.')
        if not result.get('ok'):
            raise HTTPException(403, 'Toto ocenění není dostupné pro tvůj účet.')
        return result


