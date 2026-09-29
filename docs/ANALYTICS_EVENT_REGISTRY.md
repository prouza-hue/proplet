# Product analytics event registry

Sprint 15 separates product-event transport from gameplay/UI flow without changing metric semantics.

## Canonical contract

- Registry: `public/analytics-event-registry.json`.
- Client adapter: `public/app/analytics.js`.
- Backend service: `backend/analytics.py`.
- HTTP endpoint remains `POST /api/product-event`.
- Request body remains exactly `{"event_type":"..."}`.
- The characterized registry contains 132 accepted event names.
- One call to `analytics.track(...)` still means one HTTP request. Batching is intentionally disabled.

The global `trackProductEvent()` function remains as a compatibility wrapper for existing current/versioned assets. It delegates to the adapter when available and preserves the historical direct-request fallback for mixed-cache clients.

## PII audit

Product-event request bodies contain only the event name.

They do **not** add:

- player name or email;
- team name/code;
- puzzle words, free text or support text;
- URL/referrer/campaign properties;
- arbitrary caller-supplied properties.

Existing actor identity continues to be derived by the backend from the established Authorization or `X-Proplet-Anon-ID` headers supplied by the shared API client. Sprint 15 does not add a new identifier.

A historical caller passes `{level}` as a second argument for `starter_hint_used`; the old transport ignored it and the new adapter intentionally continues to ignore all custom properties.

## Call-site inventory

Product-event calls currently cover these domains:

- app/session and non-game screen navigation;
- onboarding/helper and returning-player flows;
- account nudges, progress guard and win account CTA;
- starter flow;
- PWA install/update and push-retention flows;
- rolling-content CTA;
- Tajenka product journey;
- calm-mode product preferences;
- difficulty nudges;
- valid non-solution / word-discovery product signals.

Current and compatibility assets continue to emit explicit domain event names through `trackProductEvent()`; Sprint 15 changes transport ownership, not event timing or product definitions.

## Telemetry explicitly outside this registry

The following remain separate contracts and are not routed through product analytics:

- `/api/attempt/start`
- `/api/attempt/checkpoint`
- `/api/attempt/finish`
- `/api/hint-event`
- `/api/helper-event`
- `/api/challenge-event`
- `/api/account-bonus-event`

Completion/attempt telemetry therefore remains isolated from best-effort product analytics.

## Admin aggregation

Sprint 15 does not change historical aggregation logic or retention definitions.

In particular:

- `build_quality_report()` still reads bounded product/attempt/helper/hint datasets and builds the existing quality funnel in process;
- `/api/admin/launch` still reads bounded recent `product_events` and performs the existing launch aggregation;
- no SQL view/RPC, daily snapshot, batching or session buffer is introduced.

Any aggregation/performance change requires separate measurement and product approval.

## Change protocol

Adding or removing a product event requires:

1. updating the canonical registry;
2. updating the golden fixture and current tests;
3. preserving the event payload/PII policy unless explicitly approved;
4. product review if the change alters metric or retention meaning.


## board-v3-short provenance and boundaries (2026-09-25)

`X-Proplet-Onboarding` is an exact, case-sensitive allowlist: `board-v2` and
`board-v3-short` are retained unchanged. Missing, empty, malformed, overlong or
unknown values map to `legacy`; arbitrary values are never stored. This category
means **unrecognized/unspecified**, not proof that a player saw an old tutorial.
The rule applies to all measurement-enriched tables. Environment, is_test,
measurement_version, client_release and capture-time auth remain independent.
Anonymous claim updates actor ownership only; it must not rewrite provenance.
Server-owned `account_created` is authoritative; do not infer its absent client
release or onboarding version from the actor's other events.

Ordered diagnostic phases per `starter_run_id`:
`requested → data_ready → ready → interaction → first_correct → completed`.
`ready` means the board rendered, not that input was proven functional.
`interaction` is the first real board pointer interaction (tap or drag), at most
once per run. `first_correct` follows actual word acceptance, `completed` follows
all three accepted words; both are at most once per run. `hidden` is visibility,
not definitive abandonment. Reason remains an allowlist; no URLs, PII or raw errors.

`starter_started` is a compatibility event just before ready.
`onboarding_completed`, `starter_completed`, `starter_v1_completed` are **one
logical starter-completion boundary**, never three successive funnel steps.
Completion of the assigned first real board is a separate real-game boundary. In the `first-board-v1` experiment this is `g4-e-001` for `control_e001` and `g4-e-009` for `challenger_e009`. Only then can
`first_steps_v1_offer` fire; Google/manual/continue follow the offer. `saved`
requires confirmed sync after auth/claim, and is not emitted for preview storage.

Evaluate new runs by environment=production, is_test=false, exact onboarding
version and client release, retaining run IDs, captured elapsed times and
capture-time auth. Report stage reach by distinct runs and distinct actors
separately. Compare only closed, comparable acquisition/time windows; today's
rolling totals are diagnostics, not a causal uplift claim. Historical rows from
known faulty releases require explicit correction; do not silently reinterpret
all legacy rows, nor mix corrected and uncorrected populations.



## Immutable funnel context — 2026-09-26
Starter trace freezes onboarding_version/client_release at requested and sends that snapshot on every phase, including completed after onboarding state changes. Legitimate board-v2 remains board-v2. Run IDs are UUIDs; phase capture remains once per run. Capture-time auth and elapsed remain unchanged. starter_reason is preserved for compatibility and duplicated into canonical context.reason: data/prepare/render/superseded/navigation/visibility (unknown only as server fallback for missing/invalid legacy headers). Hidden is visibility only, not final abandonment. Three completion signals (onboarding_completed, starter_completed, starter_v1_completed) are ONE logical boundary.

Account flow creates first_steps_run_id at the assigned first real-board offer. It persists across OAuth return and guest claim; event context contains first_steps_run_id, signup trigger context additionally creation_source=first_steps_v1 (otherwise other). `first_board_experiment_assigned`, `first_board_experiment_started` and `first_board_experiment_completed` carry the bounded experiment key, arm and 0-99 bucket; the same provenance is carried through the client-side first-steps branch. The authoritative server-side `account_created` is attributed to the arm by its shared `first_steps_run_id`, not by guessing from player or puzzle. These analytic declarations are never authorization. All values are bounded/UUID validated; no emails, URLs or free-form errors are copied. Non-test production reports MUST filter environment=production AND is_test=false.

New diagnostic events: first_steps_v1_auth_cancelled, first_steps_v1_auth_failed, first_steps_v1_save_failed; at most once each per flow. context.outcome: cancelled|failed; reason: dismissed|provider_cancel|request|offline|sync|quarantined. Multiple retries do not create duplicate branch phases. The authoritative account_created remains transactionally emitted only by the players INSERT trigger. HTTP rejection/provider cancellation cannot create it. saved requires successful claim/sync, no remaining/quarantined queue and server-confirmed starter:starter-v1 plus the dynamically assigned first real board. An existing-account login can save without a new account_created. Puzzle IDs and contents remain immutable.

Use docs/audits/FUNNEL-PRODUCTION-VERIFY.sql for organic acceptance. Until at least 30 fresh non-test v3 runs and all invariants pass, status is “nasazeno, čeká na produkční ověření”. Do not fabricate production traffic to fill the cohort.
