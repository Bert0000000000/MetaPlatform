"""The image must not start metadata consumers after a failed upgrade."""

from __future__ import annotations

import os
import runpy
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "run_service.py"


class ServiceStarted(Exception):
    pass


class RunServiceTests(unittest.TestCase):
    def invoke(self, module, upgrade):
        command = ["uvicorn", module, "--host", "0.0.0.0", "--port", "8301"]
        with (
            patch.object(sys, "argv", [str(SCRIPT), *command]),
            patch.dict(os.environ),
            patch.object(Path, "glob", return_value=[]),
            patch("subprocess.run", side_effect=upgrade) as migration,
            patch("os.execvp", side_effect=ServiceStarted) as start,
        ):
            try:
                runpy.run_path(str(SCRIPT), run_name="__main__")
            except ServiceStarted:
                pass
            return migration, start, command

    def test_failed_upgrade_prevents_both_consumers_from_starting(self):
        for module in ("mate_app_hub.main:app", "mate_tech_mcp.main:app"):
            with self.subTest(module=module):
                with (
                    patch.object(sys, "argv", [str(SCRIPT), "uvicorn", module]),
                    patch.dict(os.environ),
                    patch.object(Path, "glob", return_value=[]),
                    patch(
                        "subprocess.run",
                        side_effect=subprocess.CalledProcessError(1, "schema-upgrade"),
                    ),
                    patch("os.execvp") as start,
                    self.assertRaises(subprocess.CalledProcessError),
                ):
                    runpy.run_path(str(SCRIPT), run_name="__main__")
                start.assert_not_called()

    def test_successful_upgrade_finishes_before_original_service_command(self):
        for module in ("mate_app_hub.main:app", "mate_tech_mcp.main:app"):
            events = []

            def upgrade(*args, _events=events, **kwargs):
                _events.append("upgrade-complete")
                return subprocess.CompletedProcess(args[0], 0)

            with self.subTest(module=module):
                migration, start, command = self.invoke(module, upgrade)
                self.assertEqual(events, ["upgrade-complete"])
                migration.assert_called_once()
                self.assertTrue(migration.call_args.kwargs["check"])
                start.assert_called_once_with("uvicorn", command)

    def test_other_services_do_not_run_schema_upgrade(self):
        for module in ("mate_tech_ont.main:app", "other.module:app"):
            with self.subTest(module=module):
                migration, start, command = self.invoke(module, None)
                migration.assert_not_called()
                start.assert_called_once_with("uvicorn", command)


if __name__ == "__main__":
    unittest.main()
