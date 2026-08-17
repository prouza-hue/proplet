-- Proplet v3.31.8 — optional recovery email + external auth identity mapping
-- Additive migration. Existing password/name login remains untouched.

alter table public.players
  add column if not exists email text,
  add column if not exists email_verified_at timestamptz,
  add column if not exists auth_user_id uuid;

create unique index if not exists players_verified_email_unique
  on public.players (lower(email))
  where email is not null and email_verified_at is not null;

create unique index if not exists players_auth_user_id_unique
  on public.players (auth_user_id)
  where auth_user_id is not null;

create table if not exists public.account_auth_challenges (
  id uuid primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  purpose text not null check (purpose in ('link_email','recover_password')),
  email text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  verified_auth_user_id uuid
);

create index if not exists account_auth_challenges_player_idx
  on public.account_auth_challenges(player_id, created_at desc);

create index if not exists account_auth_challenges_expiry_idx
  on public.account_auth_challenges(expires_at)
  where used_at is null;

alter table public.account_auth_challenges enable row level security;
revoke all on table public.account_auth_challenges from anon, authenticated;
grant select, insert, update, delete on table public.account_auth_challenges to service_role;

comment on column public.players.email is
  'Optional recovery/login email. Treat as recovery-capable only when email_verified_at is set.';
comment on column public.players.auth_user_id is
  'Supabase Auth identity mapped to the canonical Proplet player account.';
comment on table public.account_auth_challenges is
  'Short-lived hashed state for email verification and password recovery links.';
