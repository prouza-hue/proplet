"""Bounded public GET smoke. Dry-run by default; never accepts account credentials."""
import argparse
import json
from datetime import date
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def plan(url, weekly=False, monthly=False, week=None):
    parsed = urlsplit(url)
    host = parsed.hostname or ''
    if (parsed.scheme != 'https' or parsed.username or parsed.password or parsed.port
            or parsed.query or parsed.fragment or parsed.path not in ('', '/')
            or not (host == 'hrajproplet.cz' or (host.startswith('proplet-') and host.endswith('.vercel.app')))):
        raise ValueError('Use the exact Proplet HTTPS origin, without credentials, path or query.')
    paths = ['/api/health', '/api/config']
    if weekly:
        paths.append('/api/team-victories/competition')
    if monthly:
        paths.append('/api/competition/monthly')
    if week:
        parsed_week = date.fromisoformat(week)
        if parsed_week.isoformat() != week or parsed_week.weekday() != 0:
            raise ValueError('Week must be an ISO Monday date.')
        paths.append('/api/team-victories/competition?week=' + week + '&includeSummary=false')
    if len(paths) > 4:
        raise ValueError('Select only the changed contracts; four requests maximum.')
    return [url.rstrip('/') + path for path in paths]


def run(urls, expected_version=None, opener=urlopen):
    if len(urls) > 4:
        raise ValueError('Live smoke budget is four requests; do not retry automatically.')
    result = []
    for url in urls:
        request = Request(url, headers={'User-Agent': 'Proplet-bounded-release-smoke'}, method='GET')
        with opener(request, timeout=20) as response:
            body = response.read(1024 * 1024 + 1)
            if len(body) > 1024 * 1024:
                raise ValueError('Response exceeded smoke byte budget')
            value = json.loads(body)
        if url.endswith('/api/health'):
            assert value.get('ok') and value.get('database'), 'Health check failed'
            if expected_version:
                assert value.get('version') == expected_version, 'Unexpected production version'
        if '/competition' in url:
            assert value.get('enabled') is True, 'Competition disabled'
        result.append({'path': urlsplit(url).path, 'responseBytes': len(body),
                       'state': {k: value[k] for k in ('ok', 'version', 'environment', 'livePlayerPreview', 'enabled', 'isolated') if k in value},
                       'counts': {k: len(value[k]) for k in ('weeks', 'goldTeams', 'standings') if isinstance(value.get(k), list)}})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--live', action='store_true', help='Explicitly execute the planned GET requests')
    parser.add_argument('--weekly', action='store_true')
    parser.add_argument('--monthly', action='store_true')
    parser.add_argument('--week', help='One known finalized Monday, to check the narrow history response')
    parser.add_argument('--version')
    args = parser.parse_args()
    urls = plan(args.url, args.weekly, args.monthly, args.week)
    print(json.dumps({'requests': len(urls), 'live': args.live,
                      'result': run(urls, args.version) if args.live else urls}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
