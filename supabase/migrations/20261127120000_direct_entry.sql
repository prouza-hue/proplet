-- Route fresh players through the existing no-training flow once enabled.
-- Preserve the historical experiment control and assignments.
begin;
set local lock_timeout='5s';

create table proplet_experiment_internal.entry_direct_control (
    environment text primary key check (environment in ('production','preview','local')),
    lock_marker boolean not null default true check (lock_marker),
    enabled boolean not null default false,
    starts_at timestamptz,
    check (not enabled or starts_at is not null)
);
insert into proplet_experiment_internal.entry_direct_control (environment)
values ('production');
alter table proplet_experiment_internal.entry_direct_control enable row level security;
revoke all on proplet_experiment_internal.entry_direct_control from public,anon,authenticated,service_role;
-- SELECT FOR SHARE needs UPDATE on a column. The service cannot change the schedule or enable enrollment.
grant select,update(lock_marker) on proplet_experiment_internal.entry_direct_control to service_role;

alter table proplet_experiment_internal.entry_assignments
    drop constraint entry_assignment_allocation_phase,
    add constraint entry_assignment_allocation_phase check (
        (allocation_policy in ('hash50_v1','direct_entry_v1')
            and allocation_ordinal is null and allocation_switched_at is null
            and (allocation_policy<>'direct_entry_v1' or variant='B'))
        or (allocation_policy='alternating_v1' and allocation_ordinal is not null
            and allocation_ordinal>0 and allocation_switched_at is not null
            and variant=case when allocation_ordinal%2=1 then 'A' else 'B' end)
        or (allocation_policy='catchup_v1' and allocation_ordinal is not null
            and allocation_ordinal>0 and allocation_switched_at is not null)
    );

create or replace function public.proplet_entry_allocate_v1()
returns trigger language plpgsql security invoker
set search_path = pg_catalog,proplet_experiment_internal
as $$
declare
    control proplet_experiment_internal.entry_control%rowtype;
    direct_entry proplet_experiment_internal.entry_direct_control%rowtype;
begin
    -- Also protect direct/stale INSERT callers that do not hold the RPC lock.
    perform pg_advisory_xact_lock(hashtextextended('first-board-v1:'||new.environment||':'||new.is_test::text,0));
    if new.allocation_policy='direct_entry_v1' then
        select * into direct_entry from proplet_experiment_internal.entry_direct_control
        where environment=new.environment for share;
        new.assigned_at := clock_timestamp();
        if not found or not direct_entry.enabled
           or new.is_test is distinct from (new.environment<>'production')
           or new.assigned_at<direct_entry.starts_at then
            raise exception 'Direct entry is inactive' using errcode='22023';
        end if;
        new.variant := 'B';
        new.allocation_ordinal := null;
        new.allocation_switched_at := null;
        return new;
    end if;
    if new.environment='production' then
        select * into control from proplet_experiment_internal.entry_control where singleton for share;
        if not found or not control.enabled then
            raise exception 'Entry allocation is disabled' using errcode='22023';
        end if;
    end if;

    update proplet_experiment_internal.entry_catchup_state
    set allocated=allocated+1
    where environment=new.environment and is_test=new.is_test and allocated<quota
    returning target_variant,allocated,activated_at
    into new.variant,new.allocation_ordinal,new.allocation_switched_at;
    if found then
        new.allocation_policy := 'catchup_v1';
    else
        update proplet_experiment_internal.entry_allocation_state
        set last_ordinal=last_ordinal+1
        where environment=new.environment and is_test=new.is_test
        returning last_ordinal,switched_at into new.allocation_ordinal,new.allocation_switched_at;
        if not found then
            raise exception 'Unsupported entry allocation namespace' using errcode='22023';
        end if;
        new.allocation_policy := 'alternating_v1';
        new.variant := case when new.allocation_ordinal%2=1 then 'A' else 'B' end;
    end if;
    -- A failure below or in the receipt writer rolls the selected counter back.
    new.assigned_at := clock_timestamp();
    if new.environment='production' and
       (new.assigned_at<control.starts_at or new.assigned_at>=control.ends_at) then
        raise exception 'Entry allocation window closed' using errcode='22023';
    end if;
    return new;
end;
$$;
revoke all on function public.proplet_entry_allocate_v1() from public,anon,authenticated;
grant execute on function public.proplet_entry_allocate_v1() to service_role;

