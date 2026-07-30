"""Event schema registry contract.

This module does not talk to Confluent Schema Registry directly; the
`SchemaRegistry` Protocol below is the contract that a production
deployment fills in with a Confluent client. Tests use an in-memory
fake that records every registration.

Schema lookup pattern: `schema_for(event_type)` returns the registered
schema for an event type; the producer refuses to publish if no
schema is registered.
"""
from __future__ import annotations

import re
from typing import Any, Protocol


_TYPE_PATTERN = re.compile(r"^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]+$")


class SchemaError(Exception):
    """Raised when a schema cannot be found or is invalid."""


def validate_event_type(event_type: str) -> str:
    if not _TYPE_PATTERN.match(event_type):
        raise SchemaError(
            f"invalid event type {event_type!r}; expected <domain>.<aggregate>.<action>"
        )
    return event_type


def schema_id_for(event_type: str, version: int = 1) -> str:
    """Return the schema-registry id for an event type + version.

    Format: metaplatform.<type>.v<version>
    """
    validate_event_type(event_type)
    if version < 1:
        raise SchemaError(f"schema version must be >= 1, got {version}")
    return f"metaplatform.{event_type}.v{version}"


class SchemaRegistry(Protocol):
    """Protocol that a Confluent or in-memory schema-registry client implements."""

    def register(self, event_type: str, schema: dict[str, Any]) -> str:
        """Register a JSON schema for an event type, return its id."""
        ...

    def fetch(self, schema_id: str) -> dict[str, Any]:
        """Fetch a schema by id, raise SchemaError if missing."""
        ...


class InMemorySchemaRegistry:
    """Tiny in-memory implementation for unit tests."""

    def __init__(self) -> None:
        self._by_id: dict[str, dict[str, Any]] = {}
        self._by_type: dict[str, str] = {}

    def register(self, event_type: str, schema: dict[str, Any]) -> str:
        sid = schema_id_for(event_type)
        self._by_id[sid] = dict(schema)
        self._by_type[event_type] = sid
        return sid

    def fetch(self, schema_id: str) -> dict[str, Any]:
        if schema_id not in self._by_id:
            raise SchemaError(f"schema {schema_id!r} not found")
        return dict(self._by_id[schema_id])

    def registered_for(self, event_type: str) -> str | None:
        return self._by_type.get(event_type)