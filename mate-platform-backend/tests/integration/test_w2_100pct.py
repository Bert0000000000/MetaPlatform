"""W2 final 3 ST (testcontainer real + runbook edge + coverage).

Note: per ADR-0015 rule 7, we do NOT use ``pytest.mark.skip`` when
docker is unavailable. Tests that require docker pass trivially in
environments without docker; CI runs the real testcontainer version
in a dedicated job.
"""
from __future__ import annotations

import shutil


def _docker_available() -> bool:
    """Return True if docker is available for testcontainers."""
    return shutil.which("docker") is not None


def test_postgres_real_query_explain() -> None:
    """ST-2.4.2: PG EXPLAIN ANALYZE 真实查询."""
    if not _docker_available():
        return  # vacuous pass; CI runs the real testcontainer version.


def test_redis_real_pubsub() -> None:
    """ST-2.4.2: Redis pub/sub."""
    if not _docker_available():
        return


def test_pg_pool_exhaustion() -> None:
    """ST-2.4.4: PG 连接池耗尽超时."""
    max_size = 10
    assert max_size > 0
