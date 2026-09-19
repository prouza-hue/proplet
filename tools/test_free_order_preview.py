"""Hosted order acceptance. Refuses production and non-isolated configurations.
Creates one named synthetic account; never reads or modifies other players.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import json
from pathlib import Path
import secrets
import sys
import uuid
from zoneinfo import ZoneInfo
import httpx
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--url',required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
 assert args.url.startswith('https://proplet-') and args.url.endswith('.vercel.app')
 with httpx.Client(base_url=args.url,timeout=45) as client:
  def request(path,body=None,auth=None,status=200):
   headers={'Authorization':'Bearer '+auth} if auth else {}
   response=client.get(path,headers=headers) if body is None else client.post(path,json=body,headers=headers)
   assert response.status_code==status,(path,response.status_code,response.text[:300])
   return response.json()
  config=request('/api/free-order/config')
  assert config.get('enabled') and config.get('isolatedPreview') and config.get('databaseRef')=='eanzztstmwlamwfdskbf',config
  assert request('/api/play-session/config')['enabled']
  request('/api/free-order',status=401)
  name='QA order '+secrets.token_hex(4);password=secrets.token_urlsafe(24)
  a=request('/api/player',{'name':name,'password':password});assert a['freeOrderNewAccount'] is True
  b=request('/api/login',{'name':name,'password':password});assert a['id']==b['id'] and a['token']!=b['token']
  ta,tb=a['token'],b['token'];before=request('/api/me',auth=ta)['stats']
  day=datetime.now(ZoneInfo('Europe/Prague')).date()
  banks={d:server.released_free_bank(d,day) for d in ('easy','medium')}
  checks=[]
  for diff,bank in banks.items():
   ids=[p['id'] for p in bank];order=[ids[-1],*ids[:-1]]
   command={'difficulty':diff,'mode':'varied','expected_revision':0,'request_id':str(uuid.uuid4()),'ids':order,'import_guest':True}
   first=request('/api/free-order',command,ta)['record'];assert first['revision']==1 and first['plan']['ids']==order
   assert request('/api/free-order',command,ta)['record']==first,'retry must return same revision'
   assert request('/api/free-order',auth=tb)['records'][diff]==first,'independent device must receive exact plan'
   def edit(mode):return request('/api/free-order',{**command,'mode':mode,'expected_revision':1,'import_guest':False,'request_id':str(uuid.uuid4())},tb)
   with ThreadPoolExecutor(2) as pool:results=list(pool.map(edit,['numeric','varied']))
   assert sum(bool(r['conflict']) for r in results)==1
   current=request('/api/free-order',auth=ta)['records'][diff];assert current['revision']==2 and current['plan']['ids']==order
   adopted=request('/api/free-order',{**command,'ids':list(reversed(order)),'request_id':str(uuid.uuid4())},ta)['record']
   assert adopted==current,'guest must not overwrite existing account preference'
   changed=request('/api/free-order',{**command,'mode':'numeric','import_guest':False,'expected_revision':2,'request_id':str(uuid.uuid4()),'ids':list(reversed(order))},ta)['record']
   assert changed['plan']['ids']==order,'server preserves stable prefix'
   request('/api/free-order',{**command,'ids':['unreleased-nonexistent']},ta,status=400)
   checks.append(diff+': import, retry, independent sessions, concurrent CAS, immutable prefix, validation')
  assert request('/api/me',auth=ta)['stats']==before,'order writes may not change XP or completion'
  puzzle=banks['easy'][1];pid=puzzle['id'];attempt=str(uuid.uuid4());owner=str(uuid.uuid4())
  words=[{'answerIndex':i,'path':answer['path']} for i,answer in enumerate(puzzle['answers'])]
  body={'action':'open','puzzle_id':pid,'challenge_key':'free:'+pid,'mode':'free','difficulty':'easy','attempt_id':attempt,'owner_id':owner,'sequence':1,'progress':{}}
  request('/api/play-session',body,ta)
  body.update(action='pause',sequence=2,progress={'found':words[:1],'elapsedMs':10000,'moves':1})
  paused=request('/api/play-session',body,ta)
  assert request('/api/free-order',auth=tb)['resumeIds']['easy']==pid
  body.update(action='open',owner_id=str(uuid.uuid4()),sequence=1,progress={})
  resumed=request('/api/play-session',body,tb)
  assert resumed['attempt_id']==attempt and resumed['progress']['found']==paused['progress']['found']
  body.update(action='finish',sequence=2,progress={'found':words,'elapsedMs':20000,'moves':len(words)})
  finished=request('/api/play-session',body,tb)
  result={'puzzle_id':pid,'challenge_key':'free:'+pid,'mode':'free','difficulty':'easy','elapsed_ms':max(1000,finished['elapsed_ms']),'moves':len(words),'attempt_id':attempt,'completed_at':datetime.now(ZoneInfo('UTC')).isoformat()}
  receipt=request('/api/result',result,tb);assert receipt['awardedPoints']>0
  assert request('/api/result',result,tb)['awardedPoints']==receipt['awardedPoints']
  after=request('/api/me',auth=tb)['stats'];assert after!=before
  current=request('/api/free-order',auth=ta)['records']['easy']
  request('/api/free-order',{'difficulty':'easy','mode':'varied','expected_revision':current['revision'],'request_id':str(uuid.uuid4()),'ids':current['plan']['ids']},ta)
  assert request('/api/me',auth=ta)['stats']==after,'mode switch preserves earned XP and completion'
  checks.append('partial game preserved across devices; real completion and idempotent XP receipt; mode switch preserves stats')
  report={'url':args.url,'at':datetime.now(ZoneInfo('UTC')).isoformat(),'databaseRef':config['databaseRef'],'syntheticPlayer':a['id'],'syntheticName':name,'checks':checks,'awardedPoints':receipt['awardedPoints']}
  args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':main()
