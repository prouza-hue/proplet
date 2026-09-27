"""Read the pinned runtime fallback locally; never call a word-validation API.

The optional text cache is a byte-checked export of wordfreq 3.1.1, not a
handpicked target vocabulary. Missing cache is reconstructed from that package.
"""
import hashlib
from importlib.metadata import version
from pathlib import Path
import re
import unicodedata

from tools.gen5.catalog import ROOT, read_json, norm

DIRECTORY = ROOT / 'content/gen6/round3-eight'


def runtime_words():
    manifest = read_json(DIRECTORY / 'wordfreq-manifest.json')
    source = (ROOT / 'word_recognition_v3330.py').read_bytes()
    if hashlib.sha256(source).hexdigest() != manifest['sourceRuntimeSha256']:
        raise ValueError('Runtime recognition policy changed; resnapshot deliberately')
    cache = DIRECTORY / 'wordfreq-cs-runtime.txt'
    if cache.exists():
        raw = cache.read_bytes()
    else:
        if version('wordfreq') != manifest['version']:
            raise ValueError('The pinned wordfreq 3.1.1 package is required')
        from wordfreq import get_frequency_dict, zipf_frequency, tokenize
        alphabet = re.compile(r'^[a-záčďéěíňóřšťúůýž]{4,24}$')
        accents = set('áčďéěíňóřšťúůýž')
        accepted = set()
        for original in get_frequency_dict('cs'):
            word = norm(original)
            if not alphabet.fullmatch(word) or word == 'negr':
                continue
            if tokenize(word, 'cs') != [word]:
                raise ValueError('Unexpected alphabetic tokenization')
            key = 'WORDFREQ_ZIPF_THRESHOLD_' + ('DIACRITIC' if accents.intersection(word) else 'PLAIN')
            if zipf_frequency(word, 'cs') >= manifest['thresholds'][key]:
                accepted.add(word)
        raw = ('\n'.join(sorted(accepted)) + '\n').encode('utf-8')
    if hashlib.sha256(raw).hexdigest() != manifest['sha256']:
        raise ValueError('Runtime fallback export does not match the frozen snapshot')
    result = raw.decode('utf-8').splitlines()
    if len(result) != manifest['acceptedEntries'] or manifest['nonSingleTokenAlphabeticEntries']:
        raise ValueError('Inconsistent fallback snapshot')
    return result


def full_words():
    working = ROOT / 'content/lexicon-v3/working'
    manifest = read_json(working / 'manifest.json')
    raw = (working / 'recognition-words.txt').read_bytes()
    if hashlib.sha256(raw).hexdigest() != manifest['outputs_sha256']['recognition-words.txt']:
        raise ValueError('The full-v3 static dictionary no longer matches its manifest')
    words = {norm(w) for w in raw.decode('utf-8').splitlines()}
    words.update(runtime_words())
    # Recognize both spellings, even when only one is a preferred target.
    words.update(norm(w) for g in read_json(working / 'variant-groups.json')['groups'] for w in g['members'])
    pattern = re.compile(r'^[a-záčďéěíňóřšťúůýž]{4,24}$')
    return sorted(w for w in words if pattern.fullmatch(w) and w != 'negr')
