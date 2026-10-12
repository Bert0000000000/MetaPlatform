"""Exercise release gating, untrusted archives and recovery without shared services."""

from __future__ import annotations

import hashlib
import importlib.util
import io
import json
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
SHA = "a" * 40
OTHER = "b" * 40
REPO = "Bert0000000000/MetaPlatform"
WORKFLOWS = (
    "CI",
    "Python Backend CI",
    "ga-acceptance",
    "ontology-loop",
    "OpenAPI Contract CI",
    "Tencent Demo CI",
)


def load(name: str):
    path = KIT / (name + ".py")
    if not path.exists():
        raise AssertionError(f"Missing deployment implementation: {path.name}")
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def runs():
    return [
        dict(
            id=i,
            name=name,
            head_sha=SHA,
            head_branch="main",
            event="push",
            head_repository={"full_name": REPO},
            status="completed",
            conclusion="success",
            run_attempt=1,
        )
        for i, name in enumerate(WORKFLOWS, 1)
    ]


class GateTests(unittest.TestCase):
    def test_all_ci_must_pass_for_the_exact_main_revision(self):
        gate = load("ci_gate")
        self.assertEqual(gate.evaluate(runs(), SHA, REPO)[0], "ready")
        for field, value in [
            ("head_sha", OTHER),
            ("head_branch", "feature"),
            ("event", "pull_request"),
            ("head_repository", {"full_name": "attacker/fork"}),
        ]:
            with self.subTest(field=field):
                fixture = runs()
                fixture[-1][field] = value
                self.assertEqual(gate.evaluate(fixture, SHA, REPO)[0], "waiting")

    def test_pending_missing_failed_cancelled_and_skipped_results_cannot_deploy(self):
        gate = load("ci_gate")
        self.assertEqual(gate.evaluate(runs()[:-1], SHA, REPO)[0], "waiting")
        fixture = runs()
        fixture[0].update(status="in_progress", conclusion=None)
        self.assertEqual(gate.evaluate(fixture, SHA, REPO)[0], "waiting")
        for conclusion in ("failure", "cancelled", "skipped", "timed_out"):
            with self.subTest(conclusion=conclusion):
                fixture = runs()
                fixture[0]["conclusion"] = conclusion
                self.assertEqual(gate.evaluate(fixture, SHA, REPO)[0], "failed")

    def test_a_later_failed_attempt_cannot_reuse_an_earlier_success(self):
        gate = load("ci_gate")
        fixture = runs()
        fixture.append(dict(fixture[0], id=50, run_attempt=2, conclusion="failure"))
        self.assertEqual(gate.evaluate(fixture, SHA, REPO)[0], "failed")

    def test_new_triggered_ci_failures_also_block_the_release(self):
        fixture = runs()
        fixture.append(dict(fixture[0], id=70, name="Extra checks", conclusion="failure"))
        self.assertEqual(load("ci_gate").evaluate(fixture, SHA, REPO)[0], "failed")


def archive_bytes(name="docker-compose.yml", kind=None):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as archive:
        item = tarfile.TarInfo(name)
        content = b"services: {}\n"
        if kind:
            item.type = kind
            item.linkname = "/etc/passwd"
        else:
            item.size = len(content)
        archive.addfile(item, None if kind else io.BytesIO(content))
        revision = tarfile.TarInfo("infra/demo-cloud/artifacts/source-revision.txt")
        revision.size = 41
        archive.addfile(revision, io.BytesIO((SHA + "\n").encode()))
    return output.getvalue()


class ArchiveTests(unittest.TestCase):
    def test_retrying_a_release_cannot_overwrite_an_earlier_release_directory(self):
        server = load("ci_server")
        self.assertTrue(hasattr(server, "stage_source"), "Safe release retries are not implemented")
        data = archive_bytes()
        digest = hashlib.sha256(data).hexdigest()
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            first = server.stage_source(io.BytesIO(data), base, SHA, digest)
            second = server.stage_source(io.BytesIO(data), base, SHA, digest)
            self.assertEqual(first, second)
            self.assertEqual((first / "docker-compose.yml").read_text(), "services: {}\n")
            with self.assertRaises(ValueError):
                server.stage_source(io.BytesIO(data), base, OTHER, digest)

    def test_valid_source_is_extracted_only_after_digest_verification(self):
        server = load("ci_server")
        data = archive_bytes()
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "release"
            server.unpack(io.BytesIO(data), target, hashlib.sha256(data).hexdigest())
            self.assertEqual((target / "docker-compose.yml").read_text(), "services: {}\n")

    def test_bad_digest_does_not_write_release_files(self):
        server = load("ci_server")
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "release"
            with self.assertRaises(ValueError):
                server.unpack(io.BytesIO(archive_bytes()), target, "0" * 64)
            self.assertFalse(target.exists())

    def test_paths_links_and_secrets_cannot_escape_or_replace_server_configuration(self):
        server = load("ci_server")
        for name, kind in [
            ("../escape", None),
            ("/absolute/escape", None),
            ("infra/demo-cloud/private/.env", None),
            ("infra/demo-cloud/artifacts/demo-accounts.json", None),
            ("docker-compose.yml", tarfile.SYMTYPE),
            ("docker-compose.yml", tarfile.LNKTYPE),
            ("mate-platform-backend/x", tarfile.CHRTYPE),
            ("infra/demo-cloud/..\\private/.env", None),
        ]:
            with self.subTest(name=name, kind=kind), tempfile.TemporaryDirectory() as directory:
                data = archive_bytes(name, kind)
                target = Path(directory) / "release"
                with self.assertRaises(ValueError):
                    server.unpack(io.BytesIO(data), target, hashlib.sha256(data).hexdigest())
                self.assertFalse(target.exists())

    def test_ssh_commands_cannot_open_a_shell_or_accept_arbitrary_arguments(self):
        server = load("ci_server")
        self.assertEqual(server.parse_command(f"release {SHA} {'c' * 64}")[0], "release")
        for command in (
            "bash",
            f"release {SHA}; touch /tmp/x",
            "../status",
            f"status {SHA} extra",
            f"release {SHA} bad",
            "rollback /tmp",
        ):
            with self.subTest(command=command), self.assertRaises(ValueError):
                server.parse_command(command)


