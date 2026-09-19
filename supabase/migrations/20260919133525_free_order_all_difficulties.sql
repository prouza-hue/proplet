-- Extend accepted difficulties without modifying existing plans or gameplay data.
alter table public.player_free_order drop constraint player_free_order_difficulty_check;
alter table public.player_free_order add constraint player_free_order_difficulty_check check (difficulty in ('easy','medium','hard','hardcore'));

create or replace function public.proplet_free_order_v1(
 p_player uuid, p_difficulty text, p_expected bigint, p_mode text,
 p_ids jsonb, p_request text, p_import boolean, p_newcomer boolean
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v public.player_free_order%rowtype; body jsonb; merged jsonb;
begin
 if p_difficulty not in ('easy','medium','hard','hardcore') or p_mode not in ('numeric','varied')
    or p_expected < 0 or jsonb_typeof(p_ids) <> 'array' or jsonb_array_length(p_ids)>5000 then
   raise exception 'INVALID_ORDER_COMMAND';
 end if;
 body := jsonb_build_object('expected',p_expected,'mode',p_mode,'ids',p_ids,'import',p_import,'newcomer',p_newcomer);
 -- Serializes first insertion too; row locks alone cannot lock an absent row.
 perform pg_advisory_xact_lock(hashtextextended(p_player::text || ':' || p_difficulty, 716));
 select * into v from public.player_free_order where player_id=p_player and difficulty=p_difficulty for update;
 if found then
   if v.request_id=p_request then
     if v.request_body<>body then raise exception 'ORDER_IDEMPOTENCY_CONFLICT'; end if;
     return jsonb_build_object('record',to_jsonb(v));
   end if;
   -- Account preference wins over an imported guest, atomically and on retries.
   if p_import then return jsonb_build_object('record',to_jsonb(v)); end if;
   if v.revision<>p_expected then return jsonb_build_object('conflict',true,'record',to_jsonb(v)); end if;
   -- Stable prefix is immutable after first plan; new batches append only.
   select coalesce(jsonb_agg(id order by first_seen),'[]'::jsonb) into merged from
     (select id,min(n) first_seen from jsonb_array_elements(v.ids || p_ids) with ordinality a(id,n) group by id) q;
   update public.player_free_order set mode=p_mode,ids=merged,revision=revision+1,
     request_id=p_request,request_body=body,updated_at=now()
     where player_id=p_player and difficulty=p_difficulty returning * into v;
 else
   if p_expected<>0 then raise exception 'ORDER_REVISION_MISSING'; end if;
   insert into public.player_free_order(player_id,difficulty,mode,ids,newcomer,request_id,request_body)
     values(p_player,p_difficulty,p_mode,p_ids,p_newcomer,p_request,body) returning * into v;
 end if;
 return jsonb_build_object('record',to_jsonb(v));
end $$;
revoke all on function public.proplet_free_order_v1(uuid,text,bigint,text,jsonb,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.proplet_free_order_v1(uuid,text,bigint,text,jsonb,text,boolean,boolean) to service_role;
