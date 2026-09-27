-- Supabase Cron runs server-side and owns no HTTP credential.
-- Settings remain disabled until the matching production application is live.
begin;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'proplet-weekly-team-victories',
  '10 * * * *',
  'select public.proplet_finalize_team_victories_v1();'
);
commit;
