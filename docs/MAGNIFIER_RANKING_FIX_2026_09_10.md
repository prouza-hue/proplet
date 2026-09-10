# Preview follow-up: magnifier and expanded ranking

Branch ux/tiskarska-dilna only. Baseline remote d453612b1d98790e41a26bb77ede7ea19dd9fa8e.

Magnifier:
- Render as a child of the layout dock rather than a fixed body overlay gated on an exact measured 84px rectangle.
- Support touch-capable unfolded viewports up to 1280px; the previous 600px short-side cutoff excluded larger Fold viewports.
- Rendering visibility is controlled by the input lifecycle and user's preference, not a conflicting fine-pointer media rule. Difficulty eligibility is unchanged.
- QA fixture now exercises pointerDown and pointerEnter rather than calling showMagnifier directly. Removed its CSS visibility override.

Ranking:
- Expanding hides the compact neighbours; collapsing restores them.
- Initial API page surrounds myRank (up to 25 preceding players); focus centers own row after loading.
- Previous/next pages append without duplicating rank boundaries. Local team results use the same expansion focus behavior without API pagination.
- Medal column now reserves the artwork's full 40px width, leaving an actual 8px gap to the avatar.

Verification:
- Cloud Chrome 390x844 and 760x900: magnifier visibly rendered through input handlers; off toggle hides it.
- Mobile free results: compact neighbours hidden after expansion, restored after collapse; medal/avatar separation checked visually.
- Fold daily results: rank 75 of 120 opens centered on player, 50 rows initially; previous then next produce 99 and 120 unique rows.
- Node interaction tests, magnifier pointer lifecycle (390/560/760/1024 widths), ranking pagination/focus tests pass.
- Team browser fixture was anonymous after asynchronous app refresh; team non-fetch/focus path is covered by the Node test, not a claimed browser account test.

The precise failing state on Pavel's physical device was not available. The fragile size/visibility gates were removed; this is browser viewport verification, not a physical Samsung test. Temporary public fixtures restored/removed after verification.
