"""Run generated PowerShell with harmless query/termination substitutes."""

import base64
import importlib.util
import json
import subprocess
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "mp11_manage", Path(__file__).parents[1] / "manage.py"
)
manage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manage)


@pytest.mark.parametrize(
    "changed",
    ["CreationTicks", "ExecutablePath", "CommandLine", "ProcessId", "absent", "unchanged"],
)
def test_stop_rechecks_identity_immediately_before_termination(monkeypatch, changed):
    identity = {
        "ProcessId": 12345,
        "ExecutablePath": r"C:\owned\python.exe",
        "CommandLine": "owned candidate.py api",
        "CreationTicks": 1000,
    }
    state = {"processes": {"api": identity}, "listeners": {"api": [identity]}}
    monkeypatch.setattr(manage, "state", lambda: state)
    saved = []
    monkeypatch.setattr(manage, "save", lambda *args: saved.append(True))

    def harmless_command(args):
        prelude = r"""
$script:queries=0; $script:stops=0
function Get-CimInstance {
 param($ClassName,$Filter)
 $script:queries++
 $item=[pscustomobject]@{ProcessId=12345; ExecutablePath='C:\owned\python.exe'; CommandLine='owned candidate.py api'; CreationDate=[datetime]::new(1000,[DateTimeKind]::Utc)}
 if($script:queries -gt 1){ CHANGE }
 return $item
}
function Stop-Process { param($Id,$ErrorAction) $script:stops++ }
try { GENERATED; $errorKind='' } catch { $errorKind=$_.Exception.Message }
ConvertTo-Json -Compress @{stops=$script:stops;error=$errorKind}
"""
        change = {
            "CreationTicks": "$item.CreationDate=[datetime]::new(2000,[DateTimeKind]::Utc)",
            "ExecutablePath": r"$item.ExecutablePath='C:\unowned\python.exe'",
            "CommandLine": "$item.CommandLine='unowned process'",
            "ProcessId": "$item.ProcessId=54321",
            "absent": "return $null",
            "unchanged": "",
        }[changed]
        script = prelude.replace("CHANGE", change).replace("GENERATED", args[-1])
        encoded = base64.b64encode(script.encode("utf-16-le")).decode()
        run = subprocess.run(
            ["powershell.exe", "-NoProfile", "-EncodedCommand", encoded],
            capture_output=True,
            text=True,
            timeout=20,
        )
        assert run.returncode == 0
        result = json.loads(run.stdout)
        assert result["stops"] == (1 if changed == "unchanged" else 0)
        if changed not in ("unchanged", "absent"):
            assert "identity mismatch" in result["error"]
            raise RuntimeError("command failed: mocked identity mismatch")
        return run.stdout

    monkeypatch.setattr(manage, "command", harmless_command)
    if changed not in ("unchanged", "absent"):
        with pytest.raises(RuntimeError):
            manage.stop("api")
        assert not saved and "api" in state["processes"]
    else:
        manage.stop("api")
        assert saved and "api" not in state["processes"]
