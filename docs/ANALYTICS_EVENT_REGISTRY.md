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
