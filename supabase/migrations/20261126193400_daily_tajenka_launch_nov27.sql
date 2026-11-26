-- Bring the daily Tajenka announcement forward with its existing campaign identity.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

alter table public.release_news_campaigns
  drop constraint release_news_campaigns_schedule_check;

do $schedule$
declare
  launch constant timestamptz := timestamp '2026-11-27 00:00' at time zone 'Europe/Prague';
  original constant timestamptz := timestamp '2026-12-01 00:00' at time zone 'Europe/Prague';
begin
  if not exists (
    select 1 from public.release_news_campaigns
    where campaign_id = 'daily-tajenka-2026-12'
      and release_at in (original, launch) and account_cutoff = release_at
  ) then
    raise exception 'Unexpected daily Tajenka campaign schedule';
  end if;

  update public.release_news_campaigns
  set release_at = launch, account_cutoff = launch
  where campaign_id = 'daily-tajenka-2026-12' and release_at = original;
end $schedule$;

alter table public.release_news_campaigns
  add constraint release_news_campaigns_schedule_check check (
    (campaign_id = 'november-2026-release-v1'
      and release_at = timestamp '2026-11-01 00:00' at time zone 'Europe/Prague')
    or (campaign_id = 'daily-tajenka-2026-12'
      and release_at = timestamp '2026-11-27 00:00' at time zone 'Europe/Prague')
  );
commit;
