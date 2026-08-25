-- Anonymous players may opt into the same Daily + weekly-content push stream.
-- Ownership remains exactly one pseudonymous identity and is claimed by the account later.
alter table public.push_subscriptions
  add column if not exists anonymous_id text,
  alter column player_id drop not null;

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_actor_check;
alter table public.push_subscriptions
  add constraint push_subscriptions_actor_check
  check ((player_id is not null)::int + (anonymous_id is not null)::int = 1);

create index if not exists idx_push_subscriptions_anonymous_id
  on public.push_subscriptions (anonymous_id)
  where anonymous_id is not null;

alter table public.push_delivery_log
  add column if not exists anonymous_id text,
  alter column player_id drop not null;

alter table public.push_delivery_log
  drop constraint if exists push_delivery_log_actor_check;
alter table public.push_delivery_log
  add constraint push_delivery_log_actor_check
  check ((player_id is not null)::int + (anonymous_id is not null)::int = 1);

create index if not exists idx_push_delivery_log_anonymous_id
  on public.push_delivery_log (anonymous_id)
  where anonymous_id is not null;
