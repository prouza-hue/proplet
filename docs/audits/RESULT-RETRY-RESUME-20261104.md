# Result retry and optional resume recovery

A rejected result write used the entire quota window as Retry-After even though the database returns the end of its fixed bucket. The result-only guard now uses the remaining bucket time, with conservative fallback for invalid metadata. Other scopes and the 120/hour limit are unchanged. The queue follows a valid 429 Retry-After even below its generic one-minute network backoff, retains the original item and finish time, and sends one confirmation after reset.

Quota diagnostics include the authenticated pseudonymous account and a UUID-only reported attempt. The latter is explicitly reported, not an ownership assertion. No request body, token or network address is added. Existing committed-receipt replay still returns before consuming write budget.

Compact Play resumes the saved board through its native difficulty tile. It no longer starts recovery for the retired separate card. A non-compact screen without Free progress also has no card to recover. Where legacy recovery is needed, it joins the shell's pending module load, distinguishes timeout/load_error/missing_export/append_error, and permits only one later retry after a 30-second cooldown. It does not change saved games, results, account state or experiment allocation.

Regression coverage:
- Actual HTTP rate guard: 120/121 requests, both observed reset offsets, sub-second and elapsed boundaries, invalid/missing reset, unchanged other scopes and safe reported linkage.
- Real result queue: exact original item/finish time survives 429, token renewal preserves backoff, concurrent retries share one POST, reset below a minute is honored, invalid header falls back safely.
- Module contract VM: compact/empty state, valid and recovered exports, one in-flight loader shared with the shell, finite failure reasons, bounded later retry and unchanged local state.
- Loopback browser on desktop, phone and Fold: malformed/blocked HomeLayout still resumes g4-e-009 with saved hints and moves; existing current-module recovery and real historical 4.09.9 worker upgrade remain in the suite.

Candidate release 4.10.21 / proplet-v4.10.21-retry-resume1. No migration is required. No production games, registrations, writes or error probes are part of validation. Subsequent organic verification must associate a real rate-limit request with its reported attempt and confirm later receipt; a module warning by itself must not be presented as a lost game.