create or replace function public.proplet_entry_assign_v1(
    p_environment text, p_is_test boolean, p_anonymous_id text, p_player uuid,
    p_flow uuid, p_client_release text, p_release text, p_app_version text, p_enroll boolean
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog,proplet_experiment_internal
set statement_timeout = '5s'
as $$
declare
    a proplet_experiment_internal.entry_assignments%rowtype;
    decision_at timestamptz;
    direct_entry proplet_experiment_internal.entry_direct_control%rowtype;
    allocation text := 'hash50_v1';
    eligibility_start timestamptz;
    control proplet_experiment_internal.entry_control%rowtype;
    no_variant constant jsonb := '{"variant":null}';
begin
    if p_environment not in ('production','local','preview') or p_environment is null
       or p_is_test is distinct from (p_environment <> 'production') or p_flow is null then
        return no_variant;
    end if;
    if p_player is not null then
        -- An account can claim multiple installations. Resolve only a matching
        -- claimed flow, never substitute a different installation's assignment.
        select x.* into a from proplet_experiment_internal.entry_assignments x
        join public.product_events e on e.id=x.event_id
        where x.environment=p_environment and x.is_test=p_is_test
          and e.player_id=p_player and x.first_steps_run_id=p_flow;
        if not found then return no_variant; end if;
    else
        if p_anonymous_id is null or p_anonymous_id !~ '^[a-f0-9]{64}$' then
            raise exception 'Invalid entry identity' using errcode='22023';
        end if;
        perform pg_advisory_xact_lock(hashtextextended('entry-v1:'||p_environment||':'||p_anonymous_id,0));
        select * into a from proplet_experiment_internal.entry_assignments
        where environment=p_environment and is_test=p_is_test and anonymous_id=p_anonymous_id;
        if not found then
            if p_enroll is not true then return no_variant; end if;
            -- Serialize eligibility with historical first-board allocations as well as same-identity retries.
            perform pg_advisory_xact_lock(hashtextextended('first-board-v1:'||p_environment||':'||p_is_test::text,0));
            decision_at := clock_timestamp();
            select * into direct_entry from proplet_experiment_internal.entry_direct_control
            where environment=p_environment for share;
            if direct_entry.enabled and decision_at>=direct_entry.starts_at then
                allocation := 'direct_entry_v1';
                eligibility_start := direct_entry.starts_at;
            elsif p_environment='production' then
                select * into control from proplet_experiment_internal.entry_control where singleton for share;
                if not found or not control.enabled or decision_at<control.starts_at
                   or decision_at>=control.ends_at then return no_variant; end if;
                eligibility_start := control.starts_at;
            end if;
            if exists(select from proplet_experiment_internal.first_board_assignments
                      where environment=p_environment and anonymous_id=p_anonymous_id)
               or exists(select from public.puzzle_attempts where anonymous_id=p_anonymous_id)
               or exists(select from public.play_sessions where actor_key='a:'||p_anonymous_id)
               or exists(select from public.product_events where anonymous_id=p_anonymous_id and
                    (event_type ~ '^(onboarding_|starter_|first_steps_|first_board_)'
                     or (p_environment='production' and (created_at < eligibility_start or is_test)))) then
                return no_variant;
            end if;
            insert into proplet_experiment_internal.entry_assignments
                (environment,is_test,anonymous_id,first_steps_run_id,assigned_at,variant,allocation_policy)
            values(p_environment,p_is_test,p_anonymous_id,p_flow,decision_at,
                'A',allocation) -- BEFORE INSERT determines the arm.
            returning * into a;
            insert into public.product_events(id,anonymous_id,event_type,app_version,created_at,environment,
                is_test,measurement_version,onboarding_version,client_release,release,context)
            values(a.event_id,p_anonymous_id,'entry_experiment_assigned',p_app_version,a.assigned_at,p_environment,
                p_is_test,2,'board-v3-short',p_client_release,p_release,
                jsonb_build_object('entry_experiment','new-player-entry-v1','entry_variant',a.variant,
                    'first_steps_run_id',a.first_steps_run_id,'puzzle_id','g4-e-009','assignment_origin','server',
                    'entry_allocation_policy',a.allocation_policy,
                    'entry_allocation_ordinal',a.allocation_ordinal,
                    'entry_allocation_switched_at',a.allocation_switched_at));
        end if;
    end if;
    return jsonb_build_object('key','new-player-entry-v1','variant',a.variant,
        'firstStepsRunId',a.first_steps_run_id,'boardId','g4-e-009',
        'allocationPolicy',a.allocation_policy,'allocationOrdinal',a.allocation_ordinal,
        'allocationSwitchedAt',a.allocation_switched_at);
end;
$$;
revoke all on function public.proplet_entry_assign_v1(text,boolean,text,uuid,uuid,text,text,text,boolean)
    from public,anon,authenticated;
grant execute on function public.proplet_entry_assign_v1(text,boolean,text,uuid,uuid,text,text,text,boolean)
    to service_role;
commit;
