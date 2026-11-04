-- This fixture runs inside a transaction in the isolated PostgreSQL gate.
INSERT INTO proplet_experiment_internal.entry_assignments
    (environment,is_test,anonymous_id,first_steps_run_id,variant,assigned_at,event_id)
SELECT env,test,repeat(hex,64),('ad000000-0000-4000-8000-00000000000'||n)::uuid,
       arm,'2026-11-16 11:00Z',('ed000000-0000-4000-8000-00000000000'||n)::uuid
FROM (VALUES (1,'production',false,'a','A'),(2,'production',false,'b','B'),
             (3,'production',false,'c','B'),(4,'production',true,'d','A'),
             (5,'preview',true,'e','B'),(6,'production',false,'f','A'),(7,'production',false,'7','B')) AS f(n,env,test,hex,arm);

INSERT INTO public.product_events(id,event_type,anonymous_id,environment,is_test,created_at,context)
SELECT event_id,'entry_experiment_assigned',anonymous_id,environment,is_test,assigned_at,
       jsonb_build_object('entry_experiment','new-player-entry-v1','entry_variant',variant,
                          'first_steps_run_id',first_steps_run_id)
FROM proplet_experiment_internal.entry_assignments WHERE first_steps_run_id::text LIKE 'ad000000-%';

INSERT INTO public.puzzle_attempts(id,puzzle_id,challenge_key,mode,difficulty,anonymous_id,started_at,completed_at,environment,is_test)
VALUES ('entry-report-first','g4-e-009','free:g4-e-009','free','easy',repeat('b',64),'2026-11-16 11:01Z','2026-11-16 11:06Z','production',false),
       ('entry-report-next','g4-e-010','free:g4-e-010','free','easy',repeat('b',64),'2026-11-16 11:08Z',null,'production',false),
       ('entry-report-boundary','g4-e-010','free:g4-e-010','free','easy',repeat('c',64),'2026-11-16 11:08Z','2026-11-17 11:00Z','production',false),
       ('entry-report-qa','g4-e-009','free:g4-e-009','free','easy',repeat('a',64),'2026-11-16 11:01Z','2026-11-16 11:08Z','production',true);

INSERT INTO public.product_events(id,event_type,anonymous_id,environment,is_test,created_at,context)
VALUES (gen_random_uuid(),'first_board_experiment_started',repeat('b',64),'production',false,'2026-11-16 11:01Z',
       '{"puzzle_id":"g4-e-009","first_steps_run_id":"ad000000-0000-4000-8000-000000000002","run_id":"entry-report-first"}'),
       (gen_random_uuid(),'starter_completed',repeat('a',64),'production',false,'2026-11-16 11:01Z','{}'),
       (gen_random_uuid(),'tajenka_completed',repeat('7',64),'production',false,'2026-11-16 11:25Z','{}'),
       (gen_random_uuid(),'tajenka_completed',repeat('a',64),'production',true,'2026-11-16 11:25Z','{}'),
       (gen_random_uuid(),'app_open',repeat('b',64),'production',false,'2026-11-16 23:01Z','{}');
