-- Isolated synthetic identities; acceptance runs under the production RPC role.
begin;
insert into public.players(id,name,family_code,token_hash)
values('ed555555-0000-4000-8000-000000000001','Entry QA','SOLO_ENTRY','entry-claim-fixture');
-- Model rows persisted before the migration without consuming the new counter.
alter table proplet_experiment_internal.entry_assignments disable trigger proplet_entry_allocate_v1;
insert into proplet_experiment_internal.entry_assignments
    (environment,is_test,anonymous_id,first_steps_run_id,variant,assigned_at)
select 'local',true,encode(sha256(convert_to('entry-legacy-fixture-'||arm,'UTF8')),'hex'),
    gen_random_uuid(),arm,clock_timestamp()-interval '1 day'
from (values ('A'),('B')) as legacy(arm);
alter table proplet_experiment_internal.entry_assignments enable trigger proplet_entry_allocate_v1;
set local role service_role;
do $$
declare
    flow uuid := gen_random_uuid();
    player constant uuid := 'ed555555-0000-4000-8000-000000000001';
    identity text;
    arm text;
    first_assign jsonb;
    result jsonb;
    seen text[] := '{}';
    before_ordinal bigint;
    legacy record;
begin
    select last_ordinal into before_ordinal from proplet_experiment_internal.entry_allocation_state
    where environment='local' and is_test;
    for legacy in select * from proplet_experiment_internal.entry_assignments
        where environment='local' and is_test and anonymous_id in (
            encode(sha256(convert_to('entry-legacy-fixture-A','UTF8')),'hex'),
            encode(sha256(convert_to('entry-legacy-fixture-B','UTF8')),'hex'))
    loop
        result := public.proplet_entry_assign_v1('local',true,legacy.anonymous_id,null,gen_random_uuid(),'qa','qa','qa',true);
        if result->>'variant'<>legacy.variant or result->>'firstStepsRunId'<>legacy.first_steps_run_id::text
           or result->>'allocationPolicy'<>'hash50_v1' or result->>'allocationOrdinal' is not null
           or result->>'allocationSwitchedAt' is not null then
            raise exception 'Historical hash assignment changed or was relabelled';
        end if;
    end loop;
    for i in 1..16 loop
        flow := gen_random_uuid();
        identity := encode(sha256(convert_to('entry-sql-fixture-'||i,'UTF8')),'hex');
        first_assign := public.proplet_entry_assign_v1('local',true,identity,null,flow,'qa','qa','qa',true);
        arm := first_assign->>'variant';
        if arm is null or arm not in ('A','B') or first_assign->>'boardId' <> 'g4-e-009' then
            raise exception 'New identity did not receive the pinned real board';
        end if;
        if first_assign->>'allocationPolicy'<>'alternating_v1'
           or (first_assign->>'allocationOrdinal')::bigint<>before_ordinal+i
           or arm<>(case when (before_ordinal+i)%2=1 then 'A' else 'B' end) then
            raise exception 'New assignments did not alternate exactly once per identity';
        end if;
        seen := array_append(seen,arm);
        result := public.proplet_entry_assign_v1('local',true,identity,null,gen_random_uuid(),'qa','qa','qa',true);
        if result <> first_assign then raise exception 'Refresh changed immutable flow/arm'; end if;
        if (select count(*) from public.product_events where anonymous_id=identity and
            event_type='entry_experiment_assigned' and context->>'first_steps_run_id'=flow::text) <> 1 then
            raise exception 'Missing/duplicated assignment receipt';
        end if;
    end loop;
    if not (seen @> array['A','B']) then raise exception 'Both alternating branches expected'; end if;
    if public.proplet_entry_assign_v1('local',true,identity,null,gen_random_uuid(),'qa','qa','qa',false) <> first_assign
       or public.proplet_entry_assign_v1('local',true,repeat('e',64),null,gen_random_uuid(),'qa','qa','qa',false)->>'variant' is not null then
        raise exception 'Disabled gate lost an existing assignment or created a new one';
    end if;
    -- Same update as the anonymous claim path, including loss of anonymous_id.
    update public.product_events set player_id=player,anonymous_id=null where anonymous_id=identity;
    if public.proplet_entry_assign_v1('local',true,null,player,flow,'qa','qa','qa',true) <> first_assign then
        raise exception 'Claimed assignment lost';
    end if;
    if public.proplet_entry_assign_v1('local',true,null,player,gen_random_uuid(),'qa','qa','qa',true)->>'variant' is not null then
        raise exception 'Authenticated player allocated a new flow';
    end if;
    identity := repeat('f',64);
    insert into public.product_events(id,anonymous_id,event_type,app_version,environment,is_test)
    values(gen_random_uuid(),identity,'starter_v1_requested','qa','local',true);
    if public.proplet_entry_assign_v1('local',true,identity,null,gen_random_uuid(),'qa','qa','qa',true)->>'variant' is not null then
        raise exception 'Returning onboarding identity entered test';
    end if;
    identity := repeat('d',64);
    insert into public.puzzle_attempts(id,anonymous_id,puzzle_id,challenge_key,mode,difficulty,started_at)
    values(gen_random_uuid(),identity,'old-free','free:old-free','free','easy',clock_timestamp());
    if public.proplet_entry_assign_v1('local',true,identity,null,gen_random_uuid(),'qa','qa','qa',true)->>'variant' is not null then
        raise exception 'Existing unfinished attempt entered experiment';
    end if;
    identity := repeat('c',64);
    perform public.proplet_first_board_assign('local',true,identity,gen_random_uuid(),40,'qa','qa','qa');
    if public.proplet_entry_assign_v1('local',true,identity,null,gen_random_uuid(),'qa','qa','qa',true)->>'variant' is not null then
        raise exception 'Existing first-board assignment entered experiment';
    end if;
    if public.proplet_entry_assign_v1('production',true,repeat('e',64),null,gen_random_uuid(),'qa','qa','qa',true)->>'variant' is not null then
        raise exception 'Synthetic production enrollment';
    end if;
    if has_function_privilege('anon','public.proplet_entry_assign_v1(text,boolean,text,uuid,uuid,text,text,text,boolean)','execute')
       or has_table_privilege('authenticated','proplet_experiment_internal.entry_assignments','insert') then
        raise exception 'Client can forge an assignment';
    end if;
    if has_function_privilege('anon','public.proplet_entry_allocate_v1()','execute')
       or has_table_privilege('authenticated','proplet_experiment_internal.entry_allocation_state','update') then
        raise exception 'Public client can mutate the alternating counter';
    end if;
    if (select last_ordinal from proplet_experiment_internal.entry_allocation_state
        where environment='local' and is_test)<>before_ordinal+16 then
        raise exception 'Retry, claim, or an ineligible identity consumed an ordinal';
    end if;
