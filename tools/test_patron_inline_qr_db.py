"""Inline automatic QR lifecycle against disposable PostgreSQL and native HTTP."""
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import io
import psycopg
from psycopg import sql

def run_inline_qr_acceptance(c,rpc,new_player,admin,opts):
 assert opts['host']=='127.0.0.1' and opts['dbname'].startswith('proplet_test_')
 from fastapi import FastAPI,HTTPException
 from fastapi.testclient import TestClient
 from backend import patrons
 import resvg_py,zxingcpp
 from PIL import Image
 def ready_player():
  pid=new_player();rpc('proplet_patron_state_v1',pid,False)
  c.execute("update proplet_private.patron_first_seen set first_seen_at=now()-interval '10 days' where player_id=%s",(pid,))
  assert rpc('proplet_patron_state_v1',pid,False)['canOffer']
  return pid
 def shown(pid):
  reservation=rpc('proplet_patron_offer_v2',pid,None)
  assert reservation['displayGranted'],reservation
  rid=reservation['receiptId'];assert rpc('proplet_patron_offer_v2',pid,rid)['displayGranted']
  return rid
 def count_intents():return c.execute('select count(*) from proplet_private.patron_intents').fetchone()[0]
 owner=ready_player();other=ready_player()
 # A reservation is not visibility and cannot create automatic payment data.
 reserved=rpc('proplet_patron_offer_v2',owner,None)['receiptId'];before=count_intents()
 assert rpc('proplet_patron_offer_qr_v1',owner,reserved)['code']=='not_found'
 assert rpc('proplet_patron_offer_qr_v1',owner,str(uuid4()))['code']=='not_found'
 assert count_intents()==before
 assert rpc('proplet_patron_offer_v2',owner,reserved)['displayGranted']
 assert rpc('proplet_patron_offer_qr_v1',other,reserved)['code']=='not_found'
 # All parallel requests reuse one immutable intent and bank reference.
 def prepare(_):
  with psycopg.connect(**opts) as conn:
   conn.execute('set role service_role')
   return rpc('proplet_patron_offer_qr_v1',owner,reserved,connection=conn)
 with ThreadPoolExecutor(max_workers=6) as pool:prepared=list(pool.map(prepare,range(6)))
 assert all(item['ok'] for item in prepared)
 assert len({item['intent']['id'] for item in prepared})==1 and count_intents()==before+1
 intent=prepared[0]['intent'];iid=intent['id']
 assert intent['amountCzk']==129 and intent['frequency']=='once' and intent['firstPaymentDate'] is None
 assert intent['source']=='automatic_offer' and intent['engagedAt'] is None and intent['offerShownAt']
 assert rpc('proplet_patron_state_v1',owner,False)['offerWaitReason']=='cooldown'
 # It still must not become payment interest when its offer cooldown expires.
 c.execute("update proplet_private.patron_offer_receipts set shown_at=now()-interval '15 days' where id=%s",(reserved,))
 assert rpc('proplet_patron_state_v1',owner,False)['canOffer']
 assert rpc('proplet_patron_offer_qr_v1',owner,reserved)['intent']['id']==iid
 assert count_intents()==before+1
 unengaged_summary=rpc('proplet_patron_admin_list_v1',7,1,intent['reference'])
 assert unengaged_summary['summary']=={'manualPreparations':0,'automaticPrepared':1,'automaticOfferShown':1,'automaticEngaged':0,'activeInterest':0,'confirmedIntents':0}
 assert unengaged_summary['items'][0]['source']=='automatic_offer'
 # Real native endpoints bind the account, reject supplied amount/source and
 # return the production encoder output. No external transport or banking.
 calls=[]
 def auth(token):
  if token not in ('Bearer owner','Bearer other'):raise HTTPException(401,'auth')
  return {'id':owner if token=='Bearer owner' else other,'name':'Inline SQL'}
 def db_rpc(name,args):
  calls.append(name)
  with psycopg.connect(**opts) as conn:
   conn.execute('set role service_role')
   return conn.execute(sql.SQL('select public.{}({})').format(sql.Identifier(name),sql.SQL(',').join(sql.Placeholder() for _ in args)),tuple(args.values())).fetchone()[0]
 app=FastAPI();patrons.install(app,auth_player=auth,require_admin=lambda *a,**k:None,db_rpc=db_rpc,enforce_rate_limit=lambda *a,**k:None,enabled=lambda:True)
 client=TestClient(app);h={'Authorization':'Bearer owner'};oh={'Authorization':'Bearer other'}
 qr='/api/patrons/offers/qr';engage='/api/patrons/offers/engage'
 assert client.post(qr,json={'receiptId':reserved}).status_code==401
 assert client.post(qr,json={'receiptId':reserved},headers=oh).status_code==404
 for extra in ({'amountCzk':199},{'source':'manual'},{'playerId':other},{'frequency':'monthly'},{'requestId':str(uuid4())}):
  assert client.post(qr,json={'receiptId':reserved,**extra},headers=h).status_code==422
 response=client.post(qr,json={'receiptId':reserved},headers=h)
 assert response.status_code==200 and response.headers['cache-control']=='no-store'
 payment=response.json()['payment']
 assert '*AM:129.00*CC:CZK*X-VS:'+intent['reference']+'*MSG:' in payment['spd']
 assert '*FRQ:' not in payment['spd'] and '*DT:' not in payment['spd']
 for size in (140,256,512):
  png=resvg_py.svg_to_bytes(svg_string=payment['qrSvg'],width=size,height=size,dpi=96.0,background='#ffffff')
  decoded=zxingcpp.read_barcode(Image.open(io.BytesIO(png)).convert('RGB'))
  assert decoded and decoded.text==payment['spd'],f'Actual inline QR failed independent decoding at {size}px'
 assert client.post(engage,json={'intentId':iid,'action':'copied'}).status_code==401
 assert client.post(engage,json={'intentId':iid,'action':'copied'},headers=oh).status_code==404
 assert client.post(engage,json={'intentId':iid,'action':'opened'},headers=h).status_code==422
 assert client.post(engage,json={'intentId':iid,'action':'copied','playerId':other},headers=h).status_code==422
 # Successful save/copy starts the interest clock now, not at auto generation.
 c.execute("update proplet_private.patron_intents set created_at=now()-interval '30 days' where id=%s",(iid,))
 def click(action):
  with psycopg.connect(**opts) as conn:
   conn.execute('set role service_role')
   return rpc('proplet_patron_offer_engage_v1',owner,iid,action,connection=conn)
 with ThreadPoolExecutor(max_workers=6) as pool:engaged=list(pool.map(click,['saved','copied']*3))
 assert len({r['engagedAt'] for r in engaged})==1 and all(r['offerWaitReason']=='payment_pending' for r in engaged)
 replay=client.post(engage,json={'intentId':iid,'action':'copied'},headers=h)
 assert replay.status_code==200 and replay.json()['engagedAt']==engaged[0]['engagedAt']
 c.execute("update proplet_private.patron_automatic_intents set engaged_at=clock_timestamp()-interval '7 days 1 second' where intent_id=%s",(iid,))
 assert rpc('proplet_patron_state_v1',owner,False)['canOffer']
 old=rpc('proplet_patron_offer_engage_v1',owner,iid,'saved')
 assert old['canOffer'],'Retry must not renew first-success clock'
 # A separately explicit/manual intent retains the old seven-day behavior.
 manual=rpc('proplet_patron_intent_v1',owner,str(uuid4()),79)['intent']
 assert manual['source']=='manual' and manual['engagedAt'] is None
 assert rpc('proplet_patron_state_v1',owner,False)['offerWaitReason']=='payment_pending'
 assert rpc('proplet_patron_offer_engage_v1',owner,manual['id'],'copied')['code']=='not_found'
 # Invalid, stale or superseded receipts never mass-create intents.
 expired=ready_player();erid=shown(expired)
 c.execute("update proplet_private.patron_offer_receipts set shown_at=now()-interval '16 minutes' where id=%s",(erid,))
 before=count_intents();assert rpc('proplet_patron_offer_qr_v1',expired,erid)['code']=='offer_expired';assert count_intents()==before
 latest=ready_player();lrid=shown(latest)
 c.execute("insert into proplet_private.patron_offer_receipts(player_id,visibility_confirmed,shown_at) values(%s,true,clock_timestamp()+interval '1 second')",(latest,))
 assert rpc('proplet_patron_offer_qr_v1',latest,lrid)['code']=='offer_expired'
 blocked=ready_player();brid=shown(blocked)
 rpc('proplet_patron_preferences_v1',blocked,False,True)
 assert rpc('proplet_patron_offer_qr_v1',blocked,brid)['code']=='offer_ineligible'
 rpc('proplet_patron_preferences_v1',blocked,False,False)
 rpc('proplet_patron_intent_v1',blocked,str(uuid4()),199)
 assert rpc('proplet_patron_offer_qr_v1',blocked,brid)['code']=='offer_ineligible'
 # Scanning another device needs no save/copy. Confirm it through the exact
 # original ledger path and grant the normal badge/month funding once only.
 scanner=ready_player();srid=shown(scanner);scanned=rpc('proplet_patron_offer_qr_v1',scanner,srid)['intent']
 funding=rpc('proplet_patron_state_v1',scanner,False)['monthFunding']['raisedCzk']
 args=[admin,scanned['id'],scanned['reference'],'inline-real-bank-fixture',129,'CZK','5531840001/5500']
 assert not rpc('proplet_patron_confirm_v1',*args)['alreadyConfirmed']
 assert rpc('proplet_patron_confirm_v1',*args)['alreadyConfirmed']
 state=rpc('proplet_patron_state_v1',scanner,False)
 assert state['patron'] and state['offerWaitReason']=='patron' and state['monthFunding']['raisedCzk']==funding+129
 paid=rpc('proplet_patron_admin_list_v1',7,1,scanned['reference'])
 assert paid['summary']['confirmedIntents']==1 and paid['summary']['automaticEngaged']==0 and paid['summary']['activeInterest']==0
 assert paid['items'][0]['engagedAt'] is None and paid['items'][0]['paymentCount']==1
 assert rpc('proplet_patron_offer_qr_v1',scanner,srid)['intent']['id']==scanned['id']
 for role in ('anon','authenticated'):
  assert not c.execute("select has_table_privilege(%s,'proplet_private.patron_automatic_intents','select')",(role,)).fetchone()[0]
  for sig in ('public.proplet_patron_offer_qr_v1(uuid,uuid)','public.proplet_patron_offer_engage_v1(uuid,uuid,text)'):
   assert not c.execute('select has_function_privilege(%s,%s,\'execute\')',(role,sig)).fetchone()[0]
 assert not c.execute("select has_table_privilege('service_role','proplet_private.patron_automatic_intents','delete')").fetchone()[0]
 assert not c.execute("select has_column_privilege('service_role','proplet_private.patron_automatic_intents','receipt_id','update')").fetchone()[0]
 print('PASS inline QR real SQL+HTTP: confirmed receipt-only generation, six-way idempotence, immutable once129 exact QR decode140/256/512, owner/ACL/fresh/latest gates, auto-not-interest/admin counts, success engagement clock+retry, late direct-scan payment/badge/funding')
