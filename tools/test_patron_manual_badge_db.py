"""Audited non-monetary owner badge acceptance in disposable loopback PG."""
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import psycopg

OWNER='e1740794-d196-48da-a59a-2741eadb8e44'

def run_manual_badge_acceptance(opts):
 assert opts['host']=='127.0.0.1' and opts['dbname'].startswith('proplet_test_')
 def connect():return psycopg.connect(**opts)
 def call(actor=OWNER,target=OWNER,request=None,action='grant',reason='Owner requested non-monetary promotional badge',public=False):
  with connect() as c:
   c.execute('set role service_role')
   return c.execute('select proplet_patron_owner_badge_v1(%s,%s,%s,%s,%s,%s)',(actor,target,request or str(uuid4()),action,reason,public)).fetchone()[0]
 def state():
  with connect() as c:
   c.execute('set role service_role')
   return c.execute('select proplet_patron_state_v1(%s,false)',(OWNER,)).fetchone()[0]
 def finance(c):
  return c.execute('select (select count(*) from proplet_private.patron_intents),(select count(*) from proplet_private.patron_payments),(select coalesce(sum(amount_czk),0) from proplet_private.patron_payments),(select count(*) from proplet_private.patron_entitlements),(select count(*) from proplet_private.patron_audit),(select count(*) from public.results),(select coalesce(sum(points),0) from public.results)').fetchone()
 with connect() as c:
  c.execute("insert into public.players(id,name,family_code,token_hash) values(%s,'Owner badge QA','SOLO_MANUAL_QA',%s) on conflict(id) do nothing",(OWNER,'owner-badge-'+str(uuid4())))
  cols={x[0] for x in c.execute("select column_name from information_schema.columns where table_schema='public' and table_name='admin_accounts'")}
  if 'id' in cols:c.execute("insert into public.admin_accounts(id,player_id,role,active) values(%s,%s,'owner',true) on conflict(player_id) do update set role='owner',active=true",(str(uuid4()),OWNER))
  else:c.execute("insert into public.admin_accounts(player_id,role,active) values(%s,'owner',true) on conflict(player_id) do update set role='owner',active=true",(OWNER,))
  before=finance(c)
  assert not c.execute('select proplet_private.patron_effective_v1(%s)',(OWNER,)).fetchone()[0]
  for role in ('anon','authenticated'):
   assert not c.execute("select has_function_privilege(%s,'public.proplet_patron_owner_badge_v1(uuid,uuid,uuid,text,text,boolean)','execute')",(role,)).fetchone()[0]
   assert not c.execute("select has_table_privilege(%s,'proplet_private.patron_manual_badge_events','select')",(role,)).fetchone()[0]
  for op in ('insert','update','delete'):
   assert not c.execute("select has_table_privilege('service_role','proplet_private.patron_manual_badge_events',%s)",(op,)).fetchone()[0]
 private_key=str(uuid4());first=call(request=private_key)
 assert first['patron'] and not first['publicBadge'] and not first['paymentCreated'] and first['source']=='owner_promotional_badge'
 assert call(request=private_key)==first
 s=state();assert s['patron'] and not s['publicBadge'] and not s['thanksPending'] and not s['canOffer'] and s['contributions']==[]
 other=str(uuid4())
 for changes in ({'actor':other},{'target':other},{'reason':'tiny'}):
  try:call(**changes);raise AssertionError('invalid or unauthorized grant accepted')
  except (psycopg.errors.InsufficientPrivilege,psycopg.errors.InvalidParameterValue):pass
 with connect() as c:c.execute('update admin_accounts set active=false where player_id=%s',(OWNER,))
 try:call();raise AssertionError('inactive owner granted badge')
 except psycopg.errors.InsufficientPrivilege:pass
 with connect() as c:c.execute('update admin_accounts set active=true where player_id=%s',(OWNER,))
 public_key=str(uuid4());public=call(request=public_key,public=True)
 assert public['patron'] and public['publicBadge']
 with connect() as c:
  assert c.execute('select proplet_patron_public_ids_v1(array[%s]::uuid[])',(OWNER,)).fetchone()[0]['players']==[OWNER]
  c.execute('update players set public_rankings=false where id=%s',(OWNER,))
  assert c.execute('select proplet_patron_public_ids_v1(array[%s]::uuid[])',(OWNER,)).fetchone()[0]['players']==[]
  c.execute('update players set public_rankings=true where id=%s',(OWNER,))
  c.execute('set role service_role')
  assert not c.execute('select proplet_patron_preferences_v1(%s,false,true)',(OWNER,)).fetchone()[0]['publicBadge']
  assert c.execute('select proplet_patron_preferences_v1(%s,true,true)',(OWNER,)).fetchone()[0]['publicBadge']
  assert not c.execute('select proplet_patron_thanks_claim_v1(%s)',(OWNER,)).fetchone()[0]['displayGranted']
 revoked=call(action='revoke');assert not revoked['patron'] and not revoked['publicBadge']
 assert call(request=public_key,public=True)==public
 assert not state()['patron'] # Lost-response replay cannot resurrect a revoked badge.
 key=str(uuid4())
 with ThreadPoolExecutor(max_workers=6) as pool:results=list(pool.map(lambda _:call(request=key,public=True),range(6)))
 assert all(r==results[0] for r in results)
 try:call(request=key,public=False);raise AssertionError('idempotency conflict accepted')
 except psycopg.errors.InvalidParameterValue:pass
 with connect() as c:
  assert c.execute('select count(*) from proplet_private.patron_manual_badge_events where player_id=%s',(OWNER,)).fetchone()[0]==4
  assert finance(c)==before
  c.execute("create function proplet_private.manual_badge_test_fault() returns trigger language plpgsql as $$begin raise exception 'MANUAL_BADGE_AUDIT_FAULT';end$$")
  c.execute('create trigger manual_badge_test_fault before insert on proplet_private.patron_manual_badge_events for each row execute function proplet_private.manual_badge_test_fault()')
 try:call(public=False);raise AssertionError('audit fault did not abort')
 except psycopg.errors.RaiseException as e:assert 'MANUAL_BADGE_AUDIT_FAULT' in str(e)
 with connect() as c:
  c.execute('drop trigger manual_badge_test_fault on proplet_private.patron_manual_badge_events')
  c.execute('drop function proplet_private.manual_badge_test_fault()')
  assert c.execute('select count(*) from proplet_private.patron_manual_badge_events where player_id=%s',(OWNER,)).fetchone()[0]==4
  assert finance(c)==before
 assert state()['publicBadge'] # Preferences changed before failed audit rolled back.
 print('PASS manual owner badge: strict UUID/active-owner/self-only, default private/explicit opt-in, privacy, revoke, exact replay, no resurrection,6 concurrent retries once, conflict, immutable audit ACL, audit-fault rollback, financial/XP counts and totals unchanged')
