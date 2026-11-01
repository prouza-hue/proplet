"""Focused real PostgreSQL v3 formula/upgrade acceptance; synthetic loopback only."""
from datetime import date,timedelta
import json,uuid
import psycopg
from psycopg.types.json import Jsonb
from backend.contracts import ResultCreate
from backend.results import build_command,result_identity


def run_independence_acceptance(base_connect,report):
    marker=json.dumps({'x-proplet-monthly-preview':'codex/monthly-competition-202611'})
    def connect():
        c=base_connect();c.execute("select set_config('request.headers',%s,false)",(marker,));return c
    def clock(c,value):c.execute('update monthly_competition_settings set preview_now=%s,preview_anchor_at=null',(value,))
    def player():
        p=str(uuid.uuid4())
        with connect() as c:c.execute('insert into players(id,name,family_code,token_hash) values(%s,%s,%s,%s)',(p,'Indep '+p[:8],'SOLO_INDEPENDENCE','independence-'+p))
        return p
    def submit(pid,day,hints=0,clean=None,level=None,verified=False,elapsed=15000):
        attempt='independence-'+str(uuid.uuid4());puzzle='independence-'+str(day);key='daily:'+str(day)
        payload=ResultCreate(puzzle_id=puzzle,challenge_key=key,mode='daily',difficulty='easy',daily_date=str(day),elapsed_ms=elapsed,moves=12,
          hints_used=hints,max_hint_level=level if level is not None else (1 if hints else 0),clean_solve=(hints==0) if clean is None else clean,
          attempt_id=attempt,completed_at=str(day)+'T12:00:00+01:00',timing_unverified=not verified)
        cmd=build_command(result_identity(pid,payload),payload,completed_at=payload.completed_at,points=100,content_generation=6,free_level=None,legacy_reward_slot=None,team_code_at_completion=None)
        with connect() as c:
            clock(c,str(day)+' 12:00:00 Europe/Prague')
            if verified:
                owner=str(uuid.uuid4())
                for seq,action,ms in ((1,'open',0),(2,'finish',elapsed)):
                    c.execute('select proplet_play_session_v1(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                      ('p:'+pid,pid,key,puzzle,'daily',attempt,owner,seq,action,Jsonb({'elapsedMs':ms,'moves':12,'hints':hints,'maxHintLevel':payload.max_hint_level,'found':[]})))
            c.execute('set role service_role')
            if not verified:receipt=c.execute('select proplet_submit_offline_result_v1(%s)',(Jsonb(cmd),)).fetchone()[0]
            else:receipt=c.execute('select proplet_submit_result_v1(%s,%s,%s,%s,%s)',(pid,cmd['idempotencyKey'],cmd['requestDigest'],cmd['commandDigest'],Jsonb(cmd))).fetchone()[0]
            assert receipt['awardedPoints']==100
    month=date(2027,1,1)
    with connect() as c:
        original_launch=c.execute('select launch_month from monthly_competition_settings').fetchone()[0]
        assert c.execute('select scoring_version from monthly_competition_settings').fetchone()[0] in (1,2)
        c.execute("update monthly_competition_settings set enabled=true,isolated=true,rules_approved=true,scoring_version=2")
        clock(c,'2027-01-31 18:00:00 Europe/Prague')
        c.execute("update fair_play_policy set enabled=true,daily_from='2026-12-01'")
        v2=c.execute('select month,revision from monthly_competition_rounds where scoring_version=2 order by month desc limit 1').fetchone()
    if v2 is None:
        old=player()
        with connect() as c:c.execute("update monthly_competition_settings set launch_month='2026-12-01'")
        submit(old,date(2026,12,1),hints=1)
        with connect() as c:
            clock(c,'2027-01-03 00:00:00 Europe/Prague');c.execute('select proplet_finalize_monthly_competition_v1()')
            v2=(date(2026,12,1),1)
    ids=[player() for _ in range(11)]
    submit(ids[0],month,hints=1)
    with connect() as c:
        assert c.execute('select points from monthly_competition_days where player_id=%s',(ids[0],)).fetchone()[0]==62
        clock(c,'2027-01-31 18:00:00 Europe/Prague')
        xp=c.execute('select count(*),sum(points) from results').fetchone()
        closed=c.execute('select month,standings,scoring_version from monthly_competition_rounds order by month').fetchall()
        c.execute('set role service_role')
        for _ in range(2):assert c.execute('select proplet_activate_monthly_independence_v3()').fetchone()[0]['scoringVersion']==3
        assert c.execute('select proplet_activate_monthly_quality_v2()').fetchone()[0]['scoringVersion']==3
        assert c.execute('select count(*),sum(points) from results').fetchone()==xp
        assert c.execute('select month,standings,scoring_version from monthly_competition_rounds order by month').fetchall()==closed
        assert c.execute('select points from monthly_competition_days where player_id=%s',(ids[0],)).fetchone()[0]==75
    def mine(pid):
        with connect() as c:
            clock(c,'2027-01-31 18:00:00 Europe/Prague');c.execute('set role service_role')
            return c.execute('select proplet_monthly_state_v1(%s,%s)',(pid,month)).fetchone()[0]
    # Exact approved independence curve and no residual clean/hint bonus.
    for h in range(7):
        submit(ids[h],month+timedelta(days=1),hints=h,clean=False if h==0 else None)
        s=mine(ids[h]);d=next(d for d in s['me']['days'] if d['date']=='2027-01-02')
        assert s['scoringVersion']==3 and s['rulesVersion']=='monthly-independence-v3'
        assert d['independencePoints']==max(25-5*h,0) and d['points']==55+max(25-5*h,0),d
        assert d['completionPoints']==55 and d['cleanPoints']==d['hintPoints']==d['speedPoints']==0
    # Corrupt legacy count must not label actual level>0 assistance as no hints.
    try:
        submit(ids[7],month+timedelta(days=2),hints=0,level=1,clean=False)
        raise AssertionError('inconsistent assistance accepted by atomic boundary')
    except psycopg.errors.RaiseException as exc:
        assert 'RESULT_COMMAND_INVALID' in str(exc)
    submit(ids[7],month+timedelta(days=2),hints=1,level=1,clean=False)
    with connect() as c:
        c.execute('update results set hints_used=0 where player_id=%s',(ids[7],))

    d=mine(ids[7])['me']['days'][0]
    assert d['hints']==1 and d['independencePoints']==20 and d['points']==75
    # Unchanged canonical verified cohort: singleton10, fastest20, slowest0.
    day=month+timedelta(days=3)
    submit(ids[8],day,hints=1,verified=True,elapsed=15000)
    assert mine(ids[8])['me']['points']==85
    submit(ids[9],day,hints=2,verified=True,elapsed=30000)
    submit(ids[10],day,hints=3,verified=True,elapsed=45000)
    assert [mine(p)['me']['points'] for p in ids[8:]]==[95,80,65]
    # Best20 chooses clean only as a tie breaker, never as an extra point bonus.
    best=player()
    for i in range(26):submit(best,month+timedelta(days=i),hints=0 if i<=20 else 1,clean=False if i==0 else None)
    s=mine(best);me=s['me']
    assert me['validDays']==26 and me['countedDays']==20 and me['dailyPoints']==1600 and me['cleanCount']==20 and me['hintCount']==0
    assert me['days'][0]['points']==80 and not me['days'][0]['counted']
    with connect() as c:
        clock(c,'2027-01-31 18:00:00 Europe/Prague');c.execute('set role service_role')
        c.execute('select proplet_reconcile_monthly_competition_v1(%s)',(month,))
    assert mine(best)['me']==me
    # Existing v2 closed month still recomputes with its old formula at cfg3.
    with connect() as c:
        r=c.execute('select month,player_id,daily_date from monthly_competition_days where month=%s order by daily_date limit 1',(v2[0],)).fetchone()
        revision=c.execute('select revision from monthly_competition_rounds where month=%s',(v2[0],)).fetchone()[0]
        clock(c,'2027-02-03 00:00:00 Europe/Prague');c.execute('set role service_role')
        receipt=c.execute('select proplet_correct_monthly_competition_v1(%s,%s,%s,%s,%s,%s,%s)',(*r,revision,'independence-legacy-review','qa-operator','Verify original v2 formula remains versioned')).fetchone()[0]
        assert receipt['scoringVersion']==2
        assert c.execute('select distinct scoring_version from monthly_competition_days where month=%s',(v2[0],)).fetchall()==[(2,)]
        assert c.execute('select proplet_monthly_state_v1(null,%s)',(v2[0],)).fetchone()[0]['scoringVersion']==2
        assert c.execute('select proplet_finalize_monthly_competition_v1()').fetchone()[0]['finalized']==1
        assert c.execute('select scoring_version from monthly_competition_rounds where month=%s',(month,)).fetchone()[0]==3
        seed=c.execute('select seed from proplet_private.monthly_draws where month=%s',(month,)).fetchone()[0]
        result=c.execute('select proplet_correct_monthly_competition_v1(%s,%s,%s,1,%s,%s,%s)',(month,best,month,'independence-v3-review','qa-operator','Verify closed v3 independence correction')).fetchone()[0]
        assert result['scoringVersion']==3 and result['dayPoints']==80 and result['drawSeed']==str(seed)
    report['checks'].append('v3 native: 0..6 hints 25/20/15/10/5/0/0; clean bonus removed; actual max-level help normalized; verified cohort unchanged; best20+clean tie; activation/reconcile retry no XP; v2 closed correction preserved; v3 final snapshot/correction reuse draw')
