"""Release bumps pass; mismatched versions/cache URLs must still fail."""
from pathlib import Path
import runpy
import tempfile

ROOT = Path(__file__).resolve().parents[2]
check = runpy.run_path(str(ROOT / "tools/release_contract.py"))["assert_release_contract"]
files = ("proplet_version.py", "public/runtime-meta.js", "public/sw.js", "public/app.js", "public/index.html", "public/theme-init.js")
version = check(ROOT)
with tempfile.TemporaryDirectory() as directory:
    target = Path(directory)
    originals = {name: (ROOT / name).read_text() for name in files}
    def restore():
        for name, content in originals.items():
            path = target / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
    restore()
    # A coordinated future release must not require changing these tests.
    for name in files:
        path = target / name
        path.write_text(path.read_text().replace(version, "99.99.99"))
    assert check(target) == "99.99.99"
    mutations = [
        ("proplet_version.py", version, "99.99.98"),
        ("public/runtime-meta.js", version, "99.99.98"),
        ("public/sw.js", "const SHELL_CACHE=", "const MISSING_CACHE="),
        ("public/app.js", "proplet-v" + version, "proplet-v99.99.98"),
        ("public/sw.js", "/theme-init.js?v=", "/missing-theme.js?v="),
        ("public/theme-init.js", "/home-layout.js?v=", "/missing-home.js?v="),
    ]
    for name, before, after in mutations:
        restore()
        path = target / name
        assert before in path.read_text()
        path.write_text(path.read_text().replace(before, after))
        try:
            check(target)
        except AssertionError:
            pass
        else:
            raise AssertionError(f"Release regression was not detected: {name}: {before}")
print("PASS release contract: synchronized future bump accepted; six version/cache regressions rejected")
