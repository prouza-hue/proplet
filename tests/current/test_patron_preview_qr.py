"""Decode actual client SVGs after independent PNG rendering, against server payment_data."""
import io
import json
from pathlib import Path
import subprocess
import unittest
from xml.etree import ElementTree

from PIL import Image
import resvg_py
import zxingcpp

from backend.patrons import payment_data

ROOT = Path(__file__).resolve().parents[2]


class PreviewQr(unittest.TestCase):
    def test_bank_fields_survive_real_qr_encoding_rendering_and_decoding(self):
        result = subprocess.run(['node', 'tests/current/patron_preview_qr_cases.cjs'], cwd=ROOT,
                                capture_output=True, text=True, encoding='utf-8', check=True)
        cases = json.loads(result.stdout)
        self.assertEqual(len(cases), 4)
        for case in cases:
            with self.subTest(amount=case['intent']['amountCzk'], frequency=case['intent']['frequency']):
                payment = case['payment']
                expected = payment_data(case['intent'])
                self.assertEqual(payment['iban'], expected['iban'])
                self.assertEqual(payment['spd'], expected['spd'])
                root = ElementTree.fromstring(payment['qrSvg'])
                viewbox = list(map(int, root.attrib['viewBox'].split()))
                self.assertEqual(viewbox[2], viewbox[3])
                for width in (256, viewbox[2]):  # Display and full-resolution PNG source.
                    png = resvg_py.svg_to_bytes(svg_string=payment['qrSvg'], width=width, height=width)
                    image = Image.open(io.BytesIO(png)).convert('RGB')
                    decoded = zxingcpp.read_barcode(image)
                    self.assertIsNotNone(decoded, 'rendered PNG must decode independently of QR encoder')
                    self.assertEqual(decoded.text, expected['spd'])
                    self.assertEqual(image.getpixel((0, 0)), (255, 255, 255), 'standalone QR has white quiet zone')
                    # Four modules remain white across every edge, even without CSS/background.
                    quiet = max(1, int(32 * width / viewbox[2]))
                    for bounds in [(0,0,width,quiet),(0,0,quiet,width),(0,width-quiet,width,width),(width-quiet,0,width,width)]:
                        self.assertEqual(image.crop(bounds).getextrema(), ((255,255),)*3)
        print('PASS: four persisted TEST intents, backend-exact SPAYD, 8 independently decoded PNGs; no client grants')


if __name__ == '__main__':
    unittest.main()
