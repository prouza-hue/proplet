"""Check the single read-only addition before comparing the legacy API surface."""


def normalize_spojky_calendar(contract):
    route = contract["paths"].pop("/api/spojky")
    assert set(route) == {"get"} and "requestBody" not in route["get"]
    assert route["get"]["parameters"] == [{
        "name": "review", "in": "query", "required": False,
        "schema": {"anyOf": [{"type": "string"}, {"type": "null"}], "title": "Review"},
    }]
