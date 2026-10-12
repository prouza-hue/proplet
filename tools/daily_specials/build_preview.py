"""Copy exactly six selected puzzles, original input modules and original icons.

The separate Vercel root serves ONLY preview/daily-specials/public. No FastAPI,
Supabase configuration, entire private bank or dated production calendar.
"""
import shutil
from .core import *

def main():
    preview=ROOT/'preview/daily-specials';public=preview/'public';assets=public/'assets'
    assets.mkdir(parents=True,exist_ok=True)
    report=read(OUT/'validation.json');selection=read(OUT/'playtest-selection.json')['boards']
    bank=read(OUT/'bank.json');counts=Counter();chosen=[];analyses=[]
    labels={'hardcore':'Mozkožrout','mozkomor':'Mozkomor','mozkokalypsa':'Mozkokalypsa'}
    for s in selection:
        b=deepcopy(next(b for b in bank['boards'] if b['id']==s['id']));counts[b['difficulty']]+=1
        b['previewOrdinal']=counts[b['difficulty']];b['label']=labels[b['difficulty']];b['contentHash']=content_hash(b)
        chosen.append(b);r=deepcopy(next(r for r in report['boards'] if r['id']==b['id']));r['kind']=s['kind'];analyses.append(r)
    assert len(chosen)==6 and all(v==2 for v in counts.values())
    write(public/'boards.json',{'experiment':'daily-specials-gen6-36-v1','boards':chosen})
    write(public/'analyses.json',{'boards':analyses})
    for path in (preview/'src').iterdir():shutil.copy2(path,public/path.name)
    for name in ('board','input'):shutil.copy2(ROOT/f'public/app/game/{name}.js',assets/f'{name}.js')
    for d in DIFFICULTIES:
        source=ROOT/('public/difficulty/printshop/mozkokalypsa-series-ochre.svg' if d=='mozkokalypsa' else f'public/difficulty/printshop/{d}.webp')
        shutil.copy2(source,assets/f'{d}.{source.suffix[1:]}')
    shutil.copy2(ROOT/'public/ribbon-ui.css',assets/'ribbon-ui.css')
    # Runtime recognition file is reused byte-for-byte; JS applies the same
    # 4..24 / alphabet / blocklist filter as the verified 103836-word union.
    cat=Catalog();solver=cat.solver()
    import re
    filtered=sorted({norm(w) for w in (ROOT/'data/words.txt').read_text().splitlines()
        if 4<=len(norm(w))<=24 and norm(w)!='negr' and re.fullmatch('[a-záčďéěíňóřšťúůýž]+',norm(w))})
    assert filtered==solver.words
    shutil.copy2(ROOT/'data/words.txt',assets/'recognition.txt')
    write(preview/'build-manifest.json',{'previewPuzzleIds':[b['id'] for b in chosen],
        'files':{str(p.relative_to(public)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(public.rglob('*')) if p.is_file()},
        'privateBankExposed':False,'databaseWrites':False,'productionAuthorized':False})
    print('BUILT',len(chosen),'playable puzzles')
if __name__=='__main__':main()
