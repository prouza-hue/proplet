"""Private, explicitly addressed thank-you; no automatic reward tiers."""
from typing import Literal, Optional
from fastapi import Header, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator

PLAYER_ID = '449e0545-26f8-4e37-b023-c06eeec9f307'
GIFT_ID = 'zdenek-personal-badge-20261112'
COPY = [
    'Zdeňku, Vaše zpráva mě opravdu dojala.',
    'Moc děkuju za tak štědrou podporu, ale hlavně za to, že jste mi napsal, co pro Vás Proplet znamená.',
    'Rád bych Vám na oplátku nechal vytvořit osobní odznak do hry, který budete mít jen Vy.',
    'Máte nějaké oblíbené zvíře, koníček nebo motiv, který by Vám udělal radost?',
]

def state(player_id, db_rpc):
    if str(player_id) != PLAYER_ID:
        return {}
    try:
        value = db_rpc('proplet_patron_gift_v1', {'p_player': str(player_id), 'p_action': 'read', 'p_answer': None})
        gift = value.get('gift') if isinstance(value, dict) else None
        return {'personalGift': {**gift, 'paragraphs': COPY}} if isinstance(gift, dict) else {}
    except HTTPException:
        return {}  # An optional personal note must not prevent loading patron status.

class GiftBody(BaseModel):
    model_config = ConfigDict(extra='forbid')
    action: Literal['answer', 'later', 'decline']
    answer: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode='after')
    def validate_answer(self):
        if self.action == 'answer':
            if not self.answer or not self.answer.strip():
                raise ValueError('Napište prosím motiv odznaku.')
            self.answer = self.answer.strip()
        elif self.answer is not None:
            raise ValueError('Tato volba neobsahuje odpověď.')
        return self

def install(app, *, auth_player, require_admin, db_rpc, enforce_rate_limit):
    @app.post('/api/patrons/gift')
    def respond(body: GiftBody, request: Request, response: Response, authorization: Optional[str] = Header(default=None)):
        response.headers['Cache-Control'] = 'no-store'
        player = auth_player(authorization)
        if str(player['id']) != PLAYER_ID:
            raise HTTPException(404, 'Osobní poděkování není dostupné.')
        enforce_rate_limit(request, 'patron_gift', limit=30, window_seconds=3600)
        value = db_rpc('proplet_patron_gift_v1', {'p_player': str(player['id']), 'p_action': body.action, 'p_answer': body.answer})
        if not isinstance(value, dict) or not value.get('ok'):
            raise HTTPException(409, 'Odpověď se nepodařilo uložit. Zkuste to prosím znovu.')
        return value

    @app.get('/api/admin/patrons/gifts')
    def responses(response: Response, authorization: Optional[str] = Header(default=None)):
        response.headers['Cache-Control'] = 'no-store'
        require_admin(authorization)
        return db_rpc('proplet_patron_gifts_admin_v1', {})
