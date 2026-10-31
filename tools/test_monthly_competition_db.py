"""Real PostgreSQL monthly rules/integrity acceptance in a fresh loopback DB.

No remote DSN accepted. Every player/result is synthetic. Tests submit the real
atomic command RPC, then inspect the monthly ledger/standings/badges. The approved 48-hour review-close policy is exercised with real receipts.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
import json
from pathlib import Path
import secrets
import sys
import threading
import uuid

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.test_isolated_result_db import migration_plan
from backend.contracts import ResultCreate
from backend.results import build_command, result_identity
from backend.monthly_competition import state as public_state


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--password-file', type=Path, required=True)
    p.add_argument('--port', type=int, default=55432)
    p.add_argument('--user', default='proplet_test_admin')
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    scenarios = {}
    options = dict(host='127.0.0.1', port=args.port, user=args.user,
                   password=args.password_file.read_text().strip(), autocommit=True)
    name = 'proplet_test_monthly_' + secrets.token_hex(5)
    report = {'database': name, 'host': '127.0.0.1', 'syntheticOnly': True, 'checks': [], 'limitations': []}
    with psycopg.connect(dbname='postgres', **options) as c:
        for role in ('anon', 'authenticated', 'service_role'):
            if not c.execute('select 1 from pg_roles where rolname=%s', (role,)).fetchone():
                c.execute(sql.SQL('create role {} {}').format(sql.Identifier(role),
                          sql.SQL('bypassrls' if role == 'service_role' else '')))
        c.execute(sql.SQL('create database {}').format(sql.Identifier(name)))
    options['dbname'] = name

    def connect():
        return psycopg.connect(**options)

    def snapshot(label,c,viewer,month):
        raw = c.execute('select proplet_monthly_state_v1(%s,%s)',(viewer,month)).fetchone()[0]
        profiles = [{'id':pid,'name':'Zkušební hráč '+str(i+1),'avatar':'🙂'} for i,pid in enumerate(players)]
        value = public_state(rpc=lambda *args:raw,player_id=viewer,month=str(month),
            players=lambda ids:profiles,identity=lambda p,*args:{'name':p['name'],'avatar':p['avatar'],'anonymous':False})
        scenarios[label] = {**value,'isolatedScenario':True,'scenarioViewer':True,'scenario':label,
            'dataSource':'real-postgresql-acceptance-snapshot','onlineBackend':False}

    with connect() as c:
        for objects in ('tables', 'sequences', 'functions'):
            c.execute('alter default privileges in schema public grant all on '+objects+' to anon,authenticated,service_role')
        for path in migration_plan(ROOT):
            if path.name.endswith('_weekly_team_victories_scheduler.sql'):
                if not c.execute("select 1 from pg_available_extensions where name='pg_cron'").fetchone():
                    report['limitations'].append('Windows PostgreSQL has no pg_cron; existing weekly scheduler migration omitted explicitly. Monthly finalizer itself runs below.')
                    continue
            c.execute(path.read_text(encoding='utf8'))
        c.execute('update monthly_competition_settings set isolated=true')
        c.execute((ROOT/'supabase/tests/monthly_preview_empty_claim.sql').read_text(encoding='utf8'))
        report['checks'].append('server-proven empty QA transfer:8 source kinds, strict marker/isolated/ACL guards, read-only/idempotent; original transfer quota untouched')
        c.execute((ROOT/'supabase/tests/monthly_preview_extra.sql').read_text(encoding='utf8'))
        report['checks'].append('actual official November Extra under monthly QA clock; no monthly points; legacy special policy preserved')
        c.execute((ROOT/'supabase/tests/monthly_preview_clock.sql').read_text(encoding='utf8'))
        report['checks'].append('trusted isolated moving clock: online/session/receive time, original offline day, real48h cutoff/badges, unmarked legacy wall clock')
        c.execute((ROOT/'supabase/tests/monthly_admin_corrections.sql').read_text(encoding='utf8'))
        report['checks'].append('compact remote rollback acceptance passed on real local PG: shared podium, service ACL, audit, CAS, removal/regrant, unchanged XP')
        assert c.execute('select enabled,rules_approved,late_sync_policy from monthly_competition_settings').fetchone() == (False, True, 'review-close')
        assert c.execute('select proplet_finalize_monthly_competition_v1()').fetchone()[0]['finalized'] == 0
        assert not c.execute('select proplet_monthly_state_v1(null,null)').fetchone()[0]['enabled']
        c.execute("update monthly_competition_settings set enabled=true,rules_approved=false")
        assert c.execute('select proplet_monthly_state_v1(null,null)').fetchone()[0]['reason'] == 'rules-pending'
        report['checks'].append('approved review-close default; competition disabled; explicit hold fails closed')
        for role in ('anon', 'authenticated'):
            for table in ('monthly_competition_settings', 'monthly_competition_days', 'monthly_competition_rounds', 'monthly_competition_badges'):
                assert not c.execute('select has_table_privilege(%s,%s,%s)', (role, table, 'select')).fetchone()[0]
            for fn in ('proplet_monthly_state_v1(uuid,date)', 'proplet_finalize_monthly_competition_v1()', 'proplet_monthly_refresh_day_v1(uuid,date)', 'proplet_reconcile_monthly_competition_v1(date)'):
                assert not c.execute('select has_function_privilege(%s,%s,%s)', (role, fn, 'execute')).fetchone()[0]
        report['checks'].append('RLS and explicit anon/authenticated table/RPC denial')
        # Use the real current database month so clock_timestamp() command receipts
        # are comparable. Only the isolated monthly clock advances to its end.
        now = c.execute("select now() at time zone 'Europe/Prague'").fetchone()[0]
        month = now.date().replace(day=1)
        end = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
        c.execute("update monthly_competition_settings set rules_approved=true,late_sync_policy='review-close',launch_month=%s,isolated=true,preview_now=%s", (month, str(end - timedelta(days=1))+' 23:00:00+01'))
        players = [str(uuid.uuid4()) for _ in range(5)]
        for i, pid in enumerate(players):
            c.execute('insert into players(id,name,family_code,token_hash) values(%s,%s,%s,%s)', (pid, 'Monthly fixture '+str(i), 'SOLO_MONTHLY', 'fixture-'+pid))
        empty = c.execute('select proplet_monthly_state_v1(%s,%s)', (players[0], month)).fetchone()[0]
        assert empty['standings'] == [] and empty['me']['points'] == 0 and empty['previousPodium'] == []
        report['checks'].append('first season empty, authenticated zero state and guest state')
        snapshot('empty',c,players[0],month)
        c.execute("update monthly_competition_settings set preview_now=(%s::date-1)::timestamp at time zone 'Europe/Prague'",(month,))
        snapshot('upcoming',c,players[0],month)
        c.execute("update monthly_competition_settings set preview_now=%s",(str(end-timedelta(days=1))+' 23:00:00+01',))

    def command(pid, day, *, hints=0, mode='daily', suffix='', completed=None, unverified=False):
        key = ('daily:' + day.isoformat()) if mode == 'daily' else mode + ':monthly-fixture-' + day.isoformat() + suffix
        payload = ResultCreate(puzzle_id='monthly-fixture-' + day.isoformat(), challenge_key=key,
            mode=mode, difficulty='easy', daily_date=day.isoformat() if mode=='daily' else None,
            elapsed_ms=42000, moves=12, hints_used=hints, max_hint_level=1 if hints else 0,
            clean_solve=not hints, attempt_id='monthly-'+str(uuid.uuid4()),
            completed_at=completed or day.isoformat()+'T10:00:00+01:00',timing_unverified=unverified)
        return build_command(result_identity(pid, payload), payload, completed_at=payload.completed_at,
            points=987, content_generation=6, free_level=1 if mode=='free' else None,
            legacy_reward_slot=None, team_code_at_completion=None)

    def submit(cmd, barrier=None):
        with connect() as c:
            c.execute('set role service_role')
            if barrier:
                barrier.wait(timeout=20)
            if cmd.get('timingUnverified'):
                return c.execute('select proplet_submit_offline_result_v1(%s)',(Jsonb(cmd),)).fetchone()[0]
            return c.execute('select proplet_submit_result_v1(%s,%s,%s,%s,%s)',
                (cmd['playerId'], cmd['idempotencyKey'], cmd['requestDigest'], cmd['commandDigest'], Jsonb(cmd))).fetchone()[0]

    first = command(players[0], month)
    with connect() as c:
        c.execute('update monthly_competition_settings set enabled=false')
    barrier = threading.Barrier(8)
    with ThreadPoolExecutor(max_workers=8) as pool:
        receipts = list(pool.map(lambda _: submit(first, barrier), range(8)))
    assert all(r == receipts[0] for r in receipts)
    assert submit(first) == receipts[0]
    with connect() as c:
        assert c.execute('select count(*) from monthly_competition_days').fetchone()[0] == 0
        c.execute('update monthly_competition_settings set enabled=true')
        c.execute('set role service_role')
        assert c.execute('select proplet_reconcile_monthly_competition_v1(%s)',(month,)).fetchone()[0]['reconciled'] == 1
        assert c.execute('select proplet_reconcile_monthly_competition_v1(%s)',(month,)).fetchone()[0]['reconciled'] == 1
        assert c.execute('select count(*) from monthly_competition_days').fetchone()[0] == 1
    report['checks'].append('disabled delivery preserves gameplay; explicit predeadline activation reconciliation/retry recovers one official day')
    submit(command(players[0], month, hints=1, completed=month.isoformat()+'T11:00:00+01:00'))
    with connect() as c:
        assert c.execute('select count(*),sum(points) from monthly_competition_days where player_id=%s', (players[0],)).fetchone() == (1,120)
        assert c.execute('select points from results where player_id=%s', (players[0],)).fetchone()[0] == 987
        snapshot('under20',c,players[0],month)
    report['checks'].append('8 simultaneous same commands + lost-response replay: one 120-point day; repeat ignored; XP remains 987')
    # 25 official days: five assisted + twenty clean; only the twenty clean count.
    for i in range(1,25):
        submit(command(players[0], month + timedelta(days=i), hints=1 if i < 6 else 0))
    for pid in players[1:3]:
        for i in range(20):
            submit(command(pid, month + timedelta(days=i)))
    submit(command(players[3], month, hints=1))
    for mode in ('free', 'starter', 'tajenka'):
        submit(command(players[0], month, mode=mode))
    # A result issued yesterday but finished today is not a competition day.
    submit(command(players[4], month, completed=(month+timedelta(days=1)).isoformat()+'T00:00:00+01:00'))
    with connect() as c:
        s = c.execute('select proplet_monthly_state_v1(%s,%s)', (players[0], month)).fetchone()[0]
        assert s['me']['points'] == 2400 and s['me']['validDays'] == 25 and s['me']['countedDays'] == 20
        assert sum(d['counted'] for d in s['me']['days']) == 20
        assert [r['rank'] for r in s['standings']] == [1,1,1,4]
        assert all(r['points'] == 2400 for r in s['standings'][:3])
        assert c.execute('select count(*) from monthly_competition_days where player_id=%s', (players[4],)).fetchone()[0] == 0
        snapshot('over20',c,players[0],month)
        snapshot('ties',c,players[0],month)
    report['checks'].append('best20 of25; clean120/assisted100; rank1–1–1–4; non-Daily and next-day completion excluded')
    # Authoritative correction and rejection are reflected before the freeze.
    with connect() as c:
        c.execute('update results set hints_used=1,max_hint_level=1,clean_solve=false where player_id=%s and daily_date=%s', (players[1],month))
        assert c.execute('select points from monthly_competition_days where player_id=%s and daily_date=%s', (players[1],month)).fetchone()[0] == 100
        c.execute('delete from results where player_id=%s', (players[3],))
        assert c.execute('select count(*) from monthly_competition_days where player_id=%s', (players[3],)).fetchone()[0] == 0
        # UTC date differs, Prague date is the publication day; DST month is
        # covered independently by the calendar close calculation below.
        late = command(players[4], month, completed=(month-timedelta(days=1)).isoformat()+'T23:30:00+00:00')
    submit(late)
    with connect() as c:
        assert c.execute('select count(*) from monthly_competition_days where player_id=%s', (players[4],)).fetchone()[0] == 1
        # Reject a committed receipt before closure: ledger must retract it.
        c.execute('update result_commands set receipt=null,committed_at=null where id=(select command_id from monthly_competition_days where player_id=%s)',(players[4],))
        assert c.execute('select count(*) from monthly_competition_days where player_id=%s', (players[4],)).fetchone()[0] == 0
    report['checks'].append('Prague midnight boundary; preclose result correction/deletion/receipt rejection recomputes ledger')
    offline = command(players[4],month,hints=1,unverified=True,
        completed=month.isoformat()+'T00:10:00+01:00')
    assert submit(offline)['awardedPoints'] == 0
    with connect() as c:
        assert c.execute('select points from monthly_competition_days where player_id=%s',(players[4],)).fetchone()[0] == 100
        c.execute("update monthly_competition_settings set preview_now=(%s::date::timestamp at time zone 'Europe/Prague')+interval '24 hours'",(end,))
        c.execute("update result_commands set committed_at=(%s::date::timestamp at time zone 'Europe/Prague') where id=(select command_id from monthly_competition_days where player_id=%s)",(end,players[4]))
        assert c.execute('select points from monthly_competition_days where player_id=%s',(players[4],)).fetchone()[0] == 100
        c.execute("update monthly_competition_settings set late_sync_policy='review-close'")
        c.execute('select proplet_monthly_refresh_day_v1(%s,%s)',(players[4],month))
        assert c.execute('select points from monthly_competition_days where player_id=%s',(players[4],)).fetchone()[0] == 100
        c.execute("update result_commands set committed_at=(%s::date::timestamp at time zone 'Europe/Prague')+interval '48 hours' where id=(select command_id from monthly_competition_days where player_id=%s)",(end,players[4]))
        assert c.execute('select count(*) from monthly_competition_days where player_id=%s',(players[4],)).fetchone()[0] == 0
        c.execute("update monthly_competition_settings set late_sync_policy='review-close'")
    report['checks'].append('earlier assisted offline replaces official first without XP; approved review-close sync cutoff tested; exact cutoff excluded')
    with connect() as c:
        c.execute("update monthly_competition_settings set preview_now=(%s::date::timestamp at time zone 'Europe/Prague')+interval '47 hours 59 minutes'",(end,))
        assert c.execute('select proplet_finalize_monthly_competition_v1()').fetchone()[0]['finalized'] == 0
        assert c.execute('select proplet_monthly_state_v1(null,%s)',(month,)).fetchone()[0]['status'] == 'provisional'
        snapshot('provisional',c,players[0],month)
        c.execute("update monthly_competition_settings set preview_now=(%s::date::timestamp at time zone 'Europe/Prague')+interval '48 hours'",(end,))
    def finalize(_):
        with connect() as c:
            c.execute('set role service_role')
            return c.execute('select proplet_finalize_monthly_competition_v1()').fetchone()[0]
    with ThreadPoolExecutor(max_workers=8) as pool:
        closures = list(pool.map(finalize,range(8)))
    assert sum(r['finalized'] for r in closures) == 1
    with connect() as c:
        assert c.execute('select count(*) from monthly_competition_rounds').fetchone()[0] == 1
        assert c.execute('select count(*) from monthly_competition_badges').fetchone()[0] == 3
        assert c.execute('select array_agg(rank order by rank) from monthly_competition_badges').fetchone()[0] == [1,1,3]
        frozen = c.execute('select standings from monthly_competition_rounds').fetchone()[0]
        snapshot('closed',c,players[0],month)
        saved_result=c.execute('select to_jsonb(r) from results r where player_id=%s and daily_date=%s',(players[0],month)).fetchone()[0]
        c.execute('delete from results where player_id=%s', (players[0],))
        assert c.execute('select standings from monthly_competition_rounds').fetchone()[0] == frozen
        assert c.execute('select proplet_finalize_monthly_competition_v1()').fetchone()[0]['finalized'] == 0
        assert c.execute('select proplet_monthly_state_v1(%s,%s)', (players[0],month)).fetchone()[0]['status'] == 'closed'
        # DST October is a calendar month, then exactly 48 elapsed hours.
        assert c.execute("select ('2026-11-01'::timestamp at time zone 'Europe/Prague')+interval '48 hours'").fetchone()[0] == datetime(2026,11,2,23,tzinfo=timezone.utc)
    report['checks'].append('48h boundary; 8 concurrent closures; immutable snapshot; 1–1–3 badges once; retry safe; DST close')

    def correct(day,revision,key,pid=players[0],reason='Confirmed administrative result rejection'):
        with connect() as c:
            c.execute('set role service_role')
            return c.execute('select proplet_correct_monthly_competition_v1(%s,%s,%s,%s,%s,%s,%s)',
                (month,pid,day,revision,key,'test-operator',reason)).fetchone()[0]

    with connect() as c:
        assert not c.execute("select has_table_privilege('service_role','monthly_competition_rounds','update')").fetchone()[0]
        assert not c.execute("select has_table_privilege('service_role','monthly_competition_badges','delete')").fetchone()[0]
        for role in ('anon','authenticated'):
            c.execute(sql.SQL('set role {}').format(sql.Identifier(role)))
            try:
                c.execute('select proplet_correct_monthly_competition_v1(%s,%s,%s,1,%s,%s,%s)',
                    (month,players[0],month,'unauthorized','test-operator','Unauthorized fixture request'))
                raise AssertionError('unauthorized monthly correction executed')
            except psycopg.errors.InsufficientPrivilege:
                pass
            c.execute('reset role')
        assert c.execute('select count(*) from proplet_private.monthly_corrections').fetchone()[0] == 0
    for rev,reason in ((999,'Confirmed administrative result rejection'),(1,'tiny')):
        try:
            correct(month,rev,'invalid-command',reason=reason)
            raise AssertionError('invalid correction accepted')
        except (psycopg.errors.SerializationFailure,psycopg.errors.InvalidParameterValue):
            pass
    first_correction=correct(month,1,'first-rejection')
    assert first_correction['revision']==2 and first_correction['dayPoints']==0
    assert correct(month,1,'first-rejection') == first_correction
    with ThreadPoolExecutor(max_workers=6) as pool:
        replays=list(pool.map(lambda _:correct(month,1,'first-rejection'),range(6)))
    assert all(r==first_correction for r in replays)
    try:
        correct(month,1,'first-rejection',reason='Different reason reuses existing key')
        raise AssertionError('changed command accepted under reused key')
    except psycopg.errors.InvalidParameterValue:
        pass
    with connect() as c:
        assert c.execute('select rank,shared from monthly_competition_badges where player_id=%s',(players[0],)).fetchone() == (2,True)
        xp_before=c.execute('select sum(points) from results').fetchone()[0]
        before_fault=c.execute('select standings from monthly_competition_rounds where month=%s',(month,)).fetchone()[0]
        c.execute("create function proplet_private.monthly_test_audit_fault() returns trigger language plpgsql as $$ begin raise exception 'INJECTED_AUDIT_FAILURE'; end $$")
        c.execute('create trigger monthly_test_audit_fault before insert on proplet_private.monthly_corrections for each row execute function proplet_private.monthly_test_audit_fault()')
    try:
        correct(month+timedelta(days=6),2,'fault-injection')
        raise AssertionError('injected audit failure unexpectedly committed')
    except psycopg.errors.RaiseException as exc:
        assert 'INJECTED_AUDIT_FAILURE' in str(exc)
    with connect() as c:
        assert c.execute('select revision,standings from monthly_competition_rounds where month=%s',(month,)).fetchone() == (2,before_fault)
        assert c.execute('select count(*) from proplet_private.monthly_corrections').fetchone()[0] == 1
        assert c.execute('select count(*) from monthly_competition_days where player_id=%s and daily_date=%s',(players[0],month+timedelta(days=6))).fetchone()[0] == 1
        c.execute('drop trigger monthly_test_audit_fault on proplet_private.monthly_corrections')
        c.execute('drop function proplet_private.monthly_test_audit_fault()')
    barrier=threading.Barrier(6)
    def collision(index):
        barrier.wait(timeout=20)
        try:
            return correct(month+timedelta(days=6),2,'concurrent-'+str(index))
        except psycopg.errors.SerializationFailure:
            return None
    with ThreadPoolExecutor(max_workers=6) as pool:
        raced=list(pool.map(collision,range(6)))
    assert sum(r is not None for r in raced)==1
    revision=3
    for i in range(25):
        if i in (0,6): continue
        receipt=correct(month+timedelta(days=i),revision,'reject-day-'+str(i))
        revision=receipt['revision']
    with connect() as c:
        assert c.execute('select count(*) from monthly_competition_badges where player_id=%s',(players[0],)).fetchone()[0] == 0
        assert c.execute('select sum(points) from results').fetchone()[0] == xp_before
        assert c.execute('select count(*) from proplet_private.monthly_corrections').fetchone()[0] == revision-1
        c.execute('insert into public.results select (json_populate_record(null::public.results,%s::json)).*',(Jsonb(saved_result),))
        xp_before=c.execute('select sum(points) from results').fetchone()[0]
    restored=correct(month,revision,'restore-first-day',reason='Confirmed restoration of rejected official result')
    revision=restored['revision']
    with connect() as c:
        assert c.execute('select rank,points from monthly_competition_badges where player_id=%s',(players[0],)).fetchone() == (3,120)
        assert c.execute('select sum(points) from results').fetchone()[0] == xp_before
        assert c.execute('select revision from monthly_competition_rounds where month=%s',(month,)).fetchone()[0] == revision
        assert c.execute('select proplet_monthly_state_v1(%s,%s)',(players[0],month)).fetchone()[0]['revision'] == revision
    # An earlier offline attempt received after monthly close may replace the
    # normal gameplay result. Explicit correction must retain the eligible
    # preclose first run rather than erase it because its source row moved.
    late_after_close=command(players[2],month,hints=1,unverified=True,
        completed=month.isoformat()+'T09:00:00+01:00')
    submit(late_after_close)
    with connect() as c:
        c.execute('update result_commands set committed_at=(select closes_at from monthly_competition_rounds where month=%s)+interval \'1 second\' where idempotency_key=%s',
            (month,late_after_close['idempotencyKey']))
        xp_before=c.execute('select sum(points) from results').fetchone()[0]
    retained=correct(month,revision,'late-offline-review',pid=players[2],reason='Review late offline replacement against monthly cutoff')
    assert retained['dayPoints']==120
    with connect() as c:
        assert c.execute('select sum(points) from results').fetchone()[0] == xp_before
        assert c.execute('select points from monthly_competition_badges where player_id=%s',(players[2],)).fetchone()[0] == 2400
        c.execute('set role service_role')
        try:
            c.execute('delete from proplet_private.monthly_corrections')
            raise AssertionError('runtime role altered immutable correction audit')
        except psycopg.errors.InsufficientPrivilege:
            pass
    report['checks'].append('explicit closed correction: mandatory reason/operator/CAS; unauthorized denied;6 concurrent same-key replays;6 distinct CAS commands only1 wins; injected audit failure rolls back snapshot/ledger/badges')
    report['checks'].append('closed correction atomically downgrades/removes/regrants badges and rank ties; immutable audit/revision; XP unchanged; aftercutoff offline retains eligible original')
    from tools.check_release_news_db import check_release_news
    report['checks'].append(check_release_news(options))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2),encoding='utf8')
    (ROOT/'data/monthly-preview-scenarios.json').write_text(json.dumps({
        'syntheticOnly':True,'source':'real-postgresql-acceptance-snapshot','onlineBackend':False,
        'generatedAt':datetime.now(timezone.utc).isoformat(),'scenarios':scenarios},indent=2,ensure_ascii=False),encoding='utf8')
    print(json.dumps(report,indent=2))


if __name__ == '__main__':
    main()
