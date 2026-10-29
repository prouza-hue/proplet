## ADDED Requirements

### Requirement: Complete player search
The system SHALL support bounded server pagination, true filtered totals, allowed sorting and search by name, team and exact player UUID. Same-name accounts SHALL remain distinct. List and detail XP SHALL use the same authoritative current account reward model through bounded batch reads.

#### Scenario: Player has result XP and account rewards
- **WHEN** the owner finds that player in the list and opens the detail
- **THEN** both views SHALL agree with the authoritative account total and SHALL NOT substitute the sum of result points alone

#### Scenario: Search result spans more than one page
- **WHEN** matching players exceed the requested limit
- **THEN** the UI SHALL show a true total and allow access to subsequent pages without silently dropping matches

### Requirement: Account comparison and read-only teams
The system SHALL allow comparison of selected player UUIDs with activity, last completion, XP, progress, team and masked identity/recovery status. The team view SHALL distinguish current membership from historical scoring attribution. Name similarity SHALL NOT prove shared ownership.

#### Scenario: Three accounts share a display name
- **WHEN** the owner selects them for comparison
- **THEN** each SHALL retain its own stable ID and state, and no account SHALL be merged, removed or relinked automatically

### Requirement: Recoverable support history
Hlášení SHALL provide separate Podpora and Slova workflows with supported statuses, server-side search, internal notes, history and links to known player and puzzle identifiers. Completing a case SHALL retain its retrievable history.

#### Scenario: Owner resolves a support case
- **WHEN** its state changes from open to resolved
- **THEN** the case SHALL remain accessible by its identifier and through resolved/all filters, with an audit entry

### Requirement: UUID-bound recovery confirmation
Recovery SHALL be available only in the selected player's detail after server authorization. Confirmation SHALL bind an explicit immutable player UUID and safe target-email summary. Stale responses SHALL be discarded before render and submit.

#### Scenario: Slow response for A arrives after opening B
- **WHEN** a pending recovery status for A completes while B is selected
- **THEN** it SHALL NOT render into B's detail or create a form capable of targeting A under B's identity

### Requirement: Verified-email recovery flow
The system SHALL adapt PR 118 recovery-email GET/POST to current authentication, preserving owner pin, conflict prevention, hashed tokens, expiration and rate limits. Sending SHALL create a pending verification state; email SHALL only become verified after real mailbox/provider verification through the current verification flow. Current Google PKCE and explicit link intent SHALL remain intact.

#### Scenario: Email is already verified on another player
- **WHEN** recovery is requested or finalized for that email on a different player
- **THEN** the operation SHALL be refused without transferring email, Google identity, results or XP

#### Scenario: Provider email is not confirmed
- **WHEN** a recovery callback lacks valid confirmation for the expected email
- **THEN** the account SHALL remain unverified and no admin override SHALL mark the email verified

### Requirement: Atomic challenge lifecycle
Challenge issue, supersession and consumption SHALL enforce a single effective current challenge for the target. The lifecycle SHALL fail closed on revocation failure, revalidate ownership conflicts at finalization and handle concurrent/idempotent requests. Target identity state or revision SHALL be checked at preview, send and consume; a changed identity or different verified email on the target SHALL NOT be overwritten by an older pending challenge. Delivery failure SHALL leave no effective newly failed challenge; audit failure SHALL not leave an undocumented success.

#### Scenario: Revoking the previous challenge fails
- **WHEN** an owner requests another link and the revocation transaction fails
- **THEN** the new link SHALL NOT be issued or sent as successful

#### Scenario: Concurrent recovery requests
- **WHEN** two valid requests overlap for the same target player
- **THEN** at most one current challenge SHALL remain effective and an older callback SHALL NOT bind or overwrite identity

#### Scenario: Target identity changes while recovery is pending
- **WHEN** a player receives a recovery challenge and subsequently verifies a different email or changes its authentication identity before using that challenge
- **THEN** consuming the old challenge SHALL be refused without overwriting the new identity; an already verified identical email SHALL use an explicit idempotent already-verified outcome

### Requirement: First-release mutation boundary
The first release SHALL NOT expose account merge, Auth user deletion, arbitrary XP editing, identity unlinking, team membership writes or historical score correction as available mutations. Future sensitive operations SHALL have separate approved specifications and transaction/dry-run acceptance.

#### Scenario: Owner opens a duplicate-account comparison
- **WHEN** the owner inspects the first-release interface
- **THEN** comparison and recovery SHALL be available as specified, and deferred team or identity repairs SHALL not execute changes
