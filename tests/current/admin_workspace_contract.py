"""Validate only the approved additive admin delta before historical API hashing.

This is deliberately an allowlist of exact methods, optional parameters, bounds
and recovery body models. It never drops an existing admin path. Runtime
authorization, bounded SQL and challenge lifecycle have separate HTTP/SQL tests.
"""
from __future__ import annotations

WORKSPACE_ROUTES = {
    "/api/admin/workspace": ("GET", "workspace_route"),
    "/api/admin/operations": ("GET", "operations_route"),
    "/api/admin/content": ("GET", "content_route"),
    "/api/admin/analytics": ("GET", "analytics_route"),
    "/api/admin/teams": ("GET", "teams_route"),
    "/api/admin/teams/{code}": ("GET", "team_route"),
}
RECOVERY_ROUTES = {
    ("/api/admin/users/{player_id}/recovery-email", "GET", "recovery_status"),
    ("/api/admin/users/{player_id}/recovery-email", "POST", "recovery_send"),
    ("/api/admin/users/{player_id}/recovery-email/preview", "POST", "recovery_preview"),
}
EXISTING_ADMIN_PATHS = {
    "/api/admin/me", "/api/admin/launch", "/api/admin/support",
    "/api/admin/support/{report_id}", "/api/admin/overview", "/api/admin/users",
    "/api/admin/users/{player_id}", "/api/admin/reports", "/api/admin/reports/{report_id}",
    "/api/admin/audit", "/api/admin/quality", "/api/admin/quality-history",
    "/api/admin/quality-snapshot", "/api/admin/push-diagnostics", "/api/admin/account-integrity",
}


def normalize_admin_routes(routes):
    """Remove reviewed additions, retaining old paths/methods/handler names."""
    routes = list(routes)
    recovery = [r for r in routes if "recovery-email" in r[0]]
    expected = {(p, (method,), name) for p, (method, name) in WORKSPACE_ROUTES.items()}
    if recovery:
        expected |= {(p, (method,), name) for p, method, name in RECOVERY_ROUTES}
    added_paths = set(WORKSPACE_ROUTES) | {p for p, _, _ in RECOVERY_ROUTES}
    actual = [r for r in routes if r[0] in added_paths]
    assert len(actual) == len(expected) and set(actual) == expected, actual
    assert {r[0] for r in routes if r[0].startswith("/api/admin/")} == (
        EXISTING_ADMIN_PATHS | {r[0] for r in expected}
    ), "Unexpected admin path addition or historical path removal"
    return [r for r in routes if r[0] not in added_paths]


def parameter(name, kind, default=... , *, required=False, location="query", **bounds):
    title = name.replace("_", " ").title()
    schema = {"type": kind, **bounds, "title": title}
    if default is not ...:
        schema["default"] = default
    return {"name": name, "in": location, "required": required, "schema": schema}


def nullable(name, *, location="query"):
    return {"name": name, "in": location, "required": False,
            "schema": {"anyOf": [{"type": "string"}, {"type": "null"}],
                       "title": name.replace("_", " ").title()}}


AUTHORIZATION = nullable("authorization", location="header")
OFFSET = parameter("offset", "integer", 0)
BOUNDED_OFFSET = parameter("offset", "integer", 0, minimum=0, maximum=100000)
TEAM_LIMIT = parameter("limit", "integer", 30, minimum=1, maximum=200)
QUERY = parameter("q", "string", "", maxLength=80)
ADDED_QUERY_PARAMETERS = {
    "/api/admin/users": [OFFSET, parameter("sort", "string", "active")],
    "/api/admin/support": [parameter("q", "string", ""), parameter("category", "string", ""),
                           nullable("player_id"), nullable("id"), OFFSET,
                           parameter("limit", "integer", 100)],
    "/api/admin/reports": [OFFSET, nullable("player_id"), nullable("id")],
    "/api/admin/audit": [OFFSET, parameter("action", "string", ""), parameter("target_id", "string", ""),
                         nullable("from_date"), nullable("to_date")],
}
WORKSPACE_PARAMETERS = {
    "/api/admin/workspace": [AUTHORIZATION],
    "/api/admin/operations": [AUTHORIZATION],
    "/api/admin/content": [parameter("days", "integer", 7, minimum=1, maximum=14), AUTHORIZATION],
    "/api/admin/analytics": [parameter("days", "integer", 30, minimum=1, maximum=90),
                             parameter("history", "boolean", False), AUTHORIZATION],
    "/api/admin/teams": [QUERY, BOUNDED_OFFSET, TEAM_LIMIT, AUTHORIZATION],
    "/api/admin/teams/{code}": [parameter("code", "string", required=True, location="path"),
                                BOUNDED_OFFSET, TEAM_LIMIT, AUTHORIZATION],
}


