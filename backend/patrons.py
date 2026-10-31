"""Optional bank-transfer patron support. No XP, client grants or bank polling."""
from __future__ import annotations
import io
import os
from datetime import date
from typing import Optional, Literal
from urllib.parse import quote
from uuid import UUID
from fastapi import Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, model_validator

ACCOUNT = '5531840001/5500'
CURRENCY = 'CZK'

def feature_enabled():
    # The public design deployment is static. Never enable against preview's DB.
    return os.getenv('PROPLET_PATRONS_ENABLED', '').lower() in {'1','true','yes'} and os.getenv('VERCEL_ENV','').lower() != 'preview'

def iban_for_account():
    bban='5500'+'000000'+'5531840001'
    return 'CZ'+str(98-int(bban+'123500')%97).zfill(2)+bban

IBAN=iban_for_account()

def payment_data(intent):
    """Only call with the persisted server-owned intent, never request fields."""
    if not isinstance(intent,dict):raise HTTPException(503,'Platební údaje nejsou dostupné')
    if intent.get('account')!=ACCOUNT or intent.get('currency')!=CURRENCY:
        raise HTTPException(503,'Platební údaje nejsou dostupné')
    ref=str(intent.get('reference',''))
    amount=intent.get('amountCzk')
    if type(amount) is not int:raise HTTPException(503,'Platební údaje nejsou dostupné')
    if not ref.isascii() or not ref.isdigit() or not 1<=len(ref)<=10 or ref.startswith('0') or not 1<=amount<=100000:
        raise HTTPException(503,'Platební údaje nejsou dostupné')
    # SPAYD fields use percent encoding for separators and UTF-8. Bound message
    # length before encoding; nickname is descriptive, never payment identity.
    message=str(intent.get('message',''))
    if len(message)>60 or not message.endswith(' podporuje Proplet') or any(ord(c)<32 for c in message):
        raise HTTPException(503,'Platební údaje nejsou dostupné')
    spd=f'SPD*1.0*ACC:{IBAN}*AM:{amount}.00*CC:CZK*X-VS:{ref}*MSG:{quote(message,safe=" ")}'
    frequency=intent.get('frequency','once')
    first=intent.get('firstPaymentDate')
    if frequency not in ('once','monthly') or (frequency=='once' and first is not None):
        raise HTTPException(503,'Platební údaje nejsou dostupné')
    if frequency=='monthly':
        try:
            if not isinstance(first,str) or len(first)!=10 or date.fromisoformat(first).isoformat()!=first:raise ValueError()
        except ValueError as exc:raise HTTPException(503,'Platební údaje nejsou dostupné') from exc
        # Standing order, not direct debit: the player authorizes it in their bank.
        spd+=f'*FRQ:1M*DT:{first.replace("-","")}'
    import qrcode
    from qrcode.image.svg import SvgPathImage
    image=qrcode.make(spd,image_factory=SvgPathImage,box_size=8,border=4)
    out=io.BytesIO();image.save(out)
    return {'iban':IBAN,'spd':spd,'qrSvg':out.getvalue().decode('utf-8')}

class Body(BaseModel):
    model_config=ConfigDict(extra='forbid')
class IntentBody(Body):
    requestId: UUID
    amountCzk: StrictInt=Field(ge=1,le=100000)
    frequency: Literal['once','monthly']='once'
    firstPaymentDate: Optional[str]=Field(default=None,pattern=r'^\d{4}-\d{2}-\d{2}$')
    @model_validator(mode='after')
    def schedule(self):
        if self.frequency=='monthly':
            if self.firstPaymentDate is None:raise ValueError('Měsíční podpora vyžaduje datum první platby')
            date.fromisoformat(self.firstPaymentDate)
        elif self.firstPaymentDate is not None:raise ValueError('Jednorázová podpora nemá datum trvalého příkazu')
        return self
class PreferenceBody(Body):
    publicBadge: StrictBool
    offersDisabled: StrictBool
class DismissBody(Body):
    receiptId: UUID
    action: Literal['declined','ignored','opened']
class ConfirmBody(Body):
    intentId: UUID
    reference: str=Field(pattern=r'^[1-9][0-9]{0,9}$')
    bankTransactionId: str=Field(min_length=1,max_length=120,pattern=r'^[A-Za-z0-9_.:/-]+$')
    amountCzk: StrictInt=Field(ge=1,le=100000)
    currency: Literal['CZK']
    recipientAccount: Literal['5531840001/5500']


