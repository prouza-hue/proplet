-- Read-only verification after SUPABASE_MIGRATION_V4_01_38_ATOMIC_RESULT.sql

do $$
declare
  v_function oid;
  v_bad bigint;
begin
  v_function := pg_catalog.to_regprocedure(
    'public.proplet_submit_result_v1(uuid,text,text,text,jsonb)'
  );

  if v_function is null then
    raise exception 'VERIFY v4.01.38: proplet_submit_result_v1 is missing';
  end if;
  if not (select prosecdef from pg_catalog.pg_proc where oid = v_function) then
    raise exception 'VERIFY v4.01.38: RPC is not SECURITY DEFINER';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_proc
    where oid = v_function and proconfig @> array['search_path=']::text[]
  ) then
    raise exception 'VERIFY v4.01.38: RPC search_path is not fixed to empty';
  end if;
  if exists (
       select 1
       from pg_catalog.pg_proc p,
            lateral pg_catalog.aclexplode(
              pg_catalog.coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
            ) acl
       where p.oid = v_function and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
     )
     or pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE')
  then
    raise exception 'VERIFY v4.01.38: untrusted RPC EXECUTE grant exists';
  end if;
  if not pg_catalog.has_function_privilege('service_role', v_function, 'EXECUTE') then
    raise exception 'VERIFY v4.01.38: service_role cannot execute RPC';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'result_commands'
      and c.relkind = 'r' and c.relrowsecurity
  ) then
    raise exception 'VERIFY v4.01.38: result_commands or RLS is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'puzzle_runs'
      and column_name = 'result_command_id' and data_type = 'uuid'
  ) then
    raise exception 'VERIFY v4.01.38: puzzle_runs.result_command_id is missing';
  end if;

  select count(*) into v_bad
  from public.result_commands
  where receipt is null or committed_at is null;
  if v_bad <> 0 then
    raise exception 'VERIFY v4.01.38: % incomplete committed ledger rows', v_bad;
  end if;

  select count(*) into v_bad
  from public.result_commands c
  left join public.puzzle_runs r on r.result_command_id = c.id
  where r.id is null;
  if v_bad <> 0 then
    raise exception 'VERIFY v4.01.38: % committed commands lack a puzzle run', v_bad;
  end if;
end;
$$;

select
  (select count(*) from public.result_commands) as committed_commands,
  (select count(*) from public.puzzle_runs where result_command_id is not null) as atomic_runs,
  pg_catalog.has_table_privilege('anon', 'public.result_commands', 'SELECT') as anon_can_read_ledger,
  pg_catalog.has_table_privilege('authenticated', 'public.result_commands', 'SELECT') as authenticated_can_read_ledger,
  pg_catalog.has_table_privilege('service_role', 'public.result_commands', 'SELECT') as service_role_can_read_ledger;
