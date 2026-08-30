#!/usr/bin/env python3
"""Characterization for the static migration-manifest validator.

The fixtures intentionally describe validator failures.  No Supabase client,
network connection, migration execution, or SQL write is involved.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import tempfile

# This test imports a repository module directly; keep a standalone target
# run as clean as the current gate's PYTHONDONTWRITEBYTECODE environment.
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.validate_migration_manifest import validate_manifest, validate_read_only_sql


def checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run_fixture(manifest: dict, root: Path) -> set[str]:
    return {error.code for error in validate_manifest(manifest, root)}


def main() -> None:
    with tempfile.TemporaryDirectory(prefix='proplet-migration-manifest-') as directory:
        root = Path(directory)
        first = root / 'first.sql'
        second = root / 'second.sql'
        first.write_text('-- first\n', encoding='utf-8')
        second.write_text('-- second\n', encoding='utf-8')
        valid_entry = lambda ident, order, path: {
            'id': ident, 'order': order, 'path': path,
            'version': ident, 'type': 'migration',
            'sha256': checksum(root / path), 'supersedes': [], 'replaced_rpc_definitions': [],
        }
        valid = {'schema_version': 1, 'files': [valid_entry('one', 10, 'first.sql'), valid_entry('two', 20, 'second.sql')]}
        if run_fixture(valid, root): raise AssertionError('valid fixture unexpectedly failed')

        duplicate = json.loads(json.dumps(valid))
        duplicate['files'][1]['id'] = 'one'
        duplicate['files'][1]['order'] = 10
        if not {'duplicate_id', 'duplicate_order'} <= run_fixture(duplicate, root): raise AssertionError('duplicate fixture not rejected')

        missing = json.loads(json.dumps(valid))
        missing['files'][1]['path'] = 'gone.sql'
        if 'missing_file' not in run_fixture(missing, root): raise AssertionError('missing file fixture not rejected')

        drift = json.loads(json.dumps(valid))
        drift['files'][0]['sha256'] = '0' * 64
        if 'checksum_mismatch' not in run_fixture(drift, root): raise AssertionError('checksum fixture not rejected')

        unordered = json.loads(json.dumps(valid))
        unordered['files'][1]['order'] = 5
        if 'ambiguous_order' not in run_fixture(unordered, root): raise AssertionError('order fixture not rejected')

        future = json.loads(json.dumps(valid))
        future['files'][0]['supersedes'] = ['two']
        if 'invalid_supersedes_order' not in run_fixture(future, root): raise AssertionError('future supersedes fixture not rejected')

        self_reference = json.loads(json.dumps(valid))
        self_reference['files'][0]['supersedes'] = ['one']
        if 'invalid_supersedes_order' not in run_fixture(self_reference, root): raise AssertionError('self supersedes fixture not rejected')

        malformed_predecessor = json.loads(json.dumps(valid))
        malformed_predecessor['files'][1]['order'] = 'not-an-order'
        malformed_predecessor['files'][0]['supersedes'] = ['two']
        if 'invalid_supersedes_order' not in run_fixture(malformed_predecessor, root): raise AssertionError('malformed predecessor fixture not rejected')

        schema = Path(__file__).resolve().parents[2] / 'supabase/schema-verification.sql'
        if validate_read_only_sql(schema.read_text(encoding='utf-8')):
            raise AssertionError('checked-in schema verification is not SELECT-only')
        ddl_fixture = '-- comment;\ncreate table should_never_run (id integer);'
        if 'non_read_only_statement' not in {error.code for error in validate_read_only_sql(ddl_fixture)}:
            raise AssertionError('DDL verification fixture not rejected')
    print('PASS: migration manifest validator negative fixtures are deterministic')


if __name__ == '__main__':
    main()
