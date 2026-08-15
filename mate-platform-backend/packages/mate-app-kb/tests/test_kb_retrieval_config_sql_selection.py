"""KB_STORE=sql selection-layer tests for the retrieval-config persistence.

The ``KB_STORE`` branch in ``repositories/__init__.py`` is evaluated at
import time, so these tests exercise the selection in SUBPROCESSES —
reloading the package in-process would rebind module state for the rest
of the pytest session and contaminate the (default) memory-mode suites.

Coverage:
  * KB_STORE=sql + MATE_DB_URL=sqlite:// (in-memory DB): the four
    retrieval-config helpers on the package surface come from
    ``sql_store`` (not ``in_memory``) and round-trip against the engine
    resolved from the env DSN.
  * KB_STORE=sql + a sqlite FILE DB: config + snapshots written by one
    process are still there for a FRESH process (restart persistence —
    the CI-safe stand-in for the real-PG smoke).
  * Default (no KB_STORE): the selection layer keeps binding the
    in-memory implementations — memory-mode behaviour unchanged.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

# packages/ root: packages/mate-app-kb/tests/<this file> → parents[2]
_PKGS = Path(__file__).resolve().parents[2]
# Subprocess import path — the sql branch needs mate-app-kb + mate-tech-db
# only (in_memory dataclasses are stdlib; sql_store → mate_tech_db.base →
# sqlalchemy). Everything else stays out so the subprocess is minimal.
_SUBPROCESS_PATH_SUBS = ("mate-app-kb", "mate-tech-db")

_TENANT = "tenant-acme"

# ---------------------------------------------------------------------------
# Subprocess driver
# ---------------------------------------------------------------------------
def _run_py(script: str, db_url: str | None = None, kb_store: str | None = None):
    env = os.environ.copy()
    # Never inherit storage env from the test runner — each case pins its own.
    for var in ("KB_STORE", "MATE_DB_URL", "DATABASE_URL"):
        env.pop(var, None)
    src_paths = os.pathsep.join(str(_PKGS / sub / "src") for sub in _SUBPROCESS_PATH_SUBS)
    inherited = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = src_paths + (os.pathsep + inherited if inherited else "")
    if kb_store is not None:
        env["KB_STORE"] = kb_store
    if db_url is not None:
        env["MATE_DB_URL"] = db_url
    return subprocess.run(  # noqa: S603 — argv is fully static (venv python + authored script)
        [sys.executable, "-c", script],
        capture_output=True, text=True, env=env, timeout=180, check=False,
    )


def _assert_ok(proc: subprocess.CompletedProcess, marker: str) -> None:
    assert proc.returncode == 0, (
        f"subprocess failed (rc={proc.returncode})\n"
        f"--- stdout ---\n{proc.stdout}\n--- stderr ---\n{proc.stderr}"
    )
    assert marker in proc.stdout, f"marker {marker!r} missing:\n{proc.stdout}\n{proc.stderr}"


# ---------------------------------------------------------------------------
# Subprocess scripts
# ---------------------------------------------------------------------------
# Phase A: verify the sql-branch bindings + a full round-trip against the
# env-resolved engine (create_all mirrors what create_app does under
# KB_STORE=sql).
_PHASE_A = f"""
from mate_tech_db.base import create_all
import mate_app_kb.repositories.sql_models  # noqa: F401 — registers ORM on Base
create_all()
import mate_app_kb.repositories as repos
from mate_app_kb.repositories.in_memory import (
    KbRetrievalConfig, KbRetrievalConfigSnapshot,
)

# 1. The selection layer binds the SQL implementations.
for fn in (
    repos.get_retrieval_config, repos.put_retrieval_config,
    repos.put_retrieval_config_snapshot, repos.list_retrieval_config_snapshots,
):
    assert fn.__module__ == "mate_app_kb.repositories.sql_store", fn.__module__

# 2. Defaults on first access — in_memory parity (version=1, updated_at="").
cfg = repos.get_retrieval_config("{_TENANT}")
assert cfg == KbRetrievalConfig(tenant_id="{_TENANT}"), cfg
assert cfg.version == 1 and cfg.updated_at == "", cfg

