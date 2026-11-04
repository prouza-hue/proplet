-- Immutable randomization units. Account claims already transfer the corresponding
-- server-authored product event; its UUID links the two actors without re-bucketing.
begin;
-- Operator-owned production switch. Assignment readers lock this row through
-- commit; once disabling commits no in-flight transaction can enroll after it.
create table proplet_experiment_internal.entry_control (
    singleton boolean primary key default true check (singleton),
    enabled boolean not null default false
);
insert into proplet_experiment_internal.entry_control default values;
alter table proplet_experiment_internal.entry_control enable row level security;
revoke all on proplet_experiment_internal.entry_control from public,anon,authenticated,service_role;
-- FOR SHARE needs UPDATE on one column. The constrained key can only stay true.
grant select,update(singleton) on proplet_experiment_internal.entry_control to service_role;

create table proplet_experiment_internal.entry_assignments (
    environment text not null check (environment in ('production','preview','local')),
    is_test boolean not null,
    anonymous_id text not null check (anonymous_id ~ '^[a-f0-9]{64}$'),
    first_steps_run_id uuid not null,
    variant text not null check (variant in ('A','B')),
    assigned_at timestamptz not null default clock_timestamp(),
    event_id uuid not null unique default gen_random_uuid(),
    primary key(environment,is_test,anonymous_id),
    unique(environment,is_test,first_steps_run_id)
);
alter table proplet_experiment_internal.entry_assignments enable row level security;
revoke all on proplet_experiment_internal.entry_assignments from public,anon,authenticated;
grant select,insert on proplet_experiment_internal.entry_assignments to service_role;

create function public.proplet_entry_assign_v1(
    p_environment text, p_is_test boolean, p_anonymous_id text, p_player uuid,
    p_flow uuid, p_client_release text, p_release text, p_app_version text, p_enroll boolean
) returns jsonb language plpgsql security invoker
set search_path = pg_catalog,proplet_experiment_internal
set statement_timeout = '5s'
as $$
declare
    a proplet_experiment_internal.entry_assignments%rowtype;
    decision_at timestamptz;
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
            if p_environment='production' and not coalesce((
                select enabled from proplet_experiment_internal.entry_control where singleton for share
            ),false) then return no_variant; end if;
            if exists(select from proplet_experiment_internal.first_board_assignments
                      where environment=p_environment and anonymous_id=p_anonymous_id)
               or exists(select from public.puzzle_attempts where anonymous_id=p_anonymous_id)
               or exists(select from public.play_sessions where actor_key='a:'||p_anonymous_id)
               or exists(select from public.product_events where anonymous_id=p_anonymous_id and
                    (event_type ~ '^(onboarding_|starter_|first_steps_|first_board_)'
                     or (p_environment='production' and (created_at < timestamptz '2026-11-15 23:00Z' or is_test)))) then
                return no_variant;
            end if;
            decision_at := clock_timestamp();
            if p_environment='production' and (decision_at < timestamptz '2026-11-15 23:00Z'
                or decision_at >= timestamptz '2026-11-29 23:00Z') then return no_variant; end if;
            insert into proplet_experiment_internal.entry_assignments
                (environment,is_test,anonymous_id,first_steps_run_id,assigned_at,variant)
            values(p_environment,p_is_test,p_anonymous_id,p_flow,decision_at,
                case when get_byte(sha256(convert_to('new-player-entry-v1:'||p_anonymous_id,'UTF8')),0)<128
                     then 'A' else 'B' end)
            returning * into a;
            insert into public.product_events(id,anonymous_id,event_type,app_version,created_at,environment,
                is_test,measurement_version,onboarding_version,client_release,release,context)
            values(a.event_id,p_anonymous_id,'entry_experiment_assigned',p_app_version,a.assigned_at,p_environment,
                p_is_test,2,'board-v3-short',p_client_release,p_release,
                jsonb_build_object('entry_experiment','new-player-entry-v1','entry_variant',a.variant,
                    'first_steps_run_id',a.first_steps_run_id,'puzzle_id','g4-e-009','assignment_origin','server'));
        end if;
    end if;
    return jsonb_build_object('key','new-player-entry-v1','variant',a.variant,
        'firstStepsRunId',a.first_steps_run_id,'boardId','g4-e-009');
end;
$$;
revoke all on function public.proplet_entry_assign_v1(text,boolean,text,uuid,uuid,text,text,text,boolean)
    from public,anon,authenticated;
grant execute on function public.proplet_entry_assign_v1(text,boolean,text,uuid,uuid,text,text,text,boolean)
    to service_role;
commit;
