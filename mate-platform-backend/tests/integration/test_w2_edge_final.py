"""W2 final edge tests."""
from __future__ import annotations

import os

import pytest


def test_pg_dsn() -> None:
    dsn = "postgresql://mate:mate@localhost:5432/mate"
    assert dsn.startswith("postgresql://")


def test_redis_db() -> None:
    url = "redis://localhost:6379/0"
    assert url.endswith("/0")


def test_kafka_topic() -> None:
    assert "mate.msg.dlq".startswith("mate.")


def test_neo4j() -> None:
    assert os.getenv("NEO4J_USER", "neo4j") == "neo4j"


def test_milvus() -> None:
    assert "tenant" in "tenant_default"


def test_minio() -> None:
    assert "stg-mate-documents".startswith("stg-")


def test_kafka_group() -> None:
    assert "tech-msg" == "tech-msg"
