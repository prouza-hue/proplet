-- Metadata-only fixture captured from Proplet production on 2026-10-15.
-- No user rows, credentials, policies or foreign keys are copied.
create role anon;
create role authenticated;
create role service_role;

create table public.daily_special_bindings (
  challenge_key text not null,
  daily_date date not null,
  puzzle_id text not null,
  difficulty text not null,
  content_hash text not null,
  bank_version text not null
);

create table public.daily_specials_policy (
  singleton boolean default true not null,
  enabled boolean default false not null,
  preview_date date
);

create table public.fair_play_policy (
  singleton boolean default true not null,
  enabled boolean default false not null,
  daily_from date
);

create table public.historical_free_slot_rewards (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  difficulty text not null,
  level integer not null,
  source_puzzle_id text not null,
  source_result_id uuid,
  content_generation integer,
  points integer not null,
  earned_at timestamp with time zone not null
);

create table public.play_sessions (
  actor_key text not null,
  player_id uuid,
  challenge_key text not null,
  puzzle_id text not null,
  mode text not null,
  attempt_id text not null,
  owner_id uuid not null,
  sequence bigint default 0 not null,
  progress jsonb default '{}'::jsonb not null,
  elapsed_ms bigint default 0 not null,
  active boolean default true not null,
  verified boolean default true not null,
  finished boolean default false not null,
  last_seen timestamp with time zone default clock_timestamp() not null,
  created_at timestamp with time zone default clock_timestamp() not null,
  pause_count integer default 0 not null,
  takeover_count integer default 0 not null
);

create table public.puzzle_attempts (
  id text not null,
  player_id uuid,
  puzzle_id text not null,
  challenge_key text not null,
  mode text not null,
  difficulty text not null,
  started_at timestamp with time zone default now() not null,
  completed_at timestamp with time zone,
  elapsed_ms integer,
  moves integer,
  wrong_attempts integer default 0 not null,
  hints_used integer default 0 not null,
  max_hint_level integer default 0 not null,
  clean_solve boolean,
  app_version text default '3.5'::text not null,
  reset_count integer default 0 not null,
  first_hint_at_ms integer,
  first_correct_at_ms integer,
  last_correct_at_ms integer,
  found_words integer default 0 not null,
  resume_count integer default 0 not null,
  last_activity_at timestamp with time zone,
  first_correct_ms integer,
  first_hint_ms integer,
  last_found_words integer default 0 not null,
  anonymous_id text,
  content_key text,
  content_generation smallint,
  content_bank text,
  content_level integer,
  content_lineage_confidence text,
  calm_mode boolean default false not null,
  client_release text,
  environment text default 'legacy'::text not null,
  release text,
  measurement_version integer default 1 not null,
  onboarding_version text default 'legacy'::text not null,
  is_test boolean default false not null
);

create table public.puzzle_runs (
  id uuid not null,
  attempt_id text,
  player_id uuid not null,
  puzzle_id text not null,
  challenge_key text not null,
  mode text not null,
  difficulty text not null,
  elapsed_ms integer not null,
  moves integer not null,
  hints_used integer default 0 not null,
  wrong_attempts integer default 0 not null,
  max_hint_level integer default 0 not null,
  clean_solve boolean default false not null,
  completed_at timestamp with time zone default now() not null,
  reset_count integer default 0 not null,
  first_hint_at_ms integer,
  first_correct_at_ms integer,
  last_correct_at_ms integer,
  content_key text,
  content_generation smallint,
  content_bank text,
  content_level integer,
  content_lineage_confidence text,
  calm_mode boolean default false not null,
  result_command_id uuid,
  timing_verified boolean,
  daily_special_content_hash text
);

create table public.result_commands (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  idempotency_key text not null,
  request_digest text not null,
  command_digest text not null,
  receipt jsonb,
  created_at timestamp with time zone default now() not null,
  committed_at timestamp with time zone
);

create table public.results (
  id uuid not null,
  player_id uuid not null,
  puzzle_id text not null,
  challenge_key text not null,
  mode text not null,
  difficulty text not null,
  daily_date date,
  best_elapsed_ms integer not null,
  best_moves integer not null,
  points integer not null,
  completed_at timestamp with time zone default now() not null,
  hints_used integer,
  clean_solve boolean,
  wrong_attempts integer default 0 not null,
  max_hint_level integer default 0 not null,
  team_code_at_completion text,
  content_key text,
  content_generation smallint,
  content_bank text,
  content_level integer,
  content_lineage_confidence text,
  calm_mode boolean default false not null,
  timing_verified boolean,
  daily_special_content_hash text
);

CREATE UNIQUE INDEX daily_special_bindings_daily_date_key ON public.daily_special_bindings USING btree (daily_date);
CREATE UNIQUE INDEX daily_special_bindings_pkey ON public.daily_special_bindings USING btree (challenge_key);
CREATE UNIQUE INDEX daily_special_bindings_puzzle_id_key ON public.daily_special_bindings USING btree (puzzle_id);
CREATE UNIQUE INDEX daily_specials_policy_pkey ON public.daily_specials_policy USING btree (singleton);
CREATE UNIQUE INDEX fair_play_policy_pkey ON public.fair_play_policy USING btree (singleton);
CREATE UNIQUE INDEX historical_free_slot_rewards_pkey ON public.historical_free_slot_rewards USING btree (id);
CREATE UNIQUE INDEX historical_free_slot_rewards_player_id_difficulty_level_key ON public.historical_free_slot_rewards USING btree (player_id, difficulty, level);
CREATE UNIQUE INDEX play_sessions_pkey ON public.play_sessions USING btree (actor_key, challenge_key, puzzle_id);
CREATE UNIQUE INDEX puzzle_attempts_pkey ON public.puzzle_attempts USING btree (id);
CREATE UNIQUE INDEX puzzle_runs_attempt_id_key ON public.puzzle_runs USING btree (attempt_id);
CREATE UNIQUE INDEX puzzle_runs_pkey ON public.puzzle_runs USING btree (id);
CREATE UNIQUE INDEX puzzle_runs_result_command_uq ON public.puzzle_runs USING btree (result_command_id) WHERE (result_command_id IS NOT NULL);
CREATE UNIQUE INDEX result_commands_identity_uq ON public.result_commands USING btree (player_id, idempotency_key);
CREATE UNIQUE INDEX result_commands_pkey ON public.result_commands USING btree (id);
CREATE UNIQUE INDEX results_pkey ON public.results USING btree (id);
CREATE UNIQUE INDEX results_player_id_challenge_key_key ON public.results USING btree (player_id, challenge_key);

create trigger results_timing_guard before insert or update on public.results for each row execute function public.proplet_result_timing_guard();
create trigger puzzle_runs_timing_guard before insert on public.puzzle_runs for each row execute function public.proplet_result_timing_guard();
create trigger results_daily_special_timing before insert or update on public.results for each row execute function public.proplet_daily_special_timing_guard();
create trigger runs_daily_special_timing before insert on public.puzzle_runs for each row execute function public.proplet_daily_special_timing_guard();

