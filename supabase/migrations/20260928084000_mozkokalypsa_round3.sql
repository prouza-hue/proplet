-- Additive round III; preserve all earlier attempts, RPCs, rewards and weekly scoring.
-- Starts 29 Sep 00:00 Europe/Prague, closes 1 Oct 00:00 (48 hours).
begin;
alter table public.mozkokalypsa_experiments add column opens_at timestamptz;
alter table public.mozkokalypsa_experiments add constraint mozkokalypsa_experiment_window check(opens_at is null or opens_at < closes_at);
alter table public.mozkokalypsa_attempts drop constraint mozkokalypsa_attempts_board_id_check;
alter table public.mozkokalypsa_attempts add constraint mozkokalypsa_attempts_board_id_check check (
 (experiment_id='mozkokalypsa-round2-20260925' and board_id ~ '^mk2-(0[1-9]|1[0-2])$')
 or (experiment_id='mozkokalypsa-round3-interwoven-v2' and board_id ~ '^mk3w2-0[1-8]$')
 or (experiment_id not in ('mozkokalypsa-round2-20260925','mozkokalypsa-round3-interwoven-v2') and board_id ~ '^mk26-(0[1-9]|10)$'));
insert into public.mozkokalypsa_experiments(id,active,opens_at,closes_at,reward_xp)
values('mozkokalypsa-round3-interwoven-v2',false,'2026-09-28T22:00:00Z','2026-09-30T22:00:00Z',200);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round3-interwoven-v2','mk3w2-01','7d89fa684797b3a3400c85baaa24c7c92f6e41559ed7e488e5cb0dd5eafe86cf','[{"word":"ZÁKULISÍ","path":[25,15,16,26,27,37,47,48]},{"word":"CITERA","path":[64,74,73,72,62,61]},{"word":"ZDYMADLO","path":[11,12,2,3,13,14,4,5]},{"word":"PLOTICE","path":[63,53,52,42,41,51,50]},{"word":"RAZNICE","path":[19,9,8,18,17,7,6]},{"word":"BRLOH","path":[29,28,38,39,49]},{"word":"ZÁCLONA","path":[79,78,88,89,99,98,97]},{"word":"STAVIDLO","path":[1,0,10,20,21,31,30,40]},{"word":"TISKAŘ","path":[69,59,58,68,67,77]},{"word":"SOUHVĚZDÍ","path":[82,92,91,90,80,81,71,70,60]},{"word":"TRAKAŘ","path":[35,34,24,23,22,32]},{"word":"REJSTŘÍK","path":[57,56,66,65,75,76,86,87]},{"word":"PODMÁSLÍ","path":[36,46,45,55,54,44,43,33]},{"word":"KRONIKA","path":[83,93,94,84,85,95,96]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round3-interwoven-v2','mk3w2-02','edab6900f9564a2c28a1724db50bb9e2a239c9f94147732ffdcf6ec9789ad8ac','[{"word":"PĚNKAVA","path":[7,17,16,6,5,15,14]},{"word":"ROVNÍK","path":[61,51,50,40,41,42]},{"word":"HŘEBELEC","path":[84,74,75,76,86,87,97,96]},{"word":"DIVOŽENKA","path":[62,52,53,43,44,45,35,36,46]},{"word":"SKOŘÁPKA","path":[85,95,94,93,83,82,92,91]},{"word":"KOMODA","path":[79,69,68,58,59,49]},{"word":"PATIZON","path":[8,9,19,18,28,29,39]},{"word":"ŠMEJDIT","path":[89,99,98,88,78,77,67]},{"word":"KOSIT","path":[11,21,20,30,31]},{"word":"DRÁTENÍK","path":[26,27,37,38,48,47,57,56]},{"word":"POZNATEK","path":[72,73,63,64,54,55,65,66]},{"word":"PROPUST","path":[25,24,34,33,23,22,32]},{"word":"JEHELNÍK","path":[10,0,1,2,12,13,3,4]},{"word":"ŠTOČEK","path":[60,70,71,81,80,90]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round3-interwoven-v2','mk3w2-03','288b6bbaf55ae0963632795a418c0e677edd89610eb6ea2ea2fedc7f8a95d41d','[{"word":"PASTOREK","path":[63,53,54,64,65,75,74,84]},{"word":"DEVĚTSIL","path":[45,44,34,35,25,26,27,37]},{"word":"TAJEMSTVÍ","path":[78,79,89,99,98,88,87,97,96]},{"word":"STUPNICE","path":[73,72,62,61,51,52,42,43]},{"word":"PŘEBAL","path":[16,17,7,8,9,19]},{"word":"REMÍZEK","path":[69,68,58,57,47,46,36]},{"word":"HRABOŠ","path":[20,30,31,41,40,50]},{"word":"KAMENINA","path":[55,56,66,67,77,76,86,85]},{"word":"ŠEROSVIT","path":[59,49,48,38,39,29,28,18]},{"word":"PODNEBÍ","path":[24,23,13,12,22,32,33]},{"word":"CUKROVÍ","path":[6,5,15,14,4,3,2]},{"word":"VLÍDNÝ","path":[90,80,81,71,70,60]},{"word":"SUŠIT","path":[21,11,10,0,1]},{"word":"TRADICE","path":[91,92,82,83,93,94,95]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round3-interwoven-v2','mk3w2-04','a2e079b63b7dca65b8a75e0632552ba07034ef199abf755e374a910c89a140f2','[{"word":"KŠANDY","path":[74,75,65,66,76,77]},{"word":"ŠPACHTLE","path":[26,27,37,47,46,56,57,67]},{"word":"TRUHLICE","path":[89,79,78,68,69,59,58,48]},{"word":"ÚŽLABINA","path":[92,93,83,84,94,95,85,86]},{"word":"PROSTOR","path":[52,62,61,51,50,60,70]},{"word":"BRUSIVO","path":[18,17,7,6,16,15,5]},{"word":"KALAMÁŘ","path":[82,72,71,81,91,90,80]},{"word":"POBŘEŽÍ","path":[0,10,11,21,20,30,40]},{"word":"LOUBÍ","path":[36,35,25,24,14]},{"word":"PROSTŘEDÍ","path":[73,63,64,54,55,45,44,34,33]},{"word":"DRTINA","path":[1,2,12,13,3,4]},{"word":"DŘEVORYT","path":[8,9,19,29,28,38,39,49]},{"word":"PODBĚL","path":[99,98,88,87,97,96]},{"word":"VČELSTVO","path":[53,43,42,41,31,32,22,23]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round3-interwoven-v2','mk3w2-05','a64e95c3cc1c4de71e410e6127ddd4f68716cd81ca3ef71ab05802027e3838a1','[{"word":"HMATNÍK","path":[1,0,10,11,21,20,30]},{"word":"LINORYT","path":[44,34,33,23,22,32,31]},{"word":"PAMÁTKA","path":[9,8,18,17,7,6,5]},{"word":"ŠIFRA","path":[2,12,13,3,4]},{"word":"PŘESLIČKA","path":[90,91,81,82,92,93,83,84,94]},{"word":"SKALISKO","path":[43,53,52,42,41,51,50,40]},{"word":"HUSTILKA","path":[19,29,28,38,39,49,48,58]},{"word":"ŠIŠATÝ","path":[65,75,74,73,63,62]},{"word":"JEŘABINA","path":[64,54,55,45,46,36,35,25]},{"word":"PODRÁŽKA","path":[98,99,89,79,78,68,69,59]},{"word":"PODRUČKA","path":[47,57,56,66,67,77,76,86]},{"word":"PARŤÁK","path":[80,70,60,61,71,72]},{"word":"NÁŘEČÍ","path":[88,87,97,96,95,85]},{"word":"ODDENEK","path":[37,27,26,16,15,14,24]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round3-interwoven-v2','mk3w2-06','ca78eaa36a34c96e10d46618809ba1c84387a6bcf39a1aedf683f07343ddc50d','[{"word":"SVĚTLÍK","path":[65,55,54,44,45,35,36]},{"word":"MYŠLENKA","path":[47,46,56,66,67,77,76,86]},{"word":"PERGAMEN","path":[11,21,20,30,31,41,40,50]},{"word":"OROBINEC","path":[10,0,1,2,12,13,3,4]},{"word":"POLNÍČEK","path":[90,80,81,71,70,60,61,51]},{"word":"LAHODNÝ","path":[33,34,24,14,15,25,26]},{"word":"POLEDNICE","path":[91,92,82,83,93,94,84,85,95]},{"word":"FANTAZIE","path":[23,22,32,42,43,53,52,62]},{"word":"KLEPAT","path":[8,7,17,16,6,5]},{"word":"DÁLAVA","path":[75,74,64,63,73,72]},{"word":"LYSKA","path":[79,78,68,69,59]},{"word":"MINCÍŘ","path":[57,58,48,38,37,27]},{"word":"JIŘIČKA","path":[9,19,18,28,29,39,49]},{"word":"PETRŽEL","path":[89,99,98,88,87,97,96]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round3-interwoven-v2','mk3w2-07','0601746b88abdb6ffaed5aada2296aba910c34f2f56e4d73c19bf0d11adc6bab','[{"word":"POHOŘÍ","path":[56,66,67,77,76,75]},{"word":"SVORNÍK","path":[7,17,16,6,5,15,14]},{"word":"PETLICE","path":[57,47,48,38,37,27,26]},{"word":"PŘEVOD","path":[52,42,43,33,32,22]},{"word":"TOBOLKA","path":[8,9,19,18,28,29,39]},{"word":"ZURČET","path":[44,34,35,25,24,23]},{"word":"ZÁPISNÍK","path":[88,78,79,69,68,58,59,49]},{"word":"PERMONÍK","path":[80,90,91,92,82,83,93,94]},{"word":"FUJAVICE","path":[89,99,98,97,87,86,96,95]},{"word":"STŘEVLÍK","path":[53,54,64,65,55,45,46,36]},{"word":"KORMIDLO","path":[10,0,1,2,12,13,3,4]},{"word":"STRUHADLO","path":[81,71,72,62,63,73,74,84,85]},{"word":"LEZEC","path":[11,21,20,30,31]},{"word":"POZNÁNÍ","path":[70,60,61,51,50,40,41]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round3-interwoven-v2','mk3w2-08','c6ce9bd7030212f953453d597dbe74556ef6d692e62ef84d72ee0ea75b2ab921','[{"word":"JITŘENKA","path":[36,35,45,44,34,33,43,42]},{"word":"ŽVÝKAT","path":[0,1,11,12,2,3]},{"word":"VODOVOD","path":[25,24,14,13,23,22,32]},{"word":"POTÁPNÍK","path":[59,58,48,49,39,38,28,29]},{"word":"ŘEZBA","path":[17,18,8,9,19]},{"word":"PŘÍZVUK","path":[99,89,88,78,79,69,68]},{"word":"LEZEČKA","path":[63,64,74,75,85,86,96]},{"word":"BUKVICE","path":[91,90,80,70,71,61,60]},{"word":"DŮVĚRA","path":[98,97,87,77,76,66]},{"word":"OKVĚTÍ","path":[7,6,16,15,5,4]},{"word":"SÍTOTISK","path":[73,72,62,52,53,54,55,65]},{"word":"NAPÁJEČKA","path":[10,20,21,31,30,40,41,51,50]},{"word":"BYSTŘINA","path":[81,82,92,93,83,84,94,95]},{"word":"SYMFONIE","path":[26,27,37,47,46,56,57,67]}]'::jsonb);

-- Even a legacy internal RPC cannot mutate a round-three attempt outside its window.
create function public.proplet_mozkokalypsa3_time_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare cfg public.mozkokalypsa_experiments%rowtype;
begin
 if NEW.experiment_id='mozkokalypsa-round3-interwoven-v2' then
  select * into cfg from public.mozkokalypsa_experiments where id=NEW.experiment_id for share;
  if not found or not cfg.active or cfg.opens_at is null or clock_timestamp()<cfg.opens_at or clock_timestamp()>=cfg.closes_at then
   raise exception 'Playtest není v otevřeném časovém okně.' using errcode='PT410';
  end if;
 end if;
 return NEW;
end $$;
create trigger mozkokalypsa3_time_guard before insert or update on public.mozkokalypsa_attempts
for each row when (NEW.experiment_id='mozkokalypsa-round3-interwoven-v2') execute function public.proplet_mozkokalypsa3_time_guard();
revoke all on function public.proplet_mozkokalypsa3_time_guard() from public,anon,authenticated;
grant execute on function public.proplet_mozkokalypsa3_time_guard() to service_role;
create function public.proplet_mozkokalypsa3_open(p_experiment text,p_player uuid,p_board text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.mozkokalypsa_experiments%rowtype;
begin
 select * into cfg from public.mozkokalypsa_experiments where id=p_experiment for share;
 if p_experiment<>'mozkokalypsa-round3-interwoven-v2' or not found or not cfg.active or cfg.opens_at is null or clock_timestamp()<cfg.opens_at or clock_timestamp()>=cfg.closes_at then
  raise exception 'Playtest skončil nebo není otevřený.' using errcode='PT410';
 end if;
 if not exists(select 1 from public.mozkokalypsa_boards where experiment_id=p_experiment and board_id=p_board) then
  raise exception 'Unknown test board' using errcode='22023';
 end if;
 return public.proplet_mozkokalypsa_open(p_experiment,p_player,p_board);
end $$;
create function public.proplet_mozkokalypsa3_event(
 p_experiment text,p_player uuid,p_board text,p_attempt uuid,p_event uuid,
 p_revision integer,p_kind text,p_progress jsonb,p_feedback jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.mozkokalypsa_experiments%rowtype; targets jsonb; reward_id uuid;
 a public.mozkokalypsa_attempts%rowtype; e public.mozkokalypsa_events%rowtype;
begin
 select * into cfg from public.mozkokalypsa_experiments where id=p_experiment for share;
 if p_experiment<>'mozkokalypsa-round3-interwoven-v2' or not found or not cfg.active or cfg.opens_at is null or clock_timestamp()<cfg.opens_at or clock_timestamp()>=cfg.closes_at then
  raise exception 'Playtest skončil nebo není otevřený.' using errcode='PT410';
 end if;
 select answers into targets from public.mozkokalypsa_boards where experiment_id=p_experiment and board_id=p_board;
 if not found then raise exception 'Unknown test board' using errcode='22023';end if;
 if not exists(select 1 from public.mozkokalypsa_invites where experiment_id=p_experiment and player_id=p_player and active) then
  raise exception 'not invited' using errcode='42501';
 end if;
 select * into a from public.mozkokalypsa_attempts where id=p_attempt and experiment_id=p_experiment and player_id=p_player and board_id=p_board for update;
 if not found then raise exception 'attempt owner mismatch' using errcode='42501';end if;
 if clock_timestamp()>=cfg.closes_at then raise exception 'Playtest skončil.' using errcode='PT410';end if;
 select * into e from public.mozkokalypsa_events where id=p_event;
 if found then
  if e.attempt_id<>p_attempt or e.event_type<>p_kind or e.progress<>p_progress or e.feedback<>p_feedback or e.revision<>p_revision+1 then
   raise exception 'idempotency mismatch' using errcode='22023';
  end if;
  return jsonb_build_object('ok',true,'revision',e.revision,'duplicate',true,'rewardPoints',a.reward_points);
 end if;
 if a.revision<>p_revision or (a.completed and p_kind<>'feedback') then
  return jsonb_build_object('conflict',true,'revision',a.revision);
 end if;
 if p_kind='feedback' and (not a.completed or
  not coalesce(jsonb_typeof(p_feedback->'difficulty')='number' and (p_feedback->>'difficulty') ~ '^[1-5]$',false) or
  not coalesce(jsonb_typeof(p_feedback->'fun')='number' and (p_feedback->>'fun') ~ '^[1-5]$',false)) then
  raise exception 'Dokonči desku a vyplň obě hodnocení.' using errcode='PT422';
 end if;
 if p_kind='finish' then
  if jsonb_typeof(p_progress->'found') is distinct from 'array' then raise exception 'Incomplete board' using errcode='22023';end if;
  if jsonb_array_length(p_progress->'found')<>jsonb_array_length(targets) or exists (
   select 1 from jsonb_array_elements(targets) with ordinality t(answer,idx)
   where not exists(select 1 from jsonb_array_elements(p_progress->'found') f
    where f->'answerIndex'=to_jsonb(t.idx-1) and f->'word'=t.answer->'word' and f->'path'=t.answer->'path')
  ) then raise exception 'Incomplete board' using errcode='22023';end if;
 end if;
 insert into public.mozkokalypsa_events(id,attempt_id,revision,event_type,progress,feedback)
 values(p_event,p_attempt,p_revision+1,p_kind,p_progress,p_feedback);
 update public.mozkokalypsa_attempts set revision=p_revision+1,
  progress=case when p_kind='feedback' then progress else p_progress end,
  feedback=case when p_kind='feedback' then p_feedback else feedback end,
  completed=completed or p_kind='finish',
  completed_at=case when p_kind='finish' then coalesce(completed_at,now()) else completed_at end,
  updated_at=now() where id=p_attempt;
 if p_kind='feedback' then
  insert into public.account_rewards(id,player_id,reward_key,points,reward_type,puzzle_id)
  values(gen_random_uuid(),p_player,'mozkokalypsa_v3:'||p_board,200,'mozkokalypsa_playtest',p_board)
  on conflict(player_id,reward_key) do nothing returning id into reward_id;
  update public.mozkokalypsa_attempts set reward_points=200,rewarded_at=coalesce(rewarded_at,clock_timestamp()) where id=p_attempt;
 end if;
 return jsonb_build_object('ok',true,'revision',p_revision+1,'rewardPoints',case when p_kind='feedback' then 200 else a.reward_points end,
  'rewardGranted',reward_id is not null);
end $$;


revoke all on function public.proplet_mozkokalypsa3_open(text,uuid,text) from public,anon,authenticated;
revoke all on function public.proplet_mozkokalypsa3_event(text,uuid,text,uuid,uuid,integer,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.proplet_mozkokalypsa3_open(text,uuid,text) to service_role;
grant execute on function public.proplet_mozkokalypsa3_event(text,uuid,text,uuid,uuid,integer,text,jsonb,jsonb) to service_role;
comment on column public.mozkokalypsa_experiments.opens_at is 'Inclusive UTC opening; NULL preserves historical experiments. Third round enforced in server, RPC and scoped attempt trigger.';
commit;
