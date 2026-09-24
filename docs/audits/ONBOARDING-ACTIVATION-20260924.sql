-- segment_sql
with ev as materialized (
select coalesce('p:'||player_id::text,'a:'||anonymous_id) actor,event_type,created_at,measurement_version,onboarding_version,environment,context,app_version,release
from public.product_events where environment in ('production','legacy') and not is_test and created_at<='2026-09-24 00:00 Europe/Prague'::timestamptz+interval '24 hours'
), atts as materialized (
select *,coalesce('p:'||player_id::text,'a:'||anonymous_id) actor from puzzle_attempts where environment in ('production','legacy') and not is_test
), firsts as (
select actor,min(stamp) first_seen from (
select actor,created_at stamp from ev where event_type in ('app_open','app_session_started','onboarding_started')
union all select actor,started_at from atts) x where actor is not null group by actor
), onboard as (
select actor,min(created_at) onboarding from ev where event_type='onboarding_started' and measurement_version=2 and onboarding_version='board-v2' and environment='production' group by actor
), cohort as (
select * from firsts join onboard using(actor) where first_seen >= '2026-09-17 00:00 Europe/Prague'::timestamptz
and onboarding >= '2026-09-17 00:00 Europe/Prague'::timestamptz and onboarding < '2026-09-24 00:00 Europe/Prague'::timestamptz
and onboarding-first_seen<=interval '24 hours'
), ce as (
select e.*,c.onboarding from ev e join cohort c using(actor) where e.created_at between c.onboarding and least(now(),c.onboarding+interval '24 hours')
), flags as (
select c.actor,c.onboarding,c.first_seen,
min(e.created_at) filter(where event_type='starter_started') ss,
min(e.created_at) filter(where event_type='starter_word_1_completed') w1,
min(e.created_at) filter(where event_type='starter_word_2_completed') w2,
min(e.created_at) filter(where event_type='starter_word_3_completed') w3,
min(e.created_at) filter(where event_type='starter_completed') sc,
bool_or(event_type='onboarding_skipped_known_player') skipped,
bool_or(event_type='onboarding_login_authenticated') logged_in
from cohort c left join ce e using(actor,onboarding) group by c.actor,c.onboarding,c.first_seen
) , af as (
select c.actor,
bool_or(a.started_at between c.onboarding and c.onboarding+interval '24 hours' and a.mode in ('daily','free')) real_started,
bool_or(a.started_at between c.onboarding and c.onboarding+interval '24 hours' and a.completed_at between a.started_at and c.onboarding+interval '24 hours' and a.mode in ('daily','free')) real_completed,
bool_or(a.completed_at>=c.onboarding and a.mode in ('daily','free')) any_later_completed
from cohort c left join atts a using(actor) group by c.actor
) select case when ss is null then 'no_starter_started' when sc is null then 'started_no_completion' else 'starter_completed' end segment,
count(*) n,
count(*) filter(where w1 is not null) word1,
count(*) filter(where w2 is not null) word2,
count(*) filter(where w3 is not null) word3,
count(*) filter(where skipped) skipped,
count(*) filter(where logged_in) logged_in,
count(*) filter(where real_started) real_started_24h,
count(*) filter(where real_completed) real_completed_24h,
count(*) filter(where any_later_completed) any_real_completed_through_now,
count(*) filter(where not coalesce(skipped,false) and not coalesce(logged_in,false) and not coalesce(real_started,false)) no_skip_login_realstart,
count(*) filter(where actor like 'p:%') current_account_identity,
percentile_cont(0.5) within group(order by extract(epoch from sc-ss)) filter(where sc is not null) median_completion_seconds
from flags left join af using(actor) group by 1 order by 1;

