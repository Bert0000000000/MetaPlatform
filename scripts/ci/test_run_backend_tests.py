from pathlib import Path

import pytest
from run_backend_tests import build_commands, main


def test_build_commands_use_backend_workspace_and_forward_pytest_args(tmp_path: Path) -> None:
    uv = tmp_path / "uv.exe"

    commands = build_commands(uv, tmp_path, ["--collect-only", "-q"])

    backend = tmp_path / "mate-platform-backend"
    assert commands.sync.argv == [str(uv), "sync", "--frozen", "--all-packages"]
    assert commands.sync.cwd == backend
    assert commands.python_check.argv[:3] == [str(uv), "run", "python"]
    assert commands.python_check.cwd == backend
    assert "sys.exit" in commands.python_check.argv[-1]
    assert commands.pytest.argv == [str(uv), "run", "pytest", "--collect-only", "-q"]
    assert commands.pytest.cwd == backend


def test_main_returns_uv_sync_failure(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    calls: list[tuple[list[str], Path]] = []

    monkeypatch.setattr("run_backend_tests.find_uv", lambda: tmp_path / "uv.exe")
    monkeypatch.setattr("run_backend_tests.repository_root", lambda: tmp_path)
    (tmp_path / "mate-platform-backend").mkdir()

    def fake_run(command: list[str], *, cwd: Path, check: bool = False) -> object:
        calls.append((command, cwd))
        return type("Result", (), {"returncode": 7})()

    monkeypatch.setattr("run_backend_tests.subprocess.run", fake_run)

    assert main(["-q"]) == 7
    assert calls == [
        (
            [str(tmp_path / "uv.exe"), "sync", "--frozen", "--all-packages"],
            tmp_path / "mate-platform-backend",
        )
    ]


def test_main_runs_pytest_after_python_preflight(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    calls: list[list[str]] = []

    monkeypatch.setattr("run_backend_tests.find_uv", lambda: tmp_path / "uv.exe")
    monkeypatch.setattr("run_backend_tests.repository_root", lambda: tmp_path)
    (tmp_path / "mate-platform-backend").mkdir()

    def fake_run(command: list[str], *, cwd: Path, check: bool = False) -> object:
        calls.append(command)
        return type("Result", (), {"returncode": 0})()

    monkeypatch.setattr("run_backend_tests.subprocess.run", fake_run)

    assert main(["tests/architecture", "-q"]) == 0
    assert calls[0][-3:] == ["sync", "--frozen", "--all-packages"]
    assert calls[1][:3] == [str(tmp_path / "uv.exe"), "run", "python"]
    assert calls[2] == [str(tmp_path / "uv.exe"), "run", "pytest", "tests/architecture", "-q"]
