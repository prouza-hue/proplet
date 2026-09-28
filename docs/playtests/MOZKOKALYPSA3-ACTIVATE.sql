-- Authorized 28 Sep: EXACT previous cohort, not a new TOP-X calculation.
begin;
set local lock_timeout='5s';
do $$
declare count_old integer; count_new integer;
begin
 perform 1 from public.mozkokalypsa_experiments where id='mozkokalypsa-round3-interwoven-v2' for update;
 if not found then raise exception 'Missing round III migration'; end if;
 if exists(select 1 from public.mozkokalypsa_experiments where id='mozkokalypsa-round3-interwoven-v2' and
   (opens_at is distinct from '2026-09-28T22:00:00Z'::timestamptz or closes_at<>'2026-09-30T22:00:00Z'::timestamptz or reward_xp<>200)) then
  raise exception 'Wrong round III schedule';
 end if;
 if (select count(*) from public.mozkokalypsa_boards where experiment_id='mozkokalypsa-round3-interwoven-v2')<>8 then
  raise exception 'Wrong board count';
 end if;
 select count(*) into count_old from public.mozkokalypsa_invites where experiment_id='mozkokalypsa-round2-20260925' and active;
 if count_old=0 then raise exception 'Empty reference cohort'; end if;
 insert into public.mozkokalypsa_invites(experiment_id,player_id,slot,active,participant_role)
 select 'mozkokalypsa-round3-interwoven-v2',player_id,slot,true,participant_role
 from public.mozkokalypsa_invites where experiment_id='mozkokalypsa-round2-20260925' and active
 on conflict(experiment_id,player_id) do nothing;
 if exists (
  (select player_id,slot,participant_role,active from public.mozkokalypsa_invites where experiment_id='mozkokalypsa-round3-interwoven-v2'
   except select player_id,slot,participant_role,active from public.mozkokalypsa_invites where experiment_id='mozkokalypsa-round2-20260925' and active)
  union all
  (select player_id,slot,participant_role,active from public.mozkokalypsa_invites where experiment_id='mozkokalypsa-round2-20260925' and active
   except select player_id,slot,participant_role,active from public.mozkokalypsa_invites where experiment_id='mozkokalypsa-round3-interwoven-v2')
 ) then raise exception 'Cohorts differ';end if;
 update public.mozkokalypsa_experiments set active=true,
   cohort_selected_at=coalesce(cohort_selected_at,clock_timestamp()),
   cohort_snapshot=(select jsonb_agg(jsonb_build_object('playerId',player_id,'slot',slot,'role',participant_role,'sourceExperiment','mozkokalypsa-round2-20260925') order by player_id)
     from public.mozkokalypsa_invites where experiment_id='mozkokalypsa-round3-interwoven-v2')
 where id='mozkokalypsa-round3-interwoven-v2';
end $$;
commit;
