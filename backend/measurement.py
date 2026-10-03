"""Server-owned measurement provenance and stable, bounded-size report pages."""
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
import uuid
import os
import re

context = ContextVar('measurement', default=None)
TABLES = {'product_events', 'puzzle_attempts', 'hint_events', 'helper_events', 'operational_events', 'puzzle_feedback'}
ONBOARDING_VERSIONS = frozenset({'board-v2', 'board-v3-short'})


def onboarding_version(value):
    """Exact bounded allowlist; missing/unknown/untrusted versions remain legacy."""
    return value if value in ONBOARDING_VERSIONS else 'legacy'


def request_context(request, environment):
    event_id=event_time=None
    try:
        event_id=str(uuid.UUID(request.headers.get('x-proplet-event-id','')))
        value=datetime.fromisoformat(request.headers.get('x-proplet-event-time','').replace('Z','+00:00'))
        now=datetime.now(timezone.utc)
        if value.tzinfo and now-timedelta(days=7)<=value<=now+timedelta(minutes=5):event_time=min(now,value).isoformat()
    except (ValueError,TypeError):pass
    details = {}
    marketing_gate = request.headers.get('x-proplet-marketing-gate', '')
    if marketing_gate in {'eligible', 'unknown_parameter', 'auth_url', 'nonproduction', 'non_game_path'}:
        details['marketing_gate'] = marketing_gate
    # Opt-in campaign metadata is an analytic declaration, never authorization.
    source = request.headers.get('x-proplet-acquisition-source', '')
    ids = {key: request.headers.get(f'x-proplet-acquisition-{key}', '') for key in ('campaign', 'ad', 'adset')}
    if source in {'facebook', 'instagram', 'fb', 'ig'} and all(re.fullmatch(r'\d{5,30}', value) for value in ids.values()):
        details['acquisition'] = {'source': source, **ids}
    for header, key in [('x-proplet-puzzle','puzzle_id'),('x-proplet-run','run_id')]:
        value=request.headers.get(header,'')
        if re.fullmatch(r'[A-Za-z0-9:._-]{1,120}',value): details[key]=value
    for header,key,maximum in [('x-proplet-hint-level','hint_level',3),('x-proplet-hints','hints',100),('x-proplet-elapsed-ms','elapsed_ms',86400000)]:
        value=request.headers.get(header,'')
        if value.isdigit() and 0<=int(value)<=maximum: details[key]=int(value)
    # Capture time context is immutable even when a guest queue is later claimed.
    auth_at_event=request.headers.get('x-proplet-auth-at-event','')
    if auth_at_event in {'anonymous','account'}:details['auth_at_event']=auth_at_event
    starter_run=request.headers.get('x-proplet-starter-run','')
    try:
        if starter_run:details['starter_run_id']=str(uuid.UUID(starter_run))
    except (ValueError,TypeError):pass
    starter_ms=request.headers.get('x-proplet-starter-ms','')
    if starter_ms.isdigit() and 0<=int(starter_ms)<=86400000:details['starter_ms']=int(starter_ms)
    reason=request.headers.get('x-proplet-starter-reason','')
    if reason in {'data','prepare','render','superseded','navigation','visibility'}:details['starter_reason']=reason; details['reason']=reason
    first_steps_run=request.headers.get('x-proplet-first-steps-run','')
    try:
        if first_steps_run:details['first_steps_run_id']=str(uuid.UUID(first_steps_run))
    except (ValueError,TypeError):pass
    if 'first_steps_run_id' in details:
        if request.headers.get('x-proplet-creation-source')=='first_steps_v1':details['creation_source']='first_steps_v1'
        outcome=request.headers.get('x-proplet-first-steps-outcome','')
        reason=request.headers.get('x-proplet-first-steps-reason','')
        if outcome in {'failed','cancelled'}:details['outcome']=outcome
        if reason in {'dismissed','provider_cancel','request','offline','sync','quarantined'}:details['reason']=reason
    experiment=request.headers.get('x-proplet-experiment','')
    variant=request.headers.get('x-proplet-experiment-variant','')
    bucket=request.headers.get('x-proplet-experiment-bucket','')
    if experiment=='first-board-v1' and variant in {'control_e001','challenger_e009'} and bucket.isdigit() and 0<=int(bucket)<100:
        details['experiment_key']=experiment
        details['experiment_variant']=variant
        details['experiment_bucket']=int(bucket)
    return {
        '_event_context':details,
        '_event_id':event_id,
        '_event_time':event_time,
        'environment': environment or 'local',
        'release': os.environ.get('VERCEL_GIT_COMMIT_SHA', 'analytics-v2')[:64],
        'client_release': request.headers.get('x-proplet-client-release','legacy')[:80],
        'measurement_version': 2 if request.headers.get('x-proplet-analytics') == '2' else 1,
        'onboarding_version': onboarding_version(request.headers.get('x-proplet-onboarding')),
        'is_test': request.headers.get('x-proplet-test') == '1' or bool(request.headers.get('x-proplet-preview-as-of')),
    }


def enrich(table, row):
    provenance = context.get()
    if table not in TABLES or not provenance:return row
    details={**provenance.get('_event_context',{})}
    if table=='product_events' and row.get('event_type') in {'starter_v1_left','starter_v1_hidden','starter_v1_cancelled','starter_v1_failed'}:
        details.setdefault('reason','unknown')
    result={**row, **{k:v for k,v in provenance.items() if not k.startswith('_')}, **({'context':details} if table=='product_events' else {})}
    if table=='product_events' and provenance.get('_event_id'):
        result['id']=provenance['_event_id']
        if provenance.get('_event_time'):result['created_at']=provenance['_event_time']
    return result


def pages(request, table, *, filters, columns='*'):
    """Keyset pages within an explicit report scope; never truncate or mask errors.

    Every supported relation has a unique immutable id. Unlike OFFSET, appending
    events cannot shift a previously read page. Callers pin an upper timestamp.
    """
    result, cursor = [], None
    while True:
        params = {'select':columns, 'order':'id.asc', 'limit':'1000', **filters}
        if cursor is not None:
            params['id'] = f'gt.{cursor}'
        page = request('GET', table, params=params)
        if not isinstance(page, list):
            raise ValueError('Invalid analytics page')
        result.extend(page)
        if len(page) < 1000:
            return result
        next_cursor = page[-1]['id']
        if next_cursor == cursor:
            raise ValueError('Analytics cursor did not advance')
        cursor = next_cursor
