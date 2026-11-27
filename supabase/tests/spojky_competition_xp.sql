-- Disposable full-schema fixture, including a replay and a team change after credit.
begin;
do $$
declare
  member_id uuid := gen_random_uuid();
  solo_id uuid := gen_random_uuid();
  week_start date := date_trunc('week', now() at time zone 'Europe/Prague')::date - 14;
  stamp timestamptz := (week_start + 1)::timestamp at time zone 'Europe/Prague';
  month_start date := date_trunc('month', week_start + 1)::date;
  board text := 'spojky-cross-01-v1';
begin
  update public.monthly_competition_settings set isolated=false, preview_now=null where singleton;
  insert into public.leagues(code,name,public_opt_in,public_enabled_at)
    values ('SPOJKYQA','Spojky QA',true,stamp-interval '1 week');
  insert into public.players(id,name,family_code,token_hash,team_joined_at) values
    (member_id,'Spojky QA','SPOJKYQA','qa-spojky-member',stamp-interval '1 hour'),
    (solo_id,'Spojky solo','SOLO_SPOJKY','qa-spojky-solo',null);
  insert into public.account_rewards(id,player_id,reward_key,reward_type,puzzle_id,granted_at,points)
    select gen_random_uuid(), p.id,'spojky_v1:'||board,'spojky',board,stamp,200
    from (values(member_id),(solo_id),(member_id)) p(id)
    on conflict (player_id,reward_key) do nothing;
  insert into public.account_rewards(id,player_id,reward_key,reward_type,granted_at,points)
    values(gen_random_uuid(),member_id,'unrelated_qa_bonus','admin',stamp,500);
  update public.players set family_code='SOLO_CHANGED',team_joined_at=null where id=member_id;

  assert (select earned_xp from proplet_private.monthly_other_xp_v2(month_start) where player_id=member_id)=200;
  assert (select earned_xp from proplet_private.monthly_other_xp_v2(month_start) where player_id=solo_id)=200;
  assert (select period_xp from public.proplet_rankings_xp_aggregate(stamp) where row_kind='team' and entity_id='SPOJKYQA')=200;
  assert not exists(select 1 from public.proplet_rankings_xp_aggregate(stamp)
                    where row_kind='team' and entity_id in ('SOLO_CHANGED','SOLO_SPOJKY'));
  assert not exists(select 1 from public.proplet_rankings_xp_aggregate(stamp+interval '1 second')
                    where row_kind='team' and entity_id='SPOJKYQA' and period_xp>0);
  update public.team_victory_settings set enabled=true,launch_date=week_start where singleton;
  perform public.proplet_finalize_team_victories_v1();
  assert (select xp from public.team_victory_awards where team_code='SPOJKYQA'
          and team_victory_awards.week_start=(stamp at time zone 'Europe/Prague')::date-1)=200;
end $$;
rollback;
