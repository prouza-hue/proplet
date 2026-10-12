-- Optional Daily specials: additive, disabled until explicit release approval.
-- Exact production definitions audited 2026-10-12. Base result/session functions
-- and their existing unique keys remain untouched. No production data rewrite.
begin;
create table if not exists public.daily_specials_policy (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 preview_date date
);
insert into public.daily_specials_policy(singleton,enabled) values(true,false) on conflict do nothing;
alter table public.daily_specials_policy enable row level security;
revoke all on public.daily_specials_policy from public,anon,authenticated;
grant select on public.daily_specials_policy to service_role;

create table if not exists public.daily_special_bindings (
 challenge_key text primary key,
 daily_date date not null unique,
 puzzle_id text not null unique,
 difficulty text not null check(difficulty in ('hardcore','mozkomor','mozkokalypsa')),
 content_hash text not null check(content_hash ~ '^[0-9a-f]{64}$'),
 bank_version text not null,
 constraint daily_special_key_check check(challenge_key='daily-special:'||daily_date::text||':'||difficulty)
);
alter table public.daily_special_bindings enable row level security;
revoke all on public.daily_special_bindings from public,anon,authenticated;
grant select on public.daily_special_bindings to service_role;
create or replace function public.proplet_daily_special_binding_immutable()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or new is distinct from old then raise exception 'DAILY_SPECIAL_BINDING_IMMUTABLE'; end if;
 return new;
end $$;
revoke all on function public.proplet_daily_special_binding_immutable() from public,anon,authenticated;
drop trigger if exists daily_special_binding_immutable on public.daily_special_bindings;
create trigger daily_special_binding_immutable before update or delete on public.daily_special_bindings
for each row execute function public.proplet_daily_special_binding_immutable();

