"""DATA-D3 Great Expectations checkpoint client.

This module provides:
  - ``ExpectationSuite`` dataclass — a tenant-scoped collection of
    expectation checks bound to one or more datasets.
  - ``Checkpoint`` dataclass — the result of running an
    ExpectationSuite once (run_id + status + per-check results).
  - ``QualityClient`` protocol — the quality-gate surface
    (register / get / list suites, run checkpoints, query history).
  - ``InMemoryQualityClient`` — in-process implementation used by
    tests and local dev (no external GE server dependency).

Design rationale:
  - D3 builds on D2 (DataProduct / Dataset) and D1 (lineage). Each
    ExpectationSuite binds to datasets owned by a DataProduct and
    enforces the critical SEC-TENANT-01 checks
    (``tenant_id NOT NULL``, ``tenant_id == RequestContext``) plus
    domain-specific quality checks.
  - Per SEC-TENANT-01 hard rule 3: every ExpectationSuite is scoped
    to a tenant; cross-tenant listing / running is rejected.
  - Blocking vs non-blocking: a checkpoint's overall status is
    ``failed`` only if a *blocking* check fails. Non-blocking
    failures are recorded in results but do not block the pipeline.
    This maps to the Airflow gate (DAG template in
    ``infra/helm/charts/ge/templates/dag-template.py``): blocking
    failures stop the DAG; non-blocking failures emit alerts only.

Per ADR-0016 §3.2 (D3 scope).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------
class QualityError(Exception):
    """Base error for quality client operations."""


class ExpectationSuiteNotFoundError(QualityError):
    """Raised when an ExpectationSuite lookup fails."""


class TenantMismatchError(QualityError):
    """Raised when a cross-tenant expectation-suite access is attempted."""


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class Check:
    """A single expectation within a suite.

    ``passes`` simulates the outcome of evaluating this expectation
    against live data. In production, GE evaluates the expectation
    against the dataset and returns pass/fail; in the in-memory
    client we pre-set the outcome so tests can exercise both paths.

    ``blocking`` controls whether a failure blocks the pipeline
    (D3 Airflow gate). Blocking failures → checkpoint status
    ``failed``; non-blocking failures are recorded but do not block.
    """

    name: str
    blocking: bool = False
    passes: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class CheckResult:
    """The outcome of evaluating one check during a checkpoint run."""

    name: str
    passed: bool
    blocking: bool


@dataclass(frozen=True)
class ExpectationSuite:
    """A tenant-scoped collection of expectation checks.

    Fields mirror the GE checkpoint concept so the same object can
    be rendered to YAML (helm ``checkpoints:`` values) or executed
    by the GE server. Idempotent on (tenant_id, name).

    ``domain`` enables suite listing filtered by business domain
    (iam | msg | obs | rag | kb | agent | copilot | dw | data | ...).
    """

    name: str
    tenant_id: str
    domain: str = ""
    datasets: tuple[str, ...] = field(default_factory=tuple)
    checks: tuple[Check, ...] = field(default_factory=tuple)
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


@dataclass(frozen=True)
class Checkpoint:
    """The result of running an ExpectationSuite once.

    ``status`` is one of ``passed`` / ``failed`` / ``skipped``:
      - ``passed``  — all blocking checks passed (non-blocking may fail).
      - ``failed``  — at least one blocking check failed.
      - ``skipped`` — the suite had no checks to evaluate.

    ``run_id`` is unique per run (uuid4), enabling history queries.
    ``results`` carries per-check outcomes, each tagged with
    ``tenant_id`` via the suite's tenant context.
    """

    suite_name: str
    tenant_id: str
    run_id: str
    status: str  # "passed" | "failed" | "skipped"
    results: tuple[CheckResult, ...] = field(default_factory=tuple)
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


# ---------------------------------------------------------------------------
# Protocol
# ---------------------------------------------------------------------------
class QualityClient(Protocol):
    """Protocol for GE quality-gate operations (D3)."""

    def register_suite(self, suite: ExpectationSuite) -> ExpectationSuite:
        """Register (or replace) an ExpectationSuite for its tenant."""
        ...

    def get_suite(self, tenant_id: str, suite_name: str) -> ExpectationSuite:
        """Look up an ExpectationSuite by name within a tenant."""
        ...

    def list_suites(
        self, tenant_id: str, domain: str | None = None
    ) -> list[ExpectationSuite]:
        """List ExpectationSuites for a tenant, optionally by domain."""
        ...

    def run_checkpoint(
        self, tenant_id: str, suite_name: str
    ) -> Checkpoint:
        """Execute all checks in a suite and return the checkpoint."""
        ...

    def checkpoint_history(
        self, tenant_id: str, suite_name: str
    ) -> list[Checkpoint]:
        """Return the full run history of a suite, oldest first."""
        ...


# ---------------------------------------------------------------------------
# In-memory implementation
# ---------------------------------------------------------------------------
class InMemoryQualityClient:
    """In-process QualityClient implementation.

    Stores ExpectationSuites keyed by (tenant_id, suite_name) and
    checkpoints in a per-suite history list. Enforces tenant
    isolation at every method boundary (SEC-TENANT-01 hard rule 3).

    Thread-safety: not thread-safe; intended for single-process
    tests and local dev. Production uses the GE server REST API.
    """

    def __init__(self) -> None:
        # (tenant_id, suite_name) -> ExpectationSuite
        self._suites: dict[tuple[str, str], ExpectationSuite] = {}
        # (tenant_id, suite_name) -> [Checkpoint, ...]
        self._history: dict[tuple[str, str], list[Checkpoint]] = {}

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _suite_key(tenant_id: str, suite_name: str) -> tuple[str, str]:
        return (tenant_id, suite_name)

    def _validate_suite(self, suite: ExpectationSuite) -> None:
        if not suite.name:
            raise QualityError("ExpectationSuite name must not be empty")
        if not suite.tenant_id:
            raise QualityError("ExpectationSuite tenant_id must not be empty")

    def _require_suite(
        self, tenant_id: str, suite_name: str
    ) -> ExpectationSuite:
        key = self._suite_key(tenant_id, suite_name)
        suite = self._suites.get(key)
        if suite is None:
            raise ExpectationSuiteNotFoundError(
                f"ExpectationSuite {suite_name!r} not found "
                f"for tenant {tenant_id!r}"
            )
        return suite

    # ------------------------------------------------------------------
    # public API
    # ------------------------------------------------------------------
    def register_suite(self, suite: ExpectationSuite) -> ExpectationSuite:
        self._validate_suite(suite)
        key = self._suite_key(suite.tenant_id, suite.name)
        self._suites[key] = suite
        # Ensure a history bucket exists.
        self._history.setdefault(key, [])
        return suite

    def get_suite(self, tenant_id: str, suite_name: str) -> ExpectationSuite:
        return self._require_suite(tenant_id, suite_name)

    def list_suites(
        self, tenant_id: str, domain: str | None = None
    ) -> list[ExpectationSuite]:
        suites = [
            s for s in self._suites.values() if s.tenant_id == tenant_id
        ]
        if domain is not None:
            suites = [s for s in suites if s.domain == domain]
        return sorted(suites, key=lambda s: s.name)

    def run_checkpoint(
        self, tenant_id: str, suite_name: str
    ) -> Checkpoint:
        suite = self._require_suite(tenant_id, suite_name)

        # Evaluate every check against its pre-set outcome.
        results: list[CheckResult] = []
        blocking_failure = False
        for check in suite.checks:
            passed = check.passes
            results.append(
                CheckResult(
                    name=check.name,
                    passed=passed,
                    blocking=check.blocking,
                )
            )
            if check.blocking and not passed:
                blocking_failure = True

        if not suite.checks:
            status = "skipped"
        elif blocking_failure:
            status = "failed"
        else:
            status = "passed"

        checkpoint = Checkpoint(
            suite_name=suite.name,
            tenant_id=suite.tenant_id,
            run_id=str(uuid.uuid4()),
            status=status,
            results=tuple(results),
        )

        key = self._suite_key(tenant_id, suite_name)
        self._history.setdefault(key, []).append(checkpoint)
        return checkpoint

    def checkpoint_history(
        self, tenant_id: str, suite_name: str
    ) -> list[Checkpoint]:
        key = self._suite_key(tenant_id, suite_name)
        return list(self._history.get(key, []))

    # ------------------------------------------------------------------
    # test helpers — DO NOT call from production code
    # ------------------------------------------------------------------
    def reset(self) -> None:
        self._suites.clear()
        self._history.clear()
