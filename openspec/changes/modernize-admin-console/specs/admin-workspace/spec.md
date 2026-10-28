## ADDED Requirements

### Requirement: Current admin workspace
The system SHALL preserve `/admin.html` and provide Přehled, Hráči a týmy, Hlášení, Obsah a kvalita, Provoz, Analytika and Historie. Přehled SHALL be the default. Navigation SHALL preserve non-sensitive selection in URL and support browser history.

#### Scenario: Return to a player
- **WHEN** the owner opens a player and reloads the detail URL
- **THEN** the same player SHALL be selected after fresh authorization, and no email or credential SHALL be included in the URL

### Requirement: Honest data state
The system SHALL distinguish loading, empty, partial, stale, unavailable and error from successful data. Every metric SHALL expose its period, unit, source, freshness and coverage; calendar periods SHALL specify Europe/Prague.

#### Scenario: One source fails
- **WHEN** support loads successfully but diagnostics times out
- **THEN** the support data SHALL remain usable, diagnostics SHALL show an error or labeled previous snapshot, and the failed source SHALL NOT display zero or healthy

### Requirement: Actionable overview
The overview SHALL link each actionable item to its case, player, puzzle or diagnostic context and SHALL keep cases, events and affected-player counts separate.

#### Scenario: Repeated errors affect one player
- **WHEN** multiple error events refer to the same known affected player
- **THEN** the system SHALL identify the event count separately from the known affected-player count and SHALL NOT label their sum as a count of incidents

### Requirement: Owner authorization for all admin routes
Every admin API route SHALL verify the pinned owner identity and an active admin grant on the server. Mutations SHALL require explicit write authorization. A second owner grant SHALL NOT grant access to a different player. The public static `/admin.html` shell SHALL remain accessible with its authentication gate and SHALL expose no protected data before authorization.

#### Scenario: Another account receives an owner grant
- **WHEN** a different player calls users, quality-snapshot, account-integrity, push-diagnostics or recovery with that grant
- **THEN** all protected requests SHALL be denied without reading private admin data or writing state

### Requirement: Existing diagnostic and content coverage
The system SHALL expose the existing push diagnostics, limited account-integrity checks and quality history with their actual scope. The content program SHALL use the current published runtime and flag unavailable metadata. Preview features SHALL NOT be presented as current production.

#### Scenario: Monthly competition exists only in a preview branch
- **WHEN** the production admin is opened before that capability is released
- **THEN** it SHALL NOT show a healthy active production competition or actionable competition mutations

### Requirement: Accessible Proplet identity
The admin SHALL preserve Tiskařská dílna and Fraunces wordmark, omit eyebrow headings and provide keyboard operation, visible focus, labeled controls, dialog focus restoration and layouts usable at 320, 390, 690 and 1440 CSS pixels in light and dark themes.

#### Scenario: Player detail is opened from keyboard on a narrow screen
- **WHEN** the owner activates the player link and later closes its dialog or returns to the list
- **THEN** all essential data and actions SHALL remain available without page-wide horizontal clipping, and focus SHALL return to a meaningful initiating control

### Requirement: Auditable limited mutations
The system SHALL log actor, action, target UUID, time, reason where required, and safe result details for mutations. Audit lists SHALL support filters, true totals and pagination. Tokens and unmasked recovery emails SHALL NOT be logged.

#### Scenario: Recovery send fails
- **WHEN** the mail provider rejects a send after preparation
- **THEN** history SHALL distinguish the failed attempt from completed verification and SHALL expose no usable recovery token
