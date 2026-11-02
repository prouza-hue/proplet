"""Quality-v2 acceptance, called after the historical v1 upgrade fixture.

Every source uses native atomic RPCs in the already verified disposable loopback
DB. Logical dates come from the existing marked isolated QA clock only.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date,timedelta
import json
import threading
import uuid
from psycopg.types.json import Jsonb
import psycopg
from backend.contracts import ResultCreate
from backend.results import build_command,result_identity


def run_quality_acceptance(base_connect,report):
    month=date(2026,12,1)
    end=date(2027,1,1)
    marker=json.dumps({'x-proplet-monthly-preview':'codex/monthly-competition-202611'})
    def connect():
        c=base_connect()
        c.execute("select set_config('request.headers',%s,false)",(marker,))
        return c
    def clock(c,stamp):
        c.execute('update monthly_competition_settings set preview_now=%s,preview_anchor_at=null', (stamp,))
    def player(c,label):
        pid=str(uuid.uuid4())
        c.execute('insert into players(id,name,family_code,token_hash) values(%s,%s,%s,%s)',(pid,label[:20],'SOLO_QUALITY_QA','quality-'+pid))
        return pid
    with connect() as c:
        c.execute("update monthly_competition_settings set isolated=true,enabled=true,rules_approved=true,launch_month=least(launch_month,%s),preview_anchor_at=null",(month,))
        clock(c,'2026-12-30 18:00:00 Europe/Prague')
        c.execute('update fair_play_policy set enabled=true,daily_from=%s',(month,))
        ids=[player(c,'Quality '+str(i)) for i in range(12)]
        assert not c.execute("select has_function_privilege('service_role','proplet_private.rebuild_monthly_quality_v2(date,date)','execute')").fetchone()[0]
        for role in ('anon','authenticated'):
            assert not c.execute("select has_table_privilege(%s,'proplet_private.monthly_draws','select')",(role,)).fetchone()[0]
            assert not c.execute("select has_function_privilege(%s,'proplet_monthly_standings_quality_v2(date)','execute')",(role,)).fetchone()[0]
    def command(pid,day,*,elapsed=15000,hints=0,mode='daily',xp=100,unverified=False,calm=False,suffix='',received=None,completed=None):
        attempt='quality-'+str(uuid.uuid4())
        key='daily:'+str(day) if mode=='daily' else mode+':quality-'+str(day)+suffix
        puzzle='quality-'+str(day)+('-'+mode+suffix if mode!='daily' else '')
        payload=ResultCreate(puzzle_id=puzzle,challenge_key=key,mode=mode,difficulty='easy',daily_date=str(day) if mode=='daily' else None,
          elapsed_ms=elapsed,moves=12,hints_used=hints,max_hint_level=1 if hints else 0,clean_solve=not hints,
          attempt_id=attempt,completed_at=completed or str(day)+'T12:00:00+01:00',timing_unverified=unverified,calm_mode=calm)
        cmd=build_command(result_identity(pid,payload),payload,completed_at=payload.completed_at,points=xp,content_generation=6,
          free_level=1 if mode=='free' else None,legacy_reward_slot=None,team_code_at_completion=None)
        with connect() as c:
            clock(c,str(day)+' 12:00:00 Europe/Prague')
            if not unverified and mode=='daily':
                owner=str(uuid.uuid4())
                progress={'elapsedMs':0,'moves':0,'found':[]}
                c.execute('select proplet_play_session_v1(%s,%s,%s,%s,%s,%s,%s,1,%s,%s)',
                  ('p:'+pid,pid,key,puzzle,mode,attempt,owner,'open',Jsonb(progress)))
                progress.update(elapsedMs=elapsed,moves=12,hints=hints,maxHintLevel=1 if hints else 0,calmMode=calm)
                result=c.execute('select proplet_play_session_v1(%s,%s,%s,%s,%s,%s,%s,2,%s,%s)',
                  ('p:'+pid,pid,key,puzzle,mode,attempt,owner,'finish',Jsonb(progress))).fetchone()[0]
                assert result['verified'] and result['finished'],result
            if received:clock(c,received)
            c.execute('set role service_role')
            if unverified:
                receipt=c.execute('select proplet_submit_offline_result_v1(%s)',(Jsonb(cmd),)).fetchone()[0]
            else:
                receipt=c.execute('select proplet_submit_result_v1(%s,%s,%s,%s,%s)',
                  (pid,cmd['idempotencyKey'],cmd['requestDigest'],cmd['commandDigest'],Jsonb(cmd))).fetchone()[0]
        return cmd,receipt
    def state(pid):
        with connect() as c:
            clock(c,'2026-12-31 18:00:00 Europe/Prague')
            c.execute('set role service_role')
            return c.execute('select proplet_monthly_state_v1(%s,%s)',(pid,month)).fetchone()[0]
    def mine(pid):return state(pid)['me']
    # Canonical score singleton10 and exact same-day relative best-position ranks.
    first,first_receipt=command(ids[0],month)
    assert mine(ids[0])['points']==120 and state(ids[0])['scoringVersion']==1
    with connect() as c:
        xp_before=c.execute('select sum(points) from results').fetchone()[0]
        c.execute('set role service_role')
        assert c.execute('select proplet_activate_monthly_quality_v2()').fetchone()[0]['scoringVersion']==2
        assert c.execute('select proplet_activate_monthly_quality_v2()').fetchone()[0]['scoringVersion']==2
        assert c.execute('select sum(points) from results').fetchone()[0]==xp_before
    assert mine(ids[0])['points']==90
    command(ids[1],month,elapsed=30000)
    command(ids[2],month,elapsed=45000)
    assert [mine(p)['points'] for p in ids[:3]]==[100,90,80]
    command(ids[3],month,elapsed=15000)
    assert [mine(p)['points'] for p in ids[:4]]==[100,86.7,80,100]
    command(ids[4],month,unverified=True)
    assert mine(ids[4])['points']==80 and mine(ids[4])['verifiedTimeMs'] is None
    command(ids[5],month,elapsed=30000,hints=1)
    own=mine(ids[5]);d=own['days'][0]
    assert d['completionPoints']==55 and d['cleanPoints']==0 and d['hintPoints']==7 and d['speedPoints']==10
    assert own['points']==72 and d['verifiedTimeMs']==30000
    command(ids[6],month,calm=True)
    assert mine(ids[6])['validDays']==0
    with connect() as c:
        c.execute('set role service_role')
        replay=c.execute('select proplet_submit_result_v1(%s,%s,%s,%s,%s)',
          (first['playerId'],first['idempotencyKey'],first['requestDigest'],first['commandDigest'],Jsonb(first))).fetchone()[0]
        assert replay==first_receipt
    report['checks'].append('v2 explicit activation retries retrocompute existing v1 day120 to quality90 without XP writes; real verified sessions: singleton10; same-day best-position percentile; equal times; hints/clean subparts; offline no speed; calm excluded; replay stable')
    # Best20 stable equal daily choices, not simply all completions.
    for i in range(1,25):command(ids[0],month+timedelta(days=i),hints=1 if i<6 else 0)
    own=mine(ids[0]);assert own['validDays']==25 and own['countedDays']==20
    assert own['cleanCount']==20 and own['hintCount']==0
    assert sum(d['counted'] for d in own['days'])==20
    chosen=[d['date'] for d in own['days'] if d['counted']]
    assert chosen==[d['date'] for d in mine(ids[0])['days'] if d['counted']]
    assert all(d['provisional'] for d in own['days'])
    with connect() as c:max_peer=player(c,'Quality cap verified peer')
    for i in [0,*range(6,25)]:command(max_peer,month+timedelta(days=i))
    assert mine(ids[0])['dailyPoints']==2000
    command(ids[0],month,mode='free',xp=6000,suffix='total-cap')
    assert mine(ids[0])['points']==2500 and mine(ids[0])['otherPoints']==500

    report['checks'].append('v2 best20 of25, quality/stable date selection, clean/hints totals only chosen days, live provisional evidence')
    # Only newly earned approved game XP, earned in this month, with exact
    # rounded aggregate /12, cap, receipt/player ownership and current source.
    command(ids[7],month,mode='free',xp=1,suffix='one')
    assert mine(ids[7])['otherPoints']==0.1
    command(ids[7],month,mode='tajenka',xp=5,suffix='five')
    assert mine(ids[7])['otherPoints']==0.5
    command(ids[7],month,mode='starter',xp=999,suffix='training')
    assert mine(ids[7])['otherEarnedXp']==6
    # Account/referral/recovery rewards never enter other XP.
    with connect() as c:
        for key,typ in [('account_creation_quality','account'),('referral_quality','referral'),('word_discovery_recovery_v1:quality','word_discovery'),('word_discovery_v1:quality:slovo','word_discovery')]:
            c.execute('insert into account_rewards(id,player_id,reward_key,points,reward_type,granted_at) values(%s,%s,%s,5000,%s,%s)',
              (str(uuid.uuid4()),ids[7],key,typ,'2026-12-01 12:00:00+01'))
    assert mine(ids[7])['otherEarnedXp']==6
    command(ids[7],month,mode='free',xp=5994,suffix='cap')
    assert mine(ids[7])['otherPoints']==500 and mine(ids[7])['otherCreditedXp']==6000
    command(ids[7],month,mode='free',xp=120,suffix='beyond')
    assert mine(ids[7])['otherEarnedXp']==6120 and mine(ids[7])['otherPoints']==500
    command(ids[7],date(2026,11,30),mode='free',xp=1000,suffix='past',unverified=True,received='2026-12-02 12:00:00 Europe/Prague')
    assert mine(ids[7])['otherEarnedXp']==6120
    xp_cmd,_=command(ids[8],month,mode='free',xp=120,suffix='owned')
    assert mine(ids[8])['otherPoints']==10
    with connect() as c:
        c.execute("update result_commands set receipt=jsonb_set(receipt,'{transferredSlot}','true') where idempotency_key=%s",(xp_cmd['idempotencyKey'],))
    assert mine(ids[8])['otherPoints']==0
    with connect() as c:
        c.execute("update result_commands set receipt=jsonb_set(receipt,'{transferredSlot}','false'),player_id=%s where idempotency_key=%s",(ids[9],xp_cmd['idempotencyKey']))
    assert mine(ids[8])['otherPoints']==0 and mine(ids[9])['otherPoints']==0
    # Official Extra uses its real content binding/session and dedicated atomic
    # writer, not a fabricated generic-mode receipt.
    with connect() as c:
        clock(c,'2026-12-02 12:00:00 Europe/Prague')
        c.execute('update daily_specials_policy set enabled=true')
        binding=c.execute("select challenge_key,puzzle_id,difficulty,content_hash from monthly_preview_daily_special_bindings where daily_date='2026-12-02'").fetchone()
        assert binding is not None
        key,puzzle,difficulty,content_hash=binding
        attempt='quality-extra-'+str(uuid.uuid4());owner=str(uuid.uuid4())
        for sequence,action,elapsed in ((1,'open',0),(2,'finish',3000)):
            finished=c.execute('select proplet_play_session_v1(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
              ('p:'+ids[8],ids[8],key,puzzle,'daily_special',attempt,owner,sequence,action,Jsonb({'elapsedMs':elapsed,'moves':12,'found':[]}))).fetchone()[0]
        assert finished['finished'] and finished['verified'],finished
        # The current fair-play RPC deliberately uses wall-clock session stamps.
        # Place this owned, verified finish on the synthetic QA calendar before
        # Extra's writer derives its authoritative completion time from it.
        updated=c.execute('update play_sessions set last_seen=proplet_monthly_preview_clock_v1() '
          'where actor_key=%s and player_id=%s and challenge_key=%s and puzzle_id=%s '
          'and attempt_id=%s and owner_id=%s and finished and verified '
          'and proplet_monthly_preview_trusted_v1() returning last_seen',
          ('p:'+ids[8],ids[8],key,puzzle,attempt,owner))
        assert updated.rowcount==1
        session=updated.fetchone()
        assert session[0].date()==date(2026,12,2),session
        payload=ResultCreate(puzzle_id=puzzle,challenge_key=key,mode='daily_special',difficulty=difficulty,daily_date='2026-12-02',
          content_hash=content_hash,elapsed_ms=3000,moves=12,attempt_id=attempt,completed_at='2026-12-02T12:00:00+01:00',clean_solve=True)
        cmd=build_command(result_identity(ids[8],payload),payload,completed_at=payload.completed_at,points=200,content_generation=6,free_level=None,legacy_reward_slot=None,team_code_at_completion=None)
        cmd.update(contentHash=content_hash,specialPractice=False,specialPreviewDate=None)
        c.execute('set role service_role')
        receipt=c.execute('select proplet_submit_daily_special_v1(%s,%s,%s,%s,%s)',(ids[8],cmd['idempotencyKey'],cmd['requestDigest'],cmd['commandDigest'],Jsonb(cmd))).fetchone()[0]
        assert receipt['awardedPoints']==200
        assert c.execute('select proplet_submit_daily_special_v1(%s,%s,%s,%s,%s)',(ids[8],cmd['idempotencyKey'],cmd['requestDigest'],cmd['commandDigest'],Jsonb(cmd))).fetchone()[0]==receipt
        source=c.execute('select pr.completed_at,r.completed_at,rc.committed_at '
          'from puzzle_runs pr join result_commands rc on rc.id=pr.result_command_id and rc.player_id=pr.player_id '
          'join results r on r.player_id=pr.player_id and r.challenge_key=pr.challenge_key and r.puzzle_id=pr.puzzle_id and r.mode=pr.mode '
          'where pr.player_id=%s and pr.attempt_id=%s',(ids[8],attempt)).fetchone()
        assert source==(session[0],session[0],session[0]),source
    own=mine(ids[8])
    assert own['otherEarnedXp']==200 and own['otherPoints']==16.7 and own['dailyPoints']==0,own
    report['checks'].append('v2 other XP: actual first receipts free/tajenka/official bound Extra with receipt replay; starter/account/referral/discovery/recovery/basicDaily excluded; /12 rounded aggregate; 6000 cap; old completed month excluded; transferred slots/player ownership fail closed')
    # Late original-day offline qualifies through exact close, and adding an
    # accepted timed peer changes that whole day without any daily lockout.
    late_day=date(2026,12,30)
    command(ids[10],late_day,unverified=True,hints=1,received='2027-01-02 23:59:59 Europe/Prague')
    assert mine(ids[10])['points']==62
    command(ids[11],late_day,unverified=True,received='2027-01-03 00:00:00 Europe/Prague')
    assert mine(ids[11])['points']==0
    command(ids[11],late_day,mode='free',xp=120,suffix='exact-cutoff',unverified=True,received='2027-01-03 00:00:00 Europe/Prague')
    assert mine(ids[11])['otherPoints']==0
    # Fully equal live contenders explicitly await one final audited draw.
    command(ids[9],date(2026,12,29),unverified=True)
    command(ids[11],date(2026,12,29),unverified=True)
    assert mine(ids[9])['drawPending'] and mine(ids[11])['drawPending']
    assert mine(ids[9])['rank']==mine(ids[11])['rank']
    with connect() as c:
        source_xp=c.execute('select sum(points) from results').fetchone()[0]
        clock(c,'2027-01-02 23:59:59 Europe/Prague')
        assert c.execute('select proplet_finalize_monthly_competition_v1()').fetchone()[0]['finalized']==0
        clock(c,'2027-01-03 00:00:00 Europe/Prague')
    barrier=threading.Barrier(8)
    def finalize(_):
        with connect() as c:
            c.execute('set role service_role');barrier.wait(timeout=20)
            return c.execute('select proplet_finalize_monthly_competition_v1()').fetchone()[0]
    with ThreadPoolExecutor(max_workers=8) as pool:closures=list(pool.map(finalize,range(8)))
    assert sum(r['finalized'] for r in closures)==1
    with connect() as c:
        frozen=c.execute('select standings from monthly_competition_rounds where month=%s',(month,)).fetchone()[0]
        seed=c.execute('select seed from proplet_private.monthly_draws where month=%s',(month,)).fetchone()[0]
        assert len({r['rank'] for r in frozen})==len(frozen)
        assert [r['rank'] for r in frozen[:3]]==[1,2,3]
        assert all(not r['drawPending'] for r in frozen)
        assert c.execute('select array_agg(rank order by rank) from monthly_competition_badges where month=%s',(month,)).fetchone()[0]==[1,2,3]
        assert c.execute('select proplet_finalize_monthly_competition_v1()').fetchone()[0]['finalized']==0
        assert c.execute('select standings from monthly_competition_rounds where month=%s',(month,)).fetchone()[0]==frozen
        assert c.execute('select sum(points) from results').fetchone()[0]==source_xp
        c.execute('update results set hints_used=1,max_hint_level=1,clean_solve=false where player_id=%s and daily_date=%s',(ids[0],month))
        assert c.execute('select standings from monthly_competition_rounds where month=%s',(month,)).fetchone()[0]==frozen
    report['checks'].append('v2 accepted offline review-close cutoff exact; complete final cohort rebuild; 8 concurrent finalizers once; unique 1/2/3; immutable one seed; repeat preserves snapshot and XP')
    def correct(rev,key):
        with connect() as c:
            c.execute('set role service_role')
            return c.execute('select proplet_correct_monthly_competition_v1(%s,%s,%s,%s,%s,%s,%s)',
              (month,ids[0],month,rev,key,'quality-operator','Verified correction of monthly official result')).fetchone()[0]
    receipt=correct(1,'quality-correction')
    assert receipt['revision']==2 and receipt['scoringVersion']==2 and receipt['drawSeed']==str(seed)
    assert correct(1,'quality-correction')==receipt
    with connect() as c:
        assert c.execute('select seed from proplet_private.monthly_draws where month=%s',(month,)).fetchone()[0]==seed
        assert c.execute('select sum(points) from results').fetchone()[0]==source_xp
        assert c.execute('select count(*) from proplet_private.monthly_corrections where month=%s',(month,)).fetchone()[0]==1
        assert c.execute('select count(distinct rank),count(*) from monthly_competition_badges where month=%s',(month,)).fetchone()==(3,3)
    try:correct(1,'quality-stale-correction');raise AssertionError('stale correction accepted')
    except psycopg.errors.SerializationFailure:pass
    report['checks'].append('v2 audited closed correction: full cohort, unique badges, exact replay, CAS conflict, same draw seed, gameplay XP untouched')
    # Isolate rank ordering from source ingestion: trusted synthetic ledger rows
    # deliberately collide on every score key. The native-source cases above
    # prove how these fields are produced; this verifies the advertised priority.
    with connect() as c:
        c.execute('begin')
        rank_month=date(2027,2,1)
        rank_ids=[player(c,'Rank key '+str(i)) for i in range(108)]
        for i,pid in enumerate(rank_ids):
            # First six tie on total+daily. Exact equal first two, then clean,
            # hints, verified elapsed; unknown must never act like elapsed zero.
            clean=i<2
            hints=0 if i!=3 else 1
            elapsed=1000 if i<3 else 2000 if i==4 else None
            points=100 if i<6 else 99-(i-6)/10
            c.execute('insert into monthly_competition_days(month,player_id,daily_date,result_id,command_id,run_id,points,confirmed_at,scoring_version,clean,hints,verified_time_ms) values(%s,%s,%s,%s,%s,%s,%s,now(),2,%s,%s,%s)',
              (rank_month,pid,rank_month,str(uuid.uuid4()),str(uuid.uuid4()),str(uuid.uuid4()),points,clean,hints,elapsed))
        # Same visible total, different Daily subtotal: Daily wins first.
        a,b=player(c,'Daily priority A'),player(c,'Daily priority B')
        priority_month=date(2027,3,1)
        clock(c,'2027-03-01 18:00:00 Europe/Prague')
        for pid,pts in ((a,100),(b,90)):
            c.execute('insert into monthly_competition_days(month,player_id,daily_date,result_id,command_id,run_id,points,confirmed_at,scoring_version) values(%s,%s,%s,%s,%s,%s,%s,now(),2)',
              (priority_month,pid,priority_month,str(uuid.uuid4()),str(uuid.uuid4()),str(uuid.uuid4()),pts))
        payload=ResultCreate(puzzle_id='priority-free',challenge_key='free:priority-free',mode='free',difficulty='easy',elapsed_ms=15000,moves=12,
          attempt_id='quality-priority-'+str(uuid.uuid4()),completed_at='2027-03-01T12:00:00+01:00',clean_solve=True)
        cmd=build_command(result_identity(b,payload),payload,completed_at=payload.completed_at,points=120,content_generation=6,free_level=1,legacy_reward_slot=None,team_code_at_completion=None)
        c.execute('select proplet_submit_result_v1(%s,%s,%s,%s,%s)',(b,cmd['idempotencyKey'],cmd['requestDigest'],cmd['commandDigest'],Jsonb(cmd)))
        priority=c.execute('select proplet_monthly_standings_v1(%s)',(priority_month,)).fetchone()[0]
        assert [(r['playerId'],r['points'],r['dailyPoints'],r['rank']) for r in priority]==[(a,100,100,1),(b,100,90,2)]
        assert all(r['tieBreakReason']=='dailyPoints' for r in priority)
        rows=c.execute('select proplet_monthly_standings_v1(%s)',(rank_month,)).fetchone()[0]
        positions={r['playerId']:r for r in rows}
        assert positions[rank_ids[0]]['rank']==positions[rank_ids[1]]['rank']==1
        assert positions[rank_ids[0]]['drawPending'] and positions[rank_ids[1]]['drawPending']
        assert positions[rank_ids[2]]['rank']==3
        assert positions[rank_ids[4]]['rank']==4
        assert positions[rank_ids[5]]['rank']==5
        assert positions[rank_ids[3]]['rank']==6
        assert positions[rank_ids[4]]['tieBreakReason']=='verifiedTime'
        assert positions[rank_ids[3]]['tieBreakReason']=='hintCount'
        # SQL ranks the complete cohort before public top100 slicing.
        assert len(rows)==108 and positions[rank_ids[-1]]['rank']==108
        from backend.monthly_competition import state as serialize
        raw=c.execute('select proplet_monthly_state_v1(%s,%s)',(ids[0],month)).fetchone()[0]
        raw.update(month=str(rank_month),standings=rows,me={**positions[rank_ids[-1]],'days':[]},previousPodium=[])
        public=serialize(rpc=lambda *args:raw,player_id=rank_ids[-1],month=str(rank_month),players=lambda p:[],identity=lambda *args:{'name':'Anonym','avatar':'X','anonymous':True})
        assert len(public['standings'])==101 and public['standings'][-1]['rank']==108 and public['me']['rank']==108
        assert not any('playerId' in r for r in public['standings'])
        c.execute('rollback')
    report['checks'].append('v2 SQL rank priority: total/daily/clean/hints/verified time; unknown never zero; exact live equality pending; 108 players ranked before top100 plus own108 privacy serialization')
    return {'month':str(month),'players':len(ids)+1,'seedStable':True,'finalRanksUnique':True}
