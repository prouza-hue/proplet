-- Synthetic fixtures only. Executed after the actual production migration.
CREATE TEMP TABLE weekly_test_passes(name text PRIMARY KEY);
CREATE FUNCTION pg_temp.check_true(ok boolean, message text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Weekly victory check failed: %', message; END IF;
END $$;

-- Test chronology is relative to the database clock, including CI in future years.
CREATE TEMP TABLE weekly_test_clock AS
SELECT date_trunc('week', now() AT TIME ZONE 'Europe/Prague')::date AS this_week;

-- Fixtures: A and B are tied. A has an inactive private-profile member;
-- a contributor transferred A -> B during the week. C's huge private score
-- must not displace public winners. New A member joined after the period ended.
INSERT INTO public.leagues(code,name,public_name,public_opt_in,public_enabled_at) VALUES
  ('ALPHA','Alpha internal','Alpha',true,'2020-01-01'),
  ('BETA','Beta internal','Beta',true,'2020-01-01'),
  ('PRIVATE','Private secret','Private secret',false,'2020-01-01'),
  ('ZERO','Zero','Zero',true,'2020-01-01'),
  ('SOLO_TEST','Solo','Solo',true,'2020-01-01');
INSERT INTO public.leagues(code,name,public_name,public_opt_in,public_enabled_at)
SELECT 'NEWPUBLIC','New public','New public',true,
  (this_week::timestamp AT TIME ZONE 'Europe/Prague') FROM weekly_test_clock;
INSERT INTO public.players(id,name,family_code,team_joined_at,public_rankings) VALUES
  ('00000000-0000-0000-0000-000000000001','Transferred','BETA',
    ((SELECT this_week-4 FROM weekly_test_clock)::timestamp AT TIME ZONE 'Europe/Prague'),true),
  ('00000000-0000-0000-0000-000000000002','Inactive private profile','ALPHA','2020-01-01',false),
  ('00000000-0000-0000-0000-000000000003','Beta player','BETA','2020-01-01',true),
  ('00000000-0000-0000-0000-000000000004','Private team player','PRIVATE','2020-01-01',true),
  ('00000000-0000-0000-0000-000000000005','Solo player','SOLO_TEST',null,true),
  ('00000000-0000-0000-0000-000000000006','Zero player','ZERO','2020-01-01',true),
  ('00000000-0000-0000-0000-000000000007','Moved after week','BETA',
    ((SELECT this_week FROM weekly_test_clock)::timestamp AT TIME ZONE 'Europe/Prague'),true),
  ('00000000-0000-0000-0000-000000000008','New member','ALPHA',
    ((SELECT this_week FROM weekly_test_clock)::timestamp AT TIME ZONE 'Europe/Prague'),true),
  ('00000000-0000-0000-0000-000000000009','Legacy missing membership','ALPHA','2020-01-01',true),
  ('00000000-0000-0000-0000-000000000010','Explicit left membership','ALPHA','2020-01-01',true),
  ('00000000-0000-0000-0000-000000000011','New public member','NEWPUBLIC','2020-01-01',true),
  ('00000000-0000-0000-0000-000000000012','Joined after first trophy','ALPHA',
    ((SELECT this_week-6 FROM weekly_test_clock)::timestamp AT TIME ZONE 'Europe/Prague'),true);
INSERT INTO public.team_memberships(player_id,team_code,joined_at,left_at)
SELECT id,family_code,coalesce(team_joined_at,'2020-01-01'),null FROM public.players
WHERE id NOT IN ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000009');
UPDATE public.team_memberships SET left_at=((SELECT this_week-1 FROM weekly_test_clock)::timestamp AT TIME ZONE 'Europe/Prague')
WHERE player_id='00000000-0000-0000-0000-000000000010';
INSERT INTO public.team_memberships(player_id,team_code,joined_at,left_at) VALUES
  ('00000000-0000-0000-0000-000000000001','ALPHA','2020-01-01',
    ((SELECT this_week-4 FROM weekly_test_clock)::timestamp AT TIME ZONE 'Europe/Prague')),
  ('00000000-0000-0000-0000-000000000007','ALPHA','2020-01-01',
    ((SELECT this_week FROM weekly_test_clock)::timestamp AT TIME ZONE 'Europe/Prague'));

INSERT INTO public.results(player_id,points,completed_at,team_code_at_completion,calm_mode)
SELECT player_id::uuid,points,
       ((c.this_week+day_offset)::timestamp AT TIME ZONE 'Europe/Prague'),team_code,calm_mode
FROM weekly_test_clock c CROSS JOIN (VALUES
  ('00000000-0000-0000-0000-000000000001',100,-6,'ALPHA',false),
  ('00000000-0000-0000-0000-000000000001',10,-3,'BETA',false),
  ('00000000-0000-0000-0000-000000000003',90,-2,'BETA',false),
  ('00000000-0000-0000-0000-000000000004',99999,-2,'PRIVATE',false),
  ('00000000-0000-0000-0000-000000000005',99999,-2,'SOLO_TEST',false),
  ('00000000-0000-0000-0000-000000000011',99999,-2,'NEWPUBLIC',false),
  ('00000000-0000-0000-0000-000000000006',0,-2,'ZERO',false),
  ('00000000-0000-0000-0000-000000000003',99999,-2,'BETA',true),
  ('00000000-0000-0000-0000-000000000003',99999,0,'BETA',false)
) f(player_id,points,day_offset,team_code,calm_mode);
INSERT INTO public.account_rewards(player_id,points,granted_at)
SELECT '00000000-0000-0000-0000-000000000003',99999,
       ((this_week-2)::timestamp AT TIME ZONE 'Europe/Prague') FROM weekly_test_clock;

-- Feature off: neither closure nor state nor seen writes can grant anything.
SELECT pg_temp.check_true(
  public.proplet_finalize_team_victories_v1() = '{"enabled":false,"finalized":0}'::jsonb,
  'disabled finalizer is inert');
SELECT pg_temp.check_true(
  public.proplet_team_victories_state_v1('00000000-0000-0000-0000-000000000001') = '{"enabled":false}'::jsonb,
  'disabled state');
INSERT INTO weekly_test_passes VALUES ('disabled rollout is inert');

-- First whole launch week is open: old data may not create historical medals.
UPDATE public.team_victory_settings SET enabled=true,launch_date=(SELECT this_week FROM weekly_test_clock);
SET ROLE service_role;
SELECT public.proplet_finalize_team_victories_v1();
RESET ROLE;
SELECT pg_temp.check_true(NOT EXISTS(SELECT 1 FROM public.team_victory_rounds),
  'launch guard excludes prelaunch and current open weeks');
INSERT INTO weekly_test_passes VALUES ('first whole week guard');

-- Three complete weeks: empty week, Alpha wins, then A/B shared first.
UPDATE public.team_victory_settings SET launch_date=(SELECT this_week-21 FROM weekly_test_clock);
INSERT INTO public.results(player_id,points,completed_at,team_code_at_completion)
SELECT '00000000-0000-0000-0000-000000000002',30,
  ((this_week-12)::timestamp AT TIME ZONE 'Europe/Prague'),'ALPHA' FROM weekly_test_clock;
SET ROLE service_role;
SELECT public.proplet_finalize_team_victories_v1();
RESET ROLE;
SELECT pg_temp.check_true((SELECT count(*)=3 FROM public.team_victory_rounds),'all three completed weeks closed');
SELECT pg_temp.check_true((SELECT count(*)=3 FROM public.team_victory_awards),'exactly three team/week awards');
SELECT pg_temp.check_true(NOT EXISTS(SELECT 1 FROM public.team_victory_awards
  WHERE week_start=(SELECT this_week-21 FROM weekly_test_clock)), 'zero-XP week has no winner');
SELECT pg_temp.check_true((SELECT count(*)=2 AND bool_and(shared_first) AND min(xp)=100 AND max(xp)=100
  FROM public.team_victory_awards WHERE week_start=(SELECT this_week-7 FROM weekly_test_clock)),
  'equal game XP leaders share first, no arbitrary tie breaker');
SELECT pg_temp.check_true((SELECT total_gold=2 FROM public.team_victory_awards
  WHERE team_code='ALPHA' AND week_start=(SELECT this_week-7 FROM weekly_test_clock)),
  'one cumulative medal per team and winning week, not per member');
SELECT pg_temp.check_true(NOT EXISTS(SELECT 1 FROM public.team_victory_awards
  WHERE team_code IN ('PRIVATE','SOLO_TEST','ZERO','NEWPUBLIC')), 'private, solo, zero and late opt-in teams do not win');
INSERT INTO weekly_test_passes VALUES
  ('ties share first without duplicate team medals'),
  ('zero weeks receive no medals'),
  ('historical attribution and gameplay-only XP'),
  ('public opt-in eligibility and cumulative total');

-- Actual closure retries leave both snapshots and counts byte-for-byte intact.
CREATE TEMP TABLE weekly_before_retry AS
SELECT (SELECT jsonb_agg(to_jsonb(x) ORDER BY week_start) FROM public.team_victory_rounds x) AS rounds,
       (SELECT jsonb_agg(to_jsonb(x) ORDER BY week_start,team_code) FROM public.team_victory_awards x) AS awards;
SET ROLE service_role;
SELECT public.proplet_finalize_team_victories_v1();
SELECT public.proplet_finalize_team_victories_v1();
RESET ROLE;
SELECT pg_temp.check_true((SELECT rounds=(SELECT jsonb_agg(to_jsonb(x) ORDER BY week_start) FROM public.team_victory_rounds x)
 AND awards=(SELECT jsonb_agg(to_jsonb(x) ORDER BY week_start,team_code) FROM public.team_victory_awards x)
 FROM weekly_before_retry), 'idempotent retries do not change close timestamps or medals');
INSERT INTO weekly_test_passes VALUES ('retry preserves immutable snapshots');

-- Arrival after a round was finalized never edits its winner or historical score.
INSERT INTO public.results(player_id,points,completed_at,team_code_at_completion)
SELECT '00000000-0000-0000-0000-000000000003',88888,
  ((this_week-2)::timestamp AT TIME ZONE 'Europe/Prague'),'BETA' FROM weekly_test_clock;
SET ROLE service_role;
SELECT public.proplet_finalize_team_victories_v1();
RESET ROLE;
SELECT pg_temp.check_true((SELECT rounds=(SELECT jsonb_agg(to_jsonb(x) ORDER BY week_start) FROM public.team_victory_rounds x)
 AND awards=(SELECT jsonb_agg(to_jsonb(x) ORDER BY week_start,team_code) FROM public.team_victory_awards x)
 FROM weekly_before_retry), 'late score cannot rewrite finalized round');
INSERT INTO weekly_test_passes VALUES ('late submission cannot rewrite completed round');

-- End-of-week membership, not current membership, controls celebration recipients.
SELECT pg_temp.check_true((SELECT array_agg(player_id::text ORDER BY player_id) = ARRAY[
 '00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000007',
 '00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000012']
 FROM public.team_victory_recipients r JOIN public.team_victory_awards a ON a.id=r.award_id
 WHERE a.team_code='ALPHA' AND a.week_start=(SELECT this_week-7 FROM weekly_test_clock)),
 'inactive/private profile and missing-history legacy member included, newcomer and explicit departed member excluded');
SELECT pg_temp.check_true((public.proplet_team_victories_state_v1(
  '00000000-0000-0000-0000-000000000008')->'pendingAward')='null'::jsonb,
  'new member sees cabinet but no historical celebration');
SELECT pg_temp.check_true((public.proplet_team_victories_state_v1(
  '00000000-0000-0000-0000-000000000008')#>>'{team,totalGold}')::int=2,
  'cabinet persists independently of recipient membership');
INSERT INTO weekly_test_passes VALUES ('frozen recipients and new-member cabinet');
SELECT pg_temp.check_true((public.proplet_team_victories_state_v1(
 '00000000-0000-0000-0000-000000000002')#>>'{pendingAward,previousGold}')::int=0
 AND (public.proplet_team_victories_state_v1(
 '00000000-0000-0000-0000-000000000002')#>>'{pendingAward,totalGold}')::int=2,
 'return after two eligible unseen wins animates 0 to 2');
SELECT pg_temp.check_true((public.proplet_team_victories_state_v1(
 '00000000-0000-0000-0000-000000000012')#>>'{pendingAward,previousGold}')::int=1
 AND (public.proplet_team_victories_state_v1(
 '00000000-0000-0000-0000-000000000012')#>>'{pendingAward,totalGold}')::int=2,
 'joining after first trophy animates only own eligible 1 to 2');
INSERT INTO weekly_test_passes VALUES ('returning and newly joined members animate correct gold delta');

-- Acknowledgement is scoped to player AND eligible award; retry is safe.
SELECT pg_temp.check_true((public.proplet_team_victories_seen_v1(
  '00000000-0000-0000-0000-000000000008','award',
  (SELECT id FROM public.team_victory_awards WHERE team_code='ALPHA' ORDER BY week_start DESC LIMIT 1))->>'ok')::boolean=false,
  'non-recipient cannot acknowledge old award');
SET ROLE service_role;
SELECT public.proplet_team_victories_seen_v1('00000000-0000-0000-0000-000000000002','award',
  (SELECT id FROM public.team_victory_awards WHERE team_code='ALPHA' ORDER BY week_start DESC LIMIT 1));
RESET ROLE;
SELECT pg_temp.check_true((public.proplet_team_victories_state_v1(
  '00000000-0000-0000-0000-000000000002')->'pendingAward')='null'::jsonb,
  'latest celebration acknowledges older ones, no old award parade');
SELECT pg_temp.check_true((public.proplet_team_victories_seen_v1(
  '00000000-0000-0000-0000-000000000002','award',
  (SELECT id FROM public.team_victory_awards WHERE team_code='ALPHA' ORDER BY week_start DESC LIMIT 1))->>'firstSeen')::boolean=false,
  'seen retry is idempotent');
SELECT pg_temp.check_true(NOT EXISTS(SELECT 1 FROM public.team_victory_recipients
  WHERE player_id='00000000-0000-0000-0000-000000000003' AND seen_at IS NOT NULL),
  'acknowledging one member does not acknowledge others');
INSERT INTO weekly_test_passes VALUES ('identity scoped acknowledgements and no old celebration parade');

SELECT pg_temp.check_true((public.proplet_team_victories_seen_v1(
  '00000000-0000-0000-0000-000000000008','intro')->>'ok')::boolean=false,
  'intro cannot be acknowledged without earned gameplay XP');
SELECT pg_temp.check_true((public.proplet_team_victories_seen_v1(
  '00000000-0000-0000-0000-000000000001','intro')->>'firstSeen')::boolean=true,
  'eligible introduction acknowledged once');
SELECT pg_temp.check_true((public.proplet_team_victories_seen_v1(
  '00000000-0000-0000-0000-000000000001','intro')->>'firstSeen')::boolean=false,
  'intro acknowledgement idempotent');
INSERT INTO weekly_test_passes VALUES ('introduction eligibility and exactly once acknowledgement');
SELECT pg_temp.check_true((public.proplet_team_victories_seen_v1(
  '00000000-0000-0000-0000-000000000004','intro')->>'ok')::boolean=false,
  'private-team member not invited into ineligible contest');

-- The state RPC never embeds competing teams, their private names, or their members.
SELECT pg_temp.check_true(position('Private secret' IN public.proplet_team_victories_state_v1(
  '00000000-0000-0000-0000-000000000002')::text)=0,'other private team is not exposed');
SELECT pg_temp.check_true((public.proplet_team_victories_state_v1(
  '00000000-0000-0000-0000-000000000005')->'team')='null'::jsonb,'solo cabinet excluded');
SELECT pg_temp.check_true(public.proplet_team_victories_state_v1(
  '00000000-0000-0000-0000-000000000099')='{"enabled":false}'::jsonb,'unknown identity inert');
SELECT pg_temp.check_true(NOT has_function_privilege('anon','public.proplet_finalize_team_victories_v1()','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.proplet_team_victories_state_v1(uuid)','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.proplet_team_victories_seen_v1(uuid,text,uuid)','EXECUTE'),
 'RPCs cannot be called directly by public clients');
SELECT pg_temp.check_true((SELECT bool_and(relrowsecurity) FROM pg_class
 WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname LIKE 'team_victory_%'), 'RLS on every new table');
SELECT pg_temp.check_true(NOT has_table_privilege('service_role','public.team_victory_awards','UPDATE')
 AND NOT has_table_privilege('service_role','public.team_victory_awards','DELETE')
 AND NOT has_table_privilege('anon','public.team_victory_awards','SELECT'),
 'service role cannot edit medals and anonymous role cannot read tables');
INSERT INTO weekly_test_passes VALUES ('RPC, RLS and cabinet privacy boundaries');

-- DST: actual results at the exact Prague boundaries exercise production SQL.
-- Spring week is 167 hours; fall week is 169. Fixed past dates keep CI stable.
TRUNCATE public.team_victory_recipients,public.team_victory_awards,public.team_victory_rounds;
DELETE FROM public.results;
UPDATE public.team_victory_settings SET launch_date='2025-03-24';
INSERT INTO public.results(player_id,points,completed_at,team_code_at_completion) VALUES
 ('00000000-0000-0000-0000-000000000003',99999,'2025-03-23 22:59:59+00','BETA'),
 ('00000000-0000-0000-0000-000000000002',100,'2025-03-23 23:00:00+00','ALPHA'),
 ('00000000-0000-0000-0000-000000000002',10,'2025-03-30 21:59:59+00','ALPHA'),
 ('00000000-0000-0000-0000-000000000003',1000,'2025-03-30 22:00:00+00','BETA');
SET ROLE service_role;
SELECT public.proplet_finalize_team_victories_v1();
RESET ROLE;
SELECT pg_temp.check_true((SELECT team_code='ALPHA' AND xp=110 FROM public.team_victory_awards
  WHERE week_start='2025-03-24'), 'spring DST 167-hour week includes start and excludes end');
SELECT pg_temp.check_true((SELECT count(*)=8 FROM public.team_victory_rounds),
  'catch-up bounded to eight missing weeks per invocation');
SELECT pg_temp.check_true(NOT EXISTS(SELECT 1 FROM public.team_victory_rounds WHERE week_start<'2025-03-24'),
  'historical scores before launch never trigger old medals');
INSERT INTO weekly_test_passes VALUES ('Prague spring DST boundaries'),('bounded scheduler catch-up');

TRUNCATE public.team_victory_recipients,public.team_victory_awards,public.team_victory_rounds;
DELETE FROM public.results;
UPDATE public.team_victory_settings SET launch_date='2025-10-20';
INSERT INTO public.results(player_id,points,completed_at,team_code_at_completion) VALUES
 ('00000000-0000-0000-0000-000000000003',99999,'2025-10-19 21:59:59+00','BETA'),
 ('00000000-0000-0000-0000-000000000002',100,'2025-10-19 22:00:00+00','ALPHA'),
 ('00000000-0000-0000-0000-000000000002',10,'2025-10-26 22:59:59+00','ALPHA'),
 ('00000000-0000-0000-0000-000000000003',1000,'2025-10-26 23:00:00+00','BETA');
SET ROLE service_role;
SELECT public.proplet_finalize_team_victories_v1();
RESET ROLE;
SELECT pg_temp.check_true((SELECT team_code='ALPHA' AND xp=110 FROM public.team_victory_awards
  WHERE week_start='2025-10-20'), 'fall DST 169-hour week includes start and excludes end');
INSERT INTO weekly_test_passes VALUES ('Prague fall DST boundaries');
