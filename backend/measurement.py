"""Server-owned measurement provenance and stable, bounded-size report pages."""
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
import uuid
import os
import re

context = ContextVar('measurement', default=None)
TABLES = {'product_events', 'puzzle_attempts', 'hint_events', 'helper_events', 'operational_events', 'puzzle_feedback'}


def request_context(request, environment):
    event_id=event_time=None
    try:
        event_id=str(uuid.UUID(request.headers.get('x-proplet-event-id','')))
        value=datetime.fromisoformat(request.headers.get('x-proplet-event-time','').replace('Z','+00:00'))
        now=datetime.now(timezone.utc)
        if value.tzinfo and now-timedelta(days=7)<=value<=now+timedelta(minutes=5):event_time=min(now,value).isoformat()
    except (ValueError,TypeError):pass
    details = {}
    for header, key in [('x-proplet-puzzle','puzzle_id'),('x-proplet-run','run_id')]:
        value=request.headers.get(header,'')
        if re.fullmatch(r'[A-Za-z0-9:._-]{1,120}',value): details[key]=value
    for header,key,maximum in [('x-proplet-hint-level','hint_level',3),('x-proplet-hints','hints',100),('x-proplet-elapsed-ms','elapsed_ms',86400000)]:
        value=request.headers.get(header,'')
        if value.isdigit() and 0<=int(value)<=maximum: details[key]=int(value)
    return {
        '_event_context':details,
        '_event_id':event_id,
        '_event_time':event_time,
        'environment': environment or 'local',
        'release': os.environ.get('VERCEL_GIT_COMMIT_SHA', 'analytics-v2')[:64],
        'client_release': request.headers.get('x-proplet-client-release','legacy')[:80],
        'measurement_version': 2 if request.headers.get('x-proplet-analytics') == '2' else 1,
        'onboarding_version': 'board-v2' if request.headers.get('x-proplet-onboarding') == 'board-v2' else 'legacy',
        'is_test': request.headers.get('x-proplet-test') == '1' or bool(request.headers.get('x-proplet-preview-as-of')),
    }


def enrich(table, row):
    provenance = context.get()
    if table not in TABLES or not provenance:return row
    details=provenance.get('_event_context',{})
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
