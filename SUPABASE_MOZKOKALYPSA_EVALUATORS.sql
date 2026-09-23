-- Allow explicitly invited evaluators to share a frozen board order.
-- Player identity remains unique; observer separation and authorization stay intact.
begin;
drop index public.mozkokalypsa_tester_slot_key;
comment on column public.mozkokalypsa_invites.participant_role is
 'tester = evaluating cohort (original XP selection plus explicit invitations); observer = separate supplementary play';
commit;
