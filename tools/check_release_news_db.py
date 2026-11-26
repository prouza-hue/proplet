"""Real race/ACL checks inside the existing fresh, loopback-only CI database."""
from concurrent.futures import ThreadPoolExecutor
import threading
import uuid

import psycopg


def check_release_news(options):
    if options.get('host')!='127.0.0.1' or not options.get('dbname','').startswith('proplet_test_'):
        raise ValueError('Only a fresh isolated test database is supported')
    player_ids=[str(uuid.uuid4()) for _ in range(4)]
    existing,newcomer,beginner,daily_tajenka_newcomer=player_ids
    with psycopg.connect(**options) as c:
        c.execute("update monthly_competition_settings set isolated=true,preview_now='2026-10-31 22:59:59+00',preview_anchor_at=null")
        for pid,created in zip(player_ids,['2026-10-01','2026-10-31 23:00:00+00','2026-10-01','2026-11-26 23:00:00+00']):
            c.execute('insert into players(id,name,family_code,token_hash,created_at) values(%s,%s,%s,%s,%s)',
                (pid,'Release '+pid[:8],'SOLO_NEWS','fixture-'+pid,created))
            for index in range(4 if pid==beginner else 5):
                mode=['free','free','free','tajenka','free'][index]
                # No Daily date: these synthetic progress rows do not affect monthly scoring.
                c.execute('insert into results(id,player_id,puzzle_id,challenge_key,mode,difficulty,best_elapsed_ms,best_moves,points,completed_at,hints_used,calm_mode,timing_verified) values(%s,%s,%s,%s,%s,%s,5000,5,15,now(),1,true,false)',
                    (str(uuid.uuid4()),pid,'news-'+str(index),'news:'+str(index),mode,'easy'))
        rpc=lambda pid,claim=False:c.execute('select proplet_release_news_v1(%s,%s)',(pid,claim)).fetchone()[0]
        assert not rpc(existing,True)['enabled']
        c.execute("update release_news_campaigns set active=true where campaign_id='november-2026-release-v1'")
        assert not rpc(existing,True)['enabled'], 'No announcement before Prague midnight'
        c.execute("update monthly_competition_settings set preview_now='2026-10-31 23:00:00+00'")
        assert rpc(existing)['canShowAutomatically'], 'Assisted/offline/calm ordinary progress remains eligible'
        assert not rpc(newcomer,True)['eligible'], 'New account cutoff is exclusive'
        assert not rpc(beginner,True)['eligible'], 'Fewer than five completions'
        assert c.execute('select count(*) from release_news_receipts').fetchone()[0]==0, 'GET never claims'
        for role in ('anon','authenticated'):
            for table in ('release_news_campaigns','release_news_receipts'):
                assert not c.execute('select has_table_privilege(%s,%s,\'SELECT\')',(role,table)).fetchone()[0]
            assert not c.execute("select has_function_privilege(%s,'public.proplet_release_news_v1(uuid,boolean)','EXECUTE')",(role,)).fetchone()[0]
        c.commit()
    def race(statement, params):
        barrier=threading.Barrier(8)
        def claim(_):
            with psycopg.connect(**options) as c:
                c.execute('set role service_role')
                barrier.wait(timeout=30)
                return c.execute(statement,params).fetchone()[0]
        with ThreadPoolExecutor(max_workers=8) as pool:
            responses=list(pool.map(claim,range(8)))
        assert sum(row['displayGranted'] for row in responses)==1, 'Exactly one concurrent device wins'
    race('select proplet_release_news_v1(%s,true)',(existing,))
    with psycopg.connect(**options) as c:
        assert c.execute('select count(*) from release_news_receipts where player_id=%s',(existing,)).fetchone()[0]==1
        value=c.execute('select proplet_release_news_v1(%s,true)',(existing,)).fetchone()[0]
        assert value['eligible'] and not value['canShowAutomatically'] and not value['displayGranted']
        c.execute("update release_news_campaigns set active=false where campaign_id='november-2026-release-v1'")
        assert not c.execute('select proplet_release_news_v1(%s,true)',(existing,)).fetchone()[0]['enabled']
    with psycopg.connect(**options) as c:
        campaign='daily-tajenka-2026-12'
        dec=lambda pid,claim=False:c.execute('select proplet_campaign_news_v1(%s,%s,%s)',(campaign,pid,claim)).fetchone()[0]
        for role in ('anon','authenticated'):
            assert not c.execute("select has_function_privilege(%s,'public.proplet_campaign_news_v1(text,uuid,boolean)','EXECUTE')",(role,)).fetchone()[0]
        c.execute("update monthly_competition_settings set preview_now='2026-11-26 22:59:59+00'")
        assert not dec(existing,True)['enabled']
        c.execute("update monthly_competition_settings set preview_now='2026-11-26 23:00:00+00'")
        assert dec(existing)['canShowAutomatically'], 'A claim for the November release must not consume the daily Tajenka announcement'
        assert not dec(daily_tajenka_newcomer,True)['eligible'] and not dec(beginner,True)['eligible']
        assert not c.execute('select exists(select 1 from release_news_receipts where campaign_id=%s)',(campaign,)).fetchone()[0]
    race('select proplet_campaign_news_v1(%s,%s,true)',(campaign,existing))
    with psycopg.connect(**options) as c:
        assert c.execute('select count(*) from release_news_receipts where campaign_id=%s and player_id=%s',(campaign,existing)).fetchone()[0]==1
        assert not c.execute('select proplet_campaign_news_v1(%s,%s,true)',(campaign,existing)).fetchone()[0]['displayGranted']
        c.execute("update monthly_competition_settings set preview_now='2026-10-31 23:00:00+00'")
    return 'release news: separate November 1 and 27 Prague cutoffs, active campaign/returning account/five completions required; GET read-only; two eight-device races yield exactly one claim each'
