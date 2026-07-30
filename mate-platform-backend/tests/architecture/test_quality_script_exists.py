"""Guard the quality-check shell script exists with the expected commands."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "quality_check.sh"


def test_quality_check_script_exists() -> None:
    assert SCRIPT.exists(), f"missing {SCRIPT}"
    text = SCRIPT.read_text(encoding="utf-8")
    assert "ruff check" in text
    assert "pyright" in text
    assert "pytest tests/architecture" in text
    assert "architecture_check.py" in text
