"""CLI entry for import-linter contract verification."""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LINTER = ROOT / "tests" / "architecture" / "import-linter.ini"

# Packages that contain source trees import-linter needs to find.
PYTHONPATH_ENTRIES = [
    ROOT / "packages" / "mate-kernel" / "src",
    ROOT / "packages" / "mate-platform" / "src",
    ROOT / "packages" / "mate-clients" / "src",
    ROOT / "packages" / "mate-tech-rag" / "src",
    ROOT / "packages" / "mate-tech-agent" / "src",
    ROOT / "packages" / "mate-tech-ont" / "src",
]


def _python_executable() -> str:
    """Pick the Python interpreter that ships with the workspace venv."""
    venv = ROOT / ".venv" / "Scripts" / "python.exe"
    if venv.exists():
        return str(venv)
    return sys.executable


def _run_cli() -> int:
    """Run `lint-imports` via `python -m` so PYTHONPATH is honoured."""
    extra = os.pathsep.join(str(p) for p in PYTHONPATH_ENTRIES)
    existing = os.environ.get("PYTHONPATH")
    if existing:
        extra = extra + os.pathsep + existing
    env = {**os.environ, "PYTHONPATH": extra}
    cmd = [_python_executable(), "-m", "importlinter.cli", "lint_imports", "--config", str(LINTER)]
    proc = subprocess.run(
        cmd,
        cwd=str(ROOT),
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )
    if proc.stdout:
        sys.stdout.write(proc.stdout)
    if proc.stderr:
        sys.stderr.write(proc.stderr)
    return proc.returncode


def run() -> int:
    return _run_cli()


if __name__ == "__main__":
    raise SystemExit(run())
