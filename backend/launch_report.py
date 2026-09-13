"""Launch metrics over database-compacted histories, with explicit cohort semantics."""
from datetime import datetime, timedelta
from statistics import median
from zoneinfo import ZoneInfo

TZ = ZoneInfo('Europe/Prague')
ONBOARDING = 'board-v2'
ACTIVE_EVENTS = {'app_open','app_session_started','onboarding_started','starter_started','starter_completed','tajenka_started','tajenka_completed'}
PLAY_EVENTS = {'starter_started','starter_completed','tajenka_started','tajenka_completed','tajenka_word_found'}


def stamp(value):
    if not value:
        return None
    parsed = datetime.fromisoformat(str(value).replace('Z','+00:00'))
    return parsed.replace(tzinfo=TZ) if parsed.tzinfo is None else parsed.astimezone(TZ)


def ratio(n, d):
    return round(n/d,3) if d else None


def build_launch_report(data, now):
    now = now.astimezone(TZ)
    today = now.date()
    actors = []
    versions = {}
    for raw in data.get('actors',[]):
        events = {name:[stamp(t) for t in values] for name,values in raw['events'].items()}
        raw_attempts = [dict(zip(('started_at','completed_at','last_activity_at','mode','difficulty','app_version'),a)) if isinstance(a,list) else a for a in raw['attempts']]
        attempts = [{**a, **{k:stamp(a.get(k)) for k in ('started_at','completed_at','last_activity_at')}} for a in raw_attempts]
        active, played = set(), set()
        for name, times in events.items():
            if name in ACTIVE_EVENTS:
                active.update(times)
            if name in PLAY_EVENTS:
                played.update(times)
        for a in attempts:
            times = {a[k] for k in ('started_at','completed_at','last_activity_at') if a[k] and a[k]<=now}
            active.update(times); played.update(times)
            if a['started_at']>=now-timedelta(days=7):
                v=a.get('app_version') or 'neznámá';versions[v]=versions.get(v,0)+1
        actors.append({**raw,'events':events,'attempts':attempts,'active':active,'played':played,
                       'first_seen':stamp(raw.get('first_seen')),'onboarding':stamp(raw.get('onboarding'))})

    def retention(cohort, day, playing=False):
        eligible=retained=0
        for a in cohort:
            first=a['first_seen']
            if first is None:
                continue
            target=first.date()+timedelta(days=day)
            # Today's return day is incomplete, even if someone has already returned.
            if target>=today:
                continue
            eligible+=1
            retained+=target in {t.date() for t in a['played' if playing else 'active']}
        return {'eligible':eligible,'retained':retained,'rate':ratio(retained,eligible),'closedDaysOnly':True}

    def window(cutoff):
        visitors=[a for a in actors if any(t>=cutoff for t in a['active'])]
        cohort=[a for a in actors if a['onboarding'] and a['onboarding']>=cutoff and a['first_seen'] and a['first_seen']>=cutoff and a['onboarding']-a['first_seen']<=timedelta(days=1)]

        def times(a,event,after=None):
            floor=after or a['onboarding']
            ceiling=min(now,a['onboarding']+timedelta(hours=24))
            return [t for t in a['events'].get(event,[]) if floor<=t<=ceiling]

        def matching(event):
            return {a['key'] for a in cohort if times(a,event)}

        steps=[('starter_started','starterStarted','Spustilo trénink'),('starter_word_1_completed','starterWord1','Našlo MRAK'),
               ('starter_word_2_completed','starterWord2','Našlo JABLKO'),('starter_word_3_completed','starterWord3','Našlo ČOKOLÁDU'),
               ('starter_completed','starterCompleted','Dokončilo trénink')]
        current={a['key']:a['onboarding'] for a in cohort}
        funnel=[{'key':'onboardingStarted','label':'Začalo onboarding','count':len(current),'previousCount':None,'conversionFromPrevious':None,'dropOffCount':None,'dropOff':None}]
        for event,key,label in steps:
            previous=len(current)
            current={a['key']:min(ts) for a in cohort if a['key'] in current and (ts:=times(a,event,current[a['key']]))}
            n=len(current)
            funnel.append({'key':key,'label':label,'count':n,'previousCount':previous,'conversionFromPrevious':ratio(n,previous),'dropOffCount':previous-n,'dropOff':ratio(previous-n,previous)})
        started=matching('starter_started'); done=set(current)
        hints=started & matching('starter_hint_used')
        offers=started & matching('starter_hint_offer_shown')
        durations=[]
        real_started=set();real_done=set()
        for a in cohort:
            end=min(now,a['onboarding']+timedelta(hours=24))
            for attempt in a['attempts']:
                if a['onboarding']<=attempt['started_at']<=end and attempt['mode'] in ('daily','free'):
                    real_started.add(a['key'])
                    if attempt['completed_at'] and attempt['started_at']<=attempt['completed_at']<=end:
                        real_done.add(a['key'])
            if a['key'] in done:
                durations.append(int((current[a['key']]-min(times(a,'starter_started'))).total_seconds()*1000))
        skip=matching('onboarding_skipped_known_player')
        login=matching('onboarding_login_authenticated')
        auth=matching('account_authenticated')
        choice=matching('starter_hard_choice_shown')
        easy=choice & matching('starter_easy_warmup_selected')
        direct=choice & matching('starter_hard_direct_selected')
        warmup=easy & matching('starter_easy_warmup_completed')
        hard_started=set();hard_done=set();warmup_daily=set()
        for a in cohort:
            if a['key'] not in choice:continue
            for attempt in a['attempts']:
                if attempt['mode']=='daily' and attempt['difficulty']=='hard' and min(times(a,'starter_hard_choice_shown'))<=attempt['started_at']<=min(now,a['onboarding']+timedelta(hours=24)):
                    hard_started.add(a['key'])
                    if attempt['completed_at'] and attempt['completed_at']<=a['onboarding']+timedelta(hours=24):hard_done.add(a['key'])
                    if a['key'] in warmup and min(times(a,'starter_easy_warmup_completed'))<=attempt['started_at']:warmup_daily.add(a['key'])
        shares={}
        for mode in ('daily','level','tajenka'):
            opened=set();shared_started=set();shared_done=set();senders=set()
            for a in actors:
                if any(cutoff<=t<=now for t in a['events'].get(f'{mode}_share_created',[])):senders.add(a['key'])
                opens=[t for t in a['events'].get(f'shared_{mode}_opened',[]) if cutoff<=t<=now]
                if not opens:continue
                opened.add(a['key']);first=min(opens)
                starts=[t for t in a['events'].get(f'shared_{mode}_started',[]) if first<=t<=min(now,first+timedelta(days=7))]
                if not starts:continue
                shared_started.add(a['key'])
                if any(min(starts)<=t<=min(now,first+timedelta(days=7)) for t in a['events'].get(f'shared_{mode}_completed',[])):shared_done.add(a['key'])
            shares[mode]={'senders':len(senders),'opened':len(opened),'started':len(shared_started),'completed':len(shared_done),'smallSample':len(opened)<20,'unit':'actors-not-invitations'}
        return {'visitors':len(visitors),'shares':shares,'newcomers':len(cohort),'returningVisitors':sum(1 for a in visitors if a['first_seen'] and a['first_seen']<cutoff),
                'firstRealGameStarted':len(real_started),'firstRealGameCompleted':len(real_done),'funnel':funnel,
                'pendingConversion':sum(1 for a in cohort if a['onboarding']+timedelta(hours=24)>now),
                'branches':{'skipped':len(skip),'login':len(login),'authenticated':len(auth),'skippedActivated':len(skip & real_done),'trainedActivated':len(done & real_done)},
                'retentionD1':retention(cohort,1),'retentionD7':retention(cohort,7),'playingD1':retention(cohort,1,True),'playingD7':retention(cohort,7,True),
                'starter':{'started':len(started),'completed':len(done),'completionRate':ratio(len(done),len(started)),
                  'medianCompletionMs':int(median(durations)) if durations else None,'hintOfferShown':len(offers),'hintUsed':len(hints),'hintUseRate':ratio(len(hints),len(started)),
                  'resetActors':len(started & matching('starter_reset')),'abandoned':sum(1 for a in cohort if a['key'] in started-done-skip-login and min(times(a,'starter_started'))<=now-timedelta(minutes=30))},
                'hardDaily':{'choiceShown':len(choice),'easySelected':len(easy),'directSelected':len(direct),'easySelectionRate':ratio(len(easy),len(choice)),
                  'directSelectionRate':ratio(len(direct),len(choice)),'warmupCompleted':len(warmup),'warmupCompletionRate':ratio(len(warmup),len(easy)),
                  'warmupToDailyStarted':len(warmup_daily),'warmupToDailyRate':ratio(len(warmup_daily),len(warmup)),
                  'hardDailyStarted':len(hard_started),'hardDailyCompleted':len(hard_done),'hardDailyCompletionRate':ratio(len(hard_done),len(hard_started))}}

    reliability=data['reliability']
    last=stamp(reliability.get('lastSnapshot'))
    reliability['snapshotStale']=not last or last<now-timedelta(days=8)
    return {'generatedAt':now.isoformat(),'analyticsVersion':4,'onboardingVersion':ONBOARDING,'conversionWindowHours':24,
            'measurementStartedAt':data.get('measurementStartedAt'),'rawEvents30d':data.get('rawEvents30d'),
            'legacyEvents30d':data.get('legacyEvents30d'),'historicalDataLimited':True,
            'active':{'last24h':sum(any(t>=now-timedelta(hours=24) for t in a['active']) for a in actors),'last7d':sum(any(t>=now-timedelta(days=7) for t in a['active']) for a in actors)},
            'windows':{key:window(now-delta) for key,delta in [('24h',timedelta(hours=24)),('7d',timedelta(days=7)),('30d',timedelta(days=30))]},
            'reliability':reliability,'newAccounts24h':data.get('newAccounts24h',0),
            'appVersions7d':[{'version':v,'attempts':n} for v,n in sorted(versions.items(),key=lambda x:-x[1])[:8]]}
