"""Reproducible morphology-diverse extension of the immutable Gen6 geometry engine.

The original engine is read unchanged. Exact textual amendments are fail-closed;
the emitted C++ source and its hash are retained with the new pool provenance.
Only path design preferences change. Runtime adjacency and full cover do not.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
from tools.gen5.catalog import ROOT
from tools.gen6.eight import write

PROFILES = {
    'relief': dict(minTurns=1, totalMin=42, totalMax=54, cross=66, gaps=1, near=2),
    'main': dict(minTurns=1, totalMin=52, totalMax=66, cross=70, gaps=2, near=2),
    'challenge': dict(minTurns=2, totalMin=61, totalMax=76, cross=74, gaps=3, near=3),
    'summit': dict(minTurns=2, totalMin=66, totalMax=82, cross=76, gaps=4, near=3),
}
SEED = 202610010200
DIRECTORY = ROOT/'content/gen6/mozkokalypsa-100'
WORK = ROOT/'work/mk100/geometry'


def source():
    original=(ROOT/'tools/gen6/interwoven_geometry.cpp').read_text(encoding='utf-8')
    replacements={
        'using Lens=array<int,14>;': 'using Lens=array<int,14>;\nint MIN_TURNS=1,TOTAL_MIN=42,TOTAL_MAX=54,CROSS_MIN=66,GAPS_MIN=1,NEAR_MIN=2;',
        'max(0,3-t)': 'max(0,MIN_TURNS-t)',
        'double score(const M&m){return 1.5*m.cross+3.5*m.gaps+.3*m.degree-24*m.deficit-8*max(0,66-m.turns)-10*max(0,2-m.seam)-8*max(0,3-m.mindegree)-(m.valid?0:22);}':
            'double score(const M&m){return 1.2*m.cross+2.5*m.gaps+.3*m.degree-28*m.deficit-10*max(0,TOTAL_MIN-m.turns)-10*max(0,m.turns-TOTAL_MAX)-10*max(0,2-m.seam)-8*max(0,NEAR_MIN-m.mindegree)-(m.valid?0:22);}',
        'if(argc!=4)': 'if(argc!=10)',
        'RNG rng{seed};': 'RNG rng{seed};MIN_TURNS=stoi(argv[4]);TOTAL_MIN=stoi(argv[5]);TOTAL_MAX=stoi(argv[6]);CROSS_MIN=stoi(argv[7]);GAPS_MIN=stoi(argv[8]);NEAR_MIN=stoi(argv[9]);',
        'mm.valid&&mm.deficit==0&&mm.turns>=66&&mm.cross>=76&&mm.gaps>=4&&mm.mindegree>=3&&mm.seam>=2&&mm.degree>=56':
            'mm.valid&&mm.deficit==0&&mm.turns>=TOTAL_MIN&&mm.turns<=TOTAL_MAX&&mm.cross>=CROSS_MIN&&mm.gaps>=GAPS_MIN&&mm.mindegree>=NEAR_MIN&&mm.seam>=2&&mm.degree>=48',
    }
    for old,new in replacements.items():
        if original.count(old)!=1:raise ValueError('Original geometry source changed: '+old)
        original=original.replace(old,new)
    return original


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--compiler',type=Path,required=True)
    parser.add_argument('--pool-per-profile',type=int,default=64)
    parser.add_argument('--summit-pool-size',type=int,default=32)
    parser.add_argument('--attempts',type=int,default=30000000)
    args=parser.parse_args()
    WORK.mkdir(parents=True,exist_ok=True)
    cpp=WORK/'geometry-v2.cpp';cpp.write_text(source(),encoding='utf-8')
    binary=WORK/'geometry-v2.exe'
    subprocess.run([str(args.compiler),'c++','-O3','-std=c++17',str(cpp),'-o',str(binary)],check=True)
    all_records=[];generation=[]
    for profile,settings in PROFILES.items():
        seed=SEED+list(PROFILES).index(profile)
        path=WORK/(profile+'.jsonl')
        wanted=args.summit_pool_size if profile=='summit' else args.pool_per_profile
        if path.exists():
            prior=[json.loads(line) for line in path.read_text(encoding='utf-8').splitlines()]
            if len(prior)!=wanted:
                path.rename(WORK/(profile+'-prior-'+str(len(prior))+'-entries.jsonl'))
        command=[str(binary),str(seed),str(args.attempts),str(wanted),
                 *[str(settings[k]) for k in ('minTurns','totalMin','totalMax','cross','gaps','near')]]
        with path.open('w',encoding='utf-8',newline='\n') as stream:
            completed=subprocess.run(command,stdout=stream,text=True,capture_output=False)
        rows=[json.loads(line) for line in path.read_text(encoding='utf-8').splitlines()]
        if completed.returncode!=0 or len(rows)!=wanted:
            raise ValueError('Incomplete requested new geometry pool: '+profile)
        for row in rows:row['constructionProfile']=profile
        all_records.extend(rows)
        generation.append({'profile':profile,'seed':seed,'attemptLimit':args.attempts,
                           'requested':wanted,'completed':len(rows),
                           'exitCode':completed.returncode,'settings':settings})
        print('GEOMETRY_COMPLETE',profile,len(rows),flush=True)
        target=DIRECTORY/'geometry-pool-v2.jsonl'
        target.write_text('\n'.join(json.dumps(r,separators=(',',':')) for r in all_records)+'\n',encoding='utf-8')
    write(DIRECTORY/'geometry-production-v2.json',{
        'status':'complete','engine':'unchanged backbite core with declared profile-specific design preferences',
        'source':'tools/gen6/mk100_geometry.py','baseSource':'tools/gen6/interwoven_geometry.cpp',
        'emittedCppSha256':hashlib.sha256(cpp.read_bytes()).hexdigest(),
        'baseSourceSha256':hashlib.sha256((ROOT/'tools/gen6/interwoven_geometry.cpp').read_bytes()).hexdigest(),
        'profiles':generation,'poolSize':len(all_records),
        'poolSha256':hashlib.sha256(target.read_bytes()).hexdigest(),
        'runtimeRulesChanged':False})


if __name__=='__main__':main()
