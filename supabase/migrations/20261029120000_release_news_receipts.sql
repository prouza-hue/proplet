-- Fixed November release; inactive until explicitly activated. No player seeds.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';

create table public.release_news_campaigns (
  campaign_id text primary key check(campaign_id='november-2026-release-v1'),
  active boolean not null default false,
  release_at timestamptz not null default (timestamp '2026-11-01 00:00' at time zone 'Europe/Prague'),
  account_cutoff timestamptz not null default (timestamp '2026-11-01 00:00' at time zone 'Europe/Prague'),
  check(release_at=timestamp '2026-11-01 00:00' at time zone 'Europe/Prague'),
  check(account_cutoff=release_at)
);
create table public.release_news_receipts (
  campaign_id text not null references public.release_news_campaigns(campaign_id),
  player_id uuid not null references public.players(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key(campaign_id,player_id)
);
alter table public.release_news_campaigns enable row level security;
alter table public.release_news_receipts enable row level security;
revoke all on public.release_news_campaigns,public.release_news_receipts from public,anon,authenticated;
grant select,update on public.release_news_campaigns to service_role;
grant select,insert on public.release_news_receipts to service_role;
insert into public.release_news_campaigns(campaign_id,active) values('november-2026-release-v1',false);

create function public.proplet_release_news_v1(p_player uuid,p_claim boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  c public.release_news_campaigns%rowtype;
  t timestamptz := public.proplet_monthly_now_v1();
  eligible boolean := false;
  granted boolean := false;
  seen boolean := false;
begin
  if p_claim is null then raise exception 'Invalid release news action' using errcode='22023'; end if;
  -- Share lock serializes deactivation with a claim without serializing readers.
  select * into c from public.release_news_campaigns
    where campaign_id='november-2026-release-v1' and active for share;
  if not found or t is null or t<c.release_at then
    return jsonb_build_object('enabled',false,'eligible',false,'canShowAutomatically',false,'displayGranted',false);
  end if;
  select exists(select 1 from public.players p where p.id=p_player and p.created_at<c.account_cutoff)
    and (select count(*) from (select distinct r.mode,r.challenge_key from public.results r
      where r.player_id=p_player and r.mode in('daily','daily_special','free','tajenka') limit 5) completed)>=5
    into eligible;
  if eligible then
    if p_claim then
      insert into public.release_news_receipts(campaign_id,player_id,claimed_at)
        values(c.campaign_id,p_player,t) on conflict(campaign_id,player_id) do nothing;
      granted := found;
    end if;
    select exists(select 1 from public.release_news_receipts
      where campaign_id=c.campaign_id and player_id=p_player) into seen;
  end if;
  return jsonb_build_object('enabled',true,'eligible',eligible,
    'canShowAutomatically',eligible and not seen,'displayGranted',granted);
end;
$$;
revoke all on function public.proplet_release_news_v1(uuid,boolean) from public,anon,authenticated;
grant execute on function public.proplet_release_news_v1(uuid,boolean) to service_role;
commit;
