"""Test that __init__.py re-exports the documented public surface."""
from __future__ import annotations

import mate_common


class TestPackageMetadata:
    def test_version_is_string(self) -> None:
        assert isinstance(mate_common.__version__, str)
        assert mate_common.__version__  # non-empty

    def test_all_exports_are_valid_python_identifiers(self) -> None:
        for name in mate_common.__all__:
            assert name.isidentifier(), f"{name!r} is not an identifier"


class TestReExports:
    """mate_common/__init__.py is the canonical public surface.

    These tests guard the documented __all__ list: every name in
    __all__ must be accessible as `mate_common.<name>`.

    Rather than re-importing under each name (which would trip
    linters complaining the imports are unused), we use
    getattr() to verify the package attribute exists. This still
    exercises the import system because importing this test
    module triggers mate_common/__init__.py to run.
    """

    def test_dto_classes_exported(self) -> None:
        # Direct import to catch ImportError if re-exports are missing.
        from mate_common import BaseDTO, TenantMixin, TimestampMixin

        assert hasattr(mate_common, "BaseDTO")
        assert hasattr(mate_common, "TenantMixin")
        assert hasattr(mate_common, "TimestampMixin")
        # Reference the symbols so ruff/pyright keep them.
        _ = BaseDTO, TenantMixin, TimestampMixin

    def test_exceptions_exported(self) -> None:
        from mate_common import (
            AuthError,
            ConflictError,
            DomainError,
            ErrorCode,
            InfraError,
            NotFoundError,
            ValidationError,
        )

        assert hasattr(mate_common, "AuthError")
        assert hasattr(mate_common, "ConflictError")
        assert hasattr(mate_common, "DomainError")
        assert hasattr(mate_common, "ErrorCode")
        assert hasattr(mate_common, "InfraError")
        assert hasattr(mate_common, "NotFoundError")
        assert hasattr(mate_common, "ValidationError")
        _ = (
            AuthError,
            ConflictError,
            DomainError,
            ErrorCode,
            InfraError,
            NotFoundError,
            ValidationError,
        )

    def test_all_matches_actual_reexports(self) -> None:
        # Sanity: every name listed in __all__ must be an attribute of the package
        for name in mate_common.__all__:
            assert hasattr(mate_common, name), (
                f"__all__ lists {name!r} but it's missing from the package"
            )

    def test_all_is_alphabetical(self) -> None:
        # Reviewer-friendly: keep __all__ sorted so rebase diffs are minimal
        assert mate_common.__all__ == sorted(mate_common.__all__), (
            f"__all__ is not sorted: {mate_common.__all__!r}"
        )
