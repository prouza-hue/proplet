-- Proplet Tajenka — release-time database contract.
-- PREVIEW ONLY: do not run before the weekend mode is approved for production.

begin;

-- The existing unique (player_id, challenge_key) constraint makes the
-- tajenka:<puzzle-id> reward idempotent across retries and devices.
alter table public.results drop constraint if exists results_mode_check;
alter table public.results add constraint results_mode_check
    check (mode in ('daily','free','starter','tajenka'));

commit;

