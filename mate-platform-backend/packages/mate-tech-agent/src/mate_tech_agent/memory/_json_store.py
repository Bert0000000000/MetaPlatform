"""JSON file state persistence (fallback when PG unavailable)."""
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


def _path_for(thread_id: str) -> Path:
    safe = thread_id.replace("/", "_").replace("..", "_")
    return _STORAGE_DIR / f"{safe}.json"


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


def save_state(thread_id: str, state: dict[str, Any]) -> None:
    """Save state: prefer PGSaver if available, else JSON file."""
    pg = _pg_saver()
    if pg is not None:
        scenario = state.get("_scenario", "S1")
        if pg.save(thread_id, state, scenario=scenario):
            return
    p = _path_for(thread_id)
    payload = {"_saved_at": time.time(), "state": state}
    with _lock:
        p.write_text(json.dumps(payload, default=str, ensure_ascii=False), encoding="utf-8")


def load_state(thread_id: str) -> dict[str, Any] | None:
    """Load state: try PGSaver first, fallback to JSON."""
    pg = _pg_saver()
    if pg is not None:
        state = pg.load(thread_id)
        if state is not None:
            return {"state": state, "_source": "pg"}
    p = _path_for(thread_id)
    if not p.exists():
        return None
    with _lock:
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception as exc:
            _log.warning("load_state failed for %s: %s", thread_id, exc)
            return None


def delete_state(thread_id: str) -> bool:
    """Delete from both PG and JSON file."""
    pg = _pg_saver()
    pg_ok = pg is not None and pg.delete(thread_id)
    p = _path_for(thread_id)
    json_ok = False
    if p.exists():
        with _lock:
            p.unlink()
        json_ok = True
    return pg_ok or json_ok


def get_pg_saver():
    """Backward compat."""
    return _pg_saver()