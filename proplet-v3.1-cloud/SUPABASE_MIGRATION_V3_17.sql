-- Proplet v3.17 — oddělená administrace, audit a skutečná fronta hlášení slov.
-- Bezpečné opakované spuštění. Neodstraňuje žádná herní data ani XP.

-- 1) Administrátorské oprávnění je samostatné od běžného hráčského účtu.
create table if not exists public.admin_accounts (
  player_id uuid primary key references public.players(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- První vlastník: hráč Pavel v týmu Prouza. Pokud hráč neexistuje, migrace
-- normálně doběhne; grant lze později vložit ručně podle stejného vzoru.
insert into public.admin_accounts (player_id, role, active)
select id, 'owner', true
from public.players
where lower(trim(name)) = 'pavel'
  and lower(trim(family_code)) = 'prouza'
order by created_at asc
limit 1
on conflict (player_id) do nothing;

create table if not exists public.admin_audit_log (
  id uuid primary key,
  admin_player_id uuid not null references public.players(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_audit_created on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_admin on public.admin_audit_log (admin_player_id, created_at desc);

-- 2) Každé nahlášené slovo je samostatný případ se stavem a vyřízením.
alter table public.puzzle_feedback add column if not exists status text not null default 'new';
alter table public.puzzle_feedback add column if not exists resolution_note text;
alter table public.puzzle_feedback add column if not exists reviewed_at timestamptz;
alter table public.puzzle_feedback add column if not exists reviewed_by uuid references public.players(id) on delete set null;
alter table public.puzzle_feedback drop constraint if exists puzzle_feedback_status_check;
alter table public.puzzle_feedback add constraint puzzle_feedback_status_check
  check (status in ('new', 'reviewing', 'resolved', 'dismissed'));

-- Původní omezení dovolovalo jednomu hráči jen jeden report na celou desku.
alter table public.puzzle_feedback drop constraint if exists puzzle_feedback_player_id_puzzle_id_kind_key;
drop index if exists public.uq_puzzle_feedback_anonymous_puzzle_kind;

-- Hodnocení obtížnosti zůstává jeden měnitelný hlas na hráče a puzzle.
create unique index if not exists uq_feedback_player_difficulty
  on public.puzzle_feedback (player_id, puzzle_id)
  where player_id is not null and kind = 'difficulty';
create unique index if not exists uq_feedback_anon_difficulty
  on public.puzzle_feedback (anonymous_id, puzzle_id)
  where anonymous_id is not null and kind = 'difficulty';

-- U slov lze z jedné desky nahlásit více různých odpovědí; stejné slovo
-- od stejného člověka se pouze aktualizuje, aby dvojklik nevytvářel spam.
create unique index if not exists uq_feedback_player_word
  on public.puzzle_feedback (player_id, puzzle_id, lower(coalesce(word, '')))
  where player_id is not null and kind = 'word';
create unique index if not exists uq_feedback_anon_word
  on public.puzzle_feedback (anonymous_id, puzzle_id, lower(coalesce(word, '')))
  where anonymous_id is not null and kind = 'word';
create index if not exists idx_puzzle_feedback_status
  on public.puzzle_feedback (kind, status, created_at desc);

-- 3) Browser k administrátorským tabulkám nikdy nepřistupuje přímo.
alter table public.admin_accounts enable row level security;
alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_accounts from anon, authenticated;
revoke all on table public.admin_audit_log from anon, authenticated;
grant all on table public.admin_accounts to service_role;
grant all on table public.admin_audit_log to service_role;

comment on table public.admin_accounts is
  'Oddělená serverově ověřovaná oprávnění pro Proplet Admin.';
comment on table public.admin_audit_log is
  'Dohledatelná historie všech zapisujících administrátorských zásahů.';
