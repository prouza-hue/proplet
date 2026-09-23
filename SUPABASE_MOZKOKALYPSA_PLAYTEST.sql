-- Mozkokalypsa pilot: isolated tables, no changes to normal results or XP.
-- Apply only when rollout is approved. Invitations are deliberately NOT seeded.
begin;
create table if not exists public.mozkokalypsa_invites (
 experiment_id text not null,
 player_id uuid not null references public.players(id) on delete cascade,
 slot smallint not null check (slot between 0 and 2),
 active boolean not null default true,
 invited_at timestamptz not null default now(),
 primary key(experiment_id,player_id), unique(experiment_id,slot)
);
create table if not exists public.mozkokalypsa_attempts (
 id uuid primary key default gen_random_uuid(),
 experiment_id text not null,
 player_id uuid not null references public.players(id) on delete cascade,
 board_id text not null check (board_id ~ '^mk26-(0[1-9]|10)$'),
 revision integer not null default 0 check(revision>=0),
 progress jsonb not null default '{}'::jsonb,
 feedback jsonb not null default '{}'::jsonb,
 completed boolean not null default false,
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 unique(experiment_id,player_id,board_id),
 foreign key(experiment_id,player_id) references public.mozkokalypsa_invites(experiment_id,player_id) on delete cascade
);
create table if not exists public.mozkokalypsa_events (
 id uuid primary key,
 attempt_id uuid not null references public.mozkokalypsa_attempts(id) on delete cascade,
 revision integer not null,
 event_type text not null check(event_type in ('correct','wrong','hint','reset','resume','leave','finish','feedback','calm')),
 progress jsonb not null,
 feedback jsonb not null,
 created_at timestamptz not null default now(),
 unique(attempt_id,revision)
);
alter table public.mozkokalypsa_invites enable row level security;
alter table public.mozkokalypsa_attempts enable row level security;
alter table public.mozkokalypsa_events enable row level security;
revoke all on public.mozkokalypsa_invites, public.mozkokalypsa_attempts, public.mozkokalypsa_events from public, anon, authenticated;
grant select,insert,update,delete on public.mozkokalypsa_invites, public.mozkokalypsa_attempts, public.mozkokalypsa_events to service_role;

create or replace function public.proplet_mozkokalypsa_open(p_experiment text,p_player uuid,p_board text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.mozkokalypsa_attempts%rowtype;
begin
 if not exists(select 1 from public.mozkokalypsa_invites where experiment_id=p_experiment and player_id=p_player and active) then
  raise exception 'not invited' using errcode='42501';
 end if;
 insert into public.mozkokalypsa_attempts(experiment_id,player_id,board_id)
 values(p_experiment,p_player,p_board) on conflict(experiment_id,player_id,board_id) do nothing;
 select * into strict result from public.mozkokalypsa_attempts
 where experiment_id=p_experiment and player_id=p_player and board_id=p_board;
 return to_jsonb(result);
end $$;

create or replace function public.proplet_mozkokalypsa_event(
 p_experiment text,p_player uuid,p_board text,p_attempt uuid,p_event uuid,
 p_revision integer,p_kind text,p_progress jsonb,p_feedback jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.mozkokalypsa_attempts%rowtype; e public.mozkokalypsa_events%rowtype;
begin
 if not exists(select 1 from public.mozkokalypsa_invites where experiment_id=p_experiment and player_id=p_player and active) then
  raise exception 'not invited' using errcode='42501';
 end if;
 select * into a from public.mozkokalypsa_attempts where id=p_attempt and experiment_id=p_experiment and player_id=p_player and board_id=p_board for update;
 if not found then raise exception 'attempt owner mismatch' using errcode='42501';end if;
 select * into e from public.mozkokalypsa_events where id=p_event;
 if found then
  if e.attempt_id<>p_attempt or e.event_type<>p_kind or e.progress<>p_progress or e.feedback<>p_feedback or e.revision<>p_revision+1 then
   raise exception 'idempotency mismatch' using errcode='22023';
  end if;
  return jsonb_build_object('ok',true,'revision',e.revision,'duplicate',true);
 end if;
 if a.revision<>p_revision or (a.completed and p_kind<>'feedback') then
  return jsonb_build_object('conflict',true,'revision',a.revision);
 end if;
 insert into public.mozkokalypsa_events(id,attempt_id,revision,event_type,progress,feedback)
 values(p_event,p_attempt,p_revision+1,p_kind,p_progress,p_feedback);
 update public.mozkokalypsa_attempts set revision=p_revision+1,
  progress=case when p_kind='feedback' then progress else p_progress end,
  feedback=case when p_kind='feedback' then p_feedback else feedback end,
  completed=completed or p_kind='finish',
  completed_at=case when p_kind='finish' then coalesce(completed_at,now()) else completed_at end,
  updated_at=now() where id=p_attempt;
 return jsonb_build_object('ok',true,'revision',p_revision+1);
end $$;
revoke all on function public.proplet_mozkokalypsa_open(text,uuid,text) from public,anon,authenticated;
revoke all on function public.proplet_mozkokalypsa_event(text,uuid,text,uuid,uuid,integer,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.proplet_mozkokalypsa_open(text,uuid,text) to service_role;
grant execute on function public.proplet_mozkokalypsa_event(text,uuid,text,uuid,uuid,integer,text,jsonb,jsonb) to service_role;
commit;
