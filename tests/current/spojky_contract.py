"""Check the reviewed Spojky additions before comparing the legacy API surface."""


def normalize_spojky_calendar(contract):
    route = contract["paths"].pop("/api/spojky")
    assert set(route) == {"get"} and "requestBody" not in route["get"]
    assert route["get"]["parameters"] == [{
        "name": "review", "in": "query", "required": False,
        "schema": {"anyOf": [{"type": "string"}, {"type": "null"}], "title": "Review"},
    }]

    result = contract["paths"].pop("/api/spojky/result")
    assert set(result) == {"post"}
    claim = result["post"]
    assert [(p["name"], p["in"]) for p in claim["parameters"]] == [("authorization", "header")]
    assert claim["requestBody"]["content"]["application/json"]["schema"]["$ref"] == "#/components/schemas/SpojkyResult"
    model = contract["components"]["schemas"].pop("SpojkyResult")
    assert set(model["required"]) == {"boardId", "paths"} == set(model["properties"])
