"""Private gift eligibility and reply authority, using an isolated RPC fixture."""
import unittest
from unittest.mock import Mock
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from backend import patron_gifts as gifts

class GiftTests(unittest.TestCase):
 def setUp(self):
  self.rpc=Mock(return_value={'ok':True,'gift':{'id':gifts.GIFT_ID,'pending':True,'status':'pending'}})
  def auth(token):
   if not token:raise HTTPException(401,'auth')
   return {'id':gifts.PLAYER_ID if token=='Bearer target' else 'another-player'}
  def admin(token):
   if token!='Bearer admin':raise HTTPException(403,'admin')
  app=FastAPI();gifts.install(app,auth_player=auth,require_admin=admin,db_rpc=self.rpc,enforce_rate_limit=lambda *a,**k:None)
  self.client=TestClient(app)
 def test_unaddressed_players_have_no_note_or_database_request(self):
  self.assertEqual(gifts.state('another-player',self.rpc),{})
  self.rpc.assert_not_called()
  for token,status in [(None,401),('Bearer another',404)]:
   self.assertEqual(self.client.post('/api/patrons/gift',json={'action':'answer','answer':'Rys'},headers={'Authorization':token} if token else {}).status_code,status)
  self.rpc.assert_not_called()
 def test_target_gets_private_copy_and_validated_reply(self):
  self.assertIn('Vaše',gifts.state(gifts.PLAYER_ID,self.rpc)['personalGift']['paragraphs'][0])
  r=self.client.post('/api/patrons/gift',json={'action':'answer','answer':'  Rys  '},headers={'Authorization':'Bearer target'})
  self.assertEqual(r.status_code,200);self.assertEqual(r.headers['cache-control'],'no-store')
  self.rpc.assert_called_with('proplet_patron_gift_v2',{'p_player':gifts.PLAYER_ID,'p_action':'answer','p_answer':'Rys'})
 def test_delivery_copy_and_actions(self):
  self.rpc.return_value={'ok':True,'gift':{'delivery':{'pending':True,'avatar':gifts.EXCLUSIVE_AVATAR}}}
  state=gifts.state(gifts.PLAYER_ID,self.rpc)
  self.assertEqual(state['exclusiveAvatars'],[gifts.EXCLUSIVE_AVATAR])
  self.assertEqual(state['personalGift']['delivery']['paragraphs'],gifts.DELIVERY_COPY)
  self.assertEqual(state['personalGift']['delivery']['author'],'Pavel')
  for action in ('equip','delivery_later'):
   self.assertEqual(self.client.post('/api/patrons/gift',json={'action':action},headers={'Authorization':'Bearer target'}).status_code,200)
   self.rpc.assert_called_with('proplet_patron_gift_v2',{'p_player':gifts.PLAYER_ID,'p_action':action,'p_answer':None})
   self.assertEqual(self.client.post('/api/patrons/gift',json={'action':action,'answer':'x'},headers={'Authorization':'Bearer target'}).status_code,422)
 def test_reserved_avatar_http_authority(self):
  import server
  from unittest.mock import patch
  client=TestClient(server.app)
  for pid in ('another-player',gifts.PLAYER_ID):
   with patch.object(server,'auth_player',return_value={'id':pid,'avatar':'🙂','google_avatar_url':'https://example.test/photo'}),patch.object(server,'db_update') as update,patch.object(server,'enforce_rate_limit'):
    for token in (gifts.EXCLUSIVE_AVATAR,' '+gifts.EXCLUSIVE_AVATAR+' '):
     for google in (False,True):
      update.reset_mock()
      result=client.post('/api/avatar',json={'avatar':token,'use_google_avatar':google},headers={'Authorization':'Bearer player'})
      self.assertEqual(result.status_code,200 if pid==gifts.PLAYER_ID else 403,result.text)
      if pid!=gifts.PLAYER_ID:update.assert_not_called()
    update.reset_mock()
    self.assertEqual(client.post('/api/avatar',json={'avatar':gifts.EXCLUSIVE_AVATAR+'x'*20}).status_code,422)
    update.assert_not_called()
    self.assertEqual(client.post('/api/avatar',json={'avatar':'🐶'}).status_code,200)
 def test_invalid_and_spoofed_replies_never_write(self):
  for body in [{'action':'answer','answer':' '},{'action':'answer','answer':'a'*1001},{'action':'later','answer':'Rys'},{'action':'answer','answer':'Rys','playerId':'other'}]:
   self.assertEqual(self.client.post('/api/patrons/gift',json=body,headers={'Authorization':'Bearer target'}).status_code,422)
  self.rpc.assert_not_called()
 def test_admin_responses_are_private(self):
  self.assertEqual(self.client.get('/api/admin/patrons/gifts',headers={'Authorization':'Bearer target'}).status_code,403)
  self.rpc.assert_not_called()
  self.assertEqual(self.client.get('/api/admin/patrons/gifts',headers={'Authorization':'Bearer admin'}).status_code,200)
 def test_optional_note_failure_does_not_break_patron_state(self):
  self.rpc.side_effect=HTTPException(503,'offline')
  self.assertEqual(gifts.state(gifts.PLAYER_ID,self.rpc),{})

if __name__=='__main__':unittest.main()