-- missing_sql
with ev as materialized (
select coalesce('p:'||player_id::text,'a:'||anonymous_id) actor,event_type,created_at,measurement_version,onboarding_version,environment,context,app_version,release
from public.product_events where environment in ('production','legacy') and not is_test and created_at<='2026-09-24 00:00 Europe/Prague'::timestamptz+interval '24 hours'
), atts as materialized (
select *,coalesce('p:'||player_id::text,'a:'||anonymous_id) actor from puzzle_attempts where environment in ('production','legacy') and not is_test
), firsts as (
select actor,min(stamp) first_seen from (
select actor,created_at stamp from ev where event_type in ('app_open','app_session_started','onboarding_started')
union all select actor,started_at from atts) x where actor is not null group by actor
), onboard as (
select actor,min(created_at) onboarding from ev where event_type='onboarding_started' and measurement_version=2 and onboarding_version='board-v2' and environment='production' group by actor
), cohort as (
select * from firsts join onboard using(actor) where first_seen >= '2026-09-17 00:00 Europe/Prague'::timestamptz
and onboarding >= '2026-09-17 00:00 Europe/Prague'::timestamptz and onboarding < '2026-09-24 00:00 Europe/Prague'::timestamptz
and onboarding-first_seen<=interval '24 hours'
), ce as (
select e.*,c.onboarding from ev e join cohort c using(actor) where e.created_at between c.onboarding and least(now(),c.onboarding+interval '24 hours')
), flags as (
select c.actor,c.onboarding,c.first_seen,
min(e.created_at) filter(where event_type='starter_started') ss,
min(e.created_at) filter(where event_type='starter_word_1_completed') w1,
min(e.created_at) filter(where event_type='starter_word_2_completed') w2,
min(e.created_at) filter(where event_type='starter_word_3_completed') w3,
min(e.created_at) filter(where event_type='starter_completed') sc,
bool_or(event_type='onboarding_skipped_known_player') skipped,
bool_or(event_type='onboarding_login_authenticated') logged_in
from cohort c left join ce e using(actor,onboarding) group by c.actor,c.onboarding,c.first_seen
) , missing as (select * from flags where ss is null), summary as(
select m.actor,m.onboarding,count(*) event_count,count(distinct event_type) type_count,max(created_at)-min(created_at) span,
count(*) filter(where event_type like 'starter%') starter_events,
count(*) filter(where event_type='app_open') opens,
count(*) filter(where event_type='screen_daily_viewed') today_views,
count(*) filter(where event_type='tajenka_viewed') tajenka_views,
count(*) filter(where event_type='onboarding_started') onboarding_events
from missing m join ce using(actor,onboarding) group by m.actor,m.onboarding)
select 'summary' section,jsonb_build_object('n',count(*),'any_starter_event',count(*) filter(where starter_events>0),'today_views',count(*) filter(where today_views>0),'tajenka_views',count(*) filter(where tajenka_views>0),'onboarding_repeated',count(*) filter(where onboarding_events>1),'span_under_1s',count(*) filter(where span<interval '1 second'),'span_under_5s',count(*) filter(where span<interval '5 seconds'),'span_over_60s',count(*) filter(where span>interval '60 seconds'),'span_median_seconds',percentile_cont(0.5) within group(order by extract(epoch from span))) data from summary
union all
select 'event_types',jsonb_object_agg(event_type,n) from (select event_type,count(distinct actor) n from ce join missing using(actor,onboarding) group by event_type) e
union all
select 'per_day',jsonb_agg(jsonb_build_object('day',cohort_day,'cohort',n,'no_start',ns,'started_no_completion',nc,'completed',sc)) from(select (onboarding at time zone 'Europe/Prague')::date as cohort_day,count(*) n,count(*) filter(where ss is null) ns,count(*) filter(where ss is not null and sc is null) nc,count(*) filter(where sc is not null) sc from flags group by 1 order by 1) d;

-- all_events_missing_sql
with ev as materialized (
select coalesce('p:'||player_id::text,'a:'||anonymous_id) actor,event_type,created_at,measurement_version,onboarding_version,environment,context,app_version,release
from public.product_events where environment in ('production','legacy') and not is_test and created_at<='2026-09-24 00:00 Europe/Prague'::timestamptz+interval '24 hours'
), atts as materialized (
select *,coalesce('p:'||player_id::text,'a:'||anonymous_id) actor from puzzle_attempts where environment in ('production','legacy') and not is_test
), firsts as (
select actor,min(stamp) first_seen from (
select actor,created_at stamp from ev where event_type in ('app_open','app_session_started','onboarding_started')
union all select actor,started_at from atts) x where actor is not null group by actor
), onboard as (
select actor,min(created_at) onboarding from ev where event_type='onboarding_started' and measurement_version=2 and onboarding_version='board-v2' and environment='production' group by actor
), cohort as (
select * from firsts join onboard using(actor) where first_seen >= '2026-09-17 00:00 Europe/Prague'::timestamptz
and onboarding >= '2026-09-17 00:00 Europe/Prague'::timestamptz and onboarding < '2026-09-24 00:00 Europe/Prague'::timestamptz
and onboarding-first_seen<=interval '24 hours'
), ce as (
select e.*,c.onboarding from ev e join cohort c using(actor) where e.created_at between c.onboarding and least(now(),c.onboarding+interval '24 hours')
), flags as (
select c.actor,c.onboarding,c.first_seen,
min(e.created_at) filter(where event_type='starter_started') ss,
min(e.created_at) filter(where event_type='starter_word_1_completed') w1,
min(e.created_at) filter(where event_type='starter_word_2_completed') w2,
min(e.created_at) filter(where event_type='starter_word_3_completed') w3,
min(e.created_at) filter(where event_type='starter_completed') sc,
bool_or(event_type='onboarding_skipped_known_player') skipped,
bool_or(event_type='onboarding_login_authenticated') logged_in
from cohort c left join ce e using(actor,onboarding) group by c.actor,c.onboarding,c.first_seen
) , selected as (
select c.actor,c.onboarding,c.first_seen,e.event_type,e.created_at,e.context,e.app_version,e.release
from cohort c join flags f using(actor,onboarding,first_seen) join ev e using(actor)
where f.ss is null and e.created_at between c.first_seen and c.onboarding+interval '24 hours'
), ssums as (
select actor,count(*) n,count(distinct event_type) nt,max(created_at)-min(created_at) span from selected group by actor
) select 'all_events_no_starter',jsonb_object_agg(event_type,n) from(select event_type,count(distinct actor) n from selected group by event_type) x
union all select 'all_events_span',jsonb_build_object('n',count(*),'one_event',count(*) filter(where n=1),'span_under_1s',count(*) filter(where span<interval '1 second'),'span_over_60s',count(*) filter(where span>interval '60 seconds'),'span_median_seconds',percentile_cont(0.5) within group(order by extract(epoch from span))) from ssums
union all select 'versions',jsonb_agg(jsonb_build_object('version',app_version,'onboarding_actors',n,'no_starter_actors',ns)) from(
select e.app_version,count(distinct f.actor) n,count(distinct f.actor) filter(where f.ss is null) ns
from flags f join ev e using(actor) where e.event_type='onboarding_started' and e.created_at=f.onboarding group by e.app_version) x;

