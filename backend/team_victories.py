"""Weekly team trophies: authenticated reads/acknowledgements, never XP writes.

Finalization is exclusively an idempotent database job. HTTP requests do not
finalize weeks, so an ordinary read cannot accidentally mutate production.
"""
from __future__ import annotations

import os
from typing import Literal
from uuid import UUID
from datetime import date, timedelta

from fastapi import Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict

MILESTONES = (
    ('first-print', 'První otisk', 1),
    ('golden-crew', 'Zlatá parta', 3),
    ('masters', 'Mistři dílny', 10),
    ('legend', 'Legendy Propletu', 25),
)


def production_enabled() -> bool:
    # Preview must not authenticate (legacy auth may refresh session timestamps),
    # read rewards, or acknowledge anything against a production database.
    return os.environ.get('VERCEL_ENV') == 'production'


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


def install(app, *, auth_player, db_rpc, enforce_rate_limit, db_select_bounded=None):
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