insert into public.daily_special_bindings(challenge_key,daily_date,puzzle_id,difficulty,content_hash,bank_version) values
('daily-special:2026-10-21:hardcore','2026-10-21','g6-ds-hardcore-w01','hardcore','e1c580ae66e5338e28bfc58cbba4d49c0c31ea6ca75c53ee6288415fa7ba5b3e','daily-specials-gen6-36-v1'),
('daily-special:2026-10-23:mozkomor','2026-10-23','g6-ds-mozkomor-w01','mozkomor','a131f02ee2e9a93be8f633d1d57a5ed3849b26e9b0a665478b157d49a6c3232c','daily-specials-gen6-36-v1'),
('daily-special:2026-10-25:mozkokalypsa','2026-10-25','g6-ds-mozkokalypsa-w01','mozkokalypsa','eae0ae35a90fcc48a0d93b818189e114fe8dd29cabd4dbc74bab01a59581d664','daily-specials-gen6-36-v1'),
('daily-special:2026-10-28:hardcore','2026-10-28','g6-ds-hardcore-w02','hardcore','8ac87cf983df3f23483fa9419d632194e79f35818201702d2e29e4e328c2d859','daily-specials-gen6-36-v1'),
('daily-special:2026-10-30:mozkomor','2026-10-30','g6-ds-mozkomor-w02','mozkomor','8c72ef562110f16029e2eb9d33b518d0bba8f9fef341e153ae8b5475f014dcd4','daily-specials-gen6-36-v1'),
('daily-special:2026-11-01:mozkokalypsa','2026-11-01','g6-ds-mozkokalypsa-w02','mozkokalypsa','7aab79b3868600e84c5b4b5ea44d90f6b74c167060354dfc537a92abf7bef782','daily-specials-gen6-36-v1'),
('daily-special:2026-11-04:hardcore','2026-11-04','g6-ds-hardcore-w03','hardcore','fcdefec357b3983423b4e9a5dd09da09517a2618c625b9fba4800454cc80c302','daily-specials-gen6-36-v1'),
('daily-special:2026-11-06:mozkomor','2026-11-06','g6-ds-mozkomor-w03','mozkomor','682e383696c20cacc0f74b28a9b2e3beecf7892672fe68e5810783e54f8bb803','daily-specials-gen6-36-v1'),
('daily-special:2026-11-08:mozkokalypsa','2026-11-08','g6-ds-mozkokalypsa-w03','mozkokalypsa','5f17bdc50c76fe363651ef2b2c6aa69570918680fb01fdb30a95df372aa17fae','daily-specials-gen6-36-v1'),
('daily-special:2026-11-11:hardcore','2026-11-11','g6-ds-hardcore-w04','hardcore','14f61a9940660c0659aa19884e92faccc6a7f9c3a90dbec081499b322d3a3f67','daily-specials-gen6-36-v1'),
('daily-special:2026-11-13:mozkomor','2026-11-13','g6-ds-mozkomor-w04','mozkomor','66caa52ed351325273597c83c526735d38a4faf397e02cd6856361178e229c2d','daily-specials-gen6-36-v1'),
('daily-special:2026-11-15:mozkokalypsa','2026-11-15','g6-ds-mozkokalypsa-w04','mozkokalypsa','f498940510c3e8617502fedab7206de0656c0b6d3dc63671584bd5e9b0c7bae2','daily-specials-gen6-36-v1'),
('daily-special:2026-11-18:hardcore','2026-11-18','g6-ds-hardcore-w05','hardcore','ef07d24c9671245b8516cb5b8dc3f414cbcd3db25eef0d7fa9c57cf088425ae1','daily-specials-gen6-36-v1'),
('daily-special:2026-11-20:mozkomor','2026-11-20','g6-ds-mozkomor-w05','mozkomor','7b3543124e66531a23a4f8a34b2eca65b78d0d8136bd8ab082b70b1557f22364','daily-specials-gen6-36-v1'),
('daily-special:2026-11-22:mozkokalypsa','2026-11-22','g6-ds-mozkokalypsa-w05','mozkokalypsa','3d48c03b029f15b1f9ee76a7933f0036831138a1ffc9239cf5dd6f5e05be255f','daily-specials-gen6-36-v1'),
('daily-special:2026-11-25:hardcore','2026-11-25','g6-ds-hardcore-w06','hardcore','bae96dffb660d9085d1d066b7650b054177d9c483fab58d26123d1e17ab359c8','daily-specials-gen6-36-v1'),
('daily-special:2026-11-27:mozkomor','2026-11-27','g6-ds-mozkomor-w06','mozkomor','821eafa0170437e3de8a57724dd9fd1209e4a3d2b7e1fadf721f987171715af9','daily-specials-gen6-36-v1'),
('daily-special:2026-11-29:mozkokalypsa','2026-11-29','g6-ds-mozkokalypsa-w06','mozkokalypsa','44a772397bb8a769286fb321b517602192ce6e6e5ea1b965fbb625d6f8408847','daily-specials-gen6-36-v1'),
('daily-special:2026-12-02:hardcore','2026-12-02','g6-ds-hardcore-w07','hardcore','82dc41e74d23b0d743fa0461b1af88fb62e38d15c04981366c4234b4c7dea644','daily-specials-gen6-36-v1'),
('daily-special:2026-12-04:mozkomor','2026-12-04','g6-ds-mozkomor-w07','mozkomor','e762b655f6fb711611cdba8153e586e2107a20acebf080fc974a586b63e16ae1','daily-specials-gen6-36-v1'),
('daily-special:2026-12-06:mozkokalypsa','2026-12-06','g6-ds-mozkokalypsa-w07','mozkokalypsa','5f36580641829104a312df393b63a6d62c6803c588371cd99f8490f33585270c','daily-specials-gen6-36-v1'),
('daily-special:2026-12-09:hardcore','2026-12-09','g6-ds-hardcore-w08','hardcore','85ff9f27a842ab160f9dba325948bd70d600511b73f72f88fcec16bca5320769','daily-specials-gen6-36-v1'),
('daily-special:2026-12-11:mozkomor','2026-12-11','g6-ds-mozkomor-w08','mozkomor','ff30a7f1c3eb2f182c096b316fe849b0b53396efad8c18f2a096fde7059a93aa','daily-specials-gen6-36-v1'),
('daily-special:2026-12-13:mozkokalypsa','2026-12-13','g6-ds-mozkokalypsa-w08','mozkokalypsa','0f3a55ee991604dd5ce2360b0bcf4cc7bca7bd1ae735307dc1d246a1b8bea32a','daily-specials-gen6-36-v1'),
('daily-special:2026-12-16:hardcore','2026-12-16','g6-ds-hardcore-w09','hardcore','d8e0af00c6d854d874394c33ff1ae025bcd16e05bacd21f3e18e34ed0e8cb182','daily-specials-gen6-36-v1'),
('daily-special:2026-12-18:mozkomor','2026-12-18','g6-ds-mozkomor-w09','mozkomor','abee7c5631d187582716a4000a6d42d3efdd9650bb234d23514bf0d9f4e5bd7d','daily-specials-gen6-36-v1'),
('daily-special:2026-12-20:mozkokalypsa','2026-12-20','g6-ds-mozkokalypsa-w09','mozkokalypsa','209abf2733a2f74bfcb05f26af0c147dd842416e100ac3882623a915d2ff6de1','daily-specials-gen6-36-v1'),
('daily-special:2026-12-23:hardcore','2026-12-23','g6-ds-hardcore-w10','hardcore','e06d5165831320718f8bc1c22ce44c677bd6b57bc07e4b9c74a8f26d25115282','daily-specials-gen6-36-v1'),
('daily-special:2026-12-25:mozkomor','2026-12-25','g6-ds-mozkomor-w10','mozkomor','c15cf8d6c8012ef6265afe01c0f3a6633a64533da6c486a391106aef2a9adabc','daily-specials-gen6-36-v1'),
('daily-special:2026-12-27:mozkokalypsa','2026-12-27','g6-ds-mozkokalypsa-w10','mozkokalypsa','0cab64c168a38ab2cab9240f940223207ea138a46c92efca45589048be95fa3b','daily-specials-gen6-36-v1'),
('daily-special:2026-12-30:hardcore','2026-12-30','g6-ds-hardcore-w11','hardcore','51f3031b5434f4f3eeae941ea1a3e1279d88e228d442e1853407a8a2e72d9b54','daily-specials-gen6-36-v1'),
('daily-special:2027-01-01:mozkomor','2027-01-01','g6-ds-mozkomor-w11','mozkomor','74da443f674b6fb9a9b1f6c2a78c22c457f8f6df1ee807cab248a47f24ebd273','daily-specials-gen6-36-v1'),
('daily-special:2027-01-03:mozkokalypsa','2027-01-03','g6-ds-mozkokalypsa-w11','mozkokalypsa','1bc0de28617e662e8f166428fa7d6e91c3c9053d47352cfa2e4978af016b0f9e','daily-specials-gen6-36-v1'),
('daily-special:2027-01-06:hardcore','2027-01-06','g6-ds-hardcore-w12','hardcore','c6056a5c836f67ae1980536abfe052c31ef52c6f5c627a5ed5e043414e230581','daily-specials-gen6-36-v1'),
('daily-special:2027-01-08:mozkomor','2027-01-08','g6-ds-mozkomor-w12','mozkomor','b4464a29fbaf4d569c1d28c1114cfbbcb0ee4f848f594190911c1ae86ed35fb6','daily-specials-gen6-36-v1'),
('daily-special:2027-01-10:mozkokalypsa','2027-01-10','g6-ds-mozkokalypsa-w12','mozkokalypsa','26600c2a3001e620630f24aac79131a1efb1ce0e527ecb84ef4fe15cd1834ff4','daily-specials-gen6-36-v1')
on conflict(challenge_key) do update set daily_date=excluded.daily_date,puzzle_id=excluded.puzzle_id,difficulty=excluded.difficulty,content_hash=excluded.content_hash,bank_version=excluded.bank_version;

