-- Proplet v3.30 — Rolling Content + Notifications v2
-- Safe order for production: SQL FIRST, then application code.
-- This migration is intentionally backward-compatible with v3.29 clients.

begin;

-- Free rewards are keyed by a stable difficulty+level slot. v3.19 capped those slots
-- at 200; rolling content needs 201+ while preserving the exact-once unique key.
alter table if exists public.free_slot_rewards
  drop constraint if exists free_slot_rewards_level_check;

alter table if exists public.free_slot_rewards
  add constraint free_slot_rewards_level_check check (level >= 1);

-- Keep the existing device subscription, but separate consent by notification category.
-- Existing subscriptions retain ONLY their existing Daily reminder consent.
alter table public.push_subscriptions
  add column if not exists daily_enabled boolean;
alter table public.push_subscriptions
  add column if not exists content_enabled boolean;

update public.push_subscriptions set daily_enabled = true where daily_enabled is null;
update public.push_subscriptions set content_enabled = false where content_enabled is null;

alter table public.push_subscriptions
  alter column daily_enabled set default true,
  alter column daily_enabled set not null,
  alter column content_enabled set default false,
  alter column content_enabled set not null;

create index if not exists idx_push_subscriptions_daily_enabled
  on public.push_subscriptions (player_id)
  where daily_enabled = true;
create index if not exists idx_push_subscriptions_content_enabled
  on public.push_subscriptions (player_id)
  where content_enabled = true;

-- Generic delivery ledger. Reservation happens BEFORE a push is sent, which prevents
-- duplicate sends if a cron invocation is retried or overlaps another invocation.
create table if not exists public.push_delivery_log (
  id uuid primary key,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  event_key text not null,
  category text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (subscription_id, event_key)
);

create index if not exists idx_push_delivery_log_event
  on public.push_delivery_log (event_key, status);
create index if not exists idx_push_delivery_log_player
  on public.push_delivery_log (player_id, created_at desc);

alter table public.push_delivery_log enable row level security;
revoke all on table public.push_delivery_log from anon, authenticated;
grant all on table public.push_delivery_log to service_role;

commit;
