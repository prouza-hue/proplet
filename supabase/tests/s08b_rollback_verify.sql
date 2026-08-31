-- Run only after the Sprint 08B rollback script on a disposable branch.
do $$
begin
  if pg_catalog.to_regprocedure(
       'public.proplet_submit_result_v1(uuid,text,text,text,jsonb)'
     ) is not null
  then
    raise exception 'S08B rollback drill: RPC still exists';
  end if;
  if pg_catalog.to_regclass('public.result_commands') is null then
    raise exception 'S08B rollback drill: audit ledger was destructively removed';
  end if;
end;
$$;
