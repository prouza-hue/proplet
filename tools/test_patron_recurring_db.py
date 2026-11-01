"""Recurring patron acceptance called by the existing isolated patron SQL gate."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from uuid import uuid4
import psycopg
from psycopg import sql


def run_recurring_acceptance(opts):
 assert opts['host']=='127.0.0.1' and opts['dbname'].startswith('proplet_test_')
 with psycopg.connect(**opts) as c:
  def rpc(fn,*args,conn=c):
   return conn.execute(sql.SQL('select public.{}({})').format(sql.Identifier(fn),sql.SQL(',').join(sql.Placeholder() for _ in args)),args).fetchone()[0]
  def player(name):
   pid=str(uuid4());c.execute("insert into players(id,name,family_code,token_hash,public_rankings) values(%s,%s,'RECURRING_QA',%s,true)",(pid,name,str(uuid4())))
   return pid
  admin=player('Recurring admin');pid=player('Recurring history');once=player('One-off');legacy=player('Unknown bank date')
  cols={r[0] for r in c.execute("select column_name from information_schema.columns where table_schema='public' and table_name='admin_accounts'")}
  if 'id' in cols:c.execute("insert into admin_accounts(id,player_id,role,active) values(%s,%s,'owner',true)",(str(uuid4()),admin))
  else:c.execute("insert into admin_accounts(player_id,role,active) values(%s,'owner',true)",(admin,))
  today=c.execute("select (statement_timestamp() at time zone 'Europe/Prague')::date").fetchone()[0]
  def intent(owner,frequency='monthly',amount=99):
   return rpc('proplet_patron_intent_v1',owner,str(uuid4()),amount,frequency,today if frequency=='monthly' else None)['intent']
  def confirm(i,tx,paid_on,actor=admin,conn=c):
   return rpc('proplet_patron_confirm_v2',actor,i['id'],i['reference'],tx,i['amountCzk'],'CZK','5531840001/5500',paid_on,conn=conn)
  def state(owner):return rpc('proplet_patron_state_v1',owner,False)
  def at(owner,day):return c.execute('select proplet_private.patron_recurring_v1(%s,%s::date)',(owner,day)).fetchone()[0]
  i=intent(pid)
  assert not state(pid)['patron'] and state(pid)['badgeType'] is None
  assert at(pid,'2025-02-01')['state']=='none' # Instructions/QR alone grant nothing.
  assert confirm(i,'recurring-jan','2025-01-31')['ok']
  assert at(pid,'2025-01-30')['state']=='none' # Future receipts never count.
  assert at(pid,'2025-01-31')=={'state':'current','paidThrough':'2025-02-27','nextDue':'2025-02-28','graceUntil':'2025-03-07','graceDays':7}
  assert at(pid,'2025-02-28')['state']=='current' # Entire expected-payment day.
  assert at(pid,'2025-03-01')['state']=='grace'
  assert at(pid,'2025-03-07')['state']=='grace' # Seventh day AFTER expected payment.
  assert at(pid,'2025-03-08')['state']=='expired'
  assert confirm(i,'recurring-feb','2025-02-28')['ok']
  assert at(pid,'2025-02-28')['nextDue']=='2025-03-31' # No Jan31->Feb28->Mar28 drift.
  assert confirm(i,'recurring-feb-extra','2025-02-28')['ok']
  assert at(pid,'2025-02-28')['nextDue']=='2025-03-31' # No stacking receipts.
  assert confirm(i,'recurring-mar','2025-03-31')['ok']
  assert at(pid,'2025-03-31')['nextDue']=='2025-04-30'
  assert confirm(i,'recurring-return','2025-08-05')['ok']
  assert at(pid,'2025-08-05')['nextDue']=='2025-09-30' # Restart after lapse; original day retained.
  expired=state(pid)
  assert expired['patron'] and expired['badgeType']=='supporter' and expired['recurringStatus']['state']=='expired'
  assert len(expired['contributions'])==5 # Expiry keeps private history and base status.
  o=intent(once,'once',9999);assert confirm(o,'large-oneoff',today)['ok']
  assert state(once)['badgeType']=='supporter' and state(once)['recurringStatus']['state']=='none'
  # A new QR/amount cannot reset the anchor or become proof. First real transfer
  # on that monthly instruction upgrades immediately; its amount is irrelevant.
  new=intent(once,'monthly',1);assert state(once)['badgeType']=='supporter'
  assert confirm(new,'small-first-monthly',today)['ok']
  assert state(once)['badgeType']=='recurring' and not state(once)['publicBadge']
  assert confirm(new,'small-first-monthly',today)['alreadyConfirmed']
  assert confirm(new,'small-first-monthly',today-timedelta(days=1))['code']=='paid_on_conflict'
  assert confirm(new,'future-transfer',today+timedelta(days=1))['code']=='invalid_paid_on'
  assert confirm(i,'small-first-monthly',today)['code']=='bank_transaction_already_used' # Same bank ID cannot fund another intent.
  assert at(pid,today)['state']=='expired'
  # Historical v1 confirmation cannot infer an actual date from confirmed_at.
  old=intent(legacy)
  assert rpc('proplet_patron_confirm_v1',admin,old['id'],old['reference'],'legacy-date',99,'CZK','5531840001/5500')['ok']
  assert state(legacy)['badgeType']=='supporter' and state(legacy)['recurringStatus']['state']=='none'
  assert confirm(old,'legacy-date',today)['ok']
  assert state(legacy)['badgeType']=='recurring'
  # Bank date, rather than today's operator timestamp, controls late confirmation.
  delayed=player('Delayed bank confirmation');d=intent(delayed)
  assert confirm(d,'delayed-monthly','2024-01-31')['ok']
  assert at(delayed,'2024-01-31')['nextDue']=='2024-02-29' # Leap year.
  assert state(delayed)['badgeType']=='supporter'
  d2=intent(delayed,'monthly',199);assert confirm(d2,'new-qr-original-anchor',today)['ok']
  expected_last=(today.replace(day=1)+timedelta(days=32)).replace(day=1)
  month_after=(expected_last+timedelta(days=32)).replace(day=1)
  assert state(delayed)['recurringStatus']['nextDue']==(month_after-timedelta(days=1)).isoformat()
  # Repeated standing-order reference, concurrent independent retries: one
  # financial receipt and one immutable bank-date audit, never another month.
  def retry(_):
   with psycopg.connect(**opts) as conn:
    conn.execute('set role service_role')
    return confirm(new,'concurrent-recurring',today,conn=conn)
  with ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(retry,range(3)))
  assert sum(not r['alreadyConfirmed'] for r in results)==1
  assert c.execute("select count(*) from proplet_private.patron_payment_dates d join proplet_private.patron_payments r on r.id=d.payment_id where r.bank_transaction_id='concurrent-recurring'").fetchone()[0]==1
  assert state(once)['recurringStatus']['nextDue']==state(legacy)['recurringStatus']['nextDue']
  # Opt-in/privacy gates both the boolean and type; private status/dates never
  # appear in the public batch. A hidden ranking identity is still hidden.
  public=lambda:rpc('proplet_patron_public_ids_v1',[once,legacy,pid])
  assert public()=={'players':[],'badges':{}}
  rpc('proplet_patron_preferences_v1',once,True,False)
  assert public()=={'players':[once],'badges':{once:'recurring'}}
  rpc('proplet_patron_preferences_v1',pid,True,False)
  assert public()['badges']=={once:'recurring',pid:'supporter'}
  c.execute('update players set public_rankings=false where id=%s',(once,))
  assert once not in public()['players'] and once not in public()['badges']
  c.execute('set time zone \'Pacific/Kiritimati\'');first=state(legacy)['recurringStatus']
  c.execute('set time zone \'America/Los_Angeles\'');assert state(legacy)['recurringStatus']==first
  c.execute('reset time zone')
  for role in ('anon','authenticated'):
   assert not c.execute("select has_table_privilege(%s,'proplet_private.patron_payment_dates','select')",(role,)).fetchone()[0]
   assert not c.execute("select has_function_privilege(%s,'public.proplet_patron_confirm_v2(uuid,uuid,text,text,integer,text,text,date)','execute')",(role,)).fetchone()[0]
  for privilege in ('update','delete'):
   assert not c.execute("select has_table_privilege('service_role','proplet_private.patron_payment_dates',%s)",(privilege,)).fetchone()[0]
  ledger=rpc('proplet_patron_admin_list_v1',7,100,old['reference'])['items'][0]
  assert ledger['payments'][0]['paidOn']==today.isoformat()
 print('PASS recurring patron SQL: first actual monthly transfer, no QR grant, actual bank-date audit, replay/conflict/concurrency, monthly calendar/31st/leap year, due day + seven grace days, lapse/reinstatement, same-month no stacking, cross-intent anchor, one-off amount independence, history/base fallback, unknown historical dates, private/default opt-in, ranking privacy, Prague timezone and ACL')
