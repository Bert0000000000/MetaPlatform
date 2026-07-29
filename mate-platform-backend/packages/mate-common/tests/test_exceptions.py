"""Test exception hierarchy and ErrorCode enum."""
from __future__ import annotations

import pytest

from mate_common.exceptions import (
    AuthError,
    ConflictError,
    DomainError,
    ErrorCode,
    InfraError,
    NotFoundError,
    ValidationError,
)


class TestErrorCode:
    def test_validation_failed(self) -> None:
        assert ErrorCode.VALIDATION_FAILED == "E400_VALIDATION"

    def test_not_found(self) -> None:
        assert ErrorCode.NOT_FOUND == "E404_NOT_FOUND"

    def test_conflict(self) -> None:
        assert ErrorCode.CONFLICT == "E409_CONFLICT"

    def test_unauthorized(self) -> None:
        assert ErrorCode.UNAUTHORIZED == "E401_UNAUTHORIZED"

    def test_forbidden(self) -> None:
        assert ErrorCode.FORBIDDEN == "E403_FORBIDDEN"

    def test_business_rule_violation(self) -> None:
        assert ErrorCode.BUSINESS_RULE_VIOLATION == "E422_BUSINESS"

    def test_infra_timeout(self) -> None:
        assert ErrorCode.INFRA_TIMEOUT == "E502_TIMEOUT"

    def test_infra_unavailable(self) -> None:
        assert ErrorCode.INFRA_UNAVAILABLE == "E503_UNAVAILABLE"

    def test_infra_bad_response(self) -> None:
        assert ErrorCode.INFRA_BAD_RESPONSE == "E502_BAD_RESPONSE"

    def test_database_error(self) -> None:
        assert ErrorCode.DATABASE_ERROR == "E500_DATABASE"

    def test_external_service_error(self) -> None:
        assert ErrorCode.EXTERNAL_SERVICE_ERROR == "E502_EXTERNAL"


class TestDomainErrorBase:
    def test_default_message(self) -> None:
        e = DomainError()
        assert e.message == "Domain rule violation"

    def test_custom_message(self) -> None:
        e = DomainError("custom failure")
        assert e.message == "custom failure"
        assert str(e) == "custom failure"

    def test_default_code(self) -> None:
        e = DomainError()
        assert e.code == ErrorCode.BUSINESS_RULE_VIOLATION

    def test_default_http_status(self) -> None:
        e = DomainError()
        assert e.http_status == 422

    def test_details_default_empty(self) -> None:
        e = DomainError()
        assert e.details == {}

    def test_details_supplied(self) -> None:
        e = DomainError("x", details={"k": "v", "n": 1})
        assert e.details == {"k": "v", "n": 1}

    def test_to_dict_minimal(self) -> None:
        e = DomainError("test")
        assert e.to_dict() == {
            "code": "E422_BUSINESS",
            "message": "test",
            "details": {},
        }

    def test_to_dict_with_details(self) -> None:
        e = DomainError("test", details={"a": 1})
        d = e.to_dict()
        assert d["code"] == "E422_BUSINESS"
        assert d["message"] == "test"
        assert d["details"] == {"a": 1}
        assert "service" not in d

    def test_subclass_override_code(self) -> None:
        e = NotFoundError()
        assert e.code == ErrorCode.NOT_FOUND

    def test_subclass_override_http_status(self) -> None:
        e = NotFoundError()
        assert e.http_status == 404

    def test_subclass_override_message(self) -> None:
        e = NotFoundError()
        assert e.message == "Resource not found"

    def test_subclass_custom_message(self) -> None:
        e = NotFoundError("custom not found")
        assert e.message == "custom not found"

    def test_inherits_from_exception(self) -> None:
        e = DomainError()
        assert isinstance(e, Exception)


class TestNotFoundError:
    def test_attributes(self) -> None:
        e = NotFoundError()
        assert e.code == ErrorCode.NOT_FOUND
        assert e.http_status == 404
        assert e.message == "Resource not found"

    def test_to_dict(self) -> None:
        e = NotFoundError("missing user")
        d = e.to_dict()
        assert d["code"] == "E404_NOT_FOUND"
        assert d["message"] == "missing user"
        assert d["details"] == {}

    def test_can_be_raised_caught(self) -> None:
        with pytest.raises(NotFoundError) as exc_info:
            raise NotFoundError("x")
        assert exc_info.value.code == ErrorCode.NOT_FOUND


class TestConflictError:
    def test_attributes(self) -> None:
        e = ConflictError()
        assert e.code == ErrorCode.CONFLICT
        assert e.http_status == 409
        assert e.message == "Resource conflict"

    def test_to_dict_includes_conflict_code(self) -> None:
        e = ConflictError("already exists")
        assert e.to_dict()["code"] == "E409_CONFLICT"


class TestValidationError:
    def test_attributes(self) -> None:
        e = ValidationError()
        assert e.code == ErrorCode.VALIDATION_FAILED
        assert e.http_status == 400
        assert e.message == "Validation failed"

    def test_with_field_details(self) -> None:
        e = ValidationError("invalid input", details={"fields": ["name"]})
        assert e.to_dict()["code"] == "E400_VALIDATION"
        assert e.details == {"fields": ["name"]}


class TestAuthError:
    def test_attributes(self) -> None:
        e = AuthError()
        assert e.code == ErrorCode.UNAUTHORIZED
        assert e.http_status == 401
        assert e.message == "Authentication failed"

    def test_with_details(self) -> None:
        e = AuthError("token expired", details={"hint": "refresh"})
        assert e.to_dict()["code"] == "E401_UNAUTHORIZED"
        assert e.to_dict()["details"] == {"hint": "refresh"}


class TestInfraError:
    def test_default_attributes(self) -> None:
        e = InfraError()
        assert e.code == ErrorCode.INFRA_UNAVAILABLE
        assert e.http_status == 503
        assert e.message == "Infrastructure unavailable"
        assert e.service is None
        assert e.original is None
        assert e.details == {}

    def test_with_service(self) -> None:
        e = InfraError("down", service="pg-cluster")
        assert e.service == "pg-cluster"

    def test_with_original_exception(self) -> None:
        original = ConnectionError("connection refused")
        e = InfraError("upstream fail", original=original)
        assert e.original is original

    def test_to_dict_includes_service_when_set(self) -> None:
        e = InfraError("down", service="mcp")
        d = e.to_dict()
        assert d["code"] == "E503_UNAVAILABLE"
        assert d["message"] == "down"
        assert d["service"] == "mcp"
        assert "original" not in d

    def test_to_dict_omits_service_when_none(self) -> None:
        e = InfraError()
        d = e.to_dict()
        assert "service" not in d


class TestExceptionHierarchy:
    def test_not_found_is_domain(self) -> None:
        assert issubclass(NotFoundError, DomainError)

    def test_conflict_is_domain(self) -> None:
        assert issubclass(ConflictError, DomainError)

    def test_validation_is_domain(self) -> None:
        assert issubclass(ValidationError, DomainError)

    def test_auth_is_domain(self) -> None:
        assert issubclass(AuthError, DomainError)

    def test_infra_is_not_domain(self) -> None:
        # InfraError extends Exception directly (separate hierarchy)
        assert not issubclass(InfraError, DomainError)

    def test_infra_is_exception(self) -> None:
        assert issubclass(InfraError, Exception)
