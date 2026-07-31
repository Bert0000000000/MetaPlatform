"""Thread-scoped state persistence (TC-5.7.4).

Default: JSON file store in /tmp/mate_agent_state/<thread_id>.json.
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


def _path_for(thread_id: str) -> Path:
    safe = thread_id.replace("/", "_").replace("..", "_")
    return _STORAGE_DIR / f"{safe}.json"


_pg_saver: Any = None


def get_pg_saver() -> Any:
    """Lazy-init PGSaver (returns None if PG unavailable)."""
    global _pg_saver
    if _pg_saver is None:
        from mate_tech_agent.memory.pg_saver import PGSaver
        _pg_saver = PGSaver()
    return _pg_saver


def save_state(thread_id: str, state: dict[str, Any]) -> None:
    """Save state: prefer PGSaver if available, else JSON file."""
    pg = get_pg_saver()
    if pg and pg.is_available():
        scenario = state.get("_scenario", "S1")
        if pg.save(thread_id, state, scenario=scenario):
            return
    # Fallback: JSON file
    p = _path_for(thread_id)
    payload = {"_saved_at": time.time(), "state": state}
    with _lock:
        p.write_text(json.dumps(payload, default=str, ensure_ascii=False), encoding="utf-8")


def load_state(thread_id: str) -> dict[str, Any] | None:
    """Load state: try PGSaver first, fallback to JSON."""
    pg = get_pg_saver()
    if pg and pg.is_available():
        state = pg.load(thread_id)
        if state is not None:
            return {"state": state, "_source": "pg"}
    # Fallback: JSON file
    p = _path_for(thread_id)
    if not p.exists():
        return None
    with _lock:
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return None


def delete_state(thread_id: str) -> bool:
    pg = get_pg_saver()
    pg_ok = pg and pg.is_available() and pg.delete(thread_id)
    p = _path_for(thread_id)
    json_deleted = False
    if p.exists():
        with _lock:
            p.unlink()
        json_deleted = True
    return pg_ok or json_deleted