alter table public.results drop constraint if exists results_mode_check;
alter table public.results add constraint results_mode_check check(mode in ('daily','daily_special','free','starter','tajenka'));
alter table public.puzzle_attempts drop constraint if exists puzzle_attempts_mode_check;
alter table public.puzzle_attempts add constraint puzzle_attempts_mode_check check(mode in ('daily','daily_special','free','starter','tajenka'));
alter table public.play_sessions drop constraint if exists play_sessions_mode_check;
alter table public.play_sessions add constraint play_sessions_mode_check check(mode in ('daily','daily_special','free','tajenka'));
alter table public.results add column if not exists daily_special_content_hash text;
alter table public.puzzle_runs add column if not exists daily_special_content_hash text;
create index if not exists results_special_date_idx on public.results(daily_date,challenge_key) where mode='daily_special';

create or replace function public.proplet_daily_special_identity_guard()
returns trigger language plpgsql set search_path='' as $$
declare b public.daily_special_bindings; practice_key text;
begin
 if new.mode<>'daily_special' then return new; end if;
 select * into b from public.daily_special_bindings where puzzle_id=new.puzzle_id;
 practice_key:='daily-special-practice:'||b.daily_date::text||':'||b.difficulty||':'||b.puzzle_id;
 if b.puzzle_id is null or new.challenge_key not in(b.challenge_key,practice_key) then
  raise exception 'DAILY_SPECIAL_IDENTITY_INVALID';
 end if;
 if tg_table_name='results' then
  if new.challenge_key<>b.challenge_key or new.daily_date is distinct from b.daily_date or new.difficulty<>b.difficulty then
   raise exception 'DAILY_SPECIAL_IDENTITY_INVALID';
  end if;
  if tg_op='UPDATE' and (old.puzzle_id<>new.puzzle_id or old.challenge_key<>new.challenge_key or old.daily_date<>new.daily_date) then
   raise exception 'DAILY_SPECIAL_BINDING_IMMUTABLE';
  end if;
  new.daily_special_content_hash:=b.content_hash;
 elsif tg_table_name='puzzle_runs' then
  if new.difficulty<>b.difficulty then raise exception 'DAILY_SPECIAL_IDENTITY_INVALID'; end if;
  new.daily_special_content_hash:=b.content_hash;
 elsif tg_table_name='puzzle_attempts' then
  if new.difficulty<>b.difficulty then raise exception 'DAILY_SPECIAL_IDENTITY_INVALID'; end if;
 end if;
 return new;
end $$;
revoke all on function public.proplet_daily_special_identity_guard() from public,anon,authenticated;
drop trigger if exists results_daily_special_identity on public.results;
create trigger results_daily_special_identity before insert or update on public.results for each row execute function public.proplet_daily_special_identity_guard();
drop trigger if exists runs_daily_special_identity on public.puzzle_runs;
create trigger runs_daily_special_identity before insert or update on public.puzzle_runs for each row execute function public.proplet_daily_special_identity_guard();
drop trigger if exists attempts_daily_special_identity on public.puzzle_attempts;
create trigger attempts_daily_special_identity before insert or update on public.puzzle_attempts for each row execute function public.proplet_daily_special_identity_guard();
drop trigger if exists sessions_daily_special_identity on public.play_sessions;
create trigger sessions_daily_special_identity before insert or update on public.play_sessions for each row execute function public.proplet_daily_special_identity_guard();

