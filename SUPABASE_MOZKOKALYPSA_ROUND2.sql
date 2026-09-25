-- Round 2: additive schema, initially disabled; no automatic invitations.
begin;
alter table public.mozkokalypsa_attempts drop constraint mozkokalypsa_attempts_board_id_check;
alter table public.mozkokalypsa_attempts add constraint mozkokalypsa_attempts_board_id_check check (
 (experiment_id='mozkokalypsa-round2-20260925' and board_id ~ '^mk2-(0[1-9]|1[0-2])$')
 or (experiment_id<>'mozkokalypsa-round2-20260925' and board_id ~ '^mk26-(0[1-9]|10)$'));
alter table public.mozkokalypsa_attempts add column reward_points integer not null default 0 check(reward_points in (0,200));
alter table public.mozkokalypsa_attempts add column rewarded_at timestamptz;
create table public.mozkokalypsa_experiments (
 id text primary key, active boolean not null default false,
 closes_at timestamptz not null, cohort_selected_at timestamptz,
 cohort_snapshot jsonb not null default '[]'::jsonb,
 reward_xp integer not null check(reward_xp=200)
);
create table public.mozkokalypsa_boards (
 experiment_id text not null references public.mozkokalypsa_experiments(id),
 board_id text not null, content_hash text not null, answers jsonb not null,
 final_puzzle_id text, primary key(experiment_id,board_id),
 check(jsonb_array_length(answers)=14)
);
comment on column public.mozkokalypsa_boards.final_puzzle_id is
 'Set only after round-2 evaluation and explicit unconditional content approval. Completed attempts retain credit eligibility; never re-generate this board or double-credit its reward.';
