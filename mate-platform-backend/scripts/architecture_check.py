"""CLI entry for import-linter contract verification."""
import sys
from importlinter.application.use_cases import lint_imports
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LINTER = ROOT / "tests" / "architecture" / "import-linter.ini"


def run() -> int:
    passed = lint_imports(config_filename=str(LINTER))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(run())
