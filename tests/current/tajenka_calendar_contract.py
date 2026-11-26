"""Review the new edition index and the preview selector before hashing legacy HTTP contracts."""


def normalize_tajenka_calendar(contract):
    recent = contract["paths"].pop("/api/tajenka/recent")
    assert set(recent) == {"get"} and "requestBody" not in recent["get"]
    assert recent["get"]["parameters"] == [{
        "name": "review", "in": "query", "required": False,
        "schema": {"type": "boolean", "default": False, "title": "Review"},
    }]
    selector = contract["paths"]["/api/tajenka"]["get"]["parameters"][0]
    assert selector["name"] == "week" and selector["required"] is False
    number, optional = selector["schema"]["anyOf"]
    assert number == {"type": "integer", "minimum": 1} and optional == {"type": "null"}
    # A missing edition now gets a 404 in preview instead of a hard-coded limit of 37.
    number["maximum"] = 37
