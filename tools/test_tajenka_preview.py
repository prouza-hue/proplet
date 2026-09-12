#!/usr/bin/env python3
"""Compatibility entrypoint for the current Tajenka release contract.

The production owner of the Tajenka release invariant is
``test_tajenka_v2_production.py``. Keep this legacy current-gate path as a
thin delegate so the gate cannot drift back to obsolete v1 preview copy/UI
markers.
"""

from test_tajenka_v2_production import main


if __name__ == "__main__":
    main()