class FileOperations:
    """Replace only Docker/HTTP effects; state and application version writes are real."""

    def __init__(self, base, failed_revision=None, fail_build=False, fail_rollback=False):
        self.base = base
        self.failed_revision = failed_revision
        self.fail_build = fail_build
        self.fail_rollback = fail_rollback
        self.runtime = base / "running.json"
        self.runtime.write_text(json.dumps({"revision": OTHER}))

    def build(self, release):
        if self.fail_build:
            raise RuntimeError("Build failed")

    def backup(self, current):
        (self.base / "backup.sql").write_text("existing demo database")

    def activate(self, release):
        self.runtime.write_text(json.dumps({"revision": release["revision"]}))

    def verify(self, release, fresh=False):
        if release["revision"] == self.failed_revision or (
            self.fail_rollback and release["revision"] == OTHER
        ):
            raise RuntimeError("Real acceptance failed")


class TransactionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        self.old = {
            "revision": OTHER,
            "path": str(self.base / "app"),
            "backend": "backend:old",
            "frontend": "web:old",
        }
        self.new = {
            "revision": SHA,
            "path": str(self.base / "releases" / SHA),
            "backend": "backend:new",
            "frontend": "web:new",
        }
        (self.base / "state.json").write_text(json.dumps({"current": self.old, "previous": None}))
        (self.base / ".env").write_text("PASSWORD=preserve-server-only-value\n")

    def test_a_verified_release_records_both_versions_and_preserves_credentials(self):
        server = load("ci_server")
        ops = FileOperations(self.base)
        server.deploy_release(self.base, self.new, ops)
        state = json.loads((self.base / "state.json").read_text())
        self.assertEqual(state["current"], self.new)
        self.assertEqual(state["previous"], self.old)
        self.assertEqual(json.loads(ops.runtime.read_text())["revision"], SHA)
        self.assertTrue((self.base / "backup.sql").exists())
        self.assertEqual((self.base / ".env").read_text(), "PASSWORD=preserve-server-only-value\n")

    def test_failed_acceptance_restores_and_verifies_the_previous_application(self):
        server = load("ci_server")
        ops = FileOperations(self.base, failed_revision=SHA)
        with self.assertRaises(server.DeploymentFailure):
            server.deploy_release(self.base, self.new, ops)
        state = json.loads((self.base / "state.json").read_text())
        self.assertEqual(state["current"], self.old)
        self.assertEqual(json.loads(ops.runtime.read_text())["revision"], OTHER)
        self.assertEqual(state["last_result"]["status"], "rolled_back")

    def test_a_build_failure_does_not_interrupt_the_running_application(self):
        server = load("ci_server")
        ops = FileOperations(self.base, fail_build=True)
        with self.assertRaises(server.DeploymentFailure):
            server.deploy_release(self.base, self.new, ops)
        self.assertEqual(json.loads(ops.runtime.read_text())["revision"], OTHER)
        self.assertEqual(json.loads((self.base / "state.json").read_text())["current"], self.old)

    def test_rollback_failure_is_reported_without_recording_the_bad_release_as_current(self):
        server = load("ci_server")
        ops = FileOperations(self.base, failed_revision=SHA, fail_rollback=True)
        with self.assertRaises(server.DeploymentFailure):
            server.deploy_release(self.base, self.new, ops)
        state = json.loads((self.base / "state.json").read_text())
        self.assertEqual(state["current"], self.old)
        self.assertEqual(state["last_result"]["status"], "rollback_failed")


if __name__ == "__main__":
    unittest.main()
