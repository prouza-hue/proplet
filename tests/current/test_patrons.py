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
    if old and (old['amountCzk'],old['frequency'],old['firstPaymentDate'])!=(args['p_amount'],args['p_frequency'],args['p_first_payment_date']):return {'ok':False,'code':'idempotency_conflict'}
    if not old:self.intents[key]={'id':str(uuid4()),'reference':'1000000001','amountCzk':args['p_amount'],'frequency':args['p_frequency'],'firstPaymentDate':args['p_first_payment_date'],'account':patrons.ACCOUNT,'currency':'CZK','message':'Původní jméno podporuje Proplet','status':'qr_created'}
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
 def test_thanks_claim_uses_authenticated_account_and_disabled_is_quiet(self):
  self.enabled=False
  self.assertEqual(self.client.post('/api/patrons/thanks/claim').status_code,503)
  self.assertEqual(self.calls,[])
  self.enabled=True
  self.assertEqual(self.client.post('/api/patrons/thanks/claim').status_code,401)
  self.assertEqual(self.calls,[])
  response=self.client.post('/api/patrons/thanks/claim',headers={'Authorization':'Bearer player-a'},json={'playerId':'victim'})
  self.assertEqual(response.status_code,200)
  self.assertEqual(self.calls[-1],('proplet_patron_thanks_claim_v1',{'p_player':'player-a'}))
  self.assertEqual(response.headers['cache-control'],'no-store')
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
  body={'intentId':str(uuid4()),'reference':'1000000001','amountCzk':99,'currency':'CZK','recipientAccount':patrons.ACCOUNT,'bankTransactionId':'bank-1','paidOn':'2026-01-31'}
  self.assertEqual(self.client.get('/api/admin/patrons',headers={'Authorization':'Bearer player-a'}).status_code,403)
  self.assertEqual(self.client.post('/api/admin/patrons/confirm',json=body,headers={'Authorization':'Bearer player-a'}).status_code,403)
  h={'Authorization':'Bearer admin'}
  for patcher in ({'currency':'EUR'},{'recipientAccount':'1/0100'},{'reference':'0001'},{'bankTransactionId':'bad id'},{'paidOn':'2026-02-30'},{'paidOn':None}):
   self.assertEqual(self.client.post('/api/admin/patrons/confirm',json={**body,**patcher},headers=h).status_code,422)
  self.assertEqual(self.client.post('/api/admin/patrons/confirm',json=body,headers=h).status_code,200)
  self.assertEqual(self.calls[-1][1]['p_actor'],'admin')
  self.assertEqual(self.calls[-1][0],'proplet_patron_confirm_v2')
  self.assertEqual(self.calls[-1][1]['p_paid_on'],'2026-01-31')
  self.assertEqual(self.client.post('/api/admin/patrons/confirm',json={k:v for k,v in body.items() if k!='paidOn'},headers=h).status_code,422)
  self.client.get('/api/admin/patrons?reference=1000000001',headers=h)
  self.assertEqual(self.calls[-1][1]['p_reference'],'1000000001')
 def test_monthly_schedule_validation_and_immutable_qr(self):
  headers={'Authorization':'Bearer player-a'}
  body={'requestId':str(uuid4()),'amountCzk':99,'frequency':'monthly','firstPaymentDate':'2030-11-01'}
  response=self.client.post('/api/patrons/intents',json=body,headers=headers)
  self.assertEqual(response.status_code,200)
  first=response.json()
  self.assertIn('*FRQ:1M*DT:20301101',first['payment']['spd'])
  self.assertEqual(first,self.client.post('/api/patrons/intents',json=body,headers=headers).json())
  for change in ({'firstPaymentDate':'2030-11-02'},{'frequency':'once','firstPaymentDate':None}):
   self.assertEqual(self.client.post('/api/patrons/intents',json={**body,**change},headers=headers).status_code,409)
  for change in ({'firstPaymentDate':None},{'firstPaymentDate':'2030-02-30'},{'firstPaymentDate':'20301101'},{'firstPaymentDate':20301101},{'frequency':'weekly'},{'frequency':'once'}):
   self.assertEqual(self.client.post('/api/patrons/intents',json={**body,**change},headers=headers).status_code,422)
  # Never turn a malformed stored schedule into a payable one-time QR.
  for change in ({'firstPaymentDate':None},{'firstPaymentDate':'2030-02-30'},{'frequency':'weekly'}):
   with self.assertRaises(HTTPException):patrons.payment_data({**first['intent'],**change})
  once=self.client.post('/api/patrons/intents',json={'requestId':str(uuid4()),'amountCzk':99},headers=headers).json()
  self.assertNotIn('*FRQ:',once['payment']['spd']);self.assertNotIn('*DT:',once['payment']['spd'])
 def test_malformed_rpc_and_preview_fail_closed(self):
  self.rpc.side_effect=None;self.rpc.return_value={'ok':True,'intent':None}
  response=self.client.post('/api/patrons/intents',json={'requestId':str(uuid4()),'amountCzk':99},headers={'Authorization':'Bearer player-a'})
  self.assertEqual(response.status_code,503)
  with patch.dict(os.environ,{'PROPLET_PATRONS_ENABLED':'true','VERCEL_ENV':'preview'}):self.assertFalse(patrons.feature_enabled())
 def test_support_preview_requires_exact_live_branch_and_own_flag(self):
  env={'PROPLET_PATRONS_ENABLED':'true','PROPLET_LIVE_PLAYER_PREVIEW_ENABLED':'true',
       'VERCEL_ENV':'preview','VERCEL_GIT_COMMIT_REF':'codex/play-one-screen',
       'SUPABASE_URL':'https://iopyhluayfszskyqqpuc.supabase.co'}
  with patch.dict(os.environ,env,clear=True):
   self.assertTrue(patrons.feature_enabled())
   for key,values in {
    'PROPLET_PATRONS_ENABLED':['','false','0'],
    'PROPLET_LIVE_PLAYER_PREVIEW_ENABLED':['','false','0'],
    'VERCEL_GIT_COMMIT_REF':['main','codex/studio-edition','codex/today-one-screen','codex/monthly-competition-202611',
      'codex/admin-modernization','codex/play-one-screen-other','codex/play-one-screen/child','codex/Play-one-screen'],
    'SUPABASE_URL':['','https://eanzztstmwlamwfdskbf.supabase.co','https://iopyhluayfszskyqqpuc.supabase.co.invalid']
   }.items():
    for value in values:
     with self.subTest(key=key,value=value),patch.dict(os.environ,{key:value}):self.assertFalse(patrons.feature_enabled())
  for environment in ('production','development',''):
   with self.subTest(environment=environment),patch.dict(os.environ,{'VERCEL_ENV':environment,'PROPLET_PATRONS_ENABLED':'true'},clear=True):
    self.assertTrue(patrons.feature_enabled(),'non-preview opt-in keeps existing behavior')
    with patch.dict(os.environ,{'PROPLET_PATRONS_ENABLED':'false'}):self.assertFalse(patrons.feature_enabled())
 def test_live_preview_status_reads_real_handler_without_claim_and_keeps_private_gate(self):
  app=FastAPI();read=Mock(return_value={'ok':True,'patron':True,'publicBadge':False,'thanksPending':False,'contributions':[]})
  patrons.install(app,auth_player=lambda token:{'id':'synthetic-private','name':'Synthetic'},require_admin=Mock(),db_rpc=read,
    enforce_rate_limit=lambda *a,**k:None,enabled=patrons.feature_enabled)
  env={'PROPLET_PATRONS_ENABLED':'true','PROPLET_LIVE_PLAYER_PREVIEW_ENABLED':'true','VERCEL_ENV':'preview',
       'VERCEL_GIT_COMMIT_REF':'codex/play-one-screen','SUPABASE_URL':'https://iopyhluayfszskyqqpuc.supabase.co'}
  with patch.dict(os.environ,env,clear=True):
   client=TestClient(app);guest=client.get('/api/patrons');self.assertTrue(guest.json()['enabled']);self.assertFalse(guest.json()['authenticated']);read.assert_not_called()
   response=client.get('/api/patrons',headers={'Authorization':'Bearer synthetic-private'})
   self.assertEqual(response.status_code,200);self.assertTrue(response.json()['patron']);self.assertFalse(response.json()['publicBadge'])
   read.assert_called_once_with('proplet_patron_state_v1',{'p_player':'synthetic-private','p_claim':False})
   lookup=Mock(return_value={'players':['public'],'badges':{'public':'recurring','private':'recurring'}})
   rows=patrons.annotate_players([{'id':'public','public_rankings':True},{'id':'private','public_rankings':False}],lookup)
   self.assertEqual(lookup.call_args.args[1],{'p_players':['public']})
   self.assertTrue(rows[0]['_patron_public']);self.assertEqual(rows[0]['_patron_badge'],'recurring');self.assertFalse(rows[1]['_patron_public'])
   with patch.dict(os.environ,{'VERCEL_GIT_COMMIT_REF':'other-preview'}):
    read.reset_mock();self.assertEqual(client.get('/api/patrons').json(),{'enabled':False});read.assert_not_called()
 def test_spayd_cannot_inject_another_field(self):
  result=patrons.payment_data({'account':patrons.ACCOUNT,'currency':'CZK','reference':'1000000001','amountCzk':1,'message':'A*AM:999 podporuje Proplet'})
  self.assertEqual(result['spd'].count('*AM:'),1);self.assertIn('%2AAM%3A999',result['spd'])
 def test_public_badge_type_requires_the_same_public_id_gate(self):
  rows=[{'id':'public','public_rankings':True},{'id':'private','public_rankings':False},{'id':'off','public_rankings':True}]
  lookup=Mock(return_value={'players':['public'],'badges':{'public':'recurring','private':'recurring','off':'recurring'}})
  with patch.object(patrons,'feature_enabled',return_value=True):
   actual=patrons.annotate_players(rows,lookup)
  self.assertEqual(lookup.call_count,1)
  self.assertEqual(lookup.call_args.args[1],{'p_players':['public','off']})
  self.assertEqual([(p['_patron_public'],p['_patron_badge']) for p in actual],[(True,'recurring'),(False,None),(False,None)])
  # During a rolling schema update the old public boolean remains blue.
  lookup.return_value={'players':['public']}
  with patch.object(patrons,'feature_enabled',return_value=True):
   self.assertEqual(patrons.annotate_players(rows,lookup)[0]['_patron_badge'],'supporter')
 def test_actual_ranking_endpoints_forward_public_type_without_private_status(self):
  from contextlib import ExitStack
  import server
  people=[{'id':pid,'name':name,'avatar':'A','public_rankings':visible}
          for pid,name,visible in [('red','Public regular',True),('blue','Public supporter',True),
                                   ('private','Private badge',True),('hidden','Hidden real name',False)]]
  rows=[{'player_id':p['id'],'puzzle_id':'patron-api-puzzle','challenge_key':'daily:2026-11-01',
         'daily_date':'2026-11-01','mode':'daily','elapsed_ms':10000+i*1000,'moves':8,
         'hints_used':0,'clean_solve':True,'completed_at':'2026-11-01T10:00:00Z'} for i,p in enumerate(people)]
  score={p['id']:100-i for i,p in enumerate(people)}
  public={'players':['red','blue'],'badges':{'red':'recurring','blue':'supporter'}}
  with ExitStack() as stack:
   for name,value in {'enforce_rate_limit':lambda *a,**k:None,'free_puzzle_info':lambda *a:{'difficulty':'easy','level':1},
                      'competitive_row':lambda row:True,'daily_leaderboard_puzzle_id':lambda *a:'patron-api-puzzle',
                      'expected_daily_puzzle_id':lambda *a:'patron-api-puzzle','db_select_bounded':lambda *a,**k:[],
                      'db_rpc':lambda *a,**k:public,'_ranking_xp_aggregates':lambda *a:(score,score,{},{}),
                      '_ranking_viewer':lambda *a:None}.items():stack.enter_context(patch.object(server,name,value))
   stack.enter_context(patch.object(server.ranking_queries,'ranking_runs',return_value=(rows,'test')))
   stack.enter_context(patch.object(server.ranking_queries,'entity_context',return_value=(people,[])))
   stack.enter_context(patch.object(patrons,'feature_enabled',return_value=True))
   client=TestClient(server.app)
   for url,key in [('/api/free-global-leaderboard?puzzle_id=patron-api-puzzle&offset=0','rows'),
                   ('/api/daily-global-leaderboard?daily_date=2026-11-01&offset=0','rows'),
                   ('/api/rankings/xp?period=all','players'),('/api/rankings/daily?daily_date=2026-11-01','players')]:
    with self.subTest(endpoint=url):
     response=client.get(url);self.assertEqual(response.status_code,200,response.text)
     actual=response.json()[key];by_name={p['name']:p for p in actual}
     self.assertEqual(by_name['Public regular']['patronBadge'],'recurring')
     self.assertEqual(by_name['Public supporter']['patronBadge'],'supporter')
     self.assertTrue(by_name['Public regular']['patron'])
     self.assertFalse(by_name['Private badge']['patron']);self.assertNotIn('patronBadge',by_name['Private badge'])
     self.assertNotIn('Hidden real name',by_name)
     for row in actual:
      self.assertFalse({'recurringStatus','paidOn','paidThrough','nextDue','graceUntil','contributions','amountCzk'}&set(row))
      if row['anonymous']:self.assertNotIn('patronBadge',row);self.assertNotIn('patron',row)

if __name__=='__main__':unittest.main()