# 3. put -> get round-trip over every field.
saved = KbRetrievalConfig(
    tenant_id="{_TENANT}", mode="FACTUAL", rerank_strategy="keyword", top_k=5,
    similarity_threshold=0.25, chunk_strategy="semantic", chunk_size=256,
    chunk_overlap=32, vector_weight=0.6, keyword_weight=0.4,
    reranker_enabled=False, show_citations=False, version=2,
    updated_at="2026-08-16T00:00:00Z",
)
repos.put_retrieval_config("{_TENANT}", saved)
assert repos.get_retrieval_config("{_TENANT}") == saved, "round-trip mismatch"

# 4. Snapshots: append order + newest-last listing.
repos.put_retrieval_config_snapshot(
    "{_TENANT}",
    KbRetrievalConfigSnapshot(id="{_TENANT}:1", tenant_id="{_TENANT}", version=1,
                              snapshot_at="t1"),
)
repos.put_retrieval_config_snapshot(
    "{_TENANT}",
    KbRetrievalConfigSnapshot(id="{_TENANT}:2", tenant_id="{_TENANT}", version=2,
                              rerank_strategy="keyword", snapshot_at="t2"),
)
snaps = repos.list_retrieval_config_snapshots("{_TENANT}")
assert [s.version for s in snaps] == [1, 2], snaps

print("PHASE_A_OK")
"""

# Phase B: a FRESH process reading the same database (no create_all — the
# tables must already exist; the config must be exactly what phase A saved).
_PHASE_B = f"""
import mate_app_kb.repositories as repos

cfg = repos.get_retrieval_config("{_TENANT}")
assert cfg.mode == "FACTUAL", cfg
assert cfg.rerank_strategy == "keyword", cfg
assert cfg.top_k == 5 and cfg.similarity_threshold == 0.25, cfg
assert cfg.chunk_strategy == "semantic" and cfg.chunk_size == 256, cfg
assert cfg.chunk_overlap == 32, cfg
assert cfg.vector_weight == 0.6 and cfg.keyword_weight == 0.4, cfg
assert cfg.reranker_enabled is False and cfg.show_citations is False, cfg
assert cfg.version == 2 and cfg.updated_at == "2026-08-16T00:00:00Z", cfg

snaps = repos.list_retrieval_config_snapshots("{_TENANT}")
assert [s.version for s in snaps] == [1, 2], snaps
assert snaps[1].rerank_strategy == "keyword", snaps

print("PHASE_B_OK")
"""

# Control: with no KB_STORE the selection layer keeps the in-memory
# implementations (default test-path behaviour unchanged).
_MEMORY_CONTROL = """
import mate_app_kb.repositories as repos
for fn in (
    repos.get_retrieval_config, repos.put_retrieval_config,
    repos.put_retrieval_config_snapshot, repos.list_retrieval_config_snapshots,
):
    assert fn.__module__ == "mate_app_kb.repositories.in_memory", fn.__module__
print("MEMORY_OK")
"""


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
def test_sql_selection_and_roundtrip_with_inmemory_sqlite() -> None:
    """KB_STORE=sql + MATE_DB_URL=sqlite:// — selection layer routes the
    four retrieval-config helpers to sql_store; round-trip via the
    env-resolved engine."""
    proc = _run_py(_PHASE_A, db_url="sqlite://", kb_store="sql")
    _assert_ok(proc, "PHASE_A_OK")


def test_sql_config_survives_process_restart(tmp_path: Path) -> None:
    """KB_STORE=sql + sqlite FILE db — a fresh process (restart) still
    reads the config + snapshots written by the previous one."""
    db_url = f"sqlite:///{(tmp_path / 'kb_restart.db').as_posix()}"
    _assert_ok(_run_py(_PHASE_A, db_url=db_url, kb_store="sql"), "PHASE_A_OK")
    _assert_ok(_run_py(_PHASE_B, db_url=db_url, kb_store="sql"), "PHASE_B_OK")


def test_default_selection_stays_in_memory() -> None:
    """No KB_STORE → the package surface keeps the in-memory helpers."""
    _assert_ok(_run_py(_MEMORY_CONTROL), "MEMORY_OK")
