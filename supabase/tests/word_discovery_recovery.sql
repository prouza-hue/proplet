-- Synthetic-only acceptance; every fixture and ledger mutation is rolled back.
begin;
do $recovery$
declare
 p uuid:=gen_random_uuid(); other_player uuid:=gen_random_uuid();
 puzzle text:='extra-recovery-fixture'; other_puzzle text:='extra-recovery-other';
 recovery_key text:='word_discovery_recovery_v1:extra-recovery-fixture';
 r record; word text; failed boolean;
begin
 insert into public.players(id,name,family_code,token_hash,public_rankings)
 values(p,'Recovery SQL fixture','SOLO_RECOVERY_'||left(p::text,8),p::text,false),
       (other_player,'Recovery SQL fixture','SOLO_RECOVERY_'||left(other_player::text,8),other_player::text,false);
 insert into public.account_rewards(id,player_id,reward_key,points,granted_at,reward_type,puzzle_id)
 values(gen_random_uuid(),p,recovery_key,3,now(),'word_discovery_recovery',puzzle);

 select * into r from public.proplet_claim_word_discovery(p,puzzle,'ledna');
 if r.newly_granted or r.awarded_points<>0 or r.reason<>'recovered' then
  raise exception 'precredited discovery paid twice or failed to recover';
 end if;
 if (select points from public.account_rewards where player_id=p and reward_key=recovery_key)<>2
 or (select sum(points) from public.account_rewards where player_id=p)<>3
 or not exists(select 1 from public.account_rewards where player_id=p and reward_key='word_discovery_v1:'||puzzle||':ledna' and points=1) then
  raise exception 'precredit exchange did not preserve XP and materialize word';
 end if;

 select * into r from public.proplet_claim_word_discovery(p,puzzle,'LEDNA');
 if r.newly_granted or r.awarded_points<>0 or r.reason<>'duplicate'
 or (select points from public.account_rewards where player_id=p and reward_key=recovery_key)<>2 then
  raise exception 'duplicate word consumed recovery precredit';
 end if;

 -- Credit is scoped to this player and board, not a global limit.
 select * into r from public.proplet_claim_word_discovery(p,other_puzzle,'ledna');
 if not r.newly_granted or r.awarded_points<>1 or r.reason<>'granted' then
  raise exception 'other board was incorrectly paid from recovery precredit';
 end if;
 select * into r from public.proplet_claim_word_discovery(other_player,puzzle,'ledna');
 if not r.newly_granted or r.awarded_points<>1
 or (select points from public.account_rewards where player_id=p and reward_key=recovery_key)<>2 then
  raise exception 'another player was incorrectly paid from recovery precredit';
 end if;

 foreach word in array array['novel','lososa'] loop
  select * into r from public.proplet_claim_word_discovery(p,puzzle,word);
  if r.newly_granted or r.awarded_points<>0 or r.reason<>'recovered'
  or (select sum(points) from public.account_rewards where player_id=p)<>4 then
   raise exception 'remaining precredited words changed total XP';
  end if;
 end loop;
 if (select points from public.account_rewards where player_id=p and reward_key=recovery_key)<>0 then
  raise exception 'recovery precredit not exhausted exactly once';
 end if;

 select * into r from public.proplet_claim_word_discovery(p,puzzle,'novela');
 if not r.newly_granted or r.awarded_points<>1 or r.reason<>'granted'
 or (select sum(points) from public.account_rewards where player_id=p)<>5
 or (select points from public.account_rewards where player_id=p and reward_key=recovery_key)<>0 then
  raise exception 'ordinary new word not rewarded after recovery credit exhausted';
 end if;
 select * into r from public.proplet_claim_word_discovery(p,puzzle,'novela');
 if r.newly_granted or r.awarded_points<>0 or r.reason<>'duplicate' then
  raise exception 'post-recovery duplicate paid twice';
 end if;

 failed:=false;
 begin
  perform public.proplet_claim_word_discovery(p,puzzle,'x');
 exception when others then failed:=sqlerrm='invalid word discovery claim'; end;
 if not failed or (select sum(points) from public.account_rewards where player_id=p)<>5 then
  raise exception 'invalid claim mutated ledger';
 end if;
 raise notice 'PASS recovery precredit3 exchanged without double XP, duplicate0, player/board scope, post-recovery new word1';
end $recovery$;
rollback;
