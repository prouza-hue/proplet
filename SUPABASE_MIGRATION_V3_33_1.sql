begin;

create table if not exists public.account_rewards (
  id uuid primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  reward_key text not null,
  points integer not null check (points >= 0),
  granted_at timestamptz not null default now(),
  constraint account_rewards_player_reward_key_unique unique (player_id, reward_key)
);

create index if not exists account_rewards_player_id_idx
  on public.account_rewards(player_id);

-- Existing players get the same launch reward as future account creators. Production v3.33.0
-- does not read this table, so seeding it before the v3.33.1 application release is inert.
insert into public.account_rewards (id, player_id, reward_key, points, granted_at)
select gen_random_uuid(), p.id, 'account_creation_v1', 500, now()
from public.players p
on conflict (player_id, reward_key) do nothing;

commit;
