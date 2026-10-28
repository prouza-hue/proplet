## ADDED Requirements

### Requirement: Versioned current activation funnel
The system SHALL define a versioned funnel matching the current short training and first real game through verified account saving. Each step SHALL have a proven runtime event or authoritative server signal and an explicit population and denominator. Unsupported steps SHALL be marked unverified or unavailable.

#### Scenario: Only old onboarding data exists
- **WHEN** the available dataset contains board-v2 events but the current flow is board-v3-short
- **THEN** the current funnel SHALL show the coverage limitation and SHALL NOT label old data as current activation

#### Scenario: User skips training
- **WHEN** a valid runtime path skips an optional step
- **THEN** that path SHALL be represented explicitly and SHALL NOT be automatically counted as a failed mandatory conversion

### Requirement: Historical measurement isolation
Old Launch board-v2 datasets SHALL remain available only through a clearly historical view with version and period. Current and historical cohorts SHALL NOT be combined without an explicit compatible definition.

#### Scenario: Owner switches to historical Launch
- **WHEN** the historical view is selected
- **THEN** its version and interval SHALL remain visible and its metrics SHALL NOT replace the current default overview

### Requirement: Mature retention cohorts
D1 and D7 SHALL use fully observable Prague calendar cohorts with explicit denominator, definition of return and sample size. Immature cohorts SHALL be pending, not zero retention. Anonymous visitors, local players and registered accounts SHALL remain distinct unless an actual supported identity link exists.

#### Scenario: D7 cohort is only three days old
- **WHEN** the owner views its retention
- **THEN** D7 SHALL be shown as not yet evaluable and SHALL NOT reduce the retention result for mature cohorts

### Requirement: Quality methodology visibility
Quality SHALL expose its actual time window, first-lifetime-attempt basis, sample size, historical limitations, supported modes, calm-mode separation and excluded calibration IDs. Existing snapshot history SHALL be accessible without turning missing snapshots into zero-quality values.

#### Scenario: Puzzle has a small recent sample
- **WHEN** the owner opens its quality detail
- **THEN** the sample count and limitations SHALL be visible alongside the flag, and the flag SHALL NOT be presented as conclusive difficulty evidence

### Requirement: Metric semantics and cost
Every analytical measure SHALL declare its unit and exact window, and aggregation SHALL be bounded and performed through appropriate server queries/caches. Attempts SHALL NOT be labeled unique players. No dashboard refresh SHALL require unbounded per-player queries.

#### Scenario: Version distribution counts attempts
- **WHEN** that source is displayed
- **THEN** it SHALL be labeled as an attempt distribution for its actual period rather than a distribution of all active users
