"""Conftest for architecture tests."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
for p in [
    ROOT / "packages/mate-kernel/src",
    ROOT / "packages/mate-platform/src",
    ROOT / "packages/mate-clients/src",
]:
    sys.path.insert(0, str(p))
