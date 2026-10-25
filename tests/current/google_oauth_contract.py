"""Review the intentional OAuth API break before restoring historical digests."""


def normalize_google_oauth(contract):
    paths = contract["paths"]
    schemas = contract["components"]["schemas"]
    link = paths.pop("/api/auth/google/link/start")
    assert set(link) == {"post"}
    assert link["post"]["requestBody"]["content"]["application/json"]["schema"] == {"$ref": "#/components/schemas/GoogleLinkStart"}
    password = schemas.pop("GoogleLinkStart")
    assert password["required"] == ["password"]
    assert password["properties"] == {"password": {"type": "string", "minLength": 8, "maxLength": 128, "title": "Password"}}
    callback = schemas.pop("GoogleCallback")
    assert set(callback["properties"]) == {"code", "state", "inviteCode"}
    assert set(callback["required"]) == {"code", "state"}
    assert callback["properties"]["code"] == {"type": "string", "minLength": 1, "maxLength": 2048, "title": "Code"}
    assert callback["properties"]["state"] == {"type": "string", "minLength": 43, "maxLength": 43, "pattern": "^[A-Za-z0-9_-]+$", "title": "State"}
    assert callback["properties"]["inviteCode"] == schemas["AuthCallback"]["properties"]["inviteCode"]
    body = paths["/api/auth/google/complete"]["post"]["requestBody"]["content"]["application/json"]
    assert body["schema"] == {"$ref": "#/components/schemas/GoogleCallback"}
    # Only the Google endpoint changes; recovery/email still use AuthCallback.
    body["schema"] = {"$ref": "#/components/schemas/AuthCallback"}
