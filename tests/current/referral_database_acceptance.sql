create function public.referral_qa_fail_half() returns trigger language plpgsql as $$
begin
  if current_setting('qa.fail_reward',true)='1' and new.reward_key like 'referral_v1:%:invitee' then
    raise exception 'fault injection' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger referral_qa_fail_half before insert on public.account_rewards
for each row execute function public.referral_qa_fail_half();

do $qa$
declare inviter uuid:=gen_random_uuid(); invitee uuid:=gen_random_uuid(); old_player uuid:=gen_random_uuid();
  i integer; before_period bigint; before_lifetime bigint; after_period bigint; after_lifetime bigint; data jsonb;
begin
  perform set_config('request.headers','{}',true);
  insert into public.players(id,name) values(inviter,'Inviter'),(old_player,'Old player');
  data:=public.proplet_referral_create_v1(inviter,'QA_invite_20261012');
  if data->>'code'<>'QA_invite_20261012' then raise exception 'invite creation'; end if;
  if public.proplet_referral_create_v1(inviter,'different_valid_code')->>'code'<>'QA_invite_20261012' then raise exception 'invite must be stable'; end if;
  perform set_config('request.headers','{"x-proplet-referral-invite":"QA_invite_20261012"}',true);
  update public.players set name='Old renamed' where id=old_player;
  if exists(select 1 from public.referral_claims where invitee_id=old_player) then raise exception 'retrospective attribution'; end if;
  insert into public.players(id,name,family_code,team_joined_at) values(invitee,'Invitee','TEAM_QA',statement_timestamp());
  perform set_config('request.headers','{}',true);
  if not exists(select 1 from public.referral_claims where invitee_id=invitee and inviter_id=inviter) then raise exception 'signup attribution missing'; end if;
  begin
    update public.referral_claims set inviter_id=old_player where invitee_id=invitee;
    raise exception 'mutable attribution';
  exception when invalid_parameter_value then null; end;
  begin
    insert into public.referral_claims(invitee_id,inviter_id,code) values(inviter,inviter,'QA_invite_20261012');
    raise exception 'self referral permitted';
  exception when check_violation then null; end;
  insert into public.results(player_id,puzzle_id,challenge_key,mode,completed_at)
    values(invitee,'pre-signup','pre-signup','free',statement_timestamp()-interval '1 day');
  insert into public.results(player_id,puzzle_id,challenge_key,mode) values(invitee,'starter','starter','starter');
  insert into public.results(player_id,puzzle_id,challenge_key,mode) values
    (invitee,'board-a','free:board-a','free'),(invitee,'board-a','daily:board-a','daily'),
    (invitee,'board-b','daily:board-b','daily'),(invitee,'board-c','tajenka:board-c','tajenka'),
    (invitee,'board-d','daily-special:board-d','daily_special');
  -- A replay updates the same first-completion row, never progresses the invitation.
  update public.results set points=points where player_id=invitee and puzzle_id='board-b';
  if (select completed_boards from public.referral_claims where invitee_id=invitee)<>4 then raise exception 'mode/replay/puzzle dedup failed'; end if;
  if exists(select 1 from public.account_rewards where reward_key like 'referral_v1:%') then raise exception 'early reward'; end if;
  select period_xp,lifetime_xp into before_period,before_lifetime from public.proplet_rankings_xp_aggregate(statement_timestamp()-interval '2 days')
    where row_kind='player' and entity_id=invitee::text;
  -- Force failure of the recipient's half and prove that the first half, board and count roll back too.
  -- Fault injection below is installed by the acceptance runner before this block.
  perform set_config('qa.fail_reward','1',true);
  begin
    insert into public.results(player_id,puzzle_id,challenge_key,mode) values(invitee,'board-e','free:board-e','free');
    raise exception 'fault injection did not fire';
  exception when check_violation then null; end;
  if (select completed_boards from public.referral_claims where invitee_id=invitee)<>4
    or exists(select 1 from public.account_rewards where reward_key like 'referral_v1:%')
    or exists(select 1 from public.results where player_id=invitee and puzzle_id='board-e') then raise exception 'partial grant escaped transaction'; end if;
  perform set_config('qa.fail_reward','0',true);
  insert into public.results(player_id,puzzle_id,challenge_key,mode) values(invitee,'board-e','free:board-e','free');
  insert into public.results(player_id,puzzle_id,challenge_key,mode) values(invitee,'board-f','free:board-f','free');
  if (select completed_boards from public.referral_claims where invitee_id=invitee)<>5
    or (select count(*) from public.account_rewards where reward_key like 'referral_v1:%')<>2 then raise exception 'idempotent shared reward'; end if;
  select period_xp,lifetime_xp into after_period,after_lifetime from public.proplet_rankings_xp_aggregate(statement_timestamp()-interval '2 days')
    where row_kind='player' and entity_id=invitee::text;
  if after_period-before_period<>20 or after_lifetime-before_lifetime<>1020 then raise exception 'period/lifetime bonus isolation'; end if;
  if (select period_xp from public.proplet_rankings_xp_aggregate(statement_timestamp()-interval '2 days') where row_kind='player' and entity_id=inviter::text)<>0 then raise exception 'inviter weekly bonus leak'; end if;
  if (select lifetime_xp from public.proplet_rankings_xp_aggregate(null) where row_kind='player' and entity_id=inviter::text)<>1000 then raise exception 'inviter missing all-time bonus'; end if;
  data:=public.proplet_referral_status_v1(invitee);
  if data#>>'{incoming,completedBoards}'<>'5' or data#>>'{incoming,paid}'<>'true' then raise exception 'status contract'; end if;
  perform public.proplet_referral_dismiss_v1(invitee);
  if public.proplet_referral_status_v1(invitee)#>>'{incoming,rewardDismissed}'<>'true' then raise exception 'persistent dismissal'; end if;
end; $qa$;
