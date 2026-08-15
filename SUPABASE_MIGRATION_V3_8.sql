-- Proplet v3.8 — Liga rodin
-- Veřejná globální týdenní soutěž rodinných lig je opt-in.
-- Veřejně se zobrazuje pouze název týmu a agregované skóre.

alter table public.leagues
    add column if not exists public_opt_in boolean not null default false,
    add column if not exists public_name text,
    add column if not exists public_enabled_at timestamptz;

update public.leagues
set public_name = coalesce(public_name, name, code)
where public_name is null;

create index if not exists idx_leagues_public_opt_in
    on public.leagues (public_opt_in)
    where public_opt_in = true;

-- RLS už je na leagues zapnuté z migrace v3.7 a přístup má pouze service_role.
