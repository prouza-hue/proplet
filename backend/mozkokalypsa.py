"""Invite-only Mozkokalypsa pilot; no normal progress, ranking or XP writes.

Preview runs are explicitly local-only. Production authorization uses a fixed
server-side invite by immutable player ID, never a client rank/name/flag.
"""
from __future__ import annotations
from copy import deepcopy
from functools import lru_cache
import json
import os
from pathlib import Path
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

EXPERIMENT = 'mozkokalypsa-20260922-v1'
BRANCH = 'feat/mozkokalypsa-playtest'
ROOT = Path(__file__).resolve().parents[1]

@lru_cache(maxsize=1)
def bank():
    data=json.loads((ROOT/'data/playtests/mozkokalypsa-v1.json').read_text(encoding='utf-8'))
    if data['experimentId']!=EXPERIMENT or len(data['boards'])!=10:
        raise RuntimeError('Invalid frozen playtest bank')
    return data

def preview_allowed():
    return (os.getenv('VERCEL_ENV')=='preview' and os.getenv('VERCEL_GIT_COMMIT_REF')==BRANCH) or (
        not os.getenv('VERCEL') and os.getenv('VERCEL_ENV')!='production'
        and os.getenv('PROPLET_PLAYTEST_LOCAL_QA')=='true')

def enabled():
    return os.getenv('PROPLET_MOZKOKALYPSA_ENABLED')=='true' and os.getenv('VERCEL_ENV')!='preview'

def puzzle(board_id):
    for board in bank()['boards']:
        if board['id']==board_id:
            return deepcopy(board)
    raise HTTPException(404,'Testovací deska neexistuje.')

class Event(BaseModel):
    model_config=ConfigDict(extra='forbid')
    event_id: UUID
    attempt_id: UUID
    board_id: str=Field(pattern=r'^mk26-(0[1-9]|10)$')
    revision: int=Field(ge=0,le=100000)
    event_type: Literal['correct','wrong','hint','reset','resume','leave','finish','feedback','calm']
    progress: dict=Field(default_factory=dict)
    feedback: dict=Field(default_factory=dict)


def validate_progress(raw,board,kind):
    """Server checks every found path against the frozen board, not client answers."""
    out={}
    for key,maximum in [('elapsedMs',604800000),('moves',100000),('hints',10000),
                        ('wrongAttempts',100000),('maxHintLevel',3),('resetCount',10000),
                        ('resumeCount',10000)]:
        val=raw.get(key,0)
        if type(val) is not int or not 0<=val<=maximum:
            raise HTTPException(422,'Neplatná testovací metrika: '+key)
        out[key]=val
    found=raw.get('found',[])
    if not isinstance(found,list) or len(found)>len(board['answers']):
        raise HTTPException(422,'Neplatný postup.')
    seen=set();out['found']=[]
    for item in found:
        if not isinstance(item,dict):raise HTTPException(422,'Neplatný nález.')
        i=item.get('answerIndex')
        if type(i) is not int or i in seen or not 0<=i<len(board['answers']):
            raise HTTPException(422,'Neplatný nález.')
        a=board['answers'][i]
        if item.get('word')!=a['word'] or item.get('path')!=a['path']:
            raise HTTPException(422,'Nález neodpovídá desce.')
        seen.add(i)
        out['found'].append({'answerIndex':i,'word':a['word'],'path':a['path'],'colorIndex':len(seen)-1})
    for key in ('firstCorrectMs','firstHintMs','lastCorrectMs'):
        val=raw.get(key)
        if val is not None and (type(val) is not int or not 0<=val<=out['elapsedMs']):
            raise HTTPException(422,'Neplatný čas nálezu.')
        out[key]=val
    out['calmMode']=bool(raw.get('calmMode',False))
    out['foundWords']=len(seen)
    out['cleanSolve']=out['hints']==0
    if kind=='finish' and len(seen)!=len(board['answers']):
        raise HTTPException(422,'Deska ještě není dokončená.')
    if out['moves']<len(seen):raise HTTPException(422,'Neplatný počet tahů.')
    return out

