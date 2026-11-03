"""Exercise actual CI scope selectors without running suites or external services."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import textwrap
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / '.github/workflows'


def read(name):
    return (WORKFLOWS / name).read_text(encoding='utf-8')


def select(name, changed, event='pull_request', base_missing=True, fetch_error=None):
    source = read(name)
    patterns = json.loads(re.search(r'SCOPED_PATHS: >-\n\s+(\[[^\n]+\])', source)[1])
    script = textwrap.dedent(re.search(r'        shell: python\n        run: \|\n(.*?)(?=\n  [a-z])', source, re.S)[1])
    with tempfile.TemporaryDirectory() as directory:
        output = Path(directory) / 'output'
        with patch.dict(os.environ, {'SCOPED_PATHS': json.dumps(patterns), 'EVENT_NAME': event,
                                    'BASE_SHA': 'test-base', 'GITHUB_OUTPUT': str(output)}), \
             patch.object(subprocess, 'check_output', return_value=('\0'.join(changed) + '\0').encode()) as git, \
             patch.object(subprocess, 'run', return_value=SimpleNamespace(returncode=int(base_missing))) as exists, \
             patch.object(subprocess, 'check_call', side_effect=fetch_error) as fetch:
            exec(compile(script, name, 'exec'), {})
        if event == 'pull_request':
            exists.assert_called_once_with(['git', 'cat-file', '-e', 'test-base^{commit}'],
                                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
            if base_missing:
                fetch.assert_called_once_with(['git', 'fetch', '--no-tags', '--depth=1', 'origin', 'test-base'])
            else:
                fetch.assert_not_called()
            git.assert_called_once_with(['git', 'diff', '--name-only', '--no-renames', '-z', 'test-base', 'HEAD'])
        else:
            git.assert_not_called()
            exists.assert_not_called()
            fetch.assert_not_called()
        return output.read_text().strip() == 'relevant=true'


class CIResourcePolicy(unittest.TestCase):
    def test_monthly_skips_presentation_but_retains_all_database_dependencies(self):
        for path in ['public/app/monthly/competition.js', 'public/monthly-competition.css',
                     'public/ranking-navigation.css', 'public/rewards/monthly/2026-11/king.webp',
                     'tests/current/test_monthly_competition_ui.cjs', 'docs/example.md']:
            with self.subTest(path=path):
                self.assertFalse(select('monthly-competition.yml', [path]))
        for path in ['backend/monthly_competition.py', 'backend/results.py', 'backend/contracts.py',
                     'backend/db.py', 'backend/config.py', 'server.py', 'requirements-dev.txt',
                     'SUPABASE_SETUP.sql', 'supabase/migrations/20261103_example.sql',
                     'supabase/tests/monthly_quality.sql', 'tools/test_isolated_result_db.py',
                     'tools/test_monthly_quality_db.py', 'tools/check_release_news_db.py',
                     'tests/current/test_monthly_competition_http.py',
                     '.github/workflows/monthly-competition.yml']:
            with self.subTest(path=path):
                self.assertTrue(select('monthly-competition.yml', [path]))

    def test_gen4_bank_checks_skip_release_metadata_but_retain_content_and_tooling(self):
        for path in ['public/app.js', 'public/sw.js', 'public/runtime-meta.js',
                     'proplet_version.py', 'server.py', 'public/monthly-competition.css']:
            with self.subTest(path=path):
                self.assertFalse(select('v334-calibration.yml', [path]))
        for path in ['data/puzzles_gen4_candidate_v334.json', 'data/answer_tiers.json',
                     'data/puzzles.json', 'public/calibration-v334.json',
                     'tools/validate_gen4_release.py', 'tools/generate_gen4_candidates.py',
                     'content_archive.py', 'requirements.txt', '.github/workflows/v334-calibration.yml']:
            with self.subTest(path=path):
                self.assertTrue(select('v334-calibration.yml', [path]))

    def test_manual_empty_and_mixed_changes(self):
        for name in ['monthly-competition.yml', 'v334-calibration.yml']:
            self.assertTrue(select(name, [], event='workflow_dispatch'))
            self.assertFalse(select(name, []))
            self.assertTrue(select(name, ['docs/only.md', '.github/workflows/' + name]))

    def test_shallow_checkout_fetches_only_missing_base_and_fails_on_unknown_base(self):
        for name in ['monthly-competition.yml', 'v334-calibration.yml']:
            self.assertIn('fetch-depth: 1', read(name))
            self.assertFalse(select(name, ['docs/only.md'], base_missing=False))
            with self.assertRaises(subprocess.CalledProcessError):
                select(name, ['docs/only.md'], fetch_error=subprocess.CalledProcessError(128, 'git fetch'))

    def test_required_job_names_complete_or_fail_closed_not_pending(self):
        for name, job in [('monthly-competition.yml', 'database'), ('v334-calibration.yml', 'gen4-contract')]:
            source = read(name)
            trigger = source[source.index('  pull_request:'):source.index('permissions:')]
            self.assertNotIn('paths:', trigger)
            self.assertIn('  ' + job + ':\n    needs: changes', source)
            self.assertIn("always() && (needs.changes.result != 'success' || needs.changes.outputs.relevant == 'true')", source)
            self.assertIn("if: ${{ needs.changes.result != 'success' }}\n        run: exit 1", source)

    def test_expensive_duplicate_suites_removed_and_runtime_coverage_retained(self):
        self.assertNotIn('tools/test_current.py', read('monthly-competition.yml'))
        weekly = read('weekly-team-victories.yml')
        self.assertNotIn("run: python -m unittest discover -s tests/weekly", weekly)
        self.assertNotIn('run: node --test tools/test_weekly_team_victories_frontend.cjs', weekly)
        self.assertIn('python tools/test_weekly_team_victories_db.py', weekly)
        self.assertIn('node tools/qa_weekly_rewards.cjs', weekly)
        paths = {entry['path'] for entry in json.loads((ROOT / 'tests/current/manifest.json').read_text())['current']['tests']}
        for path in ['tests/weekly/test_team_victories.py', 'tools/test_weekly_team_victories_frontend.cjs',
                     'tools/test_gen4_preview_readonly.py', 'tools/test_gen4_preview_runtime_meta.js',
                     'tools/test_v334_quality_release.py', 'tools/test_gen4_progress_migration.py']:
            self.assertTrue(path in paths, 'Missing retained runtime coverage: ' + path)
        self.assertIn('run: python tools/test_current.py', read('current-runtime.yml'))
        self.assertRegex(read('current-runtime.yml'), r'push:\n\s+branches:\n\s+- main')

    def test_new_cancellation_policy_never_cancels_main_or_manual_runs(self):
        for name in ['current-runtime.yml', 'monthly-competition.yml', 'weekly-team-victories.yml',
                     'refinements-review.yml', 'v334-calibration.yml', 'client-update-browser.yml']:
            source = read(name)
            self.assertIn("cancel-in-progress: ${{ github.event_name == 'pull_request' }}", source)
            self.assertIn('github.event.pull_request.number || github.run_id', source)
            self.assertIn('${{ github.workflow }}-${{ github.event_name }}-', source)


if __name__ == '__main__':
    unittest.main()