create or replace function public.proplet_daily_special_timing_guard()
returns trigger language plpgsql set search_path='' as $$
declare s public.play_sessions;
begin
 if new.mode<>'daily_special' then return new; end if;
 select * into s from public.play_sessions where player_id=new.player_id and actor_key='p:'||new.player_id::text
  and challenge_key=new.challenge_key and puzzle_id=new.puzzle_id;
 new.timing_verified:=coalesce(s.finished and s.verified,false);
 if tg_table_name='puzzle_runs' then
  new.timing_verified:=coalesce(new.timing_verified and new.attempt_id=s.attempt_id,false);
  if s.finished and new.attempt_id=s.attempt_id then new.elapsed_ms:=greatest(new.elapsed_ms,s.elapsed_ms); end if;
 else
  if s.finished then new.best_elapsed_ms:=greatest(new.best_elapsed_ms,s.elapsed_ms); end if;
 end if;
 if s.finished then
  new.hints_used:=greatest(new.hints_used,coalesce((s.progress->>'hints')::int,0));
  new.max_hint_level:=greatest(new.max_hint_level,coalesce((s.progress->>'maxHintLevel')::int,0));
  new.calm_mode:=new.calm_mode or coalesce((s.progress->>'calmMode')::boolean,false);
  new.clean_solve:=new.clean_solve and new.hints_used=0 and new.max_hint_level=0;
 end if;
 return new;
end $$;
revoke all on function public.proplet_daily_special_timing_guard() from public,anon,authenticated;
drop trigger if exists results_daily_special_timing on public.results;
create trigger results_daily_special_timing before insert or update on public.results for each row execute function public.proplet_daily_special_timing_guard();
drop trigger if exists runs_daily_special_timing on public.puzzle_runs;
create trigger runs_daily_special_timing before insert on public.puzzle_runs for each row execute function public.proplet_daily_special_timing_guard();

