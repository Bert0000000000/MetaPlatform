from __future__ import annotations

import shutil
import subprocess
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Command:
    argv: list[str]
    cwd: Path


@dataclass(frozen=True)
class BackendCommands:
    sync: Command
    python_check: Command
    pytest: Command


def repository_root() -> Path:
    return Path(__file__).resolve().parents[2]


def find_uv() -> Path | None:
    executable = shutil.which("uv")
    if executable:
        return Path(executable)

    for candidate in (
        Path.home() / ".local" / "bin" / "uv.exe",
        Path.home() / ".local" / "bin" / "uv",
    ):
        if candidate.is_file():
            return candidate
    return None


def build_commands(uv: Path, root: Path, pytest_args: Sequence[str]) -> BackendCommands:
    backend = root / "mate-platform-backend"
    uv_executable = str(uv)
    return BackendCommands(
        sync=Command([uv_executable, "sync", "--frozen", "--all-packages"], backend),
        python_check=Command(
            [
                uv_executable,
                "run",
                "python",
                "-c",
                (
                    "import sys; expected=(3, 12); actual=sys.version_info[:2]; "
                    "sys.exit(f'Backend requires Python 3.12, got {actual[0]}.{actual[1]}') "
                    "if actual != expected else None"
                ),
            ],
            backend,
        ),
        pytest=Command([uv_executable, "run", "pytest", *pytest_args], backend),
    )


def _run(command: Command) -> int:
    return subprocess.run(command.argv, cwd=command.cwd, check=False).returncode


def main(argv: Sequence[str] | None = None) -> int:
    pytest_args = list(sys.argv[1:] if argv is None else argv)
    if pytest_args in (["--help"], ["-h"]):
        print("Usage: python scripts/ci/run_backend_tests.py [pytest arguments]")
        print("Runs backend pytest through the frozen uv workspace environment.")
        return 0

    root = repository_root()
    backend = root / "mate-platform-backend"
    if not backend.is_dir():
        print(f"Backend workspace not found: {backend}", file=sys.stderr)
        return 2

    uv = find_uv()
    if uv is None:
        print("uv was not found on PATH or in ~/.local/bin.", file=sys.stderr)
        return 2

    commands = build_commands(uv, root, pytest_args)
    for command in (commands.sync, commands.python_check, commands.pytest):
        return_code = _run(command)
        if return_code:
            return return_code
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