end;
$$;
reset role;
-- Production gating against the real database clock, entirely inside this
-- disposable database transaction. The operator controls the window.
do $$
declare
    stamp timestamptz := clock_timestamp();
    identity text := repeat('1',64);
    first_assign jsonb;
begin
    begin
        update proplet_experiment_internal.entry_control set enabled=true where singleton;
        raise exception 'Enabled an experiment without a time window';
    exception when check_violation then null;
    end;
    begin
        update proplet_experiment_internal.entry_control set starts_at=stamp,ends_at=stamp+interval '15 days' where singleton;
        raise exception 'Allowed a non-fourteen-day window';
    exception when check_violation then null;
    end;
    update proplet_experiment_internal.entry_control
    set enabled=true, starts_at=stamp+interval '1 hour', ends_at=stamp+interval '14 days 1 hour' where singleton;
    if public.proplet_entry_assign_v1('production',false,identity,null,gen_random_uuid(),'qa','qa','qa',true)->>'variant' is not null then
        raise exception 'Enrollment before database start';
    end if;
    update proplet_experiment_internal.entry_control
    set starts_at=stamp-interval '15 days', ends_at=stamp-interval '1 day' where singleton;
    if public.proplet_entry_assign_v1('production',false,identity,null,gen_random_uuid(),'qa','qa','qa',true)->>'variant' is not null then
        raise exception 'Enrollment after database end';
    end if;
    update proplet_experiment_internal.entry_control
    set starts_at=stamp-interval '1 hour', ends_at=stamp+interval '13 days 23 hours' where singleton;
    first_assign := public.proplet_entry_assign_v1('production',false,identity,null,gen_random_uuid(),'qa','qa','qa',true);
    if first_assign->>'variant' is null then raise exception 'Active database window did not enroll'; end if;
    insert into public.product_events(id,anonymous_id,event_type,app_version,environment,is_test,created_at)
    values(gen_random_uuid(),repeat('2',64),'app_open','qa','production',false,stamp-interval '2 hours');
    if public.proplet_entry_assign_v1('production',false,repeat('2',64),null,gen_random_uuid(),'qa','qa','qa',true)->>'variant' is not null then
        raise exception 'Identity predating the database start entered test';
    end if;
    update proplet_experiment_internal.entry_control set enabled=false where singleton;
    if public.proplet_entry_assign_v1('production',false,repeat('3',64),null,gen_random_uuid(),'qa','qa','qa',true)->>'variant' is not null then
        raise exception 'Kill switch admitted a new identity';
    end if;
    if public.proplet_entry_assign_v1('production',false,identity,null,gen_random_uuid(),'qa','qa','qa',true) <> first_assign then
        raise exception 'Kill switch changed an existing assignment';
    end if;
    update proplet_experiment_internal.entry_control
    set enabled=true, starts_at=stamp-interval '15 days', ends_at=stamp-interval '1 day' where singleton;
    if public.proplet_entry_assign_v1('production',false,identity,null,gen_random_uuid(),'qa','qa','qa',true) <> first_assign then
        raise exception 'Closed window changed an existing assignment';
    end if;
end;
$$;
rollback;
