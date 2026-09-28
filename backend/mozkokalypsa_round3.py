"""Scheduled third round; separate RPCs and rewards, immutable approved eight boards."""
from copy import deepcopy
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import json
import os
from pathlib import Path
from typing import Literal
from uuid import UUID
from fastapi import Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

EXPERIMENT = 'mozkokalypsa-round3-interwoven-v2'
OPENS_AT = '2026-09-28T22:00:00Z'
CLOSES_AT = '2026-09-30T22:00:00Z'
OPENS = datetime.fromisoformat(OPENS_AT.replace('Z','+00:00'))
CLOSES = datetime.fromisoformat(CLOSES_AT.replace('Z','+00:00'))
BRANCH = 'feat/mozkokalypsa-round3-release'
BANK_SHA256 = 'c412ad3ccb8dc0a651387046389aff055c34ada15c5cf75398c8440c1ce22410'
ROOT = Path(__file__).resolve().parents[1]

def utc_now():
    return datetime.now(timezone.utc)

def has_started():
    return utc_now() >= OPENS

def preview_allowed():
    return os.getenv('VERCEL_ENV') == 'preview' and os.getenv('VERCEL_GIT_COMMIT_REF') == BRANCH

def enabled():
    return os.getenv('PROPLET_MOZKOKALYPSA_ENABLED') == 'true' and os.getenv('VERCEL_ENV') != 'preview'

@lru_cache(maxsize=1)
def bank():
    raw=(ROOT/'data/playtests/mozkokalypsa-v3.json').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=BANK_SHA256:
        raise RuntimeError('Approved round-three bank changed')
    data=json.loads(raw)
    if data['experimentId']!=EXPERIMENT or [b['id'] for b in data['boards']] != [f'mk3w2-{i:02d}' for i in range(1,9)]:
        raise RuntimeError('Invalid round-three bank')
    return data

def puzzle(board_id):
    for board in bank()['boards']:
        if board['id']==board_id:
            return deepcopy(board)
    raise HTTPException(404,'Tato deska není součástí třetího kola.')

class Event(BaseModel):
    model_config=ConfigDict(extra='forbid')
    event_id: UUID
    attempt_id: UUID
    board_id: str=Field(pattern=r'^mk3w2-0[1-8]$')
    revision: int=Field(ge=0,le=100000)
    event_type: Literal['correct','wrong','hint','reset','resume','leave','finish','feedback','calm']
    progress: dict=Field(default_factory=dict)
    feedback: dict=Field(default_factory=dict)

def install(app,*,auth_player,db_select,db_rpc,enforce_rate_limit,validate_progress,validate_feedback):
    def invite(authorization):
        if not enabled():
            raise HTTPException(404,'Playtest zatím není otevřený.')
        player=auth_player(authorization)
        if not OPENS <= utc_now() < CLOSES:
            raise HTTPException(410,'Třetí kolo je otevřené pouze v úterý a ve středu.')
        configs=db_select('mozkokalypsa_experiments',id=EXPERIMENT,active=True)
        if not configs:
            raise HTTPException(404,'Playtest zatím není otevřený.')
        cfg=configs[0]
        # Refuse a mismatched deployment/database schedule instead of lying in the clock.
        parse=lambda value:datetime.fromisoformat(str(value).replace('Z','+00:00'))
        if parse(cfg['opens_at'])!=OPENS or parse(cfg['closes_at'])!=CLOSES or cfg['reward_xp']!=200:
            raise HTTPException(503,'Nastavení playtestu se právě aktualizuje.')
        invites=db_select('mozkokalypsa_invites',experiment_id=EXPERIMENT,player_id=player['id'],active=True)
        if not invites:
            raise HTTPException(403,'Tento playtest je pouze pro pozvané hráče.')
        return player

    def response(qa,attempts):
        return {'eligible':True,'qa':qa,'round':3,'experimentId':EXPERIMENT,
                'order':[b['id'] for b in bank()['boards']], 'attempts':attempts,
                'name':'Mozkokalypsa III','opensAt':OPENS_AT,'closesAt':CLOSES_AT,
                'rewardXp':200,'serverNow':utc_now().isoformat()}

    @app.get('/api/mozkokalypsa3/status')
    def status(request:Request,qa:bool=False,authorization:str|None=Header(default=None)):
        if qa:
            if not preview_allowed():
                raise HTTPException(403,'Testovací náhled není na produkci dostupný.')
            return response(True,[])
        if not enabled() or not authorization or not OPENS <= utc_now() < CLOSES:
            return {'eligible':False}
        enforce_rate_limit(request,'mozkokalypsa_status',limit=120,window_seconds=3600)
        try:
            player=invite(authorization)
        except HTTPException as exc:
            if exc.status_code in (403,404,410):return {'eligible':False}
            raise
        return response(False,db_select('mozkokalypsa_attempts',experiment_id=EXPERIMENT,player_id=player['id']))

    @app.get('/api/mozkokalypsa3/board/{board_id}')
    def preview_board(board_id:str,qa:bool=False):
        if not qa or not preview_allowed():
            raise HTTPException(403,'Desku lze otevřít pouze přes pozvánku.')
        return {'puzzle':puzzle(board_id),'qa':True}

    @app.post('/api/mozkokalypsa3/open/{board_id}')
    def open_board(board_id:str,request:Request,authorization:str|None=Header(default=None)):
        player=invite(authorization); board=puzzle(board_id)
        enforce_rate_limit(request,'mozkokalypsa_open',limit=120,window_seconds=3600)
        attempt=db_rpc('proplet_mozkokalypsa3_open',{'p_experiment':EXPERIMENT,'p_player':player['id'],'p_board':board_id})
        return {'puzzle':board,'attempt':attempt}

    @app.post('/api/mozkokalypsa3/event')
    def record(payload:Event,request:Request,authorization:str|None=Header(default=None)):
        player=invite(authorization); board=puzzle(payload.board_id)
        enforce_rate_limit(request,'mozkokalypsa_event',limit=1200,window_seconds=3600)
        feedback=validate_feedback(payload.feedback)
        if payload.event_type=='feedback' and not all(feedback.get(k) is not None for k in ('difficulty','fun')):
            raise HTTPException(422,'Vyplň náročnost i zábavnost, ať můžeme připsat 200 XP.')
        result=db_rpc('proplet_mozkokalypsa3_event',{
            'p_experiment':EXPERIMENT,'p_player':player['id'],'p_board':payload.board_id,
            'p_attempt':str(payload.attempt_id),'p_event':str(payload.event_id),
            'p_revision':payload.revision,'p_kind':payload.event_type,
            'p_progress':validate_progress(payload.progress,board,payload.event_type),'p_feedback':feedback})
        if result.get('conflict'):
            raise HTTPException(409,'Playtest se změnil na jiném zařízení. Otevři desku znovu; místní tahy zůstaly uložené.')
        return result
    return status
