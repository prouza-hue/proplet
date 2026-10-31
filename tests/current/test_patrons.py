"""HTTP authority boundary for optional patron support; no real bank/database."""
import sys, os, unittest
from pathlib import Path
from uuid import uuid4
from unittest.mock import Mock, patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from backend import patrons

class PatronHttpTests(unittest.TestCase):
 def setUp(self):
  self.enabled=True;self.calls=[];self.intents={}
  def auth(value):
   if value not in ('Bearer player-a','Bearer player-b','Bearer admin'):raise HTTPException(401,'auth')
   return {'id':value.split()[-1],'name':'Nynější jméno'}
  def admin(value,write=False):
   p=auth(value)
   if p['id']!='admin':raise HTTPException(403,'admin')
   return {'player':p}
  def rpc(name,args):
   self.calls.append((name,args))
   if name=='proplet_patron_intent_v1':
    key=(args['p_player'],args['p_request']);old=self.intents.get(key)
    if old and old['amountCzk']!=args['p_amount']:return {'ok':False,'code':'idempotency_conflict'}
    if not old:self.intents[key]={'id':str(uuid4()),'reference':'1000000001','amountCzk':args['p_amount'],'account':patrons.ACCOUNT,'currency':'CZK','message':'Původní jméno podporuje Proplet','status':'qr_created'}
    return {'ok':True,'intent':self.intents[key]}
   if name=='proplet_patron_intent_read_v1':return {'ok':False,'code':'not_found'}
   return {'ok':True,'patron':False,'publicBadge':False}
  self.rpc=Mock(side_effect=rpc);app=FastAPI();patrons.install(app,auth_player=auth,require_admin=admin,db_rpc=self.rpc,enforce_rate_limit=lambda *a,**k:None,enabled=lambda:self.enabled);self.client=TestClient(app)
 def test_off_guest_and_untrusted_fields(self):
  self.enabled=False
  self.assertEqual(self.client.get('/api/patrons').json(),{'enabled':False})
  self.assertEqual(self.client.post('/api/patrons/intents',json={'requestId':str(uuid4()),'amountCzk':99}).status_code,503)
  self.enabled=True
  self.assertFalse(self.client.get('/api/patrons').json()['authenticated'])
  body={'requestId':str(uuid4()),'amountCzk':99}
  self.assertEqual(self.client.post('/api/patrons/intents',json=body).status_code,401)
  self.assertEqual(self.client.post('/api/patrons/intents',json={**body,'playerId':'victim'},headers={'Authorization':'Bearer player-a'}).status_code,422)
  for amount in (True,'99',0,100001,1.5):
   self.assertEqual(self.client.post('/api/patrons/intents',json={**body,'amountCzk':amount},headers={'Authorization':'Bearer player-a'}).status_code,422)
 def test_idempotent_intent_is_not_payment_and_is_owned(self):
  body={'requestId':str(uuid4()),'amountCzk':99};headers={'Authorization':'Bearer player-a'}
  first=self.client.post('/api/patrons/intents',json=body,headers=headers).json()
  second=self.client.post('/api/patrons/intents',json=body,headers=headers).json()
  self.assertEqual(first,second);self.assertEqual(first['intent']['status'],'qr_created')
  self.assertTrue(first['payment']['spd'].startswith('SPD*1.0*ACC:CZ'))
  self.assertIn('*AM:99.00*CC:CZK*X-VS:1000000001*MSG:',first['payment']['spd'])
  self.assertIn('<svg',first['payment']['qrSvg']);self.assertNotIn('confirm',str(self.calls))
  self.assertEqual(self.calls[0][1]['p_player'],'player-a')
  self.assertEqual(self.client.post('/api/patrons/intents',json={**body,'amountCzk':199},headers=headers).status_code,409)
  self.assertEqual(self.client.get('/api/patrons/intents/'+first['intent']['id'],headers={'Authorization':'Bearer player-b'}).status_code,404)
 def test_admin_authorization_and_receipt_fields(self):
  body={'intentId':str(uuid4()),'reference':'1000000001','amountCzk':99,'currency':'CZK','recipientAccount':patrons.ACCOUNT,'bankTransactionId':'bank-1'}
  self.assertEqual(self.client.get('/api/admin/patrons',headers={'Authorization':'Bearer player-a'}).status_code,403)
  self.assertEqual(self.client.post('/api/admin/patrons/confirm',json=body,headers={'Authorization':'Bearer player-a'}).status_code,403)
  h={'Authorization':'Bearer admin'}
  for patcher in ({'currency':'EUR'},{'recipientAccount':'1/0100'},{'reference':'0001'},{'bankTransactionId':'bad id'}):
   self.assertEqual(self.client.post('/api/admin/patrons/confirm',json={**body,**patcher},headers=h).status_code,422)
  self.assertEqual(self.client.post('/api/admin/patrons/confirm',json=body,headers=h).status_code,200)
  self.assertEqual(self.calls[-1][1]['p_actor'],'admin')
  self.client.get('/api/admin/patrons?reference=1000000001',headers=h)
  self.assertEqual(self.calls[-1][1]['p_reference'],'1000000001')
 def test_malformed_rpc_and_preview_fail_closed(self):
  self.rpc.side_effect=None;self.rpc.return_value={'ok':True,'intent':None}
  response=self.client.post('/api/patrons/intents',json={'requestId':str(uuid4()),'amountCzk':99},headers={'Authorization':'Bearer player-a'})
  self.assertEqual(response.status_code,503)
  with patch.dict(os.environ,{'PROPLET_PATRONS_ENABLED':'true','VERCEL_ENV':'preview'}):self.assertFalse(patrons.feature_enabled())
 def test_spayd_cannot_inject_another_field(self):
  result=patrons.payment_data({'account':patrons.ACCOUNT,'currency':'CZK','reference':'1000000001','amountCzk':1,'message':'A*AM:999 podporuje Proplet'})
  self.assertEqual(result['spd'].count('*AM:'),1);self.assertIn('%2AAM%3A999',result['spd'])

if __name__=='__main__':unittest.main()
