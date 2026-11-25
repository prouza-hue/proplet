-- Run only on the isolated eanzztstmwlamwfdskbf QA project, outside the game migration chain.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
do $$
begin
  if not exists (select 1 from public.monthly_competition_settings where isolated) then
    raise exception 'Requires the isolated review database';
  end if;
end $$;

create schema if not exists proplet_editorial;
revoke all on schema proplet_editorial from public,anon,authenticated,service_role;
create table if not exists proplet_editorial.tajenka_batch (
  series text primary key check (series='2026-12'),
  token_sha256 bytea not null check (octet_length(token_sha256)=32),
  revision bigint not null default 0 check (revision>=0),
  submitted_revision bigint,
  submitted_at timestamptz,
  processed_revision bigint check (processed_revision is null or processed_revision between 0 and revision),
  check ((submitted_revision is null) = (submitted_at is null)),
  check (submitted_revision is null or submitted_revision=revision)
);
create table if not exists proplet_editorial.tajenka_reviews (
  edition smallint primary key check (edition between 26 and 66),
  version bigint not null check (version>=1),
  fields jsonb not null check (jsonb_typeof(fields)='object' and octet_length(fields::text)<=65536
    and fields - array['phrase','comment','status','clues','clueComments']::text[]='{}'::jsonb)
);
alter table proplet_editorial.tajenka_batch enable row level security;
alter table proplet_editorial.tajenka_reviews enable row level security;
revoke all on proplet_editorial.tajenka_batch,proplet_editorial.tajenka_reviews
  from public,anon,authenticated,service_role;

create or replace function public.proplet_tajenka_editorial_202612_v1(
  p_key text, p_action text, p_edition integer default null, p_version bigint default null,
  p_fields jsonb default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  batch proplet_editorial.tajenka_batch%rowtype;
  row_version bigint := 0;
  row_fields jsonb := '{}'::jsonb;
  reviews jsonb;
  submitted jsonb;
  supplied_hash bytea;
  mismatch integer := 0;
  field_name text;
  item jsonb;
begin
  if p_key is null or p_key !~ '^[A-Za-z0-9_-]{32,128}$' then
    raise exception 'Review access denied' using errcode='42501';
  end if;
  select * into batch from proplet_editorial.tajenka_batch where series='2026-12';
  if not found then raise exception 'Review access denied' using errcode='42501'; end if;
  supplied_hash := sha256(convert_to(p_key,'UTF8'));
  -- Fixed-length constant-work comparison, including callers that reach PostgREST directly.
  for i in 0..31 loop
    mismatch := mismatch | (get_byte(supplied_hash,i) # get_byte(batch.token_sha256,i));
  end loop;
  if mismatch<>0 then raise exception 'Review access denied' using errcode='42501'; end if;

  if p_action='read' then
    -- One SQL snapshot joins all sheets with exactly the revision and handoff seen by the reader.
    select jsonb_build_object(
      'revision',b.revision,
      'submission',case when b.submitted_at is not null then
        jsonb_build_object('revision',b.revision,'submittedAt',b.submitted_at) end,
      'reviews',coalesce((select jsonb_object_agg('tajenka-v2-week-'||r.edition,
        jsonb_build_object('version',r.version,'fields',r.fields)) from proplet_editorial.tajenka_reviews r),'{}'::jsonb))
      into reviews from proplet_editorial.tajenka_batch b where b.series='2026-12';
    return reviews;
  end if;
  if p_action is null or p_action not in ('write','submit') or p_version is null or p_version<0 then
    raise exception 'Invalid review action' using errcode='22023';
  end if;
  -- The single batch lock orders all changes and submissions, including edits to different sheets.
  select * into strict batch from proplet_editorial.tajenka_batch where series='2026-12' for update;
  submitted := case when batch.submitted_at is not null then
    jsonb_build_object('revision',batch.revision,'submittedAt',batch.submitted_at) end;
  if p_action='submit' then
    if p_version<>batch.revision then
      return jsonb_build_object('conflict',true,'revision',batch.revision,'submission',submitted);
    end if;
    if submitted is null then
      update proplet_editorial.tajenka_batch set submitted_at=statement_timestamp(),submitted_revision=revision
        where series='2026-12' returning submitted_at into batch.submitted_at;
      submitted := jsonb_build_object('revision',batch.revision,'submittedAt',batch.submitted_at);
    end if;
    return jsonb_build_object('revision',batch.revision,'submission',submitted);
  end if;

  if p_edition is null or p_edition not between 26 and 66 or p_fields is null or
    jsonb_typeof(p_fields)<>'object' or octet_length(p_fields::text)>65536 or
    p_fields-array['phrase','comment','status','clues','clueComments']::text[]<>'{}'::jsonb then
    raise exception 'Invalid review sheet' using errcode='22023';
  end if;
  if (p_fields?'status' and coalesce(p_fields->>'status','') not in ('pending','approved','revise'))
    or (p_fields?'phrase' and (jsonb_typeof(p_fields->'phrase')<>'string' or char_length(p_fields->>'phrase')>240))
    or (p_fields?'comment' and (jsonb_typeof(p_fields->'comment')<>'string' or char_length(p_fields->>'comment')>4000)) then
    raise exception 'Invalid review fields' using errcode='22023';
  end if;
  foreach field_name in array array['clues','clueComments'] loop
    if p_fields?field_name then
      if jsonb_typeof(p_fields->field_name)<>'object' or (select count(*) from jsonb_object_keys(p_fields->field_name))>16 then
        raise exception 'Invalid clue fields' using errcode='22023';
      end if;
      for item in select value from jsonb_each(p_fields->field_name) loop
        if jsonb_typeof(item)<>'string' or char_length(item#>>'{}')>(case when field_name='clues' then 320 else 2000 end) then
          raise exception 'Invalid clue text' using errcode='22023';
        end if;
      end loop;
    end if;
  end loop;
  select r.version,r.fields into row_version,row_fields from proplet_editorial.tajenka_reviews r where r.edition=p_edition;
  if not found then row_version:=0; row_fields:='{}'::jsonb; end if;
  if row_version<>p_version then
    return jsonb_build_object('conflict',true,'version',row_version,'fields',row_fields,'revision',batch.revision,'submission',submitted);
  end if;
  if row_fields<>p_fields then
    row_version:=row_version+1;
    insert into proplet_editorial.tajenka_reviews(edition,version,fields) values(p_edition,row_version,p_fields)
      on conflict(edition) do update set version=excluded.version,fields=excluded.fields;
    update proplet_editorial.tajenka_batch set revision=revision+1,submitted_revision=null,submitted_at=null
      where series='2026-12' returning revision into batch.revision;
    submitted:=null;
  end if;
  return jsonb_build_object('version',row_version,'fields',p_fields,'revision',batch.revision,'submission',submitted);
end;
$$;
revoke all on function public.proplet_tajenka_editorial_202612_v1(text,text,integer,bigint,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.proplet_tajenka_editorial_202612_v1(text,text,integer,bigint,jsonb) to anon;
notify pgrst, 'reload schema';
commit;
