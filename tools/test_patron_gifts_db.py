"""Private gift persistence and authorization in disposable local PostgreSQL."""
from uuid import uuid4
import psycopg

def run_gift_acceptance(opts):
 assert opts['host']=='127.0.0.1' and opts['dbname'].startswith('proplet_test_')
 pid=str(uuid4())
 with psycopg.connect(**opts) as c:
  c.execute("insert into public.players(id,name,family_code,token_hash) values(%s,'Gift QA','SOLO_GIFT_QA',%s)",(pid,str(uuid4())))
  c.execute("insert into proplet_private.patron_personal_gifts(player_id,gift_id) values(%s,%s)",(pid,'gift-qa-'+pid))
  before=c.execute('select count(*) from proplet_private.patron_payments').fetchone()[0]
  for role in ('anon','authenticated'):
   assert not c.execute("select has_function_privilege(%s,'public.proplet_patron_gift_v1(uuid,text,text)','execute')",(role,)).fetchone()[0]
   assert not c.execute("select has_function_privilege(%s,'public.proplet_patron_gifts_admin_v1()','execute')",(role,)).fetchone()[0]
   assert not c.execute("select has_table_privilege(%s,'proplet_private.patron_personal_gifts','select')",(role,)).fetchone()[0]
 def call(action='read',answer=None,player=pid):
  with psycopg.connect(**opts) as c:
   c.execute('set role service_role')
   return c.execute('select public.proplet_patron_gift_v1(%s,%s,%s)',(player,action,answer)).fetchone()[0]
 assert call()['gift']['pending']
 assert not call(player=str(uuid4()))['ok']
 assert not call('answer',' ')['ok']
 assert not call('answer','a'*1001)['ok']
 assert not call('later')['gift']['pending']
 assert not call()['gift']['pending']
 with psycopg.connect(**opts) as c:c.execute("update proplet_private.patron_personal_gifts set deferred_until=now()-interval '1 minute' where player_id=%s",(pid,))
 assert call()['gift']['pending']
 saved=call('answer','  Rys  ');assert saved['gift']['status']=='answered' and saved['gift']['answer']=='Rys'
 assert call('answer','Jiny')==saved
 assert call('later')==saved
 with psycopg.connect(**opts) as c:
  c.execute('set role service_role')
  result=c.execute('select public.proplet_patron_gifts_admin_v1()').fetchone()[0]
  record=next(x for x in result['items'] if x['playerId']==pid)
  assert record['answer']=='Rys' and record['respondedAt']
  assert c.execute('select count(*) from proplet_private.patron_payments').fetchone()[0]==before
 print('PASS personal gift SQL: private access, target isolation, defer/reappear, durable idempotent reply, admin answer; no payment mutation')

def run_delivery_acceptance(opts):
 from backend.patron_gifts import PLAYER_ID,EXCLUSIVE_AVATAR
 from concurrent.futures import ThreadPoolExecutor
 other=str(uuid4())
 with psycopg.connect(**opts) as c:
  c.execute("insert into public.players(id,name,family_code,token_hash,avatar,use_google_avatar,google_avatar_url) values(%s,'Delivery QA','SOLO_DELIVERY',%s,'🐶',true,'https://lh3.googleusercontent.com/a/synthetic-delivery-fixture') on conflict(id) do nothing",(PLAYER_ID,str(uuid4())))
  c.execute("insert into public.players(id,name,family_code,token_hash) values(%s,'Delivery other','SOLO_DELIVERY',%s)",(other,str(uuid4())))
  c.execute("insert into proplet_private.patron_personal_gifts(player_id,gift_id,status,answer,delivery_avatar,delivery_status) values(%s,'zdenek-personal-badge-20261112','answered','Datel',%s,'pending') on conflict(player_id) do update set status='answered',answer='Datel',delivery_avatar=excluded.delivery_avatar,delivery_status='pending',delivered_at=null",(PLAYER_ID,EXCLUSIVE_AVATAR))
  before=c.execute('select count(*) from proplet_private.patron_payments').fetchone()[0]
 def call(action,player=PLAYER_ID):
  with psycopg.connect(**opts) as c:
   c.execute('set role service_role')
   return c.execute('select public.proplet_patron_gift_v2(%s,%s,null)',(player,action)).fetchone()[0]
 assert call('read')['gift']['delivery']['pending']
 assert not call('read')['gift']['pending']
 assert not call('equip',other)['ok']
 assert call('delivery_later')['gift']['delivery']['status']=='later'
 assert not call('read')['gift']['delivery']['pending']
 with psycopg.connect(**opts) as c:
  assert c.execute('select avatar,use_google_avatar from public.players where id=%s',(PLAYER_ID,)).fetchone()==('🐶',True)
  c.execute('set role service_role')
  for token in (EXCLUSIVE_AVATAR,' '+EXCLUSIVE_AVATAR+' '):
   try:c.execute('update public.players set avatar=%s where id=%s',(token,other))
   except psycopg.errors.InsufficientPrivilege:pass
   else:raise AssertionError('Direct reserved avatar write bypassed ownership')
 with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:call('equip'),range(2)))
 assert all(r['avatar']==EXCLUSIVE_AVATAR and r['useGoogleAvatar'] is False for r in results)
 assert results[0]['gift']['delivery']['deliveredAt']==results[1]['gift']['delivery']['deliveredAt']
 assert call('delivery_later')['gift']['delivery']['status']=='equipped'
 assert call('read')['gift']['answer']=='Datel'
 with psycopg.connect(**opts) as c:
  assert c.execute('select count(*) from proplet_private.patron_payments').fetchone()[0]==before
  c.execute('set role service_role')
  c.execute('update public.players set avatar=%s where id=%s',('🐶',PLAYER_ID))
  c.execute('update public.players set avatar=%s where id=%s',(EXCLUSIVE_AVATAR,PLAYER_ID))
  for role in ('anon','authenticated'):
   assert not c.execute("select has_function_privilege(%s,'public.proplet_patron_gift_v2(uuid,text,text)','execute')",(role,)).fetchone()[0]
 print('PASS delivery SQL: target-only direct-write guard, atomic equip/Google-off, concurrent replay, durable dismissal, preserved answer and ledger, permanent selection')