-- drop_sql
with ev as materialized (
select coalesce('p:'||player_id::text,'a:'||anonymous_id) actor,event_type,created_at,measurement_version,onboarding_version,environment,context,app_version,release
from public.product_events where environment in ('production','legacy') and not is_test and created_at<='2026-09-24 00:00 Europe/Prague'::timestamptz+interval '24 hours'
), atts as materialized (
select *,coalesce('p:'||player_id::text,'a:'||anonymous_id) actor from puzzle_attempts where environment in ('production','legacy') and not is_test
), firsts as (
select actor,min(stamp) first_seen from (
select actor,created_at stamp from ev where event_type in ('app_open','app_session_started','onboarding_started')
union all select actor,started_at from atts) x where actor is not null group by actor
), onboard as (
select actor,min(created_at) onboarding from ev where event_type='onboarding_started' and measurement_version=2 and onboarding_version='board-v2' and environment='production' group by actor
), cohort as (
select * from firsts join onboard using(actor) where first_seen >= '2026-09-17 00:00 Europe/Prague'::timestamptz
and onboarding >= '2026-09-17 00:00 Europe/Prague'::timestamptz and onboarding < '2026-09-24 00:00 Europe/Prague'::timestamptz
and onboarding-first_seen<=interval '24 hours'
), ce as (
select e.*,c.onboarding from ev e join cohort c using(actor) where e.created_at between c.onboarding and least(now(),c.onboarding+interval '24 hours')
), flags as (
select c.actor,c.onboarding,c.first_seen,
min(e.created_at) filter(where event_type='starter_started') ss,
min(e.created_at) filter(where event_type='starter_word_1_completed') w1,
min(e.created_at) filter(where event_type='starter_word_2_completed') w2,
min(e.created_at) filter(where event_type='starter_word_3_completed') w3,
min(e.created_at) filter(where event_type='starter_completed') sc,
bool_or(event_type='onboarding_skipped_known_player') skipped,
bool_or(event_type='onboarding_login_authenticated') logged_in
from cohort c left join ce e using(actor,onboarding) group by c.actor,c.onboarding,c.first_seen
) , dropactors as (select * from flags where ss is not null and sc is null and not coalesce(skipped,false) and not coalesce(logged_in,false)), details as (
select f.actor,f.ss,f.w1,f.w2,f.w3,
max(e.created_at)-f.ss event_span,
max(case when e.context->>'elapsed_ms' ~ '^[0-9]+$' then (e.context->>'elapsed_ms')::bigint end) context_max_elapsed_ms,
bool_or(e.event_type='starter_hint_offer_shown') hint_offer,
bool_or(e.event_type='starter_hint_used') hint_used,
count(*) filter(where e.event_type='starter_started') starter_start_events
from dropactors f join ce e using(actor,onboarding) group by f.actor,f.ss,f.w1,f.w2,f.w3
) select case when w3 is not null then 'word3_no_completion' when w2 is not null then 'word2_only' when w1 is not null then 'word1_only' else 'no_word' end segment,
count(*) n,count(*) filter(where hint_offer) hint_offer,count(*) filter(where hint_used) hint_used,
count(*) filter(where event_span<interval '1 second') last_event_under1s,
count(*) filter(where event_span>=interval '60 seconds') last_event_after60s,
count(*) filter(where starter_start_events>1) repeated_starter_start,
percentile_cont(0.5) within group(order by extract(epoch from event_span)) median_event_span_s,
percentile_cont(0.5) within group(order by context_max_elapsed_ms) median_max_context_elapsed_ms,
min(context_max_elapsed_ms) min_context_elapsed_ms,max(context_max_elapsed_ms) max_context_elapsed_ms
from details group by 1 order by 1;
