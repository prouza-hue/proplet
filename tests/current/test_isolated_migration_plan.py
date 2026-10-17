"""Bootstrap order must match legacy roots followed by the dated SQL history."""
from pathlib import Path
import json
import runpy
import tempfile

ROOT = Path(__file__).resolve().parents[2]
plan = runpy.run_path(str(ROOT / "tools/test_isolated_result_db.py"))["migration_plan"]
paths = plan(ROOT)
manifest = json.loads((ROOT / "supabase/migrations/manifest.json").read_text())
dated = sorted((ROOT / "supabase/migrations").glob("*.sql"))
assert len(paths) == len(set(paths))
assert all(path.is_file() for path in paths)
assert [path for path in paths if path in dated] == dated
for entry in manifest["files"]:
    path = ROOT / entry["path"]
    if entry["type"] == "verify" or entry.get("timestamp_migration"):
        assert path not in paths
    else:
        assert paths.count(path) == 1, entry["path"]
hotfix = ROOT / "supabase/prepared/historical_free_rewards.sql"
assert paths.index(ROOT / "supabase/migrations/20261012000339_daily_specials.sql") < paths.index(hotfix)
assert paths.index(hotfix) < paths.index(ROOT / "supabase/migrations/20261015070626_offline_result_timing.sql")
# Reproduce the manifest overlap which used to run the offline migration early.
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    folder = root / "supabase/migrations"
    folder.mkdir(parents=True)
    for name in ("20260101_sessions.sql", "20260201_offline.sql"):
        (folder / name).write_text("-- synthetic migration")
    manifest = {"files": [
        {"path": "legacy.sql", "type": "migration", "order": 1},
        {"path": "supabase/migrations/20260201_offline.sql", "type": "migration", "order": 2},
    ]}
    (folder / "manifest.json").write_text(json.dumps(manifest))
    assert [p.name for p in plan(root)] == ["legacy.sql", "20260101_sessions.sql", "20260201_offline.sql"]
    manifest["files"].append(manifest["files"][0])
    (folder / "manifest.json").write_text(json.dumps(manifest))
    try:
        plan(root)
    except AssertionError:
        pass
    else:
        raise AssertionError("Duplicate legacy migration must be rejected")
print("PASS database bootstrap: chronological migrations exactly once; overlap regression and duplicate guard")
