"""Conftest that ensures src/ is on the Python path for tests."""
import sys
from pathlib import Path

_src = Path(__file__).resolve().parent
if str(_src) not in sys.path:
    sys.path.insert(0, str(_src))