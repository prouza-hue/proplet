"""Build the interwoven eight-board preview with exactly the dictionary used by its solver."""
import os
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    if os.environ.get('VERCEL_ENV') == 'production':
        raise RuntimeError('The isolated Gen6 interwoven eight-board preview must not become production')
    from tools.build_gen6_preview import build
    from tools.gen6.recognition_snapshot import full_words
    from tools.gen6.full_catalog import sha
    from tools.gen5.catalog import read_json
    directory = ROOT / 'content/gen6/round3-interwoven'
    bank = read_json(directory / 'bank.json')
    if sha(ROOT/'content/lexicon-v3/working/lexicon.json') != bank['lexiconHash']:
        raise ValueError('Preview is not built from the recorded complete Lexikon v3')
    with tempfile.TemporaryDirectory(prefix='proplet-recognition-') as temp:
        dictionary = Path(temp) / 'recognition.txt'
        dictionary.write_text('\n'.join(full_words()) + '\n', encoding='utf-8')
        result = build(directory / 'bank.json', dictionary)
    import json
    print(json.dumps({k:v for k,v in result.items() if k!='runtimeAssets'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
