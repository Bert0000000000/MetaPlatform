"""Kafka topic naming convention with tenant binding.

Topics follow the layout: `metaplatform.<domain>.<tenant-id>.<event>`.
The producer always derives the topic from the current RequestContext;
the consumer verifies the message's tenant id matches the session
tenant (unless the consumer is in cross-tenant admin mode).

This module is the *naming* layer; the actual Kafka client (which
the platform will use via the Outbox pattern in PLATFORM-EVENT-01)
is separate.
"""
from __future__ import annotations

import re

from mate_platform.tenancy.context import RequestContext
from mate_platform.tenancy.guards import is_cross_tenant_admin, require_tenant


_DOMAIN_PATTERN = re.compile(r"^[a-z][a-z0-9_]{0,31}$")
_EVENT_PATTERN = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
_TENANT_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,62}$")


class KafkaTopicError(Exception):
    """Raised when a topic name is invalid or crosses tenant boundaries."""


def _validate_part(value: str, pattern: re.Pattern[str], label: str) -> str:
    if not pattern.match(value):
        raise KafkaTopicError(
            f"invalid {label} {value!r}; must match {pattern.pattern}"
        )
    return value


def topic_name(ctx: RequestContext, *, domain: str, event: str) -> str:
    """Return the tenant-scoped topic for the given context.

    Format: metaplatform.<domain>.<tenant-id>.<event>

    For cross-tenant admin sessions the topic is the same shape but
    the consumer is allowed to read across tenants (the producer
    still publishes to one tenant at a time).
    """
    tenant_id = require_tenant(ctx)
    _validate_part(domain, _DOMAIN_PATTERN, "domain")
    _validate_part(event, _EVENT_PATTERN, "event")
    _validate_part(tenant_id, _TENANT_ID_PATTERN, "tenant_id")
    return f"metaplatform.{domain}.{tenant_id}.{event}"


def consumer_group(ctx: RequestContext, *, service: str) -> str:
    """Return the consumer group for a service in the current tenant.

    Format: <service>.t-<tenant-id>
    """
    tenant_id = require_tenant(ctx)
    _validate_part(service, _DOMAIN_PATTERN, "service")
    _validate_part(tenant_id, _TENANT_ID_PATTERN, "tenant_id")
    return f"{service}.t-{tenant_id}"


def assert_message_tenant(*, expected_tenant: str, ctx: RequestContext) -> None:
    """Consumer-side check: the message's tenant must match the session.

    Use this at the entry point of any Kafka consumer to refuse
    cross-tenant messages unless the session is in cross-tenant
    admin mode.
    """
    if is_cross_tenant_admin(ctx):
        return
    actual = require_tenant(ctx)
    if expected_tenant != actual:
        raise KafkaTopicError(
            f"message tenant {expected_tenant!r} does not match session "
            f"tenant {actual!r}"
        )