CREATE OR REPLACE FUNCTION public.proplet_submit_daily_special_v1(p_player_id uuid, p_idempotency_key text, p_request_digest text, p_command_digest text, p_command jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
v_command_id uuid;
v_existing_request_digest text;
v_existing_command_digest text;
v_receipt jsonb;
v_mode text := p_command ->> 'mode';
v_difficulty text := p_command ->> 'difficulty';
v_puzzle_id text := p_command ->> 'puzzleId';
v_challenge_key text := p_command ->> 'challengeKey';
v_attempt_id text := nullif(p_command ->> 'attemptId', '');
v_run_attempt_id text;
v_daily_date date;
v_completed_at timestamptz;
v_elapsed_ms integer;
v_moves integer;
v_hints_used integer;
v_wrong_attempts integer;
v_max_hint_level integer;
v_points integer;
v_content_generation integer;
v_free_level integer;
v_clean_solve boolean;
v_calm_mode boolean;
v_team_code text := nullif(p_command ->> 'teamCodeAtCompletion', '');
v_reward_slot jsonb := case
when p_command -> 'legacyRewardSlot' = 'null'::jsonb then null
else p_command -> 'legacyRewardSlot'
end;
v_first_completion boolean := false;
v_attempt_status text := 'not_supplied';
v_existing_result public.results%rowtype;
v_binding public.daily_special_bindings%rowtype;
v_policy public.daily_specials_policy%rowtype;
v_session public.play_sessions%rowtype;
v_practice boolean := coalesce((p_command->>'specialPractice')::boolean,false);
v_today date;
v_end timestamptz;
v_now timestamptz:=clock_timestamp();
begin
if p_player_id is null
or p_idempotency_key is null
or char_length(p_idempotency_key) not between 8 and 240
or p_request_digest is null
or p_command_digest is null
or p_command is null
or jsonb_typeof(p_command) <> 'object'
or (p_command ->> 'contractVersion') is distinct from '1'
or (p_command ->> 'playerId') is distinct from p_player_id::text
or (p_command ->> 'idempotencyKey') is distinct from p_idempotency_key
or (p_command ->> 'requestDigest') is distinct from p_request_digest
or (p_command ->> 'commandDigest') is distinct from p_command_digest
or p_idempotency_key !~ '^(attempt:|legacy:).{1,232}$'
or p_request_digest !~ '^[0-9a-f]{64}$'
or p_command_digest !~ '^[0-9a-f]{64}$'
then
raise exception using message = 'RESULT_COMMAND_INVALID', errcode = 'P0001';
end if;
if v_mode <> 'daily_special'
or v_difficulty not in ('hardcore','mozkomor','mozkokalypsa')
or v_puzzle_id is null
or char_length(v_puzzle_id) not between 1 and 160
or v_challenge_key is null
or char_length(v_challenge_key) not between 3 and 240
then
raise exception using message = 'RESULT_COMMAND_INVALID', errcode = 'P0001';
end if;
begin
v_daily_date := nullif(p_command ->> 'dailyDate', '')::date;
v_completed_at := (p_command ->> 'completedAt')::timestamptz;
v_elapsed_ms := (p_command ->> 'elapsedMs')::integer;
v_moves := (p_command ->> 'moves')::integer;
v_hints_used := (p_command ->> 'hintsUsed')::integer;
v_wrong_attempts := (p_command ->> 'wrongAttempts')::integer;
v_max_hint_level := (p_command ->> 'maxHintLevel')::integer;
v_points := (p_command ->> 'points')::integer;
v_content_generation := nullif(p_command ->> 'contentGeneration', '')::integer;
v_free_level := nullif(p_command ->> 'freeLevel', '')::integer;
v_clean_solve := (p_command ->> 'cleanSolve')::boolean;
v_calm_mode := (p_command ->> 'calmMode')::boolean;
exception when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
raise exception using message = 'RESULT_COMMAND_INVALID', errcode = 'P0001';
end;
if v_completed_at is null
or v_elapsed_ms is null or v_elapsed_ms not between 1000 and 86400000
or v_moves is null or v_moves not between 1 and 10000
or v_hints_used is null or v_hints_used not between 0 and 99
or v_wrong_attempts is null or v_wrong_attempts not between 0 and 999
or v_max_hint_level is null or v_max_hint_level not between 0 and 3
or v_points is null or v_points not between 0 and 10000
or v_clean_solve is null
or v_calm_mode is null
or (v_hints_used = 0 and v_max_hint_level > 0)
or (v_clean_solve and v_hints_used <> 0)
or v_daily_date is null
or (v_content_generation is not null and v_content_generation < 1)
or v_reward_slot is not null
then
raise exception using message = 'RESULT_COMMAND_INVALID', errcode = 'P0001';
end if;
insert into public.result_commands (
player_id, idempotency_key, request_digest, command_digest
) values (
p_player_id, p_idempotency_key, p_request_digest, p_command_digest
)
on conflict (player_id, idempotency_key) do nothing
returning id into v_command_id;
select id, request_digest, command_digest, receipt
into v_command_id, v_existing_request_digest, v_existing_command_digest, v_receipt
from public.result_commands
where player_id = p_player_id and idempotency_key = p_idempotency_key
for update;
if v_existing_request_digest is distinct from p_request_digest
or v_existing_command_digest is distinct from p_command_digest
then
raise exception using message = 'IDEMPOTENCY_CONFLICT', errcode = 'P0001';
end if;
if v_receipt is not null then
return v_receipt;
end if;
select * into v_policy from public.daily_specials_policy where singleton;
select * into v_binding from public.daily_special_bindings where puzzle_id=v_puzzle_id;
v_today:=coalesce(v_policy.preview_date,(v_now at time zone 'Europe/Prague')::date);
v_end:=(v_binding.daily_date+1)::timestamp at time zone 'Europe/Prague';
if not coalesce(v_policy.enabled,false) or v_binding.puzzle_id is null
or (p_command->>'contentHash') is distinct from v_binding.content_hash
or v_daily_date is distinct from v_binding.daily_date
or v_difficulty is distinct from v_binding.difficulty
or v_reward_slot is not null or v_free_level is not null
or v_content_generation is distinct from 6
or v_binding.daily_date>v_today
or nullif(p_command->>'specialPreviewDate','')::date is distinct from v_policy.preview_date then
raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001';
end if;
select * into v_session from public.play_sessions where player_id=p_player_id
and actor_key='p:'||p_player_id::text and challenge_key=v_challenge_key and puzzle_id=v_puzzle_id for update;
if v_practice then
if v_challenge_key<>'daily-special-practice:'||v_daily_date::text||':'||v_difficulty||':'||v_puzzle_id
or v_binding.daily_date>v_today or v_points<>0 then
raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001';
end if;
else
if v_challenge_key<>v_binding.challenge_key or v_points<>100 or v_attempt_id is null
or not coalesce(v_session.finished,false) or v_session.attempt_id<>v_attempt_id then
raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001';
end if;
if v_binding.daily_date<v_today and (
v_policy.preview_date is not null or v_now>v_end+interval '24 hours'
or not coalesce(v_session.verified,false)
or v_session.created_at<(v_binding.daily_date::timestamp at time zone 'Europe/Prague')
or v_session.created_at>=v_end or v_session.last_seen>=v_end
) then raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001'; end if;
-- Server-proven completion time prevents client timestamps from moving XP
-- across competition periods or replacing the first official result.
v_completed_at:=v_session.last_seen;
if v_policy.preview_date is not null then
v_completed_at:=(v_policy.preview_date+(v_session.last_seen at time zone 'Europe/Prague')::time) at time zone 'Europe/Prague';
end if;
end if;
v_run_attempt_id := coalesce(v_attempt_id, 'result:' || v_command_id::text);
perform pg_advisory_xact_lock(hashtextextended(v_run_attempt_id, 8802));
if exists (select 1 from public.puzzle_runs where attempt_id = v_run_attempt_id) then
v_run_attempt_id := 'result:' || v_command_id::text;
end if;
insert into public.puzzle_runs (
id, attempt_id, result_command_id, player_id, puzzle_id, challenge_key,
mode, difficulty, elapsed_ms, moves, hints_used, wrong_attempts,
max_hint_level, clean_solve, completed_at, content_generation,
content_bank, content_level, calm_mode
) values (
gen_random_uuid(), v_run_attempt_id, v_command_id, p_player_id,
v_puzzle_id, v_challenge_key, v_mode, v_difficulty, v_elapsed_ms, v_moves,
v_hints_used, v_wrong_attempts, v_max_hint_level, v_clean_solve,
v_completed_at, v_content_generation, v_mode, v_free_level, v_calm_mode
);
if not v_practice then
insert into public.results (
id, player_id, puzzle_id, challenge_key, mode, difficulty, daily_date,
best_elapsed_ms, best_moves, points, hints_used, wrong_attempts,
max_hint_level, clean_solve, completed_at, team_code_at_completion,
content_generation, content_bank, content_level, calm_mode
) values (
gen_random_uuid(), p_player_id, v_puzzle_id, v_challenge_key,
v_mode, v_difficulty, v_daily_date, v_elapsed_ms, v_moves, v_points,
v_hints_used, v_wrong_attempts, v_max_hint_level, v_clean_solve,
v_completed_at, v_team_code, v_content_generation, v_mode, v_free_level, v_calm_mode
)
on conflict (player_id, challenge_key) do nothing
returning * into v_existing_result;
if found then
v_first_completion := true;
else
select * into v_existing_result
from public.results
where player_id = p_player_id and challenge_key = v_challenge_key
for update;
if v_existing_result.puzzle_id <> v_puzzle_id then
raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001';
end if;
if v_existing_result.puzzle_id = v_puzzle_id
and v_session.verified and v_completed_at < v_existing_result.completed_at then
update public.results set
team_code_at_completion = v_team_code,
best_elapsed_ms = v_elapsed_ms,
best_moves = v_moves,
hints_used = v_hints_used,
wrong_attempts = v_wrong_attempts,
max_hint_level = v_max_hint_level,
clean_solve = v_clean_solve,
completed_at = v_completed_at,
content_generation = v_content_generation,
content_bank = v_mode,
content_level = v_free_level,
calm_mode = v_calm_mode
where id = v_existing_result.id;
end if;
end if;
end if; -- archive practice stores a run, never an official result or XP
if v_attempt_id is not null then
perform pg_advisory_xact_lock(hashtextextended(v_attempt_id,8803));
insert into public.puzzle_attempts(id,player_id,puzzle_id,challenge_key,mode,difficulty,started_at,completed_at,elapsed_ms,moves,wrong_attempts,hints_used,max_hint_level,clean_solve,app_version,content_generation,content_bank,calm_mode)
values(v_attempt_id,p_player_id,v_puzzle_id,v_challenge_key,v_mode,v_difficulty,coalesce(v_session.created_at,v_now),v_completed_at,v_elapsed_ms,v_moves,v_wrong_attempts,v_hints_used,v_max_hint_level,v_clean_solve,'daily-special-v1',6,v_mode,v_calm_mode)
on conflict(id) do nothing;
update public.puzzle_attempts set completed_at=v_completed_at,elapsed_ms=v_elapsed_ms,moves=v_moves,
wrong_attempts=v_wrong_attempts,hints_used=v_hints_used,max_hint_level=v_max_hint_level,clean_solve=v_clean_solve,
content_generation=6,content_bank=v_mode,calm_mode=v_calm_mode
where id=v_attempt_id and player_id=p_player_id and puzzle_id=v_puzzle_id and challenge_key=v_challenge_key and mode=v_mode and difficulty=v_difficulty;
if not found then raise exception using message='RESULT_COMMAND_INVALID',errcode='P0001'; end if;
v_attempt_status:='updated_owned';
end if;
v_receipt := jsonb_build_object(
'commandId', v_command_id::text,
'practice',v_practice,
'firstCompletion', v_first_completion,
'awardedPoints', case when v_first_completion then v_points else 0 end,
'dailyGenerationUpgrade', false,
'transferredSlot', false,
'attemptStatus', v_attempt_status
);
update public.result_commands
set receipt = v_receipt, committed_at = clock_timestamp()
where id = v_command_id;
return v_receipt;
end;
$function$
;

revoke all on function public.proplet_submit_daily_special_v1(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.proplet_submit_daily_special_v1(uuid,text,text,text,jsonb) to service_role;

CREATE OR REPLACE FUNCTION public.proplet_account_snapshot_v1(p_player uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone, p_active_generation integer DEFAULT 4, p_base_levels jsonb DEFAULT '{"easy": 200, "hard": 200, "medium": 200, "hardcore": 200, "mozkomor": 100}'::jsonb, p_mozkomor_unlock_base integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with
stamp as (
  select statement_timestamp() as value,
         coalesce((select preview_date from public.daily_specials_policy where singleton and enabled),(statement_timestamp() at time zone 'Europe/Prague')::date) as today
),
player_row as (
  select p.family_code, p.team_joined_at,
         coalesce(l.name, p.family_code) as league_name
  from public.players p
  left join public.leagues l on l.code = p.family_code
  where p.id = p_player
),
normalized_results as (
  select r.*,
         coalesce(
           r.content_generation::integer,
           case when r.puzzle_id like 'g4-%' then 4 else 1 end
         ) as normalized_generation,
         coalesce(
           r.content_level,
           case
             when substring(r.puzzle_id from '([0-9]+)$') is not null
             then substring(r.puzzle_id from '([0-9]+)$')::integer
           end
         ) as normalized_level
  from public.results r
  where r.player_id = p_player
),
reward_stats as (
  select
    coalesce(sum(greatest(points, 0)), 0)::integer as reward_xp,
    coalesce(sum(greatest(points, 0)) filter (where reward_key = 'account_creation_v1'), 0)::integer as account_bonus_xp,
    coalesce(sum(greatest(points, 0)) filter (where reward_key like 'word_discovery_v1:%'), 0)::integer as word_discovery_xp,
    coalesce(sum(greatest(points, 0)) filter (where reward_key <> 'account_creation_v1' and reward_key not like 'word_discovery_v1:%'), 0)::integer as other_reward_xp,
    count(*) filter (where reward_key like 'word_discovery_v1:%')::integer as word_discovery_rewards,
    count(distinct nullif(lower(trim(coalesce(reward_word, split_part(reward_key, ':', 2)))), ''))
      filter (where reward_key like 'word_discovery_v1:%')::integer as discovered_words
  from public.account_rewards
  where player_id = p_player
),
result_stats as (
  select
    coalesce(sum(points), 0)::integer as result_xp,
    count(*) filter (where mode in ('daily', 'free'))::integer as total_completed,
    count(distinct daily_date) filter (where mode = 'daily' and daily_date is not null)::integer as daily_completed,
    count(distinct challenge_key) filter (where mode = 'daily_special')::integer as daily_special_completed,
    min(best_elapsed_ms) filter (where mode = 'daily' and daily_date is not null) as best_daily_ms,
    count(*) filter (where mode in ('daily', 'free') and clean_solve is true)::integer as clean_solves,
    count(*) filter (where mode = 'daily' and clean_solve is true)::integer as clean_daily,
    count(*) filter (where mode = 'tajenka')::integer as tajenka_completed,
    count(*) filter (where mode = 'free' and difficulty = 'mozkomor')::integer as mozkomor_completed,
    bool_or(mode = 'free' and difficulty = 'mozkomor') as has_mozkomor,
    bool_or(mode = 'free' and normalized_generation <> p_active_generation) as has_prior_free,
    bool_or(mode = 'free' and normalized_generation = p_active_generation) as has_current_free
  from normalized_results
),
difficulties(difficulty) as (
  values ('easy'), ('medium'), ('hard'), ('hardcore'), ('mozkomor'), ('mozkokalypsa')
),
free_counts as (
  select d.difficulty,
    count(distinct nr.normalized_level) filter (
      where nr.normalized_level is not null
    )::integer as effective,
    count(distinct nr.normalized_level) filter (
      where nr.normalized_generation = p_active_generation
        and nr.normalized_level is not null
    )::integer as current_count,
    count(distinct nr.normalized_level) filter (
      where nr.normalized_generation = p_active_generation
        and nr.normalized_level between 1 and coalesce((p_base_levels ->> d.difficulty)::integer, 0)
    )::integer as base_current,
    count(nr.id)::integer as history_count
  from difficulties d
  left join normalized_results nr
    on nr.mode = 'free' and nr.difficulty = d.difficulty
  group by d.difficulty
),
free_transferred as (
  select d.difficulty,
    count(slots.normalized_level)::integer as transferred
  from difficulties d
  left join lateral (
    select distinct prior.normalized_level
    from normalized_results prior
    where prior.mode = 'free'
      and prior.difficulty = d.difficulty
      and prior.normalized_generation <> p_active_generation
      and prior.normalized_level is not null
      and not exists (
        select 1
        from normalized_results current_row
        where current_row.mode = 'free'
          and current_row.difficulty = d.difficulty
          and current_row.normalized_generation = p_active_generation
          and current_row.normalized_level = prior.normalized_level
      )
  ) slots on true
  group by d.difficulty
),
free_json as (
  select
    jsonb_object_agg(fc.difficulty, fc.effective) as effective,
    jsonb_object_agg(fc.difficulty, coalesce(ft.transferred, 0)) as transferred,
    jsonb_object_agg(fc.difficulty, fc.current_count) as current_count,
    jsonb_object_agg(fc.difficulty, fc.base_current) as base_current,
    jsonb_object_agg(fc.difficulty, fc.history_count) as history_count,
    max(fc.current_count) filter (where fc.difficulty = 'hardcore') as hardcore_current
  from free_counts fc
  join free_transferred ft using (difficulty)
),
effective_dates as (
  select distinct daily_date as value
  from normalized_results
  where mode = 'daily' and daily_date is not null
  union
  select distinct missed_date
  from public.streak_rescues
  where player_id = p_player and status = 'passed' and missed_date is not null
),
date_groups as (
  select value,
         value - row_number() over (order by value)::integer as island
  from effective_dates
),
streak_runs as (
  select min(value) as first_day, max(value) as last_day, count(*)::integer as days
  from date_groups
  group by island
),
streak_stats as (
  select
    coalesce(max(days) filter (where last_day in (
      (select today from stamp), (select today - 1 from stamp)
    )), 0)::integer as current_streak,
    coalesce(max(days), 0)::integer as longest_streak
  from streak_runs
),
rescue_stats as (
  select count(distinct missed_date)::integer as rescued_days
  from public.streak_rescues
  where player_id = p_player and status = 'passed' and missed_date is not null
),
delta_results as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'puzzleId', nr.puzzle_id,
      'challengeKey', nr.challenge_key,
      'mode', nr.mode,
      'difficulty', nr.difficulty,
      'dailyDate', nr.daily_date,
      'elapsedMs', greatest(coalesce(nr.best_elapsed_ms, 1000), 1000),
      'moves', greatest(coalesce(nr.best_moves, 1), 1),
      'points', coalesce(nr.points, 0),
      'hintsUsed', coalesce(nr.hints_used, 0),
      'wrongAttempts', coalesce(nr.wrong_attempts, 0),
      'maxHintLevel', coalesce(nr.max_hint_level, 0),
      'cleanSolve', nr.clean_solve is true,
      'completedAt', nr.completed_at,
      'level', case when nr.mode = 'free' then nr.normalized_level end,
      'contentGeneration', case when nr.mode = 'free' then nr.normalized_generation end,
      'legacy', nr.mode = 'free' and nr.normalized_generation <> p_active_generation
    ) || case when nr.timing_verified is null then '{}'::jsonb
              else jsonb_build_object('timingVerified', nr.timing_verified) end
    order by nr.completed_at, nr.id
  ), '[]'::jsonb) as completed
  from normalized_results nr
  where p_since is null or nr.completed_at >= p_since - interval '5 minutes'
),
stats_payload as (
  select jsonb_build_object(
    'points', rs.result_xp + rw.reward_xp,
    'resultXp', rs.result_xp,
    'xpAuthoritative', true,
    'rewardXp', rw.reward_xp,
    'accountBonusXp', rw.account_bonus_xp,
    'wordDiscoveryXp', rw.word_discovery_xp,
    'otherRewardXp', rw.other_reward_xp,
    'wordDiscoveryRewards', rw.word_discovery_rewards,
    'discoveredWords', rw.discovered_words,
    'accountRewardsIncluded', true,
    'totalCompleted', rs.total_completed,
    'dailyCompleted', rs.daily_completed,
    'dailySpecialCompleted',rs.daily_special_completed,
    'dailyChallengeCompleted',rs.daily_completed+rs.daily_special_completed,
    'totalChallengeCompleted',rs.total_completed+rs.daily_special_completed,
    'freeCompleted', fj.effective,
    'freeTransferred', fj.transferred,
    'freePlayedCurrent', fj.current_count,
    'freeBasePlayedCurrent', fj.base_current,
    'mozkomorUnlocked', true,
    'freePlayedGen2', fj.current_count,
    'freeHistoryCompleted', fj.history_count,
    'currentStreak', ss.current_streak,
    'longestStreak', ss.longest_streak,
    'bestDailyMs', rs.best_daily_ms,
    'cleanSolves', rs.clean_solves,
    'cleanDaily', rs.clean_daily,
    'tajenkaCompleted', rs.tajenka_completed,
    'mozkomorCompleted', rs.mozkomor_completed,
    'rescuedDays', rc.rescued_days,
    'gen4RewardPolicy', 'per-board',
    'gen4RewardRepairXp', 0,
    'gen4ReturnBonusXp', case when p_active_generation >= 4 and coalesce(rs.has_prior_free, false) and coalesce(rs.has_current_free, false) then 500 else 0 end,
    'gen4ReturnBonusAwardedNow', 0
  ) as stats
  from result_stats rs
  cross join reward_stats rw
  cross join free_json fj
  cross join streak_stats ss
  cross join rescue_stats rc
)
select jsonb_build_object(
  'cursor', stamp.value,
  'leagueName', (select league_name from player_row),
  'stats', stats_payload.stats,
  'completed', delta_results.completed
)
from stamp
cross join stats_payload
cross join delta_results;
$function$
;

revoke all on function public.proplet_account_snapshot_v1(uuid,timestamptz,integer,jsonb,integer) from public,anon,authenticated;
grant execute on function public.proplet_account_snapshot_v1(uuid,timestamptz,integer,jsonb,integer) to service_role;
comment on table public.daily_specials_policy is 'Release switch, disabled by default. preview_date is permitted only in the isolated preview database and must be NULL in production.';
notify pgrst,'reload schema';
commit;
