-- Proplet v3.31.7 Rankings & Teams
-- Additive migration. Safe to apply while v3.31.6.1 is still serving traffic.

-- NULL = player has not yet answered the one-time public-ranking notice.
-- TRUE = public avatar + display name may appear globally.
-- FALSE = keep the individual player out of public global tables.
alter table public.players
  add column if not exists public_rankings boolean;

alter table public.results
  add column if not exists team_code_at_completion text;

create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_code text not null,
  joined_at timestamptz not null,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  constraint team_memberships_time_check check (left_at is null or left_at >= joined_at)
);

alter table public.team_memberships enable row level security;
revoke all on public.team_memberships from anon, authenticated;
grant all on public.team_memberships to service_role;

create unique index if not exists team_memberships_one_active_per_player
  on public.team_memberships(player_id) where left_at is null;
create index if not exists team_memberships_team_time_idx
  on public.team_memberships(team_code, joined_at, left_at);
create index if not exists results_team_completion_idx
  on public.results(team_code_at_completion, completed_at);

-- Current product has never allowed switching teams, so team_joined_at is a reliable
-- start boundary for all existing real memberships. Internal SOLO_* namespaces are not teams.
insert into public.team_memberships (player_id, team_code, joined_at)
select p.id, p.family_code, p.team_joined_at
from public.players p
where p.team_joined_at is not null
  and p.family_code is not null
  and left(p.family_code, 5) <> 'SOLO_'
on conflict do nothing;

-- Attribute only XP earned at/after the historical team join. Older XP stays personal.
update public.results r
set team_code_at_completion = p.family_code
from public.players p
where r.player_id = p.id
  and r.team_code_at_completion is null
  and p.team_joined_at is not null
  and p.family_code is not null
  and left(p.family_code, 5) <> 'SOLO_'
  and r.completed_at >= p.team_joined_at;
