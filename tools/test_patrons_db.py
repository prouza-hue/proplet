"""Real patron SQL acceptance, restricted to synthetic loopback databases."""
import argparse,json,re,secrets
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4
import psycopg
from psycopg import sql

ROOT=Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--password-file',type=Path,required=True);p.add_argument('--database-report',type=Path);p.add_argument('--port',type=int,default=55432);p.add_argument('--user',default='proplet_test_admin');p.add_argument('--minimal',action='store_true');a=p.parse_args()
 opts=dict(host='127.0.0.1',port=a.port,user=a.user,password=a.password_file.read_text().strip(),autocommit=True)
 if a.minimal:
  name='proplet_test_patron_'+secrets.token_hex(5)
  with psycopg.connect(**opts,dbname='postgres') as c:c.execute(sql.SQL('create database {}').format(sql.Identifier(name)))
 else:
  report=json.loads(a.database_report.read_text());name=report.get('database','')
  if report.get('host')!='127.0.0.1' or not re.fullmatch('proplet_test_[a-z0-9_]{1,50}',name):p.error('Only disposable loopback fixture databases permitted')
 opts['dbname']=name
 with psycopg.connect(**opts) as c:
  if a.minimal:
   c.execute("""do $$begin if not exists(select from pg_roles where rolname='anon') then create role anon;end if;if not exists(select from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select from pg_roles where rolname='service_role') then create role service_role bypassrls;end if;end$$;
   create table public.players(id uuid primary key,name text,family_code text,token_hash text,support_mode text default 'none',public_rankings boolean default true,created_at timestamptz default now()-interval '10 days');
   create unique index players_family_name_ci on public.players(family_code,lower(name));
   create table public.results(id uuid primary key,player_id uuid references players(id),puzzle_id text,challenge_key text,mode text check(mode in('daily','daily_special','free','starter','tajenka')),difficulty text,best_elapsed_ms integer,best_moves integer,points integer,completed_at timestamptz,unique(player_id,challenge_key));
   create table public.admin_accounts(player_id uuid primary key,role text,active boolean);
   grant select,update on public.players to service_role;grant select on public.results,public.admin_accounts to service_role;""")
   c.execute("create function public.proplet_monthly_now_v1() returns timestamptz language sql as $$select statement_timestamp()$$")
   c.execute((ROOT/'supabase/migrations/20261029120000_release_news_receipts.sql').read_text())
   c.execute((ROOT/'supabase/migrations/20261031134258_patron_support.sql').read_text())
   c.execute((ROOT/'supabase/migrations/20261101022415_patron_manual_badge.sql').read_text(encoding='utf8'))
  ids=[str(uuid4()) for _ in range(4)];player,other,balanced,admin=ids
  for index,pid in enumerate(ids):c.execute('insert into public.players(id,name,family_code,token_hash,support_mode,public_rankings) values(%s,%s,%s,%s,%s,true)',(pid,'Patron SQL '+str(index),'patron-test',secrets.token_hex(32),'younger' if pid==balanced else 'none'))
  # Use the existing schema's required admin columns, if present.
  cols={r[0] for r in c.execute("select column_name from information_schema.columns where table_schema='public' and table_name='admin_accounts'")}
  if 'id' in cols:c.execute("insert into public.admin_accounts(id,player_id,role,active) values(%s,%s,'owner',true)",(str(uuid4()),admin))
  else:c.execute("insert into public.admin_accounts(player_id,role,active) values(%s,'owner',true)",(admin,))
  def rpc(name,*args,connection=c):
   return connection.execute(sql.SQL('select public.{}({})').format(sql.Identifier(name),sql.SQL(',').join(sql.Placeholder() for _ in args)),args).fetchone()[0]
  def seed(pid):
   for j in range(5):c.execute("insert into public.results(id,player_id,puzzle_id,challenge_key,mode,difficulty,best_elapsed_ms,best_moves,points,completed_at) values(%s,%s,%s,%s,'free','easy',10000,5,15,now()-(%s||' days')::interval)",(str(uuid4()),pid,'patron-'+str(j),'free:patron-'+str(j),j%3))
  assert rpc('proplet_patron_state_v1',player,False)['canOffer'] is False
  for pid in (player,other,balanced):
   seed(pid)
   waiting=rpc('proplet_patron_state_v1',pid,False)
   assert not waiting['canOffer'] and waiting['offerWaitReason']=='release_wait'
   assert waiting['offerAnchorSource']=='first_seen'
  # Only the fixture owner advances durable timestamps; the application role
  # cannot supply a clock or overwrite the per-account first visit.
  c.execute("update proplet_private.patron_first_seen set first_seen_at=now()-interval '49 hours'")
  assert rpc('proplet_patron_state_v1',player,False)['canOffer'] is True
  assert rpc('proplet_patron_state_v1',balanced,False)['canOffer'] is True
  assert rpc('proplet_patron_state_v1',balanced,True)['displayGranted'] is True

  def new_player():
   pid=str(uuid4())
   c.execute("insert into public.players(id,name,family_code,token_hash) values(%s,%s,'patron-test',%s)",(pid,'News SQL '+pid[:8],secrets.token_hex(32)))
   seed(pid)
   return pid
  def news(pid,hours=0):
   c.execute("insert into public.release_news_receipts(campaign_id,player_id,claimed_at) values('november-2026-release-v1',%s,now()-(%s||' hours')::interval)",(pid,hours))
  def post_news_board(pid,index,mode='free'):
   c.execute("insert into public.results(id,player_id,puzzle_id,challenge_key,mode,difficulty,best_elapsed_ms,best_moves,points,completed_at) values(%s,%s,%s,%s,%s,'easy',10000,5,15,now()) on conflict do nothing",(str(uuid4()),pid,'patron-post-'+str(index),mode+':patron-post-'+str(index),mode))
  news_player=new_player();news(news_player)
  for j in range(2):post_news_board(news_player,j)
  waiting=rpc('proplet_patron_state_v1',news_player,True)
  assert not waiting['displayGranted'] and waiting['offerWaitReason']=='release_wait' and waiting['postAnchorBoards']==2
  c.execute("update public.release_news_receipts set claimed_at=now()-interval '47 hours 59 minutes' where player_id=%s",(news_player,))
  assert not rpc('proplet_patron_state_v1',news_player,True)['displayGranted']
  c.execute("update public.release_news_receipts set claimed_at=now()-interval '48 hours' where player_id=%s",(news_player,))
  assert rpc('proplet_patron_state_v1',news_player,False)['canOffer']
  # Five historic boards and elapsed time cannot replace two new boards.
  late=new_player();rpc('proplet_patron_state_v1',late,False)
  c.execute("update proplet_private.patron_first_seen set first_seen_at=now()-interval '20 days' where player_id=%s",(late,))
  assert rpc('proplet_patron_state_v1',late,False)['canOffer']
  news(late)
  late_state=rpc('proplet_patron_state_v1',late,False)
  assert late_state['offerAnchorSource']=='release_news' and late_state['postAnchorBoards']==0 and not late_state['canOffer']
  c.execute("update public.release_news_receipts set claimed_at=now()-interval '49 hours' where player_id=%s",(late,))
  # Existing history may include boards after this artificial old receipt:
  # move that history before it, and count only distinct ordinary completions.
  c.execute("update public.results set completed_at=completed_at-interval '4 days' where player_id=%s",(late,))
  assert rpc('proplet_patron_state_v1',late,False)['offerWaitReason']=='post_news_boards'
  post_news_board(late,0);post_news_board(late,0)
  post_news_board(late,1,'starter')
  state=rpc('proplet_patron_state_v1',late,False)
  assert state['postAnchorBoards']==1 and not state['canOffer']
  post_news_board(late,1)
  assert rpc('proplet_patron_state_v1',late,False)['canOffer']
  assert rpc('proplet_patron_preferences_v1',late,False,True)['offerWaitReason']=='disabled'
  assert not rpc('proplet_patron_state_v1',late,True)['displayGranted']
  assert rpc('proplet_patron_preferences_v1',late,False,False)['canOffer']
  # No-history accounts never become eligible merely by waiting.
  empty=str(uuid4());c.execute("insert into public.players(id,name,family_code,token_hash) values(%s,'Empty','patron-test',%s)",(empty,secrets.token_hex(32)))
  rpc('proplet_patron_state_v1',empty,False)
  c.execute("update proplet_private.patron_first_seen set first_seen_at=now()-interval '49 hours' where player_id=%s",(empty,))
  assert rpc('proplet_patron_state_v1',empty,False)['offerWaitReason']=='playing_history'
  # News insertion holds the same account lock until commit. Another device
  # cannot consume a stale fallback eligibility while that receipt is arriving.
  from threading import Event
  inserted=Event();finish_news=Event();race=new_player()
  rpc('proplet_patron_state_v1',race,False)
  c.execute("update proplet_private.patron_first_seen set first_seen_at=now()-interval '20 days' where player_id=%s",(race,))
  def insert_news():
   with psycopg.connect(**{**opts,'autocommit':False}) as conn:
    conn.execute('set role service_role')
    conn.execute("insert into public.release_news_receipts(campaign_id,player_id) values('november-2026-release-v1',%s)",(race,))
    inserted.set();assert finish_news.wait(5)
  def race_claim():
   with psycopg.connect(**opts) as conn:
    conn.execute('set role service_role')
    return rpc('proplet_patron_state_v1',race,True,connection=conn)
  with ThreadPoolExecutor(max_workers=2) as pool:
   news_future=pool.submit(insert_news);assert inserted.wait(5)
   offer_future=pool.submit(race_claim)
   try:
    from concurrent.futures import TimeoutError
    try:offer_future.result(timeout=.15)
    except TimeoutError:pass
    else:raise AssertionError('News insertion failed to serialize offer claim')
   finally:finish_news.set()
   news_future.result();race_state=offer_future.result()
  assert not race_state['displayGranted'] and race_state['offerAnchorSource']=='release_news'
  assert race_state['offerWaitReason']=='release_wait'

  c.execute('set role service_role')
  request=str(uuid4());first=rpc('proplet_patron_intent_v1',player,request,99)['intent']
  assert first['status']=='qr_created' and first['reference'].isdigit()
  assert rpc('proplet_patron_state_v1',player,False)['patron'] is False
  assert rpc('proplet_patron_intent_v1',player,request,99)['intent']==first
  assert rpc('proplet_patron_intent_v1',player,request,199)['code']=='idempotency_conflict'
  assert rpc('proplet_patron_intent_read_v1',other,first['id'])['code']=='not_found'
  assert rpc('proplet_patron_preferences_v1',player,True,False)['code']=='not_confirmed'
  c.execute('reset role');c.execute("update public.players set name='Změněné jméno' where id=%s",(player,))
  assert rpc('proplet_patron_intent_v1',player,request,99)['intent']['nicknameSnapshot']==first['nicknameSnapshot']
  # Atomic offer claims on the same account across independent device connections.
  def claim(_):
   with psycopg.connect(**opts) as conn:
    conn.execute('set role service_role')
    return rpc('proplet_patron_state_v1',player,True,connection=conn)
  with ThreadPoolExecutor(max_workers=2) as pool:claims=list(pool.map(claim,range(2)))
  assert sum(r['displayGranted'] for r in claims)==1
  c.execute("update proplet_private.patron_offer_receipts set shown_at=now()-interval '31 days' where player_id=%s",(player,))
  assert rpc('proplet_patron_state_v1',player,True)['displayGranted'] is True
  c.execute("update proplet_private.patron_offer_receipts set shown_at=shown_at-interval '31 days' where player_id=%s",(player,))
  assert rpc('proplet_patron_state_v1',player,True)['displayGranted'] is False
  c.execute("update proplet_private.patron_offer_receipts set shown_at=shown_at-interval '91 days' where player_id=%s",(player,))
  assert rpc('proplet_patron_state_v1',player,False)['canOffer'] is True
  assert rpc('proplet_patron_preferences_v1',player,False,True)['canOffer'] is False
  assert rpc('proplet_patron_preferences_v1',player,False,False)['canOffer'] is True
  try:rpc('proplet_patron_confirm_v1',other,first['id'],first['reference'],'forbidden',99,'CZK','5531840001/5500')
  except psycopg.errors.InsufficientPrivilege:pass
  else:raise AssertionError('Non-admin confirmed a contribution')
  # Only matching, received receipts grant the permanent entitlement.
  confirm=lambda pid,ref,tx,amount=99,account='5531840001/5500',currency='CZK':rpc('proplet_patron_confirm_v1',admin,pid,ref,tx,amount,currency,account)
  for kw in ({'amount':100},{'currency':'EUR'},{'account':'1/0100'}):assert confirm(first['id'],first['reference'],'test-tx',**kw)['code']=='payment_mismatch'
  assert confirm(first['id'],'9999999999','test-tx')['code']=='payment_mismatch'
  assert rpc('proplet_patron_state_v1',player,False)['patron'] is False
  assert confirm(first['id'],first['reference'],'test-tx')['alreadyConfirmed'] is False
  thank_state=rpc('proplet_patron_state_v1',player,False)
  assert thank_state['thanksPending'] and not thank_state['publicBadge']
  assert len(thank_state['contributions'])==1
  assert set(thank_state['contributions'][0])=={'id','amountCzk','frequency','confirmedAt'}
  assert thank_state['contributions'][0]['amountCzk']==99
  assert rpc('proplet_patron_state_v1',other,False)['contributions']==[]
  assert not rpc('proplet_patron_thanks_claim_v1',other)['displayGranted']
  def claim_thanks(_):
   with psycopg.connect(**opts) as conn:
    conn.execute('set role service_role')
    return rpc('proplet_patron_thanks_claim_v1',player,connection=conn)
  with ThreadPoolExecutor(max_workers=2) as pool:thanks=list(pool.map(claim_thanks,range(2)))
  assert sum(r['displayGranted'] for r in thanks)==1
  assert not rpc('proplet_patron_thanks_claim_v1',player)['displayGranted']
  assert not rpc('proplet_patron_state_v1',player,False)['thanksPending']

  assert confirm(first['id'],first['reference'],'test-tx')['alreadyConfirmed'] is True
  assert confirm(first['id'],first['reference'],'another-tx')['ok'] is False
  second=rpc('proplet_patron_intent_v1',other,str(uuid4()),99)['intent']
  assert confirm(second['id'],second['reference'],'test-tx')['code']=='bank_transaction_already_used'
  # Monthly instructions are immutable; each real bank transaction is a new
  # ledger entry, while retries must never duplicate receipts or entitlement.
  today=c.execute("select (statement_timestamp() at time zone 'Europe/Prague')::date").fetchone()[0]
  from datetime import timedelta
  for zone in ('Pacific/Kiritimati','Etc/GMT+12'):
   c.execute(sql.SQL('set time zone {}').format(sql.Literal(zone)))
   assert rpc('proplet_patron_intent_v1',other,str(uuid4()),199,'monthly',today)['ok']
   assert rpc('proplet_patron_intent_v1',other,str(uuid4()),199,'monthly',today-timedelta(days=1))['code']=='invalid_first_payment_date'
  c.execute('reset time zone')
  monthly_request=str(uuid4())
  monthly=rpc('proplet_patron_intent_v1',other,monthly_request,199,'monthly',today)['intent']
  assert monthly['frequency']=='monthly' and monthly['firstPaymentDate']==today.isoformat()
  assert monthly['paymentCount']==0 and monthly['totalConfirmedCzk']==0
  assert rpc('proplet_patron_intent_v1',other,monthly_request,199,'monthly',today)['intent']==monthly
  assert rpc('proplet_patron_intent_v1',other,monthly_request,199,'once',None)['code']=='idempotency_conflict'
  assert rpc('proplet_patron_intent_v1',other,monthly_request,199,'monthly',today+timedelta(days=1))['code']=='idempotency_conflict'
  assert rpc('proplet_patron_intent_read_v1',player,monthly['id'])['code']=='not_found'
  for frequency,day in [('monthly',None),('monthly',today-timedelta(days=1)),('once',today)]:
   assert rpc('proplet_patron_intent_v1',other,str(uuid4()),199,frequency,day)['code']=='invalid_first_payment_date'
  assert confirm(monthly['id'],monthly['reference'],'test-tx',amount=199)['code']=='bank_transaction_already_used'
  assert confirm(monthly['id'],first['reference'],'monthly-1',amount=199)['code']=='payment_mismatch'
  assert confirm(monthly['id'],monthly['reference'],'monthly-1',amount=99)['code']=='payment_mismatch'
  assert confirm(monthly['id'],monthly['reference'],'monthly-1',amount=199)['alreadyConfirmed'] is False
  # Exercise independent concurrent retries of the same second receipt.
  def monthly_retry(_):
   with psycopg.connect(**opts) as conn:
    conn.execute('set role service_role')
    return rpc('proplet_patron_confirm_v1',admin,monthly['id'],monthly['reference'],'monthly-2',199,'CZK','5531840001/5500',connection=conn)
  with ThreadPoolExecutor(max_workers=2) as pool:receipts=list(pool.map(monthly_retry,range(2)))
  assert sum(not r['alreadyConfirmed'] for r in receipts)==1
  assert all(r['intent']['paymentCount']==2 and r['intent']['totalConfirmedCzk']==398 for r in receipts)
  assert confirm(monthly['id'],monthly['reference'],'monthly-1',amount=199)['alreadyConfirmed'] is True
  monthly_state=rpc('proplet_patron_state_v1',other,False)
  assert monthly_state['patron'] and monthly_state['thanksPending'] and not monthly_state['publicBadge']
  assert len(monthly_state['contributions'])==2
  assert all(set(r)=={'id','amountCzk','frequency','confirmedAt'} and r['frequency']=='monthly' and r['amountCzk']==199 for r in monthly_state['contributions'])
  assert len(rpc('proplet_patron_state_v1',player,False)['contributions'])==1

  assert c.execute('select count(*) from proplet_private.patron_entitlements where player_id=%s',(other,)).fetchone()[0]==1
  assert c.execute('select count(*) from proplet_private.patron_audit where intent_id=%s',(monthly['id'],)).fetchone()[0]==2
  ledger=rpc('proplet_patron_admin_list_v1',7,100,monthly['reference'])['items'][0]
  assert ledger['paymentCount']==2 and len(ledger['payments'])==2
  assert {r['bankTransactionId'] for r in ledger['payments']}=={'monthly-1','monthly-2'}
  assert 'payments' not in rpc('proplet_patron_intent_read_v1',other,monthly['id'])['intent']
  # The date may be historical on later retrieval/retry. Simulate a past
  # immutable creation as fixture owner; the application role cannot edit it.
  c.execute("update proplet_private.patron_intents set first_payment_date=%s where id=%s",(today-timedelta(days=1),monthly['id']))
  assert rpc('proplet_patron_intent_v1',other,monthly_request,199,'monthly',today-timedelta(days=1))['ok']
  state=rpc('proplet_patron_state_v1',player,True);assert state['patron'] and not state['publicBadge'] and not state['displayGranted']
  assert rpc('proplet_patron_public_ids_v1',ids)['players']==[]
  rpc('proplet_patron_preferences_v1',player,True,False)
  assert rpc('proplet_patron_public_ids_v1',ids)['players']==[player]
  c.execute('update public.players set public_rankings=false where id=%s',(player,));assert rpc('proplet_patron_public_ids_v1',ids)['players']==[]
  c.execute("update proplet_private.patron_intents set created_at=now()-interval '100 days' where id=%s",(first['id'],))
  assert not any(i['id']==first['id'] for i in rpc('proplet_patron_admin_list_v1',7,100,None)['items'])
  assert rpc('proplet_patron_admin_list_v1',7,100,first['reference'])['items'][0]['id']==first['id']
  assert c.execute('select count(*) from proplet_private.patron_audit where player_id=%s',(player,)).fetchone()[0]==1
  c.execute('set role service_role')
  try:c.execute("update proplet_private.patron_first_seen set first_seen_at=now() where player_id=%s",(player,))
  except psycopg.errors.InsufficientPrivilege:pass
  else:raise AssertionError('Application role can reset first visit')
  c.execute('reset role')
  for role in ('anon','authenticated'):
   c.execute(sql.SQL('set role {}').format(sql.Identifier(role)))
   try:rpc('proplet_patron_state_v1',player,False)
   except psycopg.errors.InsufficientPrivilege:pass
   else:raise AssertionError('Client role can invoke private patron RPC')
   c.execute('reset role')
  http_acceptance(opts,new_player(),new_player(),admin)
  from tools.test_patron_manual_badge_db import run_manual_badge_acceptance
  run_manual_badge_acceptance(opts)
 print('PASS patron SQL: migration, ownership, immutable once/monthly/date, Prague calendar, repeated monthly receipts, concurrent receipt retry, permanent entitlement, account-wide exactly-once thanks claim, private bounded personal payment history, monthly audit/ledger, rename, atomic claims/news receipt race, balanced preset eligibility, durable first-visit 48h fallback, news priority + 48h + two distinct ordinary boards, late receipt reset, 3-day/5-board eligibility, 30/90-day limits, opt-out, exact receipt, duplicate bank transaction, private default and ACL; database='+name)

