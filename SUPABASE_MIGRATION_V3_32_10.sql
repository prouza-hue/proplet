begin;

-- v3.32.10: teams participate in the public team league by default.
-- Explicit false remains the opt-out state. Existing NULL rows, if any, become visible.
alter table public.leagues
  alter column public_opt_in set default true;

update public.leagues
set public_opt_in = true
where public_opt_in is null;

commit;
