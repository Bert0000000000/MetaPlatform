"""Test constants exposed by mate_common.constants."""
from __future__ import annotations

from mate_common.constants import (
    DEFAULT_AUTH_PORT,
    DEFAULT_HTTP_PORT,
    HEADER_REQUEST_ID,
    HEADER_TENANT_ID,
    HEADER_TRACE_ID,
    HEADER_USER_ID,
    Environment,
)


class TestEnvironment:
    def test_dev_value(self) -> None:
        assert Environment.DEV == "dev"

    def test_test_value(self) -> None:
        assert Environment.TEST == "test"

    def test_staging_value(self) -> None:
        assert Environment.STAGING == "staging"

    def test_prod_value(self) -> None:
        assert Environment.PROD == "prod"

    def test_inherits_from_str(self) -> None:
        # StrEnum: Environment.X is a str subclass
        assert isinstance(Environment.DEV, str)

    def test_full_set(self) -> None:
        assert {e.value for e in Environment} == {"dev", "test", "staging", "prod"}


class TestHeaders:
    def test_tenant_id(self) -> None:
        assert HEADER_TENANT_ID == "X-Tenant-Id"

    def test_user_id(self) -> None:
        assert HEADER_USER_ID == "X-User-Id"

    def test_trace_id(self) -> None:
        assert HEADER_TRACE_ID == "X-Trace-Id"

    def test_request_id(self) -> None:
        assert HEADER_REQUEST_ID == "X-Request-Id"


class TestPorts:
    def test_default_http(self) -> None:
        assert DEFAULT_HTTP_PORT == 8080
        assert isinstance(DEFAULT_HTTP_PORT, int)

    def test_default_auth(self) -> None:
        assert DEFAULT_AUTH_PORT == 8000
        assert isinstance(DEFAULT_AUTH_PORT, int)
