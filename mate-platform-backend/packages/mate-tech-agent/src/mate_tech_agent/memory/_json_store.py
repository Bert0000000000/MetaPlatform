"""JSON file state persistence (fallback when PG unavailable).

Tenant-scoped (BUSINESS-SLICES): every state record is keyed by
``(tenant_id, thread_id)`` so that tenant A cannot read tenant B's
thread state even if it knows the thread id. This closes the
cross-tenant data-leak vector flagged in the ADR-0014 5-step audit.

The PG saver is left untouched (another subagent owns SQL); tenant
isolation on the PG path is achieved with a composite key
``<tenant>:<thread>`` passed as the ``thread_id`` column value.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any

_log = logging.getLogger(__name__)

_STORAGE_DIR = Path(os.environ.get("AGENT_STATE_DIR", "/tmp/mate_agent_state"))
_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
_lock = threading.Lock()


def _safe_part(value: str) -> str:
    """Sanitize a path / key component (tenant_id or thread_id)."""
    return value.replace("/", "_").replace("..", "_").replace(":", "_").strip()


def _path_for(tenant_id: str, thread_id: str) -> Path:
    """Return the JSON file path scoped by tenant + thread."""
    tenant = _safe_part(tenant_id) or "_global"
    thread = _safe_part(thread_id)
    return _STORAGE_DIR / tenant / f"{thread}.json"


def _composite_key(tenant_id: str, thread_id: str) -> str:
    """Composite PG key: ``<tenant>:<thread>`` (no schema change needed)."""
    return f"{_safe_part(tenant_id)}:{_safe_part(thread_id)}"


def _pg_saver():
    """Lazy-init PGSaver (returns None if PG unavailable)."""
    try:
        from mate_tech_agent.memory.pg_saver import PGSaver
        global _pg_instance
        if "_pg_instance" not in globals():
            _pg_instance = PGSaver()
        return _pg_instance if _pg_instance.is_available() else None
    except Exception:
        return None


def save_state(tenant_id: str, thread_id: str, state: dict[str, Any]) -> None:
    """Save state: prefer PGSaver if available, else tenant-scoped JSON file."""
    pg = _pg_saver()
    if pg is not None:
        scenario = state.get("_scenario", "S1")
        if pg.save(_composite_key(tenant_id, thread_id), state, scenario=scenario):
            return
    p = _path_for(tenant_id, thread_id)
    p.parent.mkdir(parents=True, exist_ok=True)
    payload = {"_saved_at": time.time(), "state": state}
    with _lock:
        p.write_text(json.dumps(payload, default=str, ensure_ascii=False), encoding="utf-8")


def load_state(tenant_id: str, thread_id: str) -> dict[str, Any] | None:
    """Load state: try PGSaver first, fallback to tenant-scoped JSON."""
    pg = _pg_saver()
    if pg is not None:
        state = pg.load(_composite_key(tenant_id, thread_id))
        if state is not None:
            return {"state": state, "_source": "pg"}
    p = _path_for(tenant_id, thread_id)
    if not p.exists():
        return None
    with _lock:
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception as exc:
            _log.warning("load_state failed for %s/%s: %s", tenant_id, thread_id, exc)
            return None


def delete_state(tenant_id: str, thread_id: str) -> bool:
    """Delete from both PG and tenant-scoped JSON file."""
    pg = _pg_saver()
    key = _composite_key(tenant_id, thread_id)
    pg_ok = pg is not None and pg.delete(key)
    p = _path_for(tenant_id, thread_id)
    json_ok = False
    if p.exists():
        with _lock:
            p.unlink()
        json_ok = True
    return pg_ok or json_ok


def get_pg_saver():
    """Backward compat."""
    return _pg_saver()
