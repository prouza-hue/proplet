-- Fresh/disposable PostgreSQL only. Never run against a populated application schema.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
create table public.players(id uuid primary key,name text not null,avatar text default '🙂',
  created_at timestamptz not null default statement_timestamp(),family_code text default 'SOLO_QA',team_joined_at timestamptz);
create table public.results(id uuid primary key default gen_random_uuid(),player_id uuid references public.players(id) on delete cascade,
  puzzle_id text not null,challenge_key text not null,mode text not null,points integer not null default 10,
  completed_at timestamptz not null default statement_timestamp(),daily_date date,calm_mode boolean not null default false,
  team_code_at_completion text,unique(player_id,challenge_key));
create table public.account_rewards(id uuid primary key,player_id uuid references public.players(id) on delete cascade,
  reward_key text not null,points integer not null,granted_at timestamptz not null default statement_timestamp(),unique(player_id,reward_key));
create table public.streak_rescues(player_id uuid,status text,missed_date date);
grant select,insert,update,delete on public.players,public.results,public.account_rewards,public.streak_rescues to service_role;
