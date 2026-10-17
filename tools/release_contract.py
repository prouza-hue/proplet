"""Cross-file release invariants, independent of the release being published."""
import re


def assert_release_contract(root):
    def read(path):
        return (root / path).read_text(encoding="utf-8")
    def extract(pattern, text, label):
        match = re.search(pattern, text)
        assert match, f"Missing {label}"
        return match.group(1)
    version = extract(r'APP_VERSION = "(\d+\.\d+\.\d+)"', read("proplet_version.py"), "canonical version")
    runtime = extract(r"version:'([^']+)'", read("public/runtime-meta.js"), "runtime version")
    shell = read("public/sw.js")
    cache = extract(r"const SHELL_CACHE='([^']+)'", shell, "shell cache")
    app = extract(r"const APP_PREVIEW_RELEASE='([^']+)'", read("public/app.js"), "app release")
    assert runtime == version, f"Runtime {runtime} differs from canonical version {version}"
    assert cache == app, f"Shell cache {cache} differs from app release {app}"
    assert cache.startswith(f"proplet-v{version}-"), f"Shell cache {cache} does not identify release {version}"
    shell_assets = set(re.findall(r"'(/[^']+)'", extract(r"const SHELL=\[(.*?)\];", shell, "shell assets")))
    for source, asset in (("public/index.html", "theme-init.js"), ("public/index.html", "runtime-meta.js"),
                          ("public/index.html", "app.js"), ("public/theme-init.js", "home-layout.js")):
        url = extract(r"(/" + re.escape(asset) + r"\?v=[^'\"\s]+)", read(source), asset + " cache URL")
        assert url in shell_assets, f"{source} loads {url}, missing from service-worker shell"
    return version