alter table public.mozkokalypsa_experiments enable row level security;
alter table public.mozkokalypsa_boards enable row level security;
revoke all on public.mozkokalypsa_experiments,public.mozkokalypsa_boards from public,anon,authenticated;
grant select,insert,update,delete on public.mozkokalypsa_experiments,public.mozkokalypsa_boards to service_role;
insert into public.mozkokalypsa_experiments(id,closes_at,reward_xp)
values('mozkokalypsa-round2-20260925','2026-09-28T22:00:00Z',200);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round2-20260925','mk2-01','386ea33492e5903db59953dae9455bb13fd47bd7b4d42ede076cea1ad8159d04','[{"word": "HELMA", "path": [73, 72, 62, 63, 53]}, {"word": "PASTELKA", "path": [83, 93, 92, 82, 81, 91, 90, 80]}, {"word": "PROJEKT", "path": [85, 75, 74, 64, 65, 55, 54]}, {"word": "SVÍTIT", "path": [40, 30, 31, 21, 20, 10]}, {"word": "PELIKÁN", "path": [41, 51, 50, 60, 61, 71, 70]}, {"word": "SLOGAN", "path": [69, 68, 78, 79, 89, 99]}, {"word": "SMLOUVA", "path": [23, 22, 32, 33, 43, 42, 52]}, {"word": "KLOKAN", "path": [7, 17, 18, 8, 9, 19]}, {"word": "FASCINACE", "path": [4, 5, 15, 25, 24, 34, 35, 45, 44]}, {"word": "LIMONÁDA", "path": [14, 13, 3, 2, 12, 11, 1, 0]}, {"word": "EKOLOGIE", "path": [59, 58, 48, 49, 39, 38, 28, 29]}, {"word": "HLEMÝŽĎ", "path": [6, 16, 26, 27, 37, 36, 46]}, {"word": "MINULOST", "path": [84, 94, 95, 96, 97, 87, 88, 98]}, {"word": "VICHŘICE", "path": [86, 76, 77, 67, 66, 56, 57, 47]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round2-20260925','mk2-02','44491881abc218b73212516dc296890d7d64126be2c0afb6be5a95e0d65e75b6','[{"word": "JANTAR", "path": [25, 24, 14, 4, 5, 15]}, {"word": "HYPOTÉZA", "path": [56, 66, 65, 75, 74, 84, 85, 95]}, {"word": "BATERKA", "path": [91, 90, 80, 81, 71, 70, 60]}, {"word": "CHÁPAT", "path": [33, 23, 22, 12, 13, 3]}, {"word": "KAPSLE", "path": [21, 11, 10, 0, 1, 2]}, {"word": "POSLEDNÍ", "path": [20, 30, 31, 41, 40, 50, 51, 61]}, {"word": "CHAMELEON", "path": [69, 59, 58, 48, 49, 39, 29, 28, 38]}, {"word": "KAPYBARA", "path": [32, 42, 43, 53, 52, 62, 72, 73]}, {"word": "BÁSEŇ", "path": [92, 82, 83, 93, 94]}, {"word": "FORMULE", "path": [57, 47, 46, 36, 26, 27, 37]}, {"word": "KONCERT", "path": [67, 77, 76, 86, 96, 97, 87]}, {"word": "BIOLOGIE", "path": [19, 9, 8, 18, 17, 7, 6, 16]}, {"word": "NÁSTROJ", "path": [68, 78, 79, 89, 99, 98, 88]}, {"word": "RELIKVIE", "path": [35, 34, 44, 45, 55, 54, 64, 63]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round2-20260925','mk2-03','4fb902f9c118924b0d868c05ac8b165eaa85708d46b45c025d484a81f706f8d4','[{"word": "ZAŘÍZENÍ", "path": [2, 12, 11, 1, 0, 10, 20, 21]}, {"word": "MAKRELA", "path": [38, 28, 29, 19, 9, 8, 18]}, {"word": "VYSOKÝ", "path": [34, 35, 45, 44, 54, 55]}, {"word": "TÁBOR", "path": [84, 83, 93, 92, 82]}, {"word": "FIREWALL", "path": [76, 77, 67, 66, 56, 57, 47, 46]}, {"word": "KATEGORIE", "path": [86, 96, 97, 87, 88, 98, 99, 89, 79]}, {"word": "OMELETA", "path": [94, 95, 85, 75, 74, 64, 65]}, {"word": "TECHNIKA", "path": [24, 25, 15, 16, 26, 27, 37, 36]}, {"word": "RAŠELINA", "path": [3, 13, 14, 4, 5, 6, 7, 17]}, {"word": "BONVIVÁN", "path": [39, 49, 48, 58, 59, 69, 68, 78]}, {"word": "GALERIE", "path": [42, 43, 33, 23, 22, 32, 31]}, {"word": "KOMIKS", "path": [71, 70, 80, 90, 91, 81]}, {"word": "SATELIT", "path": [61, 60, 50, 51, 41, 40, 30]}, {"word": "LŽIČKA", "path": [52, 53, 63, 62, 72, 73]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round2-20260925','mk2-04','8de47726309020aac9834d28e5f6b96bef3d490dcf788eec83c3a53ba7df77dc','[{"word": "MALINA", "path": [20, 10, 0, 1, 11, 12]}, {"word": "ALEGORIE", "path": [93, 83, 84, 94, 95, 85, 86, 96]}, {"word": "HISTORIE", "path": [44, 54, 55, 45, 46, 47, 57, 56]}, {"word": "VÝVOJ", "path": [21, 31, 30, 40, 50]}, {"word": "ROPUCHA", "path": [35, 36, 26, 27, 37, 38, 39]}, {"word": "DIALEKT", "path": [25, 24, 34, 33, 23, 22, 32]}, {"word": "REKORD", "path": [68, 69, 59, 58, 48, 49]}, {"word": "TARANTULE", "path": [6, 16, 15, 5, 4, 14, 13, 3, 2]}, {"word": "NÁVŠTĚVA", "path": [78, 79, 89, 99, 98, 88, 87, 97]}, {"word": "VRTULNÍK", "path": [7, 17, 18, 8, 9, 19, 29, 28]}, {"word": "VODOPÁD", "path": [64, 65, 75, 76, 77, 67, 66]}, {"word": "PŘÍZRAK", "path": [92, 82, 81, 91, 90, 80, 70]}, {"word": "ČOKOLÁDA", "path": [74, 73, 63, 62, 72, 71, 61, 60]}, {"word": "REJNOK", "path": [43, 53, 52, 42, 41, 51]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round2-20260925','mk2-05','03145279e72d0b1133f71c7f1ca1d693a59b37a408bbbb6cb77b0e048a0b4b9b','[{"word": "HORIZONT", "path": [84, 85, 95, 96, 86, 87, 97, 98]}, {"word": "KOBEREC", "path": [59, 49, 48, 47, 37, 38, 39]}, {"word": "VYPRAVĚČ", "path": [58, 68, 69, 79, 78, 88, 89, 99]}, {"word": "EUFORIE", "path": [6, 5, 15, 14, 4, 3, 13]}, {"word": "PAPOUŠEK", "path": [62, 61, 60, 70, 71, 81, 80, 90]}, {"word": "ABECEDA", "path": [7, 8, 9, 19, 18, 28, 29]}, {"word": "KNIHOVNA", "path": [55, 54, 44, 43, 53, 52, 42, 41]}, {"word": "VAKUUM", "path": [11, 10, 0, 1, 2, 12]}, {"word": "LAGUNA", "path": [94, 93, 83, 82, 92, 91]}, {"word": "METEORIT", "path": [21, 31, 32, 22, 23, 33, 34, 24]}, {"word": "MARIONETA", "path": [72, 73, 63, 64, 74, 75, 65, 66, 76]}, {"word": "OPERA", "path": [20, 30, 40, 50, 51]}, {"word": "LASICE", "path": [45, 46, 56, 57, 67, 77]}, {"word": "BERUŠKA", "path": [16, 17, 27, 26, 36, 35, 25]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round2-20260925','mk2-06','bc0bb8092722ce1aeb56014d84fafd992453e3b7e8fa4dbd29882a0f5f0af323','[{"word": "TRILOBIT", "path": [39, 38, 28, 29, 19, 18, 8, 9]}, {"word": "ŠPRÝMAŘ", "path": [53, 63, 62, 72, 73, 83, 93]}, {"word": "RÉBUS", "path": [44, 34, 35, 25, 24]}, {"word": "PORTÁL", "path": [86, 85, 95, 94, 84, 74]}, {"word": "SIMULACE", "path": [47, 46, 56, 57, 67, 66, 76, 77]}, {"word": "MOZAIKA", "path": [52, 42, 43, 33, 32, 22, 23]}, {"word": "VELBLOUD", "path": [37, 36, 26, 27, 17, 7, 6, 16]}, {"word": "TRAGÉDIE", "path": [96, 97, 87, 88, 98, 99, 89, 79]}, {"word": "ODPOVĚĎ", "path": [2, 3, 13, 14, 4, 5, 15]}, {"word": "LAVINA", "path": [61, 60, 50, 51, 41, 40]}, {"word": "VOLAVKA", "path": [49, 48, 58, 59, 69, 68, 78]}, {"word": "LABORATOŘ", "path": [12, 11, 1, 0, 10, 20, 21, 31, 30]}, {"word": "POŘADÍ", "path": [45, 55, 54, 64, 65, 75]}, {"word": "ODSTAVEC", "path": [71, 70, 80, 90, 91, 81, 82, 92]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round2-20260925','mk2-07','a8f001532eaa560db86ec7d8eb085ded13b14dfab73656a872a677a9625372fc','[{"word": "BULDOZER", "path": [20, 21, 31, 30, 40, 41, 51, 50]}, {"word": "ŠAMPION", "path": [10, 0, 1, 11, 12, 2, 3]}, {"word": "ZPŮSOB", "path": [47, 46, 56, 57, 67, 77]}, {"word": "OTEVŘÍT", "path": [64, 63, 73, 72, 62, 52, 53]}, {"word": "KOSATKA", "path": [7, 8, 9, 19, 18, 28, 29]}, {"word": "DESIGN", "path": [59, 58, 68, 69, 79, 78]}, {"word": "SKAFANDR", "path": [92, 93, 83, 84, 94, 95, 85, 86]}, {"word": "OBLÁZKY", "path": [89, 99, 98, 88, 87, 97, 96]}, {"word": "ODVAHA", "path": [25, 15, 5, 4, 14, 13]}, {"word": "OHŇOSTROJ", "path": [82, 81, 91, 90, 80, 70, 71, 61, 60]}, {"word": "ROBOTIKA", "path": [24, 34, 33, 23, 22, 32, 42, 43]}, {"word": "ZMRZLINA", "path": [74, 75, 76, 66, 65, 55, 54, 44]}, {"word": "JELEN", "path": [37, 38, 48, 49, 39]}, {"word": "LISTOPAD", "path": [6, 16, 17, 27, 26, 36, 35, 45]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round2-20260925','mk2-08','4f218b7938f54f6447602fbd03419591bcba7529fff3e580eff485f7118f66a2','[{"word": "HARDWARE", "path": [82, 81, 91, 90, 80, 70, 71, 61]}, {"word": "SKLENICE", "path": [92, 93, 83, 84, 94, 95, 85, 75]}, {"word": "MISKA", "path": [40, 41, 51, 50, 60]}, {"word": "KONFETA", "path": [30, 31, 21, 20, 10, 0, 1]}, {"word": "TRESKA", "path": [14, 13, 3, 2, 12, 11]}, {"word": "VAKCÍNA", "path": [19, 9, 8, 18, 28, 29, 39]}, {"word": "KORZÁR", "path": [44, 54, 55, 65, 64, 74]}, {"word": "CVRČEK", "path": [67, 66, 76, 77, 87, 86]}, {"word": "FIALOVÁ", "path": [4, 5, 15, 16, 6, 7, 17]}, {"word": "DOKUMENT", "path": [45, 35, 25, 24, 34, 33, 23, 22]}, {"word": "KOLOBĚŽKA", "path": [72, 73, 63, 62, 52, 53, 43, 42, 32]}, {"word": "HRDLIČKA", "path": [57, 56, 46, 47, 37, 36, 26, 27]}, {"word": "PROGRAM", "path": [78, 88, 89, 99, 98, 97, 96]}, {"word": "GENERACE", "path": [79, 69, 68, 58, 59, 49, 48, 38]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round2-20260925','mk2-09','9e2b7707ac0f8b70440070872fa9e3e25ea80d3994644f9333f33e55bd400663','[{"word": "EROTOMAN", "path": [57, 56, 46, 47, 37, 36, 26, 27]}, {"word": "PROUD", "path": [11, 21, 20, 30, 31]}, {"word": "KŘEPELKA", "path": [4, 3, 13, 14, 24, 25, 35, 34]}, {"word": "GLADIÁTOR", "path": [81, 71, 70, 60, 61, 51, 50, 40, 41]}, {"word": "ŠKEBLE", "path": [62, 52, 53, 43, 42, 32]}, {"word": "PORTRÉT", "path": [80, 90, 91, 92, 82, 83, 84]}, {"word": "ZKUSIT", "path": [5, 15, 16, 6, 7, 17]}, {"word": "MLHOVINA", "path": [10, 0, 1, 2, 12, 22, 23, 33]}, {"word": "VÝSTAVA", "path": [67, 77, 76, 66, 65, 75, 74]}, {"word": "KOMBAJN", "path": [38, 28, 29, 19, 9, 8, 18]}, {"word": "KUCHAŘ", "path": [87, 88, 98, 99, 89, 79]}, {"word": "DOPRAVA", "path": [97, 96, 86, 85, 95, 94, 93]}, {"word": "POMERANČ", "path": [39, 49, 48, 58, 59, 69, 68, 78]}, {"word": "TEPLOMĚR", "path": [72, 73, 63, 64, 54, 55, 45, 44]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round2-20260925','mk2-10','c1a58b32d8320f4630aa106a9ffb2e6bcaf77bf028b6d318d3a99f2c699a3c43','[{"word": "HLAVOLAM", "path": [31, 30, 20, 21, 11, 10, 0, 1]}, {"word": "CHEMIE", "path": [7, 6, 16, 17, 27, 26]}, {"word": "DRUŽICE", "path": [79, 78, 88, 89, 99, 98, 97]}, {"word": "ČOLEK", "path": [41, 40, 50, 51, 61]}, {"word": "ORCHESTR", "path": [76, 77, 87, 86, 96, 95, 85, 75]}, {"word": "PIJAVICE", "path": [66, 67, 57, 56, 46, 47, 37, 36]}, {"word": "ČTVEREC", "path": [91, 90, 80, 81, 71, 70, 60]}, {"word": "PRODAVAČ", "path": [8, 9, 19, 18, 28, 29, 39, 38]}, {"word": "ČEPICE", "path": [44, 54, 55, 65, 64, 74]}, {"word": "BANKOVKA", "path": [92, 93, 94, 84, 83, 82, 72, 73]}, {"word": "NABÍJEČKA", "path": [33, 23, 22, 12, 2, 3, 13, 14, 4]}, {"word": "PROBLÉM", "path": [32, 42, 43, 53, 52, 62, 63]}, {"word": "DIALOG", "path": [69, 68, 58, 59, 49, 48]}, {"word": "POLÁRKA", "path": [45, 35, 34, 24, 25, 15, 5]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round2-20260925','mk2-11','aef609380a0d76ec7f12b368c8bd0072b9c1c76224d7b19974a955a7b1414321','[{"word": "TORTILLA", "path": [80, 90, 91, 81, 82, 92, 93, 83]}, {"word": "PLANINA", "path": [16, 6, 5, 4, 14, 15, 25]}, {"word": "VYNÁLEZ", "path": [68, 69, 79, 78, 88, 89, 99]}, {"word": "MINERÁL", "path": [56, 46, 47, 37, 27, 26, 36]}, {"word": "NINJA", "path": [53, 63, 62, 72, 73]}, {"word": "PRÁZDNINY", "path": [75, 74, 64, 65, 55, 54, 44, 45, 35]}, {"word": "PROTON", "path": [17, 7, 8, 9, 19, 18]}, {"word": "SOFTWARE", "path": [11, 1, 0, 10, 20, 21, 31, 30]}, {"word": "SOUBOR", "path": [52, 42, 43, 33, 34, 24]}, {"word": "METAFORA", "path": [70, 71, 61, 60, 50, 51, 41, 40]}, {"word": "PROHRA", "path": [85, 86, 96, 95, 94, 84]}, {"word": "STUDENÝ", "path": [12, 2, 3, 13, 23, 22, 32]}, {"word": "BLUDIŠTĚ", "path": [57, 67, 66, 76, 77, 87, 97, 98]}, {"word": "INTERNET", "path": [58, 59, 49, 48, 38, 39, 29, 28]}]'::jsonb);
insert into public.mozkokalypsa_boards(experiment_id,board_id,content_hash,answers) values('mozkokalypsa-round2-20260925','mk2-12','12d19a854ee46e0caafe23b8db9e884150caf6df8dde6afbe4bd06efae0acba9','[{"word": "TALISMAN", "path": [39, 29, 28, 18, 19, 9, 8, 7]}, {"word": "FURIANT", "path": [62, 72, 73, 63, 64, 74, 75]}, {"word": "KOUPELNA", "path": [41, 40, 50, 51, 61, 60, 70, 71]}, {"word": "KRUPOBITÍ", "path": [78, 88, 89, 99, 98, 97, 87, 86, 96]}, {"word": "BLÍZKÝ", "path": [82, 92, 91, 90, 80, 81]}, {"word": "EVOLUCE", "path": [52, 53, 43, 44, 54, 55, 45]}, {"word": "PONOŽKA", "path": [38, 37, 27, 26, 36, 35, 25]}, {"word": "HORKÝ", "path": [22, 23, 33, 34, 24]}, {"word": "ZÁPLETKA", "path": [79, 69, 68, 67, 77, 76, 66, 65]}, {"word": "PRŮBĚH", "path": [83, 93, 94, 84, 85, 95]}, {"word": "RUKAVICE", "path": [49, 59, 58, 48, 47, 57, 56, 46]}, {"word": "VRABEC", "path": [3, 13, 12, 2, 1, 0]}, {"word": "DŮSLEDEK", "path": [42, 32, 31, 30, 20, 21, 11, 10]}, {"word": "KREVETA", "path": [4, 14, 15, 5, 6, 16, 17]}]'::jsonb);

create function public.proplet_mozkokalypsa2_open(p_experiment text,p_player uuid,p_board text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.mozkokalypsa_experiments%rowtype;
begin
 select * into cfg from public.mozkokalypsa_experiments where id=p_experiment for share;
 if not found or not cfg.active or clock_timestamp()>=cfg.closes_at then
  raise exception 'Playtest skončil nebo není otevřený.' using errcode='PT410';
 end if;
 if not exists(select 1 from public.mozkokalypsa_boards where experiment_id=p_experiment and board_id=p_board) then
  raise exception 'Unknown test board' using errcode='22023';
 end if;
 return public.proplet_mozkokalypsa_open(p_experiment,p_player,p_board);
end $$;
create or replace function public.proplet_mozkokalypsa2_event(
 p_experiment text,p_player uuid,p_board text,p_attempt uuid,p_event uuid,
 p_revision integer,p_kind text,p_progress jsonb,p_feedback jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cfg public.mozkokalypsa_experiments%rowtype; targets jsonb; reward_id uuid;
 a public.mozkokalypsa_attempts%rowtype; e public.mozkokalypsa_events%rowtype;
begin
 select * into cfg from public.mozkokalypsa_experiments where id=p_experiment for share;
 if not found or not cfg.active or clock_timestamp()>=cfg.closes_at then
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
  values(gen_random_uuid(),p_player,'mozkokalypsa_v2:'||p_board,200,'mozkokalypsa_playtest',p_board)
  on conflict(player_id,reward_key) do nothing returning id into reward_id;
  update public.mozkokalypsa_attempts set reward_points=200,rewarded_at=coalesce(rewarded_at,clock_timestamp()) where id=p_attempt;
 end if;
 return jsonb_build_object('ok',true,'revision',p_revision+1,'rewardPoints',case when p_kind='feedback' then 200 else a.reward_points end,
  'rewardGranted',reward_id is not null);
end $$;

revoke all on function public.proplet_mozkokalypsa2_open(text,uuid,text) from public,anon,authenticated;
revoke all on function public.proplet_mozkokalypsa2_event(text,uuid,text,uuid,uuid,integer,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.proplet_mozkokalypsa2_open(text,uuid,text) to service_role;
grant execute on function public.proplet_mozkokalypsa2_event(text,uuid,text,uuid,uuid,integer,text,jsonb,jsonb) to service_role;
commit;
