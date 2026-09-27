#!/usr/bin/env python3
"""Verify real pg_cron registration/execution in the disposable CI database."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import time

import psycopg

ROOT = Path(__file__).resolve().parents[1]
SCHEDULER = ROOT / 'supabase/migrations/20260927200409_weekly_team_victories_scheduler.sql'
COMMAND = 'select public.proplet_finalize_team_victories_v1();'


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-report', type=Path, required=True)
    parser.add_argument('--password-file', type=Path, required=True)
    parser.add_argument('--port', type=int, default=55432)
    parser.add_argument('--user', default='proplet_test_admin')
    args = parser.parse_args()
    report = json.loads(args.database_report.read_text())
    database = report.get('database', '')
    if report.get('host') != '127.0.0.1' or report.get('syntheticOnly') is not True:
        parser.error('Only an explicitly synthetic loopback database report is accepted')
    if not re.fullmatch(r'proplet_test_[a-z0-9_]{1,40}', database):
        parser.error('Database name must be a disposable proplet_test_* database')
    with psycopg.connect(host='127.0.0.1', port=args.port, dbname=database,
                         user=args.user, password=args.password_file.read_text().strip(),
                         autocommit=True) as conn:
        extension = conn.execute("select extversion from pg_extension where extname='pg_cron'").fetchone()
        assert extension, 'Actual pg_cron extension must be installed'
        assert conn.execute('select enabled from public.team_victory_settings').fetchone() == (False,), \
            'Scheduler probe requires rollout disabled'
        before_rounds = conn.execute('select count(*) from public.team_victory_rounds').fetchone()[0]
        job_query = """select jobid, schedule, command, active, database, username
                       from cron.job where jobname='proplet-weekly-team-victories'"""
        jobs = conn.execute(job_query).fetchall()
        assert len(jobs) == 1, f'Expected one real named job, got {len(jobs)}'
        job = jobs[0]
        assert job[1:] == ('10 * * * *', COMMAND, True, database, args.user), job
        # Reapplying the deployment migration must update the named job, not duplicate it.
        conn.execute(SCHEDULER.read_text(), prepare=False)
        assert conn.execute(job_query).fetchall() == jobs, 'Scheduler migration must be idempotent'

        probe_id = conn.execute('select cron.schedule(%s,%s,%s)',
            ('proplet-weekly-ci-execution-probe', '1 second', COMMAND)).fetchone()[0]
        try:
            deadline = time.monotonic() + 20
            executed = False
            while time.monotonic() < deadline:
                status = conn.execute('''select status, return_message from cron.job_run_details
                                        where jobid=%s order by runid desc limit 1''', (probe_id,)).fetchone()
                if status and status[0] == 'failed':
                    raise AssertionError(f'Actual background finalizer failed: {status[1]}')
                if status and status[0] == 'succeeded':
                    executed = True
                    break
                time.sleep(0.5)
            assert executed, 'Real scheduler did not execute the finalizer within 20 seconds'
        finally:
            conn.execute('select cron.unschedule(%s)', (probe_id,))
        assert conn.execute('select count(*) from public.team_victory_rounds').fetchone()[0] == before_rounds, \
            'Disabled scheduler execution must not create any rounds'
        assert conn.execute(job_query).fetchall() == jobs, 'Probe must leave production-named schedule intact'
    print(json.dumps({'pg_cron': extension[0], 'syntheticOnly': True, 'passed': [
        'real extension and exact hourly named schedule',
        'scheduler migration retry preserves one job',
        'real background worker invokes production finalizer',
        'disabled rollout remains inert and test probe removed',
    ]}, indent=2))


if __name__ == '__main__':
    main()
