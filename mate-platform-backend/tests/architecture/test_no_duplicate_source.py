"""Forbid root-level deployment source trees duplicating the monorepo copies."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_root_services_only_in_workspace() -> None:
    """The root services/ tree must be empty; deployment source lives in mate-platform-backend/services/."""
    root_services = ROOT / "services"
    if not root_services.exists():
        return
    offenders = []
    for path in root_services.iterdir():
        if not path.is_dir():
            continue
        flat = path.name.replace("-", "_")
        candidate = path / "src" / flat / "main.py"
        if candidate.exists():
            offenders.append(path.name)
    assert offenders == [], offenders
