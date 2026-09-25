-- One-time cohort snapshot; safe to retry without reselecting the TOP 10.
-- Run only after production deploy verification. No synthetic accounts.
begin;
do $$
declare cfg public.mozkokalypsa_experiments%rowtype; chosen jsonb; total integer;
begin
 select * into strict cfg from public.mozkokalypsa_experiments
 where id='mozkokalypsa-round2-20260925' for update;
 if cfg.cohort_selected_at is not null then return;end if;
 if clock_timestamp()>=cfg.closes_at then raise exception 'Playtest already closed';end if;
 if not exists(select 1 from players where id='e1740794-d196-48da-a59a-2741eadb8e44' and name='Pavel')
 or not exists(select 1 from players where id='62b7a393-5117-42f9-b1cc-a1d347393b82' and name='Petra') then
  raise exception 'Owner / Petra identity changed; verify before activating';
 end if;
 with ranked as (
  select p.id,p.name,a.lifetime_xp,row_number() over(order by a.lifetime_xp desc,p.id) as rank
  from public.proplet_rankings_xp_aggregate(null) a join public.players p on p.id::text=a.entity_id
  where a.row_kind='player'
 ), selected as (
  select id,name,lifetime_xp,rank,'top10'::text as source from ranked where rank<=10
  union all
  select p.id,p.name,coalesce(r.lifetime_xp,0),r.rank,'explicit'
  from public.players p left join ranked r on r.id=p.id
  where p.id in ('e1740794-d196-48da-a59a-2741eadb8e44','62b7a393-5117-42f9-b1cc-a1d347393b82')
   and coalesce(r.rank,11)>10
 ), ordered as (
  select *,((row_number() over(order by case when source='top10' then 0 else 1 end,rank nulls last,id)-1)%3)::smallint as slot from selected
 ) select jsonb_agg(to_jsonb(ordered) order by case when source='top10' then 0 else 1 end,rank nulls last,id),count(*) into chosen,total from ordered;
 if total<10 or total>12 then raise exception 'Unexpected cohort size %',total;end if;
 insert into public.mozkokalypsa_invites(experiment_id,player_id,slot,active,participant_role)
 select cfg.id,(v->>'id')::uuid,(v->>'slot')::smallint,true,'tester' from jsonb_array_elements(chosen) v;
 update public.mozkokalypsa_experiments set active=true,cohort_selected_at=clock_timestamp(),cohort_snapshot=chosen where id=cfg.id;
end $$;
commit;
select id,active,closes_at,cohort_selected_at,cohort_snapshot from public.mozkokalypsa_experiments where id='mozkokalypsa-round2-20260925';
