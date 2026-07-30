"""Forbid module-level mutable business state."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PATTERN = re.compile(r"^[A-Z_]+\s*:\s*(dict|list|set)\s*=", re.MULTILINE)

def test_application_layer_has_no_module_level_business_state() -> None:
    for path in (ROOT / "packages").rglob("*.py"):
        if "/tests/" in path.as_posix() or "/.venv/" in path.as_posix():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for match in PATTERN.finditer(text):
            line = match.group(0)
            assert line.startswith("#") or "= _" in line, (path, line)
