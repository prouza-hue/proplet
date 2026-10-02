"""Export the unpublished refresh inside current Proplet as an isolated static preview."""
from __future__ import annotations
import copy,hashlib,json,os,pathlib,re,shutil,urllib.request
from datetime import date

ROOT=pathlib.Path(__file__).resolve().parents[1]
CONTENT=ROOT/'content/gen6/free-refresh-300'
OUTPUT=ROOT/'dist-free-refresh-preview'
AS_OF=os.environ.get('FREE_REFRESH_PREVIEW_AS_OF','2026-10-02')
DIFFICULTIES=('easy','medium','hard')

def read(path): return json.loads(path.read_text(encoding='utf8'))
def write(path,value): path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def digest(value): return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def bundle_fonts(output):
    """Recovery path for CI: download the same requested families into the static export."""
    folder=output/'assets/fonts'
    folder.mkdir(parents=True,exist_ok=True)
    css_path=folder/'preview-fonts.css'
    if css_path.exists(): return
    css_url='https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,800&family=Outfit:wght@400;500;600;700;800;900&display=swap'
    request=urllib.request.Request(css_url,headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'})
    with urllib.request.urlopen(request,timeout=40) as response: css=response.read().decode('utf8')
    urls=list(dict.fromkeys(re.findall(r'url\((https://[^)]+)\)',css)))
    if not urls: raise ValueError('Font stylesheet did not contain downloadable fonts')
    sources=[]
    for index,url in enumerate(urls,1):
        name='preview-'+str(index)+'.woff2'
        with urllib.request.urlopen(url,timeout=40) as response: body=response.read()
        (folder/name).write_bytes(body)
        css=css.replace(url,'/assets/fonts/'+name)
        sources.append({'path':name,'source':url,'sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body)})
    css_path.write_text(css,encoding='utf8')
    write(folder/'source-manifest.json',{'cssSource':css_url,'fonts':sources,'recoveryBuild':True})

def build():
    if os.environ.get('VERCEL_ENV','').lower()=='production': raise RuntimeError('Unpublished refresh: production build forbidden')
    baseline=read(ROOT/'BASELINE.json')
    bank=read(CONTENT/'bank.json'); boards=bank['boards']
    if len(boards)!=300 or any(sum(p['difficulty']==d for p in boards)!=100 for d in DIFFICULTIES):
        raise ValueError('Preview requires the complete 100/100/100 bank')
    identifiers=[p['id'] for p in boards]
    if len(set(identifiers))!=300: raise ValueError('Duplicate refresh identity')
    for p in boards:
        cells=set(p['mask']); paths=[i for a in p['answers'] for i in a['path']]
        if len(paths)!=len(set(paths)) or set(paths)!=cells: raise ValueError('Incomplete/disjoint coverage '+p['id'])
        for a in p['answers']:
            if ''.join(p['letters'][i] for i in a['path']).casefold()!=a['word'].casefold(): raise ValueError('Word/path mismatch '+p['id'])
            for x,y in zip(a['path'],a['path'][1:]):
                if abs(x//p['cols']-y//p['cols'])+abs(x%p['cols']-y%p['cols'])!=1: raise ValueError('Nonorthogonal path '+p['id'])
    source=read(ROOT/'public/puzzles.json')
    puzzles=copy.deepcopy(source)
    # Only exact active public catalogue; rolling reservations stay exposure history.
    originals={p['id'] for rows in puzzles['free'].values() for p in rows}
    if originals&set(identifiers): raise ValueError('New bank overwrites original identities')
    route_path=CONTENT/'shared-route-manifest.json'
    if not route_path.exists(): raise ValueError('Reviewed shared-route-manifest.json is required')
    manifest=read(route_path)
    routes={}
    for diff in DIFFICULTIES:
        fresh=[p for p in boards if p['difficulty']==diff]
        old=puzzles['free'][diff]
        if {int(p['meta']['level']) for p in fresh}&{int(p['meta']['level']) for p in old}: raise ValueError('Original slot collision '+diff)
        puzzles['free'][diff]+=copy.deepcopy(fresh)
        puzzles['freeLevelCounts'][diff]=len(puzzles['free'][diff])
        ordered=list(manifest['routes'][diff])
        expected={p['id'] for p in fresh}
        if set(ordered[:100])!=expected or len(set(ordered))!=len(ordered): raise ValueError('Shared route must begin with all 100 fresh IDs '+diff)
        oldids=[p['id'] for p in sorted(old,key=lambda p:int(p['meta']['level']))]
        allowed=expected|set(oldids)
        if not set(ordered)<=allowed: raise ValueError('Unknown route ID')
        ordered.extend(i for i in oldids if i not in set(ordered))
        routes[diff]=ordered
    recognition=ROOT/'content/gen6/recognition-words.txt'
    frozen=CONTENT/'recognition-words.txt'
    if frozen.exists(): recognition=frozen
    words={w.strip().upper() for w in recognition.read_text(encoding='utf8').splitlines() if w.strip()}
    words.update(w.strip().upper() for w in (ROOT/'public/valid-words-v3328.txt').read_text(encoding='utf8').splitlines() if w.strip())
    words.update(a['word'].upper() for p in boards for a in p['answers'])
    tajenka_bank=read(ROOT/'data/tajenka_weekend_v2.json')
    offset=(date.fromisoformat(AS_OF)-date(2026,9,12)).days
    week=3+offset//7*2+(offset%7>=4)
    tajenka=next((p for p in tajenka_bank['puzzles'] if p['week']==week),None)
    report={'kind':'free-refresh-300-static-preview','sourceMain':baseline['sourceMain'],'contentSourceMain':baseline.get('contentSourceMain',baseline['sourceMain']),'asOf':AS_OF,'boards':300,'counts':{d:100 for d in DIFFICULTIES},'bankContentHash':bank.get('contentHash',digest(boards)),'routeVersion':manifest['version'],'routesHash':digest(routes),'nativeSourceUnchanged':True,'productionWrites':False,'serverFunctions':0,'accounts':False,'playtest':False,'localPreviewProgressOnly':True,'firstBoardExperimentChanged':False,'publicationAuthorized':False,'recognitionWords':len(words),'recoveryReconstructedSources':True}
    if OUTPUT.resolve()!=ROOT.resolve()/'dist-free-refresh-preview': raise ValueError('Unsafe output')
    if OUTPUT.exists(): shutil.rmtree(OUTPUT)
    shutil.copytree(ROOT/'public',OUTPUT)
    for name in ('sw.js','manifest.webmanifest'): (OUTPUT/name).unlink(missing_ok=True)
    # Source styles stay intact. Only exported copies use bundled local fonts.
    for path in OUTPUT.rglob('*.css'):
        text=path.read_text(encoding='utf8'); text=re.sub(r'@import\s+url\([\"\']?https?://[^;]+;', '',text)
        path.write_text(text,encoding='utf8')
    bundle_fonts(OUTPUT)
    fixtures={'puzzles':puzzles,'refreshBoards':boards,'routes':routes,'recognitionWords':sorted(words),'tajenka':tajenka,'build':report}
    payload=json.dumps(fixtures,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    (OUTPUT/'free-refresh-fixtures.js').write_text('window.PROPLET_FREE_REFRESH_FIXTURES='+payload+';\n',encoding='utf8')
    html=(ROOT/'public/index.html').read_text(encoding='utf8')
    marker=re.search(r'  <script src="/theme-init\.js[^\"]*"></script>',html)
    if not marker: raise ValueError('Native bootstrap location changed')
    injection='  <script src="/free-refresh-fixtures.js"></script>\n  <script src="/app/free-refresh-preview.js"></script>\n'
    html=html[:marker.start()]+injection+html[marker.start():]
    html=re.sub(r'\s*<script defer src="/_vercel/(?:insights|speed-insights)/script\.js"></script>','',html)
    html=re.sub(r'\s*<link rel="manifest"[^>]*>','',html)
    security='<meta name="robots" content="noindex,nofollow">\n<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; connect-src \'none\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\' data:; media-src \'self\' blob:; worker-src \'none\'; frame-src \'none\'; object-src \'none\'; base-uri \'self\'; form-action \'none\'">\n'
    html=re.sub(r'(<meta charset=[^>]+>)',lambda match:match.group(1)+'\n'+security,html,count=1)
    html=html.replace('</head>','<link rel="stylesheet" href="/assets/fonts/preview-fonts.css">\n<link rel="stylesheet" href="/free-refresh-preview.css">\n</head>')
    (OUTPUT/'index.html').write_text(html,encoding='utf8')
    (OUTPUT/'robots.txt').write_text('User-agent: *\nDisallow: /\n',encoding='utf8')
    write(OUTPUT/'puzzles.json',puzzles);write(OUTPUT/'free-refresh-build.json',report)
    print(json.dumps(report,ensure_ascii=False));return report

if __name__=='__main__': build()
