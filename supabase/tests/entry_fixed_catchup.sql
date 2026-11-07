-- Disposable loopback fixture only. Every seed, activation and allocation rolls back.
begin;
create temporary table catchup_control_before as
select to_jsonb(c) as body from proplet_experiment_internal.entry_control c;

-- Start from known QA namespaces without touching production's ledger/window.
delete from proplet_experiment_internal.entry_assignments where environment in ('local','preview');
delete from proplet_experiment_internal.entry_catchup_state where environment in ('local','preview');
update proplet_experiment_internal.entry_allocation_state set last_ordinal=0 where environment='local' and is_test;
update proplet_experiment_internal.entry_allocation_state set last_ordinal=2 where environment='preview' and is_test;
alter table proplet_experiment_internal.entry_assignments disable trigger proplet_entry_allocate_v1;
insert into proplet_experiment_internal.entry_assignments
    (environment,is_test,anonymous_id,first_steps_run_id,variant)
select 'preview',true,encode(sha256(convert_to('catchup-history-'||n,'UTF8')),'hex'),
    gen_random_uuid(),case when n<=3 then 'A' else 'B' end
from generate_series(1,4) n;
insert into proplet_experiment_internal.entry_assignments
    (environment,is_test,anonymous_id,first_steps_run_id,variant,allocation_policy,allocation_ordinal,allocation_switched_at)
select 'preview',true,encode(sha256(convert_to('catchup-alternating-'||n,'UTF8')),'hex'),
    gen_random_uuid(),case when n=1 then 'A' else 'B' end,'alternating_v1',n,s.switched_at
from generate_series(1,2) n
cross join proplet_experiment_internal.entry_allocation_state s where s.environment='preview' and s.is_test;
alter table proplet_experiment_internal.entry_assignments enable trigger proplet_entry_allocate_v1;

do $$
declare
    activation jsonb;
    again jsonb;
begin
    activation := proplet_experiment_internal.activate_entry_catchup_v1('preview',true);
    if (activation->>'snapshot_a')::bigint<>4 or (activation->>'snapshot_b')::bigint<>2
       or activation->>'target_variant'<>'B' or (activation->>'quota')::bigint<>2
       or (activation->>'allocated')::bigint<>0 or activation->>'activated_at' is null then
        raise exception 'Wrong fixed activation snapshot';
    end if;
    again := proplet_experiment_internal.activate_entry_catchup_v1('preview',true);
    if again<>activation then raise exception 'Repeated activation changed its snapshot'; end if;

    activation := proplet_experiment_internal.activate_entry_catchup_v1('local',true);
    if (activation->>'quota')::bigint<>0 or activation->>'target_variant' is not null then
        raise exception 'Equal counts created a catchup quota';
    end if;
    if has_function_privilege('service_role','proplet_experiment_internal.activate_entry_catchup_v1(text,boolean)','execute')
       or has_function_privilege('anon','proplet_experiment_internal.activate_entry_catchup_v1(text,boolean)','execute')
       or has_table_privilege('service_role','proplet_experiment_internal.entry_catchup_state','insert')
       or has_column_privilege('service_role','proplet_experiment_internal.entry_catchup_state','quota','update') then
        raise exception 'Activation or quota is not operator-only';
    end if;
end;
$$;

set local role service_role;
do $$
declare
    first_assign jsonb;
    second_assign jsonb;
    third_assign jsonb;
    first_flow uuid := gen_random_uuid();
    first_identity text := encode(sha256(convert_to('catchup-first','UTF8')),'hex');
    blocked_identity text := encode(sha256(convert_to('catchup-blocked','UTF8')),'hex');
    before_state jsonb;
    after_state jsonb;
