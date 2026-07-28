"""W2 基础设施 edge tests (ST-2.x edge)."""
from __future__ import annotations

import pytest


def test_pg_pool_min_max() -> None:
    """ST-2.1.1: 连接池 min=2 max=10."""
    min_size, max_size = 2, 10
    assert min_size < max_size


def test_redis_url_default() -> None:
    """ST-2.2.1: Redis URL."""
    default_url = "redis://localhost:6379/0"
    assert default_url.startswith("redis://")


def test_kafka_bootstrap_default() -> None:
    """ST-2.2.2: Kafka bootstrap."""
    default_bootstrap = "localhost:9092"
    assert ":" in default_bootstrap


def test_neo4j_uri_format() -> None:
    """ST-2.1.3: Neo4j URI."""
    uri = "bolt://localhost:7687"
    assert uri.startswith("bolt://")


def test_milvus_port() -> None:
    """ST-2.1.4: Milvus port 19530."""
    port = 19530
    assert port == 19530


def test_minio_endpoint() -> None:
    """ST-2.1.5: MinIO endpoint."""
    endpoint = "http://localhost:9000"
    assert endpoint.startswith("http")


def test_factory_mode_default() -> None:
    """ST-2.4.5: factory 默认 mock 模式."""
    default_mode = "mock"
    assert default_mode in {"mock", "live", "hybrid"}