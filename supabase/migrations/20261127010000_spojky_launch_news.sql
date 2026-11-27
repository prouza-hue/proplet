begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

alter table public.release_news_campaigns
  drop constraint release_news_campaigns_schedule_check,
  add constraint release_news_campaigns_schedule_check check (
    (campaign_id = 'november-2026-release-v1'
      and release_at = timestamp '2026-11-01 00:00' at time zone 'Europe/Prague')
    or (campaign_id in ('daily-tajenka-2026-12', 'weekly-spojky-daily-tajenka-2026-11')
      and release_at = timestamp '2026-11-27 00:00' at time zone 'Europe/Prague')
  );

insert into public.release_news_campaigns(campaign_id, active, release_at, account_cutoff)
select 'weekly-spojky-daily-tajenka-2026-11', true, release_at, account_cutoff
from public.release_news_campaigns where campaign_id = 'daily-tajenka-2026-12';

create or replace function public.proplet_campaign_news_v1(p_campaign text, p_player uuid, p_claim boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  daily constant text := 'daily-tajenka-2026-12';
  combined constant text := 'weekly-spojky-daily-tajenka-2026-11';
  campaign public.release_news_campaigns%rowtype;
  current_timepoint timestamptz := public.proplet_monthly_now_v1();
  eligible boolean := false;
  granted boolean := false;
  seen boolean := false;
  saw_daily boolean := false;
  saw_combined boolean := false;
  response jsonb;
begin
  if p_claim is null then raise exception 'Invalid release news action' using errcode = '22023'; end if;
  select * into campaign from public.release_news_campaigns
    where campaign_id = p_campaign and active for share;
  if not found or current_timepoint is null or current_timepoint < campaign.release_at then
    response := jsonb_build_object('enabled', false, 'eligible', false, 'canShowAutomatically', false, 'displayGranted', false);
  else
    select exists(select 1 from public.players where id = p_player and created_at < campaign.account_cutoff)
      and (select count(*) from (select distinct mode, challenge_key from public.results
        where player_id = p_player and mode in ('daily','daily_special','free','tajenka') limit 5) completed) >= 5
      into eligible;
    if eligible then
      if p_campaign in (daily, combined) then
        -- A legacy client and a joint-launch client can run on different devices.
        -- Once the joint invitation wins, even an outstanding old claim is ineligible.
        if p_claim then perform pg_advisory_xact_lock(hashtextextended('spojky-launch-news:' || p_player::text, 0)); end if;
        select exists(select 1 from public.release_news_receipts where campaign_id = daily and player_id = p_player),
               exists(select 1 from public.release_news_receipts where campaign_id = combined and player_id = p_player)
          into saw_daily, saw_combined;
        seen := case when p_campaign = daily then saw_daily else saw_combined end;
        if p_campaign = daily and saw_combined then eligible := false; end if;
      else
        select exists(select 1 from public.release_news_receipts where campaign_id = p_campaign and player_id = p_player) into seen;
      end if;
      if p_claim and eligible and not seen then
        insert into public.release_news_receipts(campaign_id, player_id, claimed_at)
          values (p_campaign, p_player, current_timepoint) on conflict(campaign_id, player_id) do nothing;
        granted := found;
        seen := true;
      end if;
    end if;
    response := jsonb_build_object('enabled', true, 'eligible', eligible,
      'canShowAutomatically', eligible and not seen, 'displayGranted', granted);
  end if;
  if p_campaign = combined then response := response || jsonb_build_object('sawDailyTajenka', saw_daily); end if;
  return response;
end;
$$;

commit;
