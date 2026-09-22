"""Create a fresh loopback-only database; no Supabase host or real players."""
import json,secrets,uuid
from pathlib import Path
import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb
options=dict(host='127.0.0.1',port=55432,user='proplet_test_admin',password='local-test-only',autocommit=True)
name='proplet_test_mozkokalypsa_'+secrets.token_hex(4)
with psycopg.connect(dbname='postgres',**options) as c:
 for role in ('anon','authenticated','service_role'):
  if not c.execute('select 1 from pg_roles where rolname=%s',(role,)).fetchone():
   c.execute(sql.SQL('create role {} {}').format(sql.Identifier(role),sql.SQL('bypassrls' if role=='service_role' else '')))
 c.execute(sql.SQL('create database {}').format(sql.Identifier(name)))
with psycopg.connect(dbname=name,**options) as c:
 c.execute('create table public.players(id uuid primary key)')
 c.execute(Path('SUPABASE_MOZKOKALYPSA_PLAYTEST.sql').read_text())
 player,outsider=str(uuid.uuid4()),str(uuid.uuid4())
 c.execute('insert into players values(%s),(%s)',(player,outsider))
 c.execute("insert into mozkokalypsa_invites(experiment_id,player_id,slot) values('test',%s,0)",(player,))
 for role in ('anon','authenticated'):
  for table in ('mozkokalypsa_invites','mozkokalypsa_attempts','mozkokalypsa_events'):
   assert not c.execute('select has_table_privilege(%s,%s,%s)',(role,'public.'+table,'select')).fetchone()[0]
  for function in ('proplet_mozkokalypsa_open(text,uuid,text)','proplet_mozkokalypsa_event(text,uuid,text,uuid,uuid,integer,text,jsonb,jsonb)'):
   assert not c.execute('select has_function_privilege(%s,%s,%s)',(role,'public.'+function,'execute')).fetchone()[0]
 c.execute('set role service_role')
 def open_for(pid):return c.execute("select proplet_mozkokalypsa_open('test',%s,'mk26-01')",(pid,)).fetchone()[0]
 attempt=open_for(player);assert open_for(player)['id']==attempt['id']
 try:open_for(outsider);raise AssertionError('outsider entered')
 except psycopg.errors.InsufficientPrivilege:pass
 event=str(uuid.uuid4());snapshot={'elapsedMs':1234,'moves':1,'found':[]}
 def record(event_id,rev,kind='correct',progress=None,pid=player):
  return c.execute("select proplet_mozkokalypsa_event('test',%s,'mk26-01',%s,%s,%s,%s,%s,%s)",
   (pid,attempt['id'],event_id,rev,kind,Jsonb(progress or snapshot),Jsonb({}))).fetchone()[0]
 first=record(event,0);assert first['revision']==1
 assert record(event,0)['duplicate']
 assert record(str(uuid.uuid4()),0)['conflict']
 try:record(event,0,progress={'elapsedMs':9999});raise AssertionError('idempotency mismatch accepted')
 except psycopg.errors.InvalidParameterValue:pass
 done=record(str(uuid.uuid4()),1,'finish');assert done['revision']==2
 assert record(str(uuid.uuid4()),2,'correct')['conflict']
 assert record(str(uuid.uuid4()),2,'feedback')['revision']==3
 assert c.execute('select count(*) from mozkokalypsa_events').fetchone()[0]==3
 assert c.execute('select completed from mozkokalypsa_attempts').fetchone()[0]
 c.execute('reset role');c.execute('update mozkokalypsa_invites set active=false')
 c.execute('set role service_role')
 try:record(str(uuid.uuid4()),3,'feedback');raise AssertionError('revoked invite accepted')
 except psycopg.errors.InsufficientPrivilege:pass
print('PASS real PostgreSQL: grants/RLS, invite auth, idempotent open/event, CAS, completed immutability, invitation revoke')
