-- Private campaign only. No participant IDs, automatic enrollment or gameplay writes.
begin;

create table public.visual_playtest_campaigns (
  campaign_id text primary key,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.visual_playtest_participants (
  campaign_id text not null references public.visual_playtest_campaigns(campaign_id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  reviewer boolean not null default false,
  active boolean not null default true,
  status text not null default 'invited' check (status in ('invited','accepted','declined')),
  shown_count smallint not null default 0 check (shown_count between 0 and 2),
  last_shown_at timestamptz,
  snoozed_until timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  feedback_rating text check (feedback_rating in ('better','similar','worse','unsure')),
  feedback_comment text check (char_length(feedback_comment) <= 2000),
  feedback_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, player_id)
);
alter table public.visual_playtest_campaigns enable row level security;
alter table public.visual_playtest_participants enable row level security;
revoke all on public.visual_playtest_campaigns, public.visual_playtest_participants from public, anon, authenticated;
grant select, insert, update, delete on public.visual_playtest_campaigns, public.visual_playtest_participants to service_role;

-- Root activates and seeds the reviewed private cohort separately.
insert into public.visual_playtest_campaigns(campaign_id, active)
values ('visual-refresh-20261027-v1', false);

create function public.proplet_visual_playtest_v1(
  p_campaign text, p_player uuid, p_action text default 'status',
  p_rating text default null, p_comment text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  r public.visual_playtest_participants%rowtype;
  t timestamptz := now();
  can_show boolean;
  granted boolean := false;
begin
  if p_campaign is distinct from 'visual-refresh-20261027-v1' then
    return jsonb_build_object('eligible', false);
  end if;
  -- Share lock makes deactivation and participant changes serialize with commands.
  perform 1 from public.visual_playtest_campaigns
    where campaign_id = p_campaign and active for share;
  if not found then return jsonb_build_object('eligible', false); end if;
  select * into r from public.visual_playtest_participants
    where campaign_id = p_campaign and player_id = p_player and active for update;
  if not found then return jsonb_build_object('eligible', false); end if;
  if p_action is null or p_action not in ('status','shown','accept','snooze','decline','feedback')
     or (p_action = 'feedback' and (p_rating is null or p_rating not in ('better','similar','worse','unsure')
         or char_length(coalesce(p_comment,'')) > 2000))
     or (p_action <> 'feedback' and (p_rating is not null or p_comment is not null)) then
    raise exception 'Invalid pilot command' using errcode = '22023';
  end if;
  if r.status = 'declined' and p_action not in ('status','shown','decline') then
    return jsonb_build_object('eligible', true, 'error', 'declined');
  end if;
  can_show := not r.reviewer and r.status = 'invited' and r.shown_count < 2
    and (r.snoozed_until is null or r.snoozed_until <= t)
    and (r.last_shown_at is null or r.last_shown_at + interval '7 days' <= t);
  if p_action = 'shown' and can_show then
    r.shown_count := r.shown_count + 1;
    r.last_shown_at := t;
    granted := true;
  elsif p_action = 'accept' then
    r.status := 'accepted';
    r.accepted_at := coalesce(r.accepted_at, t);
    r.snoozed_until := null;
  elsif p_action = 'snooze' and r.status = 'invited' then
    r.snoozed_until := t + interval '7 days';
  elsif p_action = 'decline' then
    r.status := 'declined';
    r.declined_at := coalesce(r.declined_at, t);
  elsif p_action = 'feedback' then
    r.status := 'accepted';
    r.accepted_at := coalesce(r.accepted_at, t);
    r.feedback_rating := p_rating;
    r.feedback_comment := coalesce(p_comment, '');
    r.feedback_at := t;
  end if;
  if p_action <> 'status' then
    update public.visual_playtest_participants set
      status=r.status, shown_count=r.shown_count, last_shown_at=r.last_shown_at,
      snoozed_until=r.snoozed_until, accepted_at=r.accepted_at, declined_at=r.declined_at,
      feedback_rating=r.feedback_rating, feedback_comment=r.feedback_comment,
      feedback_at=r.feedback_at, updated_at=t
      where campaign_id=p_campaign and player_id=p_player;
  end if;
  can_show := not r.reviewer and r.status = 'invited' and r.shown_count < 2
    and (r.snoozed_until is null or r.snoozed_until <= t)
    and (r.last_shown_at is null or r.last_shown_at + interval '7 days' <= t);
  return jsonb_build_object(
    'eligible', true, 'role', case when r.reviewer then 'reviewer' else 'tester' end,
    'status', r.status, 'shownCount', r.shown_count, 'canShowInvite', can_show,
    'snoozedUntil', r.snoozed_until, 'displayGranted', granted,
    'feedback', case when r.feedback_rating is null then null else jsonb_build_object(
      'rating',r.feedback_rating,'comment',r.feedback_comment,'submittedAt',r.feedback_at) end
  );
end;
$$;
revoke all on function public.proplet_visual_playtest_v1(text,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.proplet_visual_playtest_v1(text,uuid,text,text,text) to service_role;
commit;
