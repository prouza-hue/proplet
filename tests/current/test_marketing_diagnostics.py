"""Bounded first-party marketing context; no network or database writes."""
from types import SimpleNamespace
from backend.measurement import request_context
from backend.analytics import load_registry, EMBEDDED_EVENT_NAMES

for value in ('eligible', 'unknown_parameter', 'auth_url', 'nonproduction', 'non_game_path'):
    row = request_context(SimpleNamespace(headers={'x-proplet-marketing-gate': value}), 'production')
    assert row['_event_context']['marketing_gate'] == value
for value in ('', 'https://hrajproplet.cz/?token=private', 'eligible?email=user@example.invalid', 'auth_url#access_token=private', 'x' * 1000):
    row = request_context(SimpleNamespace(headers={'x-proplet-marketing-gate': value}), 'production')
    assert 'marketing_gate' not in row['_event_context']
names = {'marketing_measurement_ready', 'marketing_sdk_loaded', 'marketing_sdk_failed'}
assert names <= set(load_registry()['events'])
assert set(load_registry()['events']) == set(EMBEDDED_EVENT_NAMES)
print('PASS bounded marketing context and embedded/canonical registry parity')
