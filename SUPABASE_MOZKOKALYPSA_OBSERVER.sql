-- Keep the fixed top-three cohort and permit one explicitly invited observer.
-- slot remains the index of one of the three frozen board orders.
begin;
alter table public.mozkokalypsa_invites
 add column participant_role text not null default 'tester'
 check (participant_role in ('tester','observer'));
alter table public.mozkokalypsa_invites
 drop constraint mozkokalypsa_invites_experiment_id_slot_key;
create unique index mozkokalypsa_tester_slot_key
 on public.mozkokalypsa_invites(experiment_id,slot)
 where participant_role='tester';
create unique index mozkokalypsa_one_observer_key
 on public.mozkokalypsa_invites(experiment_id)
 where participant_role='observer';
comment on column public.mozkokalypsa_invites.participant_role is
 'tester = original XP-selected cohort; observer = supplemental owner play, exclude from primary analysis';
commit;

