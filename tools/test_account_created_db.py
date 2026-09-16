"""Real signup routes and PostgreSQL; loopback synthetic DB only, no real OAuth.

First run test_isolated_result_db.py. Pass its report and local password file.
--serve exposes this isolated fixture on loopback for browser signup checks.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from datetime import timezone
import json
from pathlib import Path
import sys
from unittest.mock import MagicMock, patch
import uuid

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb
import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from fastapi.staticfiles import StaticFiles

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import server
import account_auth_core as auth


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-report',type=Path,required=True)
    parser.add_argument('--password-file',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--serve',type=int)
    args=parser.parse_args()
    source=json.loads(args.database_report.read_text())
    assert source['host']=='127.0.0.1' and source['syntheticOnly'] is True
    assert source['database'].startswith('proplet_test_')
    options=dict(host='127.0.0.1',port=55432,user='proplet_test_admin',
                 password=args.password_file.read_text().strip(),dbname=source['database'])
    def query(statement,values=()):
        with psycopg.connect(**options) as c:
            c.execute('set local role service_role')
            c.execute("select set_config('request.headers',%s,true)",
                      (json.dumps({'x-proplet-signup-environment':'preview','x-proplet-signup-version':'4.2.2'}),))
            cur=c.execute(statement,values)
            return [r[0] for r in cur.fetchall()] if cur.description else []
    def where(filters):
        return sql.SQL(' and ').join(sql.SQL('{} = %s').format(sql.Identifier(k)) for k in filters) or sql.SQL('true')
    def select(table,**filters):
        return query(sql.SQL('select to_jsonb(t) from {} t where {}').format(sql.Identifier(table),where(filters)),list(filters.values()))
    def bounded(table,*,filters,**kw):
        clauses=[];values=[]
        for k,v in filters.items():
            op,value=v.split('.',1);assert op in ('eq','ilike')
            clauses.append(sql.SQL('{} {} %s').format(sql.Identifier(k),sql.SQL('=' if op=='eq' else 'ilike')));values.append(value)
        return query(sql.SQL('select to_jsonb(t) from {} t where {}').format(sql.Identifier(table),sql.SQL(' and ').join(clauses)),values)
    def insert(table,row):
        return query(sql.SQL('insert into {} ({}) values ({}) returning to_jsonb({}.*)').format(
            sql.Identifier(table),sql.SQL(',').join(map(sql.Identifier,row)),sql.SQL(',').join(sql.Placeholder() for _ in row),sql.Identifier(table)),
            [Jsonb(v) if isinstance(v,dict) else v for v in row.values()])
    def update(table,filters,values):
        return query(sql.SQL('update {} set {} where {}').format(sql.Identifier(table),
            sql.SQL(',').join(sql.SQL('{}=%s').format(sql.Identifier(k)) for k in values),where(filters)),list(values.values())+list(filters.values()))
    def counts():
        return query("select jsonb_build_object('players',(select count(*) from players),'events',(select count(*) from product_events where event_type='account_created'),'duplicates',(select count(*) from (select player_id from product_events where event_type='account_created' group by player_id having count(*)>1) d))")[0]
    app=FastAPI()
    app.add_api_route('/api/player',server.create_player,methods=['POST'])
    app.add_api_route('/api/login',server.login,methods=['POST'])
    app.add_api_route('/api/product-event',server.product_event,methods=['POST'])
    auth.install_account_auth(app,supabase_url='https://provider.invalid',supabase_key='synthetic',tz=timezone.utc,
        db_select=select,db_insert=insert,db_update=update,db_delete=lambda *a,**kw:None,
        auth_player=server.auth_player,new_session=lambda *a:'synthetic-session',hash_password=server.hash_password,
        verify_password=server.verify_password,enforce_rate_limit=lambda *a,**kw:None,
        player_stats=lambda *a:{},public_family_code=server.public_family_code,league_name_for=lambda *a:None)
    @app.get('/api/health')
    def health():return {'isolatedFixture':True,'syntheticOnly':True,'database':source['database']}
    @app.get('/api/config')
    def config():return json.loads((ROOT/'tests/fixtures/browser/config.json').read_text())
    @app.get('/api/tajenka')
    def tajenka():return json.loads((ROOT/'tests/fixtures/browser/tajenka.json').read_text())
    @app.get('/api/progress')
    def progress():return {'completed':[]}
    @app.get('/api/me')
    def me():return {'name':'Synthetic','stats':{}}
    @app.get('/__fixture/counts')
    def fixture_counts():return counts()
    app.mount('/',StaticFiles(directory=ROOT/'public',html=True))
    with ExitStack() as stack:
        for name,value in {'db_select':select,'db_select_bounded':bounded,'db_insert':insert,
            'db_update':update,'enforce_rate_limit':lambda *a,**kw:None,
            'player_stats':lambda *a:{},'new_session':lambda *a:'synthetic-session',
            'telemetry_actor':lambda *a:{'player_id':None,'anonymous_id':'synthetic-client'}}.items():
            stack.enter_context(patch.object(server,name,value))
        stack.enter_context(patch.object(server.DB_HTTP_CLIENT,'request',side_effect=AssertionError('external I/O forbidden')))
        if args.serve:
            import uvicorn
            uvicorn.run(app,host='127.0.0.1',port=args.serve,access_log=False)
            return
        client=TestClient(app);before=counts();tag=uuid.uuid4().hex[:8]
        r=client.post('/api/player',json={'name':'Synthetic '+tag,'password':'synthetic-password'})
        assert r.status_code==200,r.text
        player=r.json();after_password=counts()
        assert after_password['players']==before['players']+1 and after_password['events']==before['events']+1
        for _ in range(3):
            r=client.post('/api/login',json={'name':player['name'],'password':'synthetic-password'})
            assert r.status_code==200,r.text
            r=client.post('/api/product-event',json={'event_type':'account_created'})
            assert r.json()=={'ok':True}
        assert counts()==after_password
        provider=MagicMock();provider.__enter__.return_value=provider
        user={'id':str(uuid.uuid4()),'email':tag+'@example.invalid','email_confirmed_at':'2026-09-16T00:00:00Z',
              'identities':[{'provider':'google','identity_data':{'email_verified':True}}],
              'user_metadata':{'full_name':'Private Google name','picture':'https://example.invalid/private'}}
        provider.request.return_value=httpx.Response(200,json=user)
        with patch.object(auth.httpx,'Client',return_value=provider):
            for _ in range(3):
                r=client.post('/api/auth/google/complete',json={'accessToken':'x'*50})
                assert r.status_code==200,r.text
            after_google=counts()
            assert after_google['players']==before['players']+2 and after_google['events']==before['events']+2
            user['email_confirmed_at']=None
            provider.request.return_value=httpx.Response(200,json=user)
            assert client.post('/api/auth/google/complete',json={'accessToken':'x'*50}).status_code==401
        assert client.post('/api/player',json={'name':'Failure','password':''}).status_code in (400,422)
        assert counts()==after_google and after_google['duplicates']==0
        r=client.post('/api/player',json={'name':'Team '+tag,'password':'synthetic-password',
            'family_code':'TEAM'+tag,'create_league':True,'league_name':'Synthetic team','league_pin':'1234'})
        assert r.status_code==200,r.text
        assert counts()['players']==before['players']+3 and counts()['events']==before['events']+3
        concurrent_id=str(uuid.uuid4())
        def retry_insert(_):
            query("insert into players(id,name,family_code,token_hash) values (%s,'Concurrent fixture',%s,'synthetic') on conflict(id) do nothing",
                  (concurrent_id,'SOLO_'+tag))
        with ThreadPoolExecutor(max_workers=10) as pool:list(pool.map(retry_insert,range(10)))
        assert counts()['players']==before['players']+4 and counts()['events']==before['events']+4
        events=query("select to_jsonb(e) from product_events e where event_type='account_created' and context->>'origin'='players_insert'")
        for e in events:
            assert e['context']=={'origin':'players_insert'}
            assert not any(x in json.dumps(e) for x in ('@','Private Google','synthetic-password'))
        result={'syntheticOnly':True,'database':source['database'],'before':before,'after':counts(),
                'checks':['password signup','team signup','Google signup','Google retry/login x3','password login x3',
                          'cached client event ignored','10 concurrent same-account inserts','failed registration','no PII','no duplicate events']}
        args.output.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))

if __name__=='__main__':main()
