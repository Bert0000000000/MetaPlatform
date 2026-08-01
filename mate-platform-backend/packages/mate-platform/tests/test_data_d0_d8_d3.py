"""DATA-D0-D8 D3 e2e tests — GE checkpoint execution + Airflow gate.

Verifies the Python-side quality-gate lifecycle:
  - checkpoint runs and returns a status (passed/failed/skipped)
  - suites must be registered before running
  - tenant isolation (SEC-TENANT-01 hard rule 3)
  - blocking vs non-blocking check semantics (Airflow gate)
  - run_id uniqueness per run
  - results carry tenant_id
  - domain filtering on suite listing
  - checkpoint history per suite
  - invalid suite rejection
"""
from __future__ import annotations

import pytest

from mate_platform.quality import (
    Check,
    Checkpoint,
    ExpectationSuite,
    ExpectationSuiteNotFoundError,
    InMemoryQualityClient,
    QualityError,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def client() -> InMemoryQualityClient:
    return InMemoryQualityClient()


def _suite(
    tenant_id: str = "tenant-acme",
    name: str = "iam.user.tenant_notnull",
    domain: str = "iam",
    *,
    blocking_failure: bool = False,
    non_blocking_failure: bool = False,
    no_checks: bool = False,
) -> ExpectationSuite:
    """Build a suite with configurable check outcomes."""
    if no_checks:
        checks: tuple[Check, ...] = ()
    else:
        checks = (
            Check(
                name="tenant_id_not_null",
                blocking=True,
                passes=not blocking_failure,
            ),
            Check(
                name="row_count_positive",
                blocking=False,
                passes=not non_blocking_failure,
            ),
        )
    return ExpectationSuite(
        name=name,
        tenant_id=tenant_id,
        domain=domain,
        datasets=("iam.user",),
        checks=checks,
    )


# ---------------------------------------------------------------------------
# 1. checkpoint runs and returns status
# ---------------------------------------------------------------------------
class TestCheckpointRuns:
    def test_checkpoint_runs_and_returns_status(
        self, client: InMemoryQualityClient
    ) -> None:
        suite = _suite()
        client.register_suite(suite)
        cp = client.run_checkpoint("tenant-acme", "iam.user.tenant_notnull")
        assert isinstance(cp, Checkpoint)
        assert cp.status == "passed"
        assert cp.suite_name == "iam.user.tenant_notnull"


# ---------------------------------------------------------------------------
# 2. suite must be registered before running
# ---------------------------------------------------------------------------
class TestSuiteRegistration:
    def test_suite_registered_before_run(
        self, client: InMemoryQualityClient
    ) -> None:
        # Running an unregistered suite must fail.
        with pytest.raises(ExpectationSuiteNotFoundError):
            client.run_checkpoint("tenant-acme", "never.registered")

        # After registration the run succeeds.
        suite = _suite()
        client.register_suite(suite)
        cp = client.run_checkpoint("tenant-acme", "iam.user.tenant_notnull")
        assert cp.status in {"passed", "failed", "skipped"}


# ---------------------------------------------------------------------------
# 3. tenant isolation
# ---------------------------------------------------------------------------
class TestTenantIsolation:
    def test_tenant_isolation(
        self, client: InMemoryQualityClient
    ) -> None:
        suite = _suite(tenant_id="tenant-acme")
        client.register_suite(suite)

        # Tenant-acme can see and run its suite.
        assert (
            client.get_suite("tenant-acme", "iam.user.tenant_notnull").name
            == "iam.user.tenant_notnull"
        )

        # Tenant-globex cannot see acme's suite.
        with pytest.raises(ExpectationSuiteNotFoundError):
            client.get_suite("tenant-globex", "iam.user.tenant_notnull")
        with pytest.raises(ExpectationSuiteNotFoundError):
            client.run_checkpoint("tenant-globex", "iam.user.tenant_notnull")

        # And globex listing excludes acme's suite.
        assert client.list_suites("tenant-globex") == []


# ---------------------------------------------------------------------------
# 4 + 5. blocking vs non-blocking semantics
# ---------------------------------------------------------------------------
class TestBlockingSemantics:
    def test_critical_check_blocks_on_failure(
        self, client: InMemoryQualityClient
    ) -> None:
        suite = _suite(blocking_failure=True)
        client.register_suite(suite)
        cp = client.run_checkpoint("tenant-acme", "iam.user.tenant_notnull")
        assert cp.status == "failed"
        # The blocking check should show as failed in results.
        blocking_results = [r for r in cp.results if r.blocking]
        assert any(not r.passed for r in blocking_results)

    def test_non_blocking_check_passes_on_failure(
        self, client: InMemoryQualityClient
    ) -> None:
        suite = _suite(non_blocking_failure=True)
        client.register_suite(suite)
        cp = client.run_checkpoint("tenant-acme", "iam.user.tenant_notnull")
        # Non-blocking failure does not block → status passed.
        assert cp.status == "passed"
        # But the non-blocking check is recorded as failed.
        nb_results = [r for r in cp.results if not r.blocking]
        assert any(not r.passed for r in nb_results)

    def test_skipped_when_no_checks(
        self, client: InMemoryQualityClient
    ) -> None:
        suite = _suite(no_checks=True)
        client.register_suite(suite)
        cp = client.run_checkpoint("tenant-acme", "iam.user.tenant_notnull")
        assert cp.status == "skipped"
        assert cp.results == ()


# ---------------------------------------------------------------------------
# 6. run_id uniqueness
# ---------------------------------------------------------------------------
class TestRunIdUniqueness:
    def test_run_id_unique_per_run(
        self, client: InMemoryQualityClient
    ) -> None:
        suite = _suite()
        client.register_suite(suite)
        cp1 = client.run_checkpoint("tenant-acme", "iam.user.tenant_notnull")
        cp2 = client.run_checkpoint("tenant-acme", "iam.user.tenant_notnull")
        assert cp1.run_id != cp2.run_id
        assert len(cp1.run_id) > 0


# ---------------------------------------------------------------------------
# 7. results carry tenant_id
# ---------------------------------------------------------------------------
class TestResultsCarryTenantId:
    def test_results_carry_tenant_id(
        self, client: InMemoryQualityClient
    ) -> None:
        suite = _suite(tenant_id="tenant-acme")
        client.register_suite(suite)
        cp = client.run_checkpoint("tenant-acme", "iam.user.tenant_notnull")
        assert cp.tenant_id == "tenant-acme"
        assert cp.suite_name == "iam.user.tenant_notnull"
        # Every checkpoint is tagged with the suite's tenant.
        assert cp.tenant_id == suite.tenant_id


# ---------------------------------------------------------------------------
# 8. list suites filtered by domain
# ---------------------------------------------------------------------------
class TestListSuitesByDomain:
    def test_list_suites_filtered_by_domain(
        self, client: InMemoryQualityClient
    ) -> None:
        client.register_suite(_suite(name="s.iam.a", domain="iam"))
        client.register_suite(_suite(name="s.msg.b", domain="msg"))
        client.register_suite(_suite(name="s.iam.c", domain="iam"))

        all_suites = client.list_suites("tenant-acme")
        assert len(all_suites) == 3

        iam_only = client.list_suites("tenant-acme", domain="iam")
        assert len(iam_only) == 2
        assert {s.name for s in iam_only} == {"s.iam.a", "s.iam.c"}


# ---------------------------------------------------------------------------
# 9. checkpoint history per suite
# ---------------------------------------------------------------------------
class TestCheckpointHistory:
    def test_checkpoint_history_per_suite(
        self, client: InMemoryQualityClient
    ) -> None:
        suite = _suite()
        client.register_suite(suite)
        for _ in range(3):
            client.run_checkpoint("tenant-acme", "iam.user.tenant_notnull")

        history = client.checkpoint_history(
            "tenant-acme", "iam.user.tenant_notnull"
        )
        assert len(history) == 3
        # History is ordered oldest-first.
        assert history[0].created_at <= history[-1].created_at
        # All entries reference the same suite.
        assert all(h.suite_name == "iam.user.tenant_notnull" for h in history)
        # Run IDs are all unique.
        run_ids = {h.run_id for h in history}
        assert len(run_ids) == 3

    def test_history_empty_for_unrun_suite(
        self, client: InMemoryQualityClient
    ) -> None:
        suite = _suite()
        client.register_suite(suite)
        history = client.checkpoint_history(
            "tenant-acme", "iam.user.tenant_notnull"
        )
        assert history == []

    def test_history_isolated_per_tenant(
        self, client: InMemoryQualityClient
    ) -> None:
        client.register_suite(_suite(tenant_id="tenant-acme"))
        client.register_suite(
            _suite(tenant_id="tenant-globex", name="iam.user.tenant_notnull")
        )
        client.run_checkpoint("tenant-acme", "iam.user.tenant_notnull")
        client.run_checkpoint("tenant-globex", "iam.user.tenant_notnull")

        acme_hist = client.checkpoint_history(
            "tenant-acme", "iam.user.tenant_notnull"
        )
        globex_hist = client.checkpoint_history(
            "tenant-globex", "iam.user.tenant_notnull"
        )
        assert len(acme_hist) == 1
        assert len(globex_hist) == 1
        assert acme_hist[0].tenant_id == "tenant-acme"
        assert globex_hist[0].tenant_id == "tenant-globex"


# ---------------------------------------------------------------------------
# 10. invalid suite rejection
# ---------------------------------------------------------------------------
class TestInvalidSuiteRejected:
    def test_invalid_suite_empty_name(
        self, client: InMemoryQualityClient
    ) -> None:
        bad = ExpectationSuite(
            name="",
            tenant_id="tenant-acme",
        )
        with pytest.raises(QualityError):
            client.register_suite(bad)

    def test_invalid_suite_empty_tenant(
        self, client: InMemoryQualityClient
    ) -> None:
        bad = ExpectationSuite(
            name="some.suite",
            tenant_id="",
        )
        with pytest.raises(QualityError):
            client.register_suite(bad)