def http_acceptance(opts,owner,other,admin):
 """Real native HTTP handlers over the disposable SQL schema, no mocked RPC."""
 import sys
 sys.path.insert(0,str(ROOT))
 from fastapi import FastAPI,HTTPException
 from fastapi.testclient import TestClient
 from backend import patrons
 app=FastAPI();enabled=[True];rpc_calls=[]
 identities={'Bearer sql-owner':owner,'Bearer sql-other':other,'Bearer sql-admin':admin}
 def auth(value):
  pid=identities.get(value)
  if not pid:raise HTTPException(401,'test authentication required')
  return {'id':pid,'name':'HTTP synthetic account'}
 def require_admin(value,write=False):
  p=auth(value)
  if p['id']!=admin:raise HTTPException(403,'admin required')
  return {'player':p,'role':'owner'}
 def call(name,args):
  rpc_calls.append(name)
  with psycopg.connect(**opts) as db:
   db.execute('set role service_role')
   fields=sql.SQL(',').join(sql.SQL('{}=>{}').format(sql.Identifier(k),sql.Placeholder()) for k in args)
   return db.execute(sql.SQL('select public.{}({})').format(sql.Identifier(name),fields),list(args.values())).fetchone()[0]
 patrons.install(app,auth_player=auth,require_admin=require_admin,db_rpc=call,enforce_rate_limit=lambda *a,**k:None,enabled=lambda:enabled[0])
 client=TestClient(app);h={'Authorization':'Bearer sql-owner'};oh={'Authorization':'Bearer sql-other'};ah={'Authorization':'Bearer sql-admin'}
 body={'requestId':str(uuid4()),'amountCzk':99}
 assert client.post('/api/patrons/intents',json=body).status_code==401
 assert client.post('/api/patrons/intents',json={**body,'playerId':other},headers=h).status_code==422
 response=client.post('/api/patrons/intents',json=body,headers=h);assert response.status_code==200,response.text
 created=response.json();intent=created['intent'];payment=created['payment'];path='/api/patrons/intents/'+intent['id']
 assert intent['account']=='5531840001/5500'
 with psycopg.connect(**opts) as db:assert str(db.execute('select player_id from proplet_private.patron_intents where id=%s',(intent['id'],)).fetchone()[0])==owner
 assert intent['message']==intent['nicknameSnapshot']+' podporuje Proplet'
 assert payment['iban']=='CZ5355000000005531840001' and '*X-VS:'+intent['reference']+'*MSG:' in payment['spd']
 # Decode the actual production encoder's QR generated from this SQL-owned intent.
 import io,resvg_py,zxingcpp
 from PIL import Image
 png=resvg_py.svg_to_bytes(svg_string=payment['qrSvg'],width=256,height=256,dpi=96.0,background='#ffffff')
 decoded=zxingcpp.read_barcode(Image.open(io.BytesIO(png)).convert('RGB'))
 assert decoded and decoded.text==payment['spd']
 assert client.post('/api/patrons/intents',json=body,headers=h).json()==created
 assert client.post('/api/patrons/intents',json={**body,'amountCzk':199},headers=h).status_code==409
 assert client.get(path,headers=oh).status_code==404
 with psycopg.connect(**opts) as db:db.execute("update public.players set name='HTTP renamed' where id=%s",(owner,))
 assert client.get(path,headers=h).json()==created
 assert not client.get('/api/patrons',headers=h).json()['patron']
 assert client.get('/api/admin/patrons',headers=h).status_code==403
 receipt={'intentId':intent['id'],'reference':intent['reference'],'bankTransactionId':'http-synthetic-'+str(uuid4()),'amountCzk':99,'currency':'CZK','recipientAccount':'5531840001/5500'}
 assert client.post('/api/admin/patrons/confirm',json=receipt,headers=h).status_code==403
 for changes in ({'amountCzk':100},{'reference':'9999999999'}):
  assert client.post('/api/admin/patrons/confirm',json={**receipt,**changes},headers=ah).status_code==409
 for changes in ({'currency':'EUR'},{'recipientAccount':'1/0100'}):
  assert client.post('/api/admin/patrons/confirm',json={**receipt,**changes},headers=ah).status_code==422
 confirmed=client.post('/api/admin/patrons/confirm',json=receipt,headers=ah)
 assert confirmed.status_code==200,confirmed.text
 assert not confirmed.json()['alreadyConfirmed']
 assert client.post('/api/admin/patrons/confirm',json=receipt,headers=ah).json()['alreadyConfirmed']
 # A real transaction ID can never grant an entitlement to a different account.
 second=client.post('/api/patrons/intents',json={'requestId':str(uuid4()),'amountCzk':99},headers=oh).json()['intent']
 assert client.post('/api/admin/patrons/confirm',json={**receipt,'intentId':second['id'],'reference':second['reference']},headers=ah).status_code==409
 state=client.get('/api/patrons',headers=h).json();assert state['patron'] and state['thanksPending'] and not state['publicBadge']
 assert len(state['contributions'])==1 and set(state['contributions'][0])=={'id','amountCzk','frequency','confirmedAt'}
 assert client.get('/api/patrons',headers=oh).json()['contributions']==[]
 assert client.post('/api/patrons/thanks/claim',headers=h).json()['displayGranted']
 assert not client.post('/api/patrons/thanks/claim',headers=h).json()['displayGranted']
 assert not client.get('/api/patrons',headers=h).json()['thanksPending']
 assert client.post('/api/patrons/preferences',json={'publicBadge':True,'offersDisabled':True},headers=h).json()['publicBadge']
 rows=client.get('/api/admin/patrons?reference='+intent['reference'],headers=ah).json()['items']
 assert rows[0]['id']==intent['id'] and rows[0]['paymentCount']==1
 enabled[0]=False;before=len(rpc_calls)
 assert client.get('/api/patrons',headers=h).json()=={'enabled':False}
 assert client.post('/api/patrons/intents',json=body,headers=h).status_code==503
 assert len(rpc_calls)==before
 print('PASS native patron HTTP + real SQL: authenticated immutable QR decoded, owner/rename binding, admin authority, exact matching, idempotence, duplicate bank ID denial, private history, account thanks, opt-in and default-OFF without database calls')

if __name__=='__main__':main()
