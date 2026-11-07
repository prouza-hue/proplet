-- Install an inactive one-off catchup overlay. Only an explicit operator call
-- snapshots the deficit. Neither this migration nor exhaustion changes the
-- original recruitment window or the saved alternating ordinal.
begin;
set local lock_timeout='5s';
set local statement_timeout='20s';

-- Match the previous cutover's lock order: active RPCs already hold a ledger
-- relation lock before taking the namespace advisory lock.
lock table proplet_experiment_internal.entry_assignments in access exclusive mode;
select pg_advisory_xact_lock(hashtextextended('first-board-v1:production:false',0));
select pg_advisory_xact_lock(hashtextextended('first-board-v1:preview:true',0));
select pg_advisory_xact_lock(hashtextextended('first-board-v1:local:true',0));

create table proplet_experiment_internal.entry_catchup_state (
    environment text not null check (environment in ('production','preview','local')),
    is_test boolean not null,
    activated_at timestamptz not null,
    snapshot_a bigint not null check (snapshot_a>=0),
    snapshot_b bigint not null check (snapshot_b>=0),
    target_variant text,
    quota bigint not null check (quota>=0),
    allocated bigint not null default 0 check (allocated>=0 and allocated<=quota),
    primary key(environment,is_test),
    check (is_test=(environment<>'production')),
    check (quota=abs(snapshot_a-snapshot_b)),
    check ((snapshot_a=snapshot_b and target_variant is null) or
           (snapshot_a<snapshot_b and target_variant is not null and target_variant='A') or
           (snapshot_a>snapshot_b and target_variant is not null and target_variant='B'))
);
alter table proplet_experiment_internal.entry_catchup_state enable row level security;
revoke all on proplet_experiment_internal.entry_catchup_state from public,anon,authenticated,service_role;
grant select,update(allocated) on proplet_experiment_internal.entry_catchup_state to service_role;

alter table proplet_experiment_internal.entry_assignments
    drop constraint entry_assignment_allocation_phase;
alter table proplet_experiment_internal.entry_assignments
    add constraint entry_assignment_allocation_phase check (
        (allocation_policy='hash50_v1' and allocation_ordinal is null and allocation_switched_at is null)
        or (allocation_policy='alternating_v1' and allocation_ordinal is not null
            and allocation_ordinal>0 and allocation_switched_at is not null
            and variant=case when allocation_ordinal%2=1 then 'A' else 'B' end)
        or (allocation_policy='catchup_v1' and allocation_ordinal is not null
            and allocation_ordinal>0 and allocation_switched_at is not null)
    );
create unique index entry_assignment_catchup_ordinal
    on proplet_experiment_internal.entry_assignments(environment,is_test,allocation_ordinal)
    where allocation_policy='catchup_v1';

create function proplet_experiment_internal.activate_entry_catchup_v1(p_environment text,p_is_test boolean)
returns jsonb language plpgsql security invoker
set search_path = pg_catalog,proplet_experiment_internal
set statement_timeout='5s'
as $$
declare
    control proplet_experiment_internal.entry_control%rowtype;
    catchup proplet_experiment_internal.entry_catchup_state%rowtype;
    counted_a bigint;
    counted_b bigint;
    activated timestamptz;
begin
    if p_environment is null or p_environment not in ('production','preview','local')
       or p_is_test is distinct from (p_environment<>'production') then
        raise exception 'Unsupported entry catchup namespace' using errcode='22023';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('first-board-v1:'||p_environment||':'||p_is_test::text,0));
    if p_environment='production' then
        select * into control from proplet_experiment_internal.entry_control where singleton for share;
    end if;
    select * into catchup from proplet_experiment_internal.entry_catchup_state
    where environment=p_environment and is_test=p_is_test for update;
    if found then return to_jsonb(catchup); end if;

    -- Also serialize with the saved alternating allocator. The snapshot is
    -- taken only once and never recomputed from subsequent arm totals.
    perform 1 from proplet_experiment_internal.entry_allocation_state
    where environment=p_environment and is_test=p_is_test for update;
    if not found then raise exception 'Missing entry allocation state' using errcode='22023'; end if;
    activated := clock_timestamp();
    if p_environment='production' and
       (not coalesce(control.enabled,false) or activated<control.starts_at or activated>=control.ends_at) then
        raise exception 'Entry catchup requires an active recruitment window' using errcode='22023';
    end if;
    select count(*) filter(where variant='A'),count(*) filter(where variant='B')
    into counted_a,counted_b from proplet_experiment_internal.entry_assignments
    where environment=p_environment and is_test=p_is_test;
    insert into proplet_experiment_internal.entry_catchup_state
        (environment,is_test,activated_at,snapshot_a,snapshot_b,target_variant,quota)
    values(p_environment,p_is_test,activated,counted_a,counted_b,
        case when counted_a<counted_b then 'A' when counted_a>counted_b then 'B' else null end,
        abs(counted_a-counted_b))
    returning * into catchup;
    return to_jsonb(catchup);
end;
$$;
-- Activation belongs exclusively to the database operator, including when
-- hosted default privileges would otherwise grant service_role EXECUTE.
revoke all on function proplet_experiment_internal.activate_entry_catchup_v1(text,boolean)
    from public,anon,authenticated,service_role;

create or replace function public.proplet_entry_allocate_v1()
returns trigger language plpgsql security invoker
set search_path = pg_catalog,proplet_experiment_internal
as $$
declare
    control proplet_experiment_internal.entry_control%rowtype;
begin
    -- Also protect direct/stale INSERT callers that do not hold the RPC lock.
    perform pg_advisory_xact_lock(hashtextextended('first-board-v1:'||new.environment||':'||new.is_test::text,0));
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
commit;
