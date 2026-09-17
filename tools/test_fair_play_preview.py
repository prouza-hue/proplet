"""Synthetic API acceptance; refuses every deployment except isolated fair-play preview."""
import argparse
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

parser=argparse.ArgumentParser();parser.add_argument('--url',required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
assert args.url.startswith('https://proplet-') and args.url.endswith('.vercel.app')
with httpx.Client(base_url=args.url,timeout=40) as client:
 def request(path,body=None,headers=None):
  response=client.get(path,headers=headers) if body is None else client.post(path,json=body,headers=headers)
  assert response.status_code==200,(path,response.status_code,response.text[:250] if response.status_code!=200 else '')
  return response.json()
 config=request('/api/play-session/config');assert config.get('isolatedPreview') is True and config.get('enabled') is True,config
 day=datetime.now(ZoneInfo('Europe/Prague')).date().isoformat()
 assert day>=config['dailyFrom']
 puzzle_id=server.expected_daily_puzzle_id(day)
 puzzle=request('/api/shared-puzzle?kind=daily&puzzle_id='+puzzle_id+'&daily_date='+day)['puzzle']
 checks=[];players=[]
 for offline in (False,True):
  anon=str(uuid.uuid4());owner=str(uuid.uuid4());attempt=str(uuid.uuid4());guest={'X-Proplet-Anon-ID':anon}
  words=[{'answerIndex':i,'path':answer['path']} for i,answer in enumerate(puzzle['answers'])]
  progress={'found':words if offline else [],'elapsedMs':20000 if offline else 0,'moves':len(words) if offline else 0}
  body={'action':'open','puzzle_id':puzzle_id,'challenge_key':'daily:'+day,'mode':'daily','difficulty':puzzle['difficulty'],'attempt_id':attempt,'owner_id':owner,'sequence':1,'progress':progress}
  first=request('/api/play-session',body,guest);assert first['verified'] is not offline
  body.update(action='pause',sequence=2,progress={'found':words[:1] if not offline else words,'elapsedMs':20000,'moves':1 if not offline else len(words)})
  paused=request('/api/play-session',body,guest)
  profile=request('/api/player',{'name':'QA fairplay '+secrets.token_hex(4),'password':secrets.token_urlsafe(24)},guest)
  auth={'Authorization':'Bearer '+profile['token']};players.append(profile['id'])
  request('/api/anonymous/claim',{'anonymous_id':anon},auth)
  body.update(action='open',owner_id=str(uuid.uuid4()),sequence=1,progress={})
  resumed=request('/api/play-session',body,auth)
  assert resumed['attempt_id']==first['attempt_id'] and resumed['elapsed_ms']>=paused['elapsed_ms']
  assert len(resumed['progress']['found'])==len(paused['progress']['found'])
  body.update(action='finish',sequence=2,progress={'found':words,'elapsedMs':22000,'moves':len(words)})
  finished=request('/api/play-session',body,auth);assert finished['verified'] is not offline
  result={'puzzle_id':puzzle_id,'challenge_key':'daily:'+day,'mode':'daily','difficulty':puzzle['difficulty'],'daily_date':day,'elapsed_ms':finished['elapsed_ms'],'moves':len(words),'attempt_id':attempt,'completed_at':datetime.now(ZoneInfo('UTC')).isoformat()}
  receipt=request('/api/result',result,auth);assert receipt['awardedPoints']==100,receipt.get('awardedPoints')
  retry=request('/api/result',result,auth);assert retry['awardedPoints']==receipt['awardedPoints']
  saved=request('/api/progress',headers=auth)['completed'];saved=next(row for row in saved if row['puzzleId']==puzzle_id)
  assert saved['timingVerified'] is not offline,saved
  checks.append({'offline':offline,'guestClaim':True,'crossDeviceResume':True,'timeFloorMs':finished['elapsed_ms'],'xp':100,'timingVerified':saved['timingVerified'],'retry':True})
 report={'url':args.url,'at':datetime.now(ZoneInfo('UTC')).isoformat(),'syntheticPlayers':players,'daily':day,'puzzle':puzzle_id,'checks':checks}
 args.output.write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
