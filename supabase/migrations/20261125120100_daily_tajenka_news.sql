-- Keep the original November receipt, cutoff and patron timing anchor intact.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

alter table public.release_news_campaigns
  drop constraint release_news_campaigns_campaign_id_check,
  drop constraint release_news_campaigns_release_at_check,
  add constraint release_news_campaigns_schedule_check check (
    (campaign_id='november-2026-release-v1'
      and release_at=timestamp '2026-11-01 00:00' at time zone 'Europe/Prague')
    or (campaign_id='daily-tajenka-2026-12'
      and release_at=timestamp '2026-12-01 00:00' at time zone 'Europe/Prague')
  );

insert into public.release_news_campaigns(campaign_id, active, release_at, account_cutoff)
values ('daily-tajenka-2026-12', true,
        timestamp '2026-12-01 00:00' at time zone 'Europe/Prague',
        timestamp '2026-12-01 00:00' at time zone 'Europe/Prague');

create function public.proplet_campaign_news_v1(p_campaign text, p_player uuid, p_claim boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  campaign public.release_news_campaigns%rowtype;
  current_timepoint timestamptz := public.proplet_monthly_now_v1();
  eligible boolean := false;
  granted boolean := false;
  seen boolean := false;
begin
  if p_claim is null then raise exception 'Invalid release news action' using errcode='22023'; end if;
  select * into campaign from public.release_news_campaigns
    where campaign_id=p_campaign and active for share;
  if not found or current_timepoint is null or current_timepoint<campaign.release_at then
    return jsonb_build_object('enabled',false,'eligible',false,'canShowAutomatically',false,'displayGranted',false);
  end if;
  select exists(select 1 from public.players where id=p_player and created_at<campaign.account_cutoff)
    and (select count(*) from (select distinct mode,challenge_key from public.results
      where player_id=p_player and mode in ('daily','daily_special','free','tajenka') limit 5) completed)>=5
    into eligible;
  if eligible then
    if p_claim then
      insert into public.release_news_receipts(campaign_id,player_id,claimed_at)
        values (campaign.campaign_id,p_player,current_timepoint)
        on conflict(campaign_id,player_id) do nothing;
      granted := found;
    end if;
    select exists(select 1 from public.release_news_receipts
      where campaign_id=campaign.campaign_id and player_id=p_player) into seen;
  end if;
  return jsonb_build_object('enabled',true,'eligible',eligible,
    'canShowAutomatically',eligible and not seen,'displayGranted',granted);
end;
$$;
revoke all on function public.proplet_campaign_news_v1(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.proplet_campaign_news_v1(text,uuid,boolean) to service_role;

create or replace function public.proplet_release_news_v1(p_player uuid,p_claim boolean default false)
returns jsonb language sql security invoker set search_path='' as $$
  select public.proplet_campaign_news_v1('november-2026-release-v1',p_player,p_claim);
$$;
commit;
