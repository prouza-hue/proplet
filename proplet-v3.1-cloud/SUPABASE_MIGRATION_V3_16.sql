-- Proplet v3.16 / Free Generation 2
-- One economic reward per difficulty + level slot, regardless of content generation.

create table if not exists public.free_slot_rewards (
  id uuid primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'hardcore')),
  level integer not null check (level between 1 and 100),
  source_puzzle_id text not null,
  content_generation integer not null default 1 check (content_generation >= 1),
  points integer not null default 0 check (points >= 0),
  earned_at timestamptz not null default now(),
  unique (player_id, difficulty, level)
);

create index if not exists free_slot_rewards_player_idx
  on public.free_slot_rewards (player_id, difficulty, level);

alter table public.free_slot_rewards enable row level security;

-- The browser never accesses this table directly. The FastAPI backend uses the
-- Supabase service-role key, as it already does for official results.
revoke all on table public.free_slot_rewards from anon, authenticated;
grant all on table public.free_slot_rewards to service_role;

comment on table public.free_slot_rewards is
  'Concurrency-safe XP claims across archived Free Gen1 and active Free Gen2 level slots.';
