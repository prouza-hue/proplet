from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
theme_init = (ROOT / "public" / "theme-init.js").read_text(encoding="utf-8")

for name in ("privacy.html", "terms.html"):
    page = (ROOT / "public" / name).read_text(encoding="utf-8")
    assert "data-proplet-theme-only" in page, f"{name} must opt out of app boot"
    assert '<script src="/theme-init.js?v=40118"></script>' in page, f"{name} must retain a cache-busted theme setup"
    assert "account-auth.js" not in page, f"{name} must not load account UI directly"

guard = "if(document.documentElement.hasAttribute('data-proplet-theme-only'))return;"
assert guard in theme_init
assert theme_init.index(guard) < theme_init.index("const styles=[")
assert theme_init.index(guard) < theme_init.index("const loadExtras=async()=>")
assert "legalPageIsolationV40111:true" in (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")
assert "legalPageCacheBustV40112:true" in (ROOT / "public" / "runtime-meta.js").read_text(encoding="utf-8")

print("v4.01.18 legal page isolation and cache-bust regression passed")
