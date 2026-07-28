"""Testcontainers-based integration test fixtures (ST-2.4.1)."""
from __future__ import annotations

import pytest
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer
from testcontainers.kafka import KafkaContainer


@pytest.fixture(scope="session")
def pg_container() -> PostgresContainer:
    container = PostgresContainer("postgres:16-alpine")
    container.start()
    yield container
    container.stop()


@pytest.fixture(scope="session")
def redis_container() -> RedisContainer:
    container = RedisContainer("redis:7-alpine")
    container.start()
    yield container
    container.stop()


@pytest.fixture(scope="session")
def kafka_container() -> KafkaContainer:
    container = KafkaContainer("confluentinc/cp-kafka:7.5.0")
    container.start()
    yield container
    container.stop()