def _operation(operation, *, path, method, parameters, body=None, name=None):
    """Check the entire untyped-JSON route envelope, including validation refs."""
    assert operation.get("parameters", []) == parameters, (path, method, operation.get("parameters"))
    assert set(operation) == {"summary", "operationId", "parameters", "responses"} | ({"requestBody"} if body else set())
    if name:
        suffix = path.replace("/", "_").replace("{", "_").replace("}", "_").replace("-", "_")
        assert operation["operationId"] == name + suffix + "_" + method.lower()
        assert operation["summary"] == name.replace("_", " ").title()
    assert operation["responses"] == {
        "200": {"description": "Successful Response", "content": {"application/json": {"schema": {}}}},
        "422": {"description": "Validation Error", "content": {
            "application/json": {"schema": {"$ref": "#/components/schemas/HTTPValidationError"}}}},
    }, (path, method)
    if body:
        assert operation["requestBody"] == {"content": {"application/json": {
            "schema": {"$ref": f"#/components/schemas/{body}"}}}, "required": True}
    else:
        assert "requestBody" not in operation


def normalize_admin_workspace(contract):
    paths, schemas = contract["paths"], contract["components"]["schemas"]
    recovery_paths = {p for p in paths if "recovery-email" in p}
    expected_recovery = {p for p, _, _ in RECOVERY_ROUTES}
    assert recovery_paths in (set(), expected_recovery), recovery_paths
    assert {p for p in paths if p.startswith("/api/admin/")} == (
        EXISTING_ADMIN_PATHS | set(WORKSPACE_ROUTES) | recovery_paths
    ), "Unexpected admin HTTP contract"
    for path, (method, name) in WORKSPACE_ROUTES.items():
        assert set(paths[path]) == {method.lower()}, path
        operation = paths[path][method.lower()]
        _operation(operation, path=path, method=method, parameters=WORKSPACE_PARAMETERS[path], name=name)
        paths.pop(path)
    for path, added in ADDED_QUERY_PARAMETERS.items():
        operation = paths[path]["get"]
        for expected in added:
            matches = [p for p in operation["parameters"] if p["name"] == expected["name"] and p["in"] == "query"]
            assert matches == [expected], (path, expected, matches)
            operation["parameters"].remove(matches[0])
    if recovery_paths:
        for path in recovery_paths:
            expected_methods = {m.lower() for p, m, _ in RECOVERY_ROUTES if p == path}
            assert set(paths[path]) == expected_methods, path
            for method in expected_methods:
                body = None if method == "get" else "AdminRecoveryPreview" if path.endswith("/preview") else "AdminRecoveryEmailRequest"
                name = next(name for p, m, name in RECOVERY_ROUTES if p == path and m.lower() == method)
                _operation(paths[path][method], path=path, method=method,
                    parameters=[parameter("player_id", "string", required=True, location="path"), AUTHORIZATION], body=body, name=name)
            paths.pop(path)
        base_properties = {
            "email": {"type": "string", "minLength": 3, "maxLength": 254, "title": "Email"},
            "reason": {"type": "string", "minLength": 8, "maxLength": 500, "title": "Reason"},
        }
        for name in ("AdminRecoveryPreview", "AdminRecoveryEmailRequest"):
            model = schemas.pop(name)
            expected = dict(base_properties)
            if name == "AdminRecoveryEmailRequest":
                expected["confirmationToken"] = {"type": "string", "minLength": 40, "maxLength": 2048, "title": "Confirmationtoken"}
            assert model == {"properties": expected, "type": "object", "required": list(expected), "title": name}, model
    else:
        assert not ({"AdminRecoveryPreview", "AdminRecoveryEmailRequest"} & set(schemas))
