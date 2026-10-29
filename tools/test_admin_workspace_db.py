"""Run admin workspace SQL acceptance in the disposable loopback CI database."""
from pathlib import Path
import argparse
import json
import re
import psycopg

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-report', type=Path, required=True)
    parser.add_argument('--password-file', type=Path, required=True)
    parser.add_argument('--port', type=int, default=55432)
    parser.add_argument('--user', default='proplet_test_admin')
    args = parser.parse_args()
    report = json.loads(args.database_report.read_text(encoding='utf-8'))
    database = report.get('database', '')
    if report.get('host') != '127.0.0.1' or not re.fullmatch(r'proplet_test_[a-z0-9_]{1,50}', database):
        parser.error('Only a known disposable loopback fixture database is permitted')
    with psycopg.connect(host='127.0.0.1', port=args.port, user=args.user, dbname=database,
                         password=args.password_file.read_text().strip(), autocommit=True) as connection:
        for name in ('admin_workspace_database_acceptance.sql','admin_case_audit_database_acceptance.sql'):
            connection.execute((ROOT/'tests/current'/name).read_text(encoding='utf-8'))
    print('PASS admin workspace SQL: pagination, exact UUID, authoritative rewards, history, ACL and rollback')


if __name__ == '__main__':
    main()
