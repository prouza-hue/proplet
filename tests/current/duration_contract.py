"""Review the conservative-disconnect duration delta before historical API hashing."""


def normalize_disconnect_durations(contract):
    schemas = contract["components"]["schemas"]
    fields = {
        ("AttemptCheckpoint", "elapsed_ms"): (0, "Elapsed Ms", True),
        ("AttemptFinishTelemetry", "elapsed_ms"): (1000, "Elapsed Ms", False),
        ("HelperEventCreate", "elapsed_ms"): (0, "Elapsed Ms", True),
        ("HelperEventCreate", "idle_ms"): (0, "Idle Ms", True),
        ("HintEventCreate", "elapsed_ms"): (0, "Elapsed Ms", True),
        ("Progress", "elapsedMs"): (0, "Elapsedms", True),
        ("ResultCreate", "elapsed_ms"): (1000, "Elapsed Ms", False),
    }
    widened = {
        (name, field)
        for name, schema in schemas.items()
        for field, value in schema.get("properties", {}).items()
        if value.get("maximum") == 2_147_483_647
    }
    assert widened == set(fields), widened
    for (name, field), (minimum, title, optional) in fields.items():
        schema = schemas[name]
        expected = {"type": "integer", "maximum": 2_147_483_647.0,
                    "minimum": float(minimum), "title": title}
        if optional:
            expected["default"] = 0
        assert schema["properties"][field] == expected, (name, field)
        assert (field not in schema.get("required", [])) == optional, (name, field)
        # Only the reviewed upper bound is normalized. Every other field detail
        # remains in the original digest, whose expected value is unchanged.
        schema["properties"][field]["maximum"] = 86_400_000.0
    assert schemas["Progress"]["properties"]["disconnected"] == {
        "type": "boolean", "title": "Disconnected", "default": False,
    }
    assert "disconnected" not in schemas["Progress"].get("required", [])
