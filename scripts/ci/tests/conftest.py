"""Shared fixtures for the CI-guard pytest suite (G2).

Makes the sibling ``scripts/ci`` modules importable so each test file
can ``import forbid_raw_sql`` / ``forbid_bare_kafka_producer`` /
``forbid_external_secret_plain`` directly.
"""
from __future__ import annotations

import sys
from pathlib import Path

_CI_DIR = Path(__file__).resolve().parents[1]
if str(_CI_DIR) not in sys.path:
    sys.path.insert(0, str(_CI_DIR))