begin
    select to_jsonb(s) into before_state from proplet_experiment_internal.entry_catchup_state s
    where environment='preview' and is_test;

    -- Neither old identity, prior onboarding, nor an enrollment-disabled request
    -- reaches the INSERT trigger or consumes any of the fixed quota.
    perform public.proplet_entry_assign_v1('preview',true,
        encode(sha256(convert_to('catchup-history-1','UTF8')),'hex'),null,gen_random_uuid(),'qa','qa','qa',true);
    insert into public.product_events(id,anonymous_id,event_type,app_version,environment,is_test)
    values(gen_random_uuid(),blocked_identity,'starter_started','qa','preview',true);
    if public.proplet_entry_assign_v1('preview',true,blocked_identity,null,gen_random_uuid(),'qa','qa','qa',true)->>'variant' is not null
       or public.proplet_entry_assign_v1('preview',true,first_identity,null,first_flow,'qa','qa','qa',false)->>'variant' is not null then
        raise exception 'Ineligible identity entered catchup';
    end if;
    select to_jsonb(s) into after_state from proplet_experiment_internal.entry_catchup_state s
    where environment='preview' and is_test;
    if after_state<>before_state then raise exception 'Ineligible identity consumed quota'; end if;

    first_assign := public.proplet_entry_assign_v1('preview',true,first_identity,null,first_flow,'qa','qa','qa',true);
    if first_assign->>'variant'<>'B' or first_assign->>'allocationPolicy'<>'catchup_v1'
       or (first_assign->>'allocationOrdinal')::bigint<>1
       or (first_assign->>'allocationSwitchedAt')::timestamptz<>(before_state->>'activated_at')::timestamptz then
        raise exception 'First catchup assignment is wrong';
    end if;
    if public.proplet_entry_assign_v1('preview',true,first_identity,null,gen_random_uuid(),'qa','qa','qa',true)<>first_assign then
        raise exception 'Catchup retry changed assignment';
    end if;

    -- A uniqueness failure happens after the trigger's quota increment.
    begin
        perform public.proplet_entry_assign_v1('preview',true,repeat('0',64),null,first_flow,'qa','qa','qa',true);
        raise exception 'Duplicate first steps flow accepted';
    exception when unique_violation then null;
    end;
    if (select allocated from proplet_experiment_internal.entry_catchup_state
        where environment='preview' and is_test)<>1 then
        raise exception 'Failed allocation consumed quota';
    end if;
    if (select last_ordinal from proplet_experiment_internal.entry_allocation_state
        where environment='preview' and is_test)<>2 then
        raise exception 'Catchup changed saved alternating position';
    end if;

    second_assign := public.proplet_entry_assign_v1('preview',true,repeat('1',64),null,gen_random_uuid(),'qa','qa','qa',true);
    third_assign := public.proplet_entry_assign_v1('preview',true,repeat('2',64),null,gen_random_uuid(),'qa','qa','qa',true);
    if second_assign->>'variant'<>'B' or second_assign->>'allocationPolicy'<>'catchup_v1'
       or (second_assign->>'allocationOrdinal')::bigint<>2
       or third_assign->>'variant'<>'A' or third_assign->>'allocationPolicy'<>'alternating_v1'
       or (third_assign->>'allocationOrdinal')::bigint<>3 then
        raise exception 'Fixed quota was not exhausted/resumed exactly';
    end if;
    if (select allocated from proplet_experiment_internal.entry_catchup_state
        where environment='preview' and is_test)<>2 then
        raise exception 'Exhausted quota kept increasing';
    end if;
    -- The zero-quota namespace proceeds directly with its own alternating 1.
    third_assign := public.proplet_entry_assign_v1('local',true,repeat('3',64),null,gen_random_uuid(),'qa','qa','qa',true);
    if third_assign->>'variant'<>'A' or third_assign->>'allocationPolicy'<>'alternating_v1'
       or (third_assign->>'allocationOrdinal')::bigint<>1 then
        raise exception 'Namespace isolation/zero-quota fallthrough failed';
    end if;
end;
$$;
reset role;

do $$
declare
    activation jsonb;
begin
    -- Arm totals have changed, but neither exhausted nor zero quota reopens.
    activation := proplet_experiment_internal.activate_entry_catchup_v1('preview',true);
    if (activation->>'quota')::bigint<>2 or (activation->>'allocated')::bigint<>2
       or (activation->>'snapshot_a')::bigint<>4 or (activation->>'snapshot_b')::bigint<>2 then
        raise exception 'Catchup dynamically recalculated its original deficit';
    end if;
    activation := proplet_experiment_internal.activate_entry_catchup_v1('local',true);
    if (activation->>'quota')::bigint<>0 or (activation->>'snapshot_a')::bigint<>0
       or (activation->>'snapshot_b')::bigint<>0 then
        raise exception 'A zero quota was reopened after counts changed';
    end if;
    if (select to_jsonb(c) from proplet_experiment_internal.entry_control c)<>(select body from catchup_control_before) then
        raise exception 'Catchup modified the original control/window';
    end if;
end;
$$;
rollback;
