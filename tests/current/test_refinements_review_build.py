"""Native review must be Preview-only, transport isolated and shell preserving."""
from pathlib import Path
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    for name in ['tools/build_refinements_review.py', 'tools/refinements-review.js', 'public/index.html']:
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    original = (root / 'public/index.html').read_bytes()
    script = root / 'tools/build_refinements_review.py'
    subprocess.run([sys.executable, str(script)], env={**os.environ, 'VERCEL_ENV': 'preview'}, check=True)
    page = root / 'public/design/refinements/index.html'
    fixture = page.with_name('review.js')
    html = page.read_text()
    assert 'data-refinements-review' in html
    assert html.index('/design/refinements/review.js') < html.index('/referral-transport.js')
    assert '<section id="screen-daily"' in html and '<div id="hintModal"' in html
    assert html.replace(' data-refinements-review', '').replace('\n  <script src="/design/refinements/review.js"></script>', '') == original.decode()
    assert fixture.read_bytes() == (ROOT / 'tools/refinements-review.js').read_bytes()
    for environment in ['production', 'development', '']:
        subprocess.run([sys.executable, str(script)], env={**os.environ, 'VERCEL_ENV': environment}, check=True)
        assert 'data-refinements-review' not in page.read_text()
        assert 'review.js' not in page.read_text()
        assert 'refinements-review' not in fixture.read_text() and 'fetch' not in fixture.read_text()
    assert (root / 'public/index.html').read_bytes() == original

# Exercise the actual adapter with a minimal browser boundary. No copied adapter.
check = r'''
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
let reads=0,nativeRequests=[];
const ctx={URL,URLSearchParams,Map,Set,Headers,Response,TextEncoder,DOMException,crypto:require('node:crypto').webcrypto,structuredClone,Intl,Date,console,setTimeout,clearTimeout,
 location:new URL('https://isolated-preview.example/design/refinements/?review=rankings&theme=dark'),
 document:{documentElement:{hasAttribute:n=>n==='data-refinements-review'},addEventListener(){}},navigator:{},
 fetch:async(input,options)=>{nativeRequests.push({input:String(input),options});return new Response('{}')},
 XMLHttpRequest:class {open(){}send(){}setRequestHeader(){}},
};
ctx.window=ctx;
Object.defineProperty(ctx,'localStorage',{configurable:true,get(){reads++;throw Error('read real local storage')}});
Object.defineProperty(ctx,'sessionStorage',{configurable:true,get(){reads++;throw Error('read real session storage')}});
vm.runInNewContext(fs.readFileSync('tools/refinements-review.js','utf8'),ctx);
(async()=>{
 assert.equal(reads,0,'adapter never reads an existing account');
 assert.equal(JSON.parse(ctx.localStorage.getItem('proplet-v2-profile')).id,'refinements-review');
 assert.equal(JSON.parse(ctx.localStorage.getItem('proplet-v3-settings')).theme,'dark');
 for(const method of ['GET','POST','PUT','PATCH','DELETE']){
  const r=await ctx.fetch('/api/unexpected',{method,headers:{Authorization:'private'}});
  assert.equal(r.status,200);assert.equal((await r.json()).reviewOnly,true);
 }
 const ranking=await (await ctx.fetch('/api/rankings/daily')).json();
 assert.equal(ranking.players.length,124);assert.equal(ranking.players.find(x=>x.isMine).rank,47);assert.equal(ranking.teams.length,18);
 const week=await (await ctx.fetch('/api/rankings/xp?period=week')).json();
 const total=await (await ctx.fetch('/api/rankings/xp?period=all')).json();
 assert.notEqual(week.players.length,total.players.length);assert.notEqual(week.teams.length,total.teams.length);
 assert.equal((await ctx.fetch('https://hrajproplet.cz/api/me')).status,403);
 assert.equal(nativeRequests.length,0,'no API or external request reaches the network');
 await ctx.fetch('/styles.css',{headers:{Authorization:'private',Cookie:'secret'}});
 assert.equal(nativeRequests.length,1);assert.equal(nativeRequests[0].options.credentials,'omit');
 assert.equal(nativeRequests[0].options.headers.has('authorization'),false);assert.equal(nativeRequests[0].options.headers.has('cookie'),false);
 const x=new ctx.XMLHttpRequest();x.open('POST','/api/result');assert.throws(()=>x.send(),{name:'SecurityError'});
 assert.equal(ctx.navigator.sendBeacon('https://hrajproplet.cz/api/result','secret'),false);
})().catch(e=>{console.error(e);process.exit(1)});
'''
subprocess.run(['node', '-e', check], cwd=ROOT, check=True)
print('PASS refinements review: real shell, Preview-only fixtures, memory storage, zero API/external network escapes')
