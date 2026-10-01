"""Candidate preview guards, complete recognition and unmodified native modules."""
from copy import deepcopy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from tools.build_mk100_preview import ROOT, CONTENT, build, digest, verify_bank


class PreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = next(CONTENT / name for name in ('bank.json', 'representative-bank-v2.json', 'representative-bank.json') if (CONTENT / name).exists())
        cls.bank = json.loads(cls.path.read_text(encoding='utf-8'))
        cls.representative = len(cls.bank['boards']) == 12

    def test_complete_data(self):
        verify_bank(self.bank, self.representative)

    def test_production_guard_precedes_read_and_output(self):
        with patch.dict('os.environ', {'VERCEL_ENV': 'production'}):
            with self.assertRaisesRegex(RuntimeError, 'production build forbidden'):
                build(CONTENT / 'nonexistent-bank.json')

    def test_stale_geometry_and_timeout_rejected(self):
        bad = deepcopy(self.bank)
        bad['boards'][0]['letters'][0] = 'X'
        bad['contentHash'] = digest(bad['boards'])
        with self.assertRaisesRegex(ValueError, 'content hash'):
            verify_bank(bad, self.representative)
        bad = deepcopy(self.bank)
        bad['boards'][0]['meta']['validation']['status'] = 'timeout'
        bad['contentHash'] = digest(bad['boards'])
        with self.assertRaisesRegex(ValueError, 'proof'):
            verify_bank(bad, self.representative)

    def test_complete_recognition_native_asset_identity_and_isolation(self):
        (ROOT / 'work').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='preview-test-', dir=ROOT / 'work') as temp:
            output = Path(temp) / 'static'
            report = build(self.path, output=output, allow_representative=self.representative)
            self.assertEqual(report['recognitionWords'], 103836)
            self.assertEqual(len(report['representativeIds']), 12)
            for source in report['runtimeAssets']:
                self.assertEqual((ROOT / source).read_bytes(), (output / source.removeprefix('public/')).read_bytes())
            names = {p.relative_to(output).as_posix() for p in output.rglob('*') if p.is_file()}
            self.assertFalse(any(name.startswith('api/') or name.startswith('functions/') or name in {'app.js', 'sw.js'} for name in names))
            html = (output / 'index.html').read_text(encoding='utf-8')
            self.assertIn("connect-src 'none'", html)
            self.assertIn("worker-src 'none'", html)
            self.assertNotIn('eyebrow', html)
            self.assertIn('window.PROPLET_MK100_RECOGNITION=', (output / 'recognition.js').read_text(encoding='utf-8'))
            truncated = Path(temp) / 'short.txt'
            truncated.write_text('proplet\n', encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'complete validation dictionary'):
                build(self.path, recognition_path=truncated, output=output, allow_representative=self.representative)


if __name__ == '__main__':
    unittest.main()
