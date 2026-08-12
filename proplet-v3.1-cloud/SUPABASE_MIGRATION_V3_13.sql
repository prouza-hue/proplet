-- Proplet v3.13 — Quality Analytics v2
-- Rozšiřuje telemetry o průběh pokusu a ukládá týdenní agregované QA snapshoty.

alter table public.puzzle_attempts add column if not exists reset_count integer not null default 0;
alter table public.puzzle_attempts add column if not exists first_hint_at_ms integer;
alter table public.puzzle_attempts add column if not exists first_correct_at_ms integer;
alter table public.puzzle_attempts add column if not exists last_correct_at_ms integer;
alter table public.puzzle_attempts add column if not exists found_words integer not null default 0;
alter table public.puzzle_attempts add column if not exists resume_count integer not null default 0;
alter table public.puzzle_attempts add column if not exists last_activity_at timestamptz;

update public.puzzle_attempts
set last_activity_at = coalesce(last_activity_at, completed_at, started_at)
where last_activity_at is null;

alter table public.puzzle_runs add column if not exists reset_count integer not null default 0;
alter table public.puzzle_runs add column if not exists first_hint_at_ms integer;
alter table public.puzzle_runs add column if not exists first_correct_at_ms integer;
alter table public.puzzle_runs add column if not exists last_correct_at_ms integer;

create table if not exists public.quality_snapshots (
    id uuid primary key,
    snapshot_date date not null unique,
    report jsonb not null,
    created_at timestamptz not null default now()
);
create index if not exists idx_quality_snapshots_date on public.quality_snapshots (snapshot_date desc);

alter table public.quality_snapshots enable row level security;
revoke all on table public.quality_snapshots from anon, authenticated;
grant all on table public.quality_snapshots to service_role;
