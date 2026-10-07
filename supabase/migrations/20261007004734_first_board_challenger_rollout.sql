-- First real board rollout: all NEW identities get g4-e-009.
-- Existing ledger/history assignments remain sticky. No Daily/content/reward changes.
alter table proplet_experiment_internal.first_board_assignments
  drop constraint first_board_assignments_policy_check;
alter table proplet_experiment_internal.first_board_assignments
  add constraint first_board_assignments_policy_check
  check (policy in ('hash50_v1','catchup_20261004','challenger_rollout_20261007'));

create or replace function public.proplet_first_board_assign(
  p_environment text, p_is_test boolean, p_anonymous_id text, p_flow uuid,
  p_identity_bucket integer, p_client_release text, p_release text, p_app_version text
) returns jsonb
language plpgsql security invoker
set search_path = pg_catalog, proplet_experiment_internal
set statement_timeout = '5s'
as $$
declare
  a proplet_experiment_internal.first_board_assignments%rowtype;
  historic record;
  n_control integer;
  n_challenger integer;
  chosen text;
  policy_name text;
  assigned_bucket integer;
begin
  if p_environment not in ('production','preview','local') or p_is_test is null
     or p_anonymous_id is null or p_anonymous_id !~ '^[a-f0-9]{64}$'
     or p_flow is null or p_identity_bucket is null or p_identity_bucket not between 0 and 99
     or coalesce(length(p_client_release),0) not between 1 and 80 then
    raise exception 'Invalid first-board assignment request' using errcode='22023';
  end if;
  -- One short transaction per environment/test namespace; concurrent requests cannot overshoot.
  perform pg_advisory_xact_lock(hashtextextended('first-board-v1:'||p_environment||':'||p_is_test::text,0));
  select * into a from proplet_experiment_internal.first_board_assignments
    where environment=p_environment and is_test=p_is_test and anonymous_id=p_anonymous_id;
  if not found then
    -- Never repurpose a flow belonging to another identity.
    if exists(select 1 from proplet_experiment_internal.first_board_assignments
      where environment=p_environment and is_test=p_is_test and first_steps_run_id=p_flow) then
      raise exception 'First-board flow belongs to another identity' using errcode='22023';
    end if;
    select e.* into historic from public.product_events e
      where e.environment=p_environment and e.is_test=p_is_test
        and e.event_type='first_board_experiment_assigned'
        and e.context->>'experiment_key'='first-board-v1'
        and e.created_at>=timestamptz '2026-09-29 07:51:55+00'
        and e.anonymous_id=p_anonymous_id
        and e.context->>'first_steps_run_id' ~ '^[a-f0-9-]{36}$'
        and e.context->>'experiment_bucket' ~ '^[0-9]{1,2}$'
        and ((e.context->>'experiment_variant'='control_e001' and e.context->>'puzzle_id'='g4-e-001'
              and (e.context->>'experiment_bucket')::int<50)
          or (e.context->>'experiment_variant'='challenger_e009' and e.context->>'puzzle_id'='g4-e-009'
              and (e.context->>'experiment_bucket')::int>=50))
      order by e.created_at,e.id limit 1;
    if found then
      insert into proplet_experiment_internal.first_board_assignments
        (environment,is_test,anonymous_id,first_steps_run_id,variant,bucket,identity_bucket,policy,assigned_at,event_id)
        values(p_environment,p_is_test,p_anonymous_id,(historic.context->>'first_steps_run_id')::uuid,
          historic.context->>'experiment_variant',(historic.context->>'experiment_bucket')::int,
          (historic.context->>'experiment_bucket')::int,
          coalesce(historic.context->>'experiment_allocation_policy','hash50_v1'),historic.created_at,historic.id)
        returning * into a;
    else
      if exists(select 1 from public.product_events e
        where e.environment=p_environment and e.is_test=p_is_test
          and e.event_type='first_board_experiment_assigned'
          and e.context->>'experiment_key'='first-board-v1'
          and e.context->>'first_steps_run_id'=p_flow::text) then
        raise exception 'First-board flow already assigned' using errcode='22023';
      end if;
      -- Product rollout chosen by the owner; not a randomized experiment phase.
      chosen='challenger_e009';
      policy_name='challenger_rollout_20261007';
      -- experiment_bucket remains the allocated arm bucket; identity_bucket retains the original hash.
      assigned_bucket=(p_identity_bucket%50)+case when chosen='challenger_e009' then 50 else 0 end;
      insert into proplet_experiment_internal.first_board_assignments
        (environment,is_test,anonymous_id,first_steps_run_id,variant,bucket,identity_bucket,policy)
        values(p_environment,p_is_test,p_anonymous_id,p_flow,chosen,assigned_bucket,p_identity_bucket,policy_name)
        returning * into a;
      -- Authoritative assignment is stored atomically with allocation, exactly once.
      insert into public.product_events
        (id,anonymous_id,event_type,app_version,created_at,client_release,environment,release,
         measurement_version,onboarding_version,is_test,context)
        values(a.event_id,p_anonymous_id,'first_board_experiment_assigned',left(p_app_version,30),
          a.assigned_at,p_client_release,p_environment,left(p_release,64),2,'board-v3-short',p_is_test,
          jsonb_build_object('first_steps_run_id',a.first_steps_run_id,'experiment_key','first-board-v1',
            'experiment_variant',a.variant,'experiment_bucket',a.bucket,
            'experiment_identity_bucket',a.identity_bucket,'experiment_allocation_policy',a.policy,
            'puzzle_id',case when a.variant='control_e001' then 'g4-e-001' else 'g4-e-009' end,
            'auth_at_event','anonymous','assignment_origin','server'));
    end if;
  end if;
  return jsonb_build_object('key','first-board-v1','variant',a.variant,'bucket',a.bucket,
    'identityBucket',a.identity_bucket,'allocationPolicy',a.policy,
    'boardId',case when a.variant='control_e001' then 'g4-e-001' else 'g4-e-009' end,
    'assignedAt',a.assigned_at,'firstStepsRunId',a.first_steps_run_id,'assignmentRecorded',true);
end;
$$;
revoke all on function public.proplet_first_board_assign(text,boolean,text,uuid,integer,text,text,text)
  from public,anon,authenticated;
grant execute on function public.proplet_first_board_assign(text,boolean,text,uuid,integer,text,text,text)
  to service_role;
notify pgrst,'reload schema';
