# Current runtime regression gate

Run `python -m pip install -r requirements-dev.txt`, then `python tools/test_current.py`
from the repository root. The runner supplies the repository import path; individual
Python tests can also be run with `PYTHONPATH=. python tests/current/<test>.py`.
`manifest.json` is the explicit list of active tests. Historical filenames in that
list still protect current behavior, not the release number in their name.

Maintenance rules:

- Check release consistency with `tools/release_contract.py`. Do not pin the current
  version or an asset cache suffix to the release that introduced a feature. The
  helper's tests accept a coordinated future bump and reject version/cache drift.
- Update changed product expectations at the behavioral boundary. Completed weekly
  banners are hidden and empty; unfinished batches retain both working entry points.
- Fixtures must implement the current API contract (archive cover count, online state,
  official special finish receipt). Cover missing/refused confirmation as well as success.
- The S04/S06 historical API digests remain compatibility checks. Review additive
  routes/optional fields explicitly before normalizing them; do not replace a digest
  simply because it fails. Existing routes, required fields and validation stay protected.
- The disposable PostgreSQL setup uses legacy roots followed by dated migrations and
  applied hotfixes at their manifest date. Never execute a dated file twice or replay
  an older RPC after its replacement. `test_isolated_migration_plan.py` covers this
  ordering without connecting to a database; CI also runs the real SQL acceptance suite.
- Report a failure with the failing test/assertion, cause, and gameplay impact. Missing
  local assets/dependencies are environment limitations, not evidence of a product defect.
