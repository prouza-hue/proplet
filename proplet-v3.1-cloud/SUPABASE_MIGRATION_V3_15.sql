-- Proplet v3.15 — anonymní, neidentifikující Quality Analytics
-- Bezpečné opakované spuštění. Navazuje na kumulativní migraci v3.14.
-- Browser drží náhodné UUID; do DB se ukládá pouze SHA-256 hash tohoto UUID.

-- 1) Pokusy mohou patřit přihlášenému hráči NEBO anonymní instalaci.
alter table public.puzzle_attempts alter column player_id drop not null;
alter table public.puzzle_attempts add column if not exists anonymous_id text;
alter table public.puzzle_attempts drop constraint if exists puzzle_attempts_exactly_one_identity;
alter table public.puzzle_attempts add constraint puzzle_attempts_exactly_one_identity
  check ((player_id is not null) <> (anonymous_id is not null));
create index if not exists idx_puzzle_attempts_anonymous on public.puzzle_attempts (anonymous_id, started_at);

-- 2) Rating / hlášení slova mohou přijít i před registrací.
alter table public.puzzle_feedback alter column player_id drop not null;
alter table public.puzzle_feedback add column if not exists anonymous_id text;
alter table public.puzzle_feedback drop constraint if exists puzzle_feedback_exactly_one_identity;
alter table public.puzzle_feedback add constraint puzzle_feedback_exactly_one_identity
  check ((player_id is not null) <> (anonymous_id is not null));
create index if not exists idx_puzzle_feedback_anonymous on public.puzzle_feedback (anonymous_id, created_at);
create unique index if not exists uq_puzzle_feedback_anonymous_puzzle_kind
  on public.puzzle_feedback (anonymous_id, puzzle_id, kind)
  where anonymous_id is not null;

-- 3) Hint / Helper events mají stejný anonymní identity model.
alter table public.helper_events alter column player_id drop not null;
alter table public.helper_events add column if not exists anonymous_id text;
alter table public.helper_events drop constraint if exists helper_events_exactly_one_identity;
alter table public.helper_events add constraint helper_events_exactly_one_identity
  check ((player_id is not null) <> (anonymous_id is not null));
create index if not exists idx_helper_events_anonymous on public.helper_events (anonymous_id, created_at);

alter table public.hint_events alter column player_id drop not null;
alter table public.hint_events add column if not exists anonymous_id text;
alter table public.hint_events drop constraint if exists hint_events_exactly_one_identity;
alter table public.hint_events add constraint hint_events_exactly_one_identity
  check ((player_id is not null) <> (anonymous_id is not null));
create index if not exists idx_hint_events_anonymous on public.hint_events (anonymous_id, created_at);

-- Přístup z browseru zůstává zakázaný; vše jde přes náš FastAPI backend/service role.
alter table public.puzzle_attempts enable row level security;
alter table public.puzzle_feedback enable row level security;
alter table public.helper_events enable row level security;
alter table public.hint_events enable row level security;
revoke all on table public.puzzle_attempts from anon, authenticated;
revoke all on table public.puzzle_feedback from anon, authenticated;
revoke all on table public.helper_events from anon, authenticated;
revoke all on table public.hint_events from anon, authenticated;
grant all on table public.puzzle_attempts to service_role;
grant all on table public.puzzle_feedback to service_role;
grant all on table public.helper_events to service_role;
grant all on table public.hint_events to service_role;

-- 4) Lehký anonymní funnel pro onboarding a přechod k účtu.
create table if not exists public.product_events (
  id uuid primary key,
  player_id uuid references public.players(id) on delete cascade,
  anonymous_id text,
  event_type text not null,
  app_version text not null default '3.15',
  created_at timestamptz not null default now(),
  constraint product_events_exactly_one_identity check ((player_id is not null) <> (anonymous_id is not null))
);
create index if not exists idx_product_events_anonymous on public.product_events (anonymous_id, created_at);
create index if not exists idx_product_events_player on public.product_events (player_id, created_at);
create index if not exists idx_product_events_type on public.product_events (event_type, created_at);
alter table public.product_events enable row level security;
revoke all on table public.product_events from anon, authenticated;
grant all on table public.product_events to service_role;
