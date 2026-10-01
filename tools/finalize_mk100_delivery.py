"""Bind complete candidate evidence before an isolated preview deployment."""
import hashlib,json,subprocess
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'content/gen6/mozkokalypsa-100'
def read(path):return json.loads(path.read_text(encoding='utf-8'))
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path,payload):path.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def main():
    bank=read(D/'bank.json');content=bank['contentHash']
    assert len(bank['boards'])==100 and bank['status']=='technically-verified-unpublished'
    bindings=read(D/'editorial-bindings-v2.json');assert len(bindings['records'])==100
    independent=read(D/'independent-verification.json');assert independent['status']=='PASS' and independent['boardCount']==100
    browser=read(ROOT/'preview/mk100/verification/report.json');assert browser['status']=='PASS' and browser['boards']==100
    assert len(browser['completedThroughPointer'])==100 and len(browser['mobileCompletions'])==12 and len(browser['fold-portraitCompletions'])==12
    assert len(browser['fold-landscapeCompletions'])==1 and not browser['errors'] and not browser['gameplayRequests']
    for report in (bindings,independent,browser,read(D/'manifest.json'),read(D/'full-verification.json'),read(D/'endgame-audit-v2.json'),read(D/'independent-canonical-geometry.json'),read(D/'candidate-pool-archive-audit.json')):
        assert report['bankContentHash']==content
    build=read(ROOT/'preview/mk100/verification/preview-build.json');assert build['bankContentHash']==content and build['boards']==100
    for name,expected in build['runtimeAssets'].items():assert sha(ROOT/name)==expected
    assert sha(ROOT/'content/lexicon-v3/working/lexicon.json')==bank['lexiconHash']
    evidence=read(ROOT/'preview/mk100/verification/evidence-manifest.json')
    assert evidence['independentProofSha256']==sha(D/'independent-verification.json')
    production='174e0fa2a3e8befd0fe01ac8ba7771f4ece25558'
    subprocess.run(['git','diff','--exit-code',production,'--','public','server.py','api','app','requirements.txt','supabase'],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
    checkpoint=read(D/'full-v2-production-checkpoint.json')
    checkpoint.update(status='candidate-delivery-complete',bankContentHash=content,
        independentSolver='PASS100/100',individualEditorial='complete100/100',browser='PASS100mouse+12phone+12FoldPortrait+1FoldLandscape',
        remainingAuthorizedManufactureWork=[],open='Human measurement, physical devices and production publication are outside this candidate delivery.')
    write(D/'full-v2-production-checkpoint.json',checkpoint)
    files={p.relative_to(ROOT).as_posix():sha(p) for p in D.glob('*') if p.is_file() and p.name!='release-readiness.json'}
    files.update({p.relative_to(ROOT).as_posix():sha(p) for p in (ROOT/'preview/mk100/verification').glob('*') if p.is_file()})
    result={'status':'PASS-candidate-ready-for-isolated-preview','createdAt':datetime.now(timezone.utc).isoformat(),
      'bankContentHash':content,'sourceSha':bank['sourceSha'],'boardCount':100,'productionSourceUnchanged':production,
      'productionPublicationAuthorized':False,'playtestActivationAuthorized':False,'playerDataWritten':False,
      'humanDifficulty':'unmeasured','physicalDeviceTested':False,'artifactSha256':files}
    write(D/'release-readiness.json',result)
    print('DELIVERY_READY100',content,len(files),'artifact hashes')
if __name__=='__main__':main()
