# Disposable feedback QA

Use only in a development/preview environment. Copy `frame.html`, `frame.css`,
`frame.js`, and `runtime.js` to the `public/design/feedback-qa*` paths referenced
by the frame. Restore any pre-existing frame files afterward.

The frame uses the app's actual rendering/completion functions. It replaces
storage with in-memory maps and intercepts API requests except the read-only
Tajenka fixture. It must not be used to assert real server ranking contents.
`tests/current/test_preview_feedback.py` checks the actual server endpoint bodies
with isolated ranking data instead.

Choose mobile, Fold, desktop, free result, daily result, or completed Tajenka
using the visible links. No production QA entry point is added by this change.
