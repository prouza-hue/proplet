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