def install(app,*,auth_player,require_admin,db_rpc,enforce_rate_limit,enabled=feature_enabled):
    def run(name,args):
        try:value=db_rpc(name,args)
        except HTTPException as exc:raise HTTPException(503,'Podpora je momentálně nedostupná') from exc
        if not isinstance(value,dict):raise HTTPException(503,'Podpora je momentálně nedostupná')
        if value.get('ok') is False:
            code=value.get('code')
            raise HTTPException(404 if code=='not_found' else 409,{'code':code,'message':'Údaje nesouhlasí. Zkontroluj platbu a obnov přehled.'})
        return value
    def active():
        if not enabled():raise HTTPException(503,'Podpora zatím není spuštěná')
    def account(authorization):
        active();return auth_player(authorization)
    def headers(response):response.headers['Cache-Control']='no-store'
    def state(pid):return run('proplet_patron_state_v1',{'p_player':pid,'p_claim':False})

    @app.get('/api/patrons')
    def status(request:Request,response:Response,authorization:Optional[str]=Header(default=None)):
        headers(response)
        if not enabled():return {'enabled':False}
        if not authorization:return {'enabled':True,'authenticated':False,'patron':False,'publicBadge':False,'offersDisabled':True,'canOffer':False,'thanksPending':False,'contributions':[]}
        p=auth_player(authorization);enforce_rate_limit(request,'patron_status',limit=120,window_seconds=3600)
        return {'enabled':True,'authenticated':True,'nickname':p.get('name') or 'Hráč',**state(p['id'])}

    @app.post('/api/patrons/intents')
    def create_intent(body:IntentBody,request:Request,response:Response,authorization:Optional[str]=Header(default=None)):
        headers(response);p=account(authorization);enforce_rate_limit(request,'patron_intent',limit=20,window_seconds=3600)
        value=run('proplet_patron_intent_v1',{'p_player':p['id'],'p_request':str(body.requestId),'p_amount':body.amountCzk,'p_frequency':body.frequency,'p_first_payment_date':body.firstPaymentDate})
        return {**value,'payment':payment_data(value.get('intent'))}

    @app.get('/api/patrons/intents/{intent_id}')
    def get_intent(intent_id:UUID,response:Response,authorization:Optional[str]=Header(default=None)):
        headers(response);p=account(authorization)
        value=run('proplet_patron_intent_read_v1',{'p_player':p['id'],'p_intent':str(intent_id)})
        return {**value,'payment':payment_data(value.get('intent'))}

    @app.post('/api/patrons/preferences')
    def preferences(body:PreferenceBody,response:Response,authorization:Optional[str]=Header(default=None)):
        headers(response);p=account(authorization)
        return run('proplet_patron_preferences_v1',{'p_player':p['id'],'p_public':body.publicBadge,'p_disabled':body.offersDisabled})

    @app.post('/api/patrons/thanks/claim')
    def claim_thanks(response:Response,authorization:Optional[str]=Header(default=None)):
        headers(response);p=account(authorization)
        return run('proplet_patron_thanks_claim_v1',{'p_player':p['id']})

    @app.post('/api/patrons/offers/claim')
    def claim(request:Request,response:Response,authorization:Optional[str]=Header(default=None)):
        headers(response);p=account(authorization);enforce_rate_limit(request,'patron_offer',limit=30,window_seconds=3600)
        return run('proplet_patron_state_v1',{'p_player':p['id'],'p_claim':True})

    @app.post('/api/patrons/offers/dismiss')
    def dismiss(body:DismissBody,response:Response,authorization:Optional[str]=Header(default=None)):
        headers(response);p=account(authorization)
        return run('proplet_patron_offer_dismiss_v1',{'p_player':p['id'],'p_receipt':str(body.receiptId),'p_action':body.action})

    @app.get('/api/admin/patrons')
    def admin_list(response:Response,days:int=Query(default=7,ge=1,le=90),limit:int=Query(default=100,ge=1,le=200),reference:Optional[str]=Query(default=None,pattern=r'^[1-9][0-9]{0,9}$'),authorization:Optional[str]=Header(default=None)):
        headers(response);active();require_admin(authorization)
        return run('proplet_patron_admin_list_v1',{'p_days':days,'p_limit':limit,'p_reference':reference})

    @app.post('/api/admin/patrons/confirm')
    def confirm(body:ConfirmBody,request:Request,response:Response,authorization:Optional[str]=Header(default=None)):
        headers(response);active();admin=require_admin(authorization,write=True)
        enforce_rate_limit(request,'patron_confirm',limit=60,window_seconds=3600)
        return run('proplet_patron_confirm_v1',{'p_actor':admin['player']['id'],'p_intent':str(body.intentId),'p_reference':body.reference,'p_bank_tx':body.bankTransactionId,'p_amount':body.amountCzk,'p_currency':body.currency,'p_account':body.recipientAccount})


def annotate_players(players,db_rpc):
    """One bounded lookup per loaded ranking batch, never one query per player."""
    if not feature_enabled() or not players:return players
    ids=[str(p['id']) for p in players if p.get('id') and p.get('public_rankings') is True]
    if not ids:return players
    try:
        public_ids=set()
        for start in range(0,len(ids),2000):
            value=db_rpc('proplet_patron_public_ids_v1',{'p_players':ids[start:start+2000]})
            if isinstance(value,dict):public_ids.update(value.get('players',[]))
    except HTTPException:public_ids=set()  # Optional decoration cannot break gameplay.
    return [{**p,'_patron_public':str(p.get('id')) in public_ids} for p in players]
