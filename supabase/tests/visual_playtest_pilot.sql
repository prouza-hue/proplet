-- DISPOSABLE DATABASE ONLY. Runner must explicitly set proplet.visual_pilot_test=isolated.
begin;
do $$ begin
  if current_setting('proplet.visual_pilot_test', true) is distinct from 'isolated' then
    raise exception 'Disposable visual pilot test database required';
  end if;
end $$;
do $test$
declare
  campaign text := 'visual-refresh-20261027-v1';
  player uuid := gen_random_uuid();
  reviewer uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  data jsonb;
  before_row jsonb;
  after_row jsonb;
  role_name text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    if has_table_privilege(role_name, 'public.visual_playtest_participants', 'SELECT')
       or has_table_privilege(role_name, 'public.visual_playtest_participants', 'UPDATE')
       or has_table_privilege(role_name, 'public.visual_playtest_campaigns', 'SELECT')
       or has_function_privilege(role_name, 'public.proplet_visual_playtest_v1(text,uuid,text,text,text)', 'EXECUTE') then
      raise exception 'Public pilot access granted to %', role_name;
    end if;
  end loop;
  if exists(select 1 from pg_class where oid in ('public.visual_playtest_campaigns'::regclass,
      'public.visual_playtest_participants'::regclass) and not relrowsecurity) then
    raise exception 'Missing RLS';
  end if;
  if exists(select 1 from pg_proc where oid='public.proplet_visual_playtest_v1(text,uuid,text,text,text)'::regprocedure and prosecdef) then
    raise exception 'Unnecessary definer privileges';
  end if;
  insert into public.players(id,name,family_code,token_hash)
    values(player,'Pilot fixture','SOLO_'||substr(player::text,1,8),player::text),
          (reviewer,'Reviewer fixture','SOLO_'||substr(reviewer::text,1,8),reviewer::text);
  insert into public.visual_playtest_participants(campaign_id,player_id,reviewer)
    values(campaign,player,false),(campaign,reviewer,true);
  if public.proplet_visual_playtest_v1(campaign,player)->>'eligible' <> 'false' then
    raise exception 'Campaign must be inactive by default';
  end if;
  update public.visual_playtest_campaigns set active=true where campaign_id=campaign;
  if public.proplet_visual_playtest_v1(campaign,outsider)->>'eligible' <> 'false' then
    raise exception 'Outsider access';
  end if;
  if public.proplet_visual_playtest_v1('other',player)->>'eligible' <> 'false' then
    raise exception 'Wrong campaign access';
  end if;
  select to_jsonb(p) into before_row from public.visual_playtest_participants p where player_id=player;
  data := public.proplet_visual_playtest_v1(campaign,player);
  select to_jsonb(p) into after_row from public.visual_playtest_participants p where player_id=player;
  if before_row <> after_row or data->>'canShowInvite'<>'true' then raise exception 'GET mutated state'; end if;
  data := public.proplet_visual_playtest_v1(campaign,player,'shown');
  if data->>'displayGranted'<>'true' or data->>'shownCount'<>'1' then raise exception 'First display'; end if;
  data := public.proplet_visual_playtest_v1(campaign,player,'shown');
  if data->>'displayGranted'<>'false' or data->>'shownCount'<>'1' then raise exception 'Duplicate display'; end if;
  data := public.proplet_visual_playtest_v1(campaign,player,'snooze');
  if (data->>'snoozedUntil')::timestamptz <> now()+interval '7 days' then raise exception 'Snooze must last7d'; end if;
  update public.visual_playtest_participants set last_shown_at=now()-interval '8 days' where player_id=player;
  if public.proplet_visual_playtest_v1(campaign,player,'shown')->>'displayGranted'<>'false' then raise exception 'Snooze bypass'; end if;
  update public.visual_playtest_participants set snoozed_until=now()-interval '1 second' where player_id=player;
  data := public.proplet_visual_playtest_v1(campaign,player,'shown');
  if data->>'displayGranted'<>'true' or data->>'shownCount'<>'2' then raise exception 'Second display'; end if;
  update public.visual_playtest_participants set last_shown_at=now()-interval '8 days' where player_id=player;
  data := public.proplet_visual_playtest_v1(campaign,player,'shown');
  if data->>'displayGranted'<>'false' or data->>'shownCount'<>'2' then raise exception 'Display cap bypass'; end if;
  data := public.proplet_visual_playtest_v1(campaign,player,'accept');
  if data->>'status'<>'accepted' or data->>'canShowInvite'<>'false' then raise exception 'Accept'; end if;
  data := public.proplet_visual_playtest_v1(campaign,player,'feedback','better','first');
  data := public.proplet_visual_playtest_v1(campaign,player,'feedback','worse',repeat('ž',2000));
  data := public.proplet_visual_playtest_v1(campaign,player);
  if data#>>'{feedback,rating}'<>'worse' or char_length(data#>>'{feedback,comment}')<>2000 then raise exception 'Persistent edit'; end if;
  begin
    perform public.proplet_visual_playtest_v1(campaign,player,'feedback','better',repeat('x',2001));
    raise exception 'Oversize accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.proplet_visual_playtest_v1(campaign,player,'feedback',null,'text');
    raise exception 'No rating accepted';
  exception when invalid_parameter_value then null; end;
  data := public.proplet_visual_playtest_v1(campaign,reviewer,'shown');
  if data->>'role'<>'reviewer' or data->>'displayGranted'<>'false' then raise exception 'Reviewer invitation'; end if;
  data := public.proplet_visual_playtest_v1(campaign,reviewer,'decline');
  if public.proplet_visual_playtest_v1(campaign,reviewer,'accept')->>'error'<>'declined' then raise exception 'Decline resurrected'; end if;
  update public.visual_playtest_participants set active=false where player_id=player;
  if public.proplet_visual_playtest_v1(campaign,player)->>'eligible'<>'false' then raise exception 'Revoked participant'; end if;
  update public.visual_playtest_campaigns set active=false where campaign_id=campaign;
  if public.proplet_visual_playtest_v1(campaign,reviewer)->>'eligible'<>'false' then raise exception 'Deactivated campaign'; end if;
end;
$test$;
rollback;