def validate_feedback(raw):
    out={}
    for key in ('difficulty','fun'):
        value=raw.get(key)
        if value is not None:
            if type(value) is not int or not 1<=value<=5:raise HTTPException(422,'Hodnocení musí být 1 až 5.')
            out[key]=value
    text=raw.get('note','')
    if not isinstance(text,str) or len(text)>500:raise HTTPException(422,'Poznámka je příliš dlouhá.')
    out['note']=text.strip()
    return out


def install(app,*,auth_player,db_select,db_request,db_rpc,enforce_rate_limit):
    router=APIRouter(prefix='/api/mozkokalypsa')

    def invite(authorization):
        if not enabled():raise HTTPException(404,'Playtest zatím není otevřený.')
        player=auth_player(authorization)
        rows=db_select('mozkokalypsa_invites',experiment_id=EXPERIMENT,player_id=player['id'],active=True)
        if not rows:raise HTTPException(403,'Tento playtest je pouze pro pozvané hráče.')
        return player,rows[0]

    @router.get('/status')
    def status(request:Request,qa:bool=False,authorization:str|None=Header(default=None)):
        if qa:
            if not preview_allowed():raise HTTPException(403,'Testovací náhled není na produkci dostupný.')
            return {'eligible':True,'qa':True,'experimentId':EXPERIMENT,'order':bank()['orders'][0],
                    'attempts':[],'name':'Mozkokalypsa'}
        if not enabled() or not authorization:return {'eligible':False}
        enforce_rate_limit(request,'mozkokalypsa_status',limit=120,window_seconds=3600)
        try:
            player,cohort=invite(authorization)
        except HTTPException as exc:
            if exc.status_code in (403,404):return {'eligible':False}
            raise
        attempts=db_select('mozkokalypsa_attempts',experiment_id=EXPERIMENT,player_id=player['id'])
        return {'eligible':True,'qa':False,'experimentId':EXPERIMENT,
                'order':bank()['orders'][cohort['slot']],'attempts':attempts,'name':'Mozkokalypsa'}

    @router.get('/board/{board_id}')
    def preview_board(board_id:str,qa:bool=False):
        # Read-only, explicit preview route; actual participant start is POST /open.
        if not qa or not preview_allowed():raise HTTPException(403,'Desku lze otevřít pouze přes pozvánku.')
        return {'puzzle':puzzle(board_id),'qa':True}

    @router.post('/open/{board_id}')
    def open_board(board_id:str,request:Request,authorization:str|None=Header(default=None)):
        player,_=invite(authorization)
        board=puzzle(board_id)
        enforce_rate_limit(request,'mozkokalypsa_open',limit=120,window_seconds=3600)
        result=db_rpc('proplet_mozkokalypsa_open',{'p_experiment':EXPERIMENT,'p_player':player['id'],'p_board':board_id})
        return {'puzzle':board,'attempt':result}

    @router.post('/event')
    def record(payload:Event,request:Request,authorization:str|None=Header(default=None)):
        player,_=invite(authorization)
        board=puzzle(payload.board_id)
        enforce_rate_limit(request,'mozkokalypsa_event',limit=1200,window_seconds=3600)
        result=db_rpc('proplet_mozkokalypsa_event',{
            'p_experiment':EXPERIMENT,'p_player':player['id'],'p_board':payload.board_id,
            'p_attempt':str(payload.attempt_id),'p_event':str(payload.event_id),
            'p_revision':payload.revision,'p_kind':payload.event_type,
            'p_progress':validate_progress(payload.progress,board,payload.event_type),
            'p_feedback':validate_feedback(payload.feedback)})
        if result.get('conflict'):raise HTTPException(409,'Playtest se změnil na jiném zařízení. Otevři desku znovu; místní tahy zůstaly uložené.')
        return result

    app.include_router(router)
