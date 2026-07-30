"""Forbid fakes in production assembly."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FAKES = ROOT / "packages/mate-clients/src/mate_clients/fakes"

def test_fakes_directory_isolated_from_production_assembly() -> None:
    assert FAKES.exists()
    for path in FAKES.rglob("*.py"):
        if path.name == "__init__.py":
            continue
        text = path.read_text(encoding="utf-8")
        assert "assert_fake_allowed" in text, path
