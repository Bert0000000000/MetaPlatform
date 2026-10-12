"""Installed forced-command receiver for the existing, isolated demo Compose project."""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import time
from pathlib import Path, PurePosixPath

CONFIG = Path("/usr/local/lib/metaplatform-demo-ci/config.json")
APPS = (
    "mate-tech-dw",
    "mate-tech-rag",
    "mate-tech-agent",
    "mate-app-kb",
    "mate-tech-llmgw",
    "mate-app-copilot",
    "mate-app-arch",
    "mate-app-hub",
    "mate-tech-data",
    "mate-app-a2a",
    "mate-tech-orchestrator",
    "mate-tech-agent-team",
    "mate-tech-ont",
    "mate-tech-msg",
    "mate-tech-mcp",
    "mate-tech-etl",
    "mate-tech-scheduler",
    "mate-tech-metrics",
    "mate-api-gateway",
    "mate-auth-service",
    "demo-web",
)
INFRA = ("postgres", "redis", "minio", "neo4j", "kafka", "keycloak")


class DeploymentFailure(RuntimeError):
    pass


def write_json(path: Path, value: dict) -> None:
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, indent=2), encoding="utf-8")
    temporary.chmod(0o600)
    temporary.replace(path)


def parse_command(command: str) -> tuple:
    if match := re.fullmatch(r"release ([0-9a-f]{40}) ([0-9a-f]{64})", command):
        return "release", *match.groups()
    if match := re.fullmatch(r"status ([0-9a-f]{40})", command):
        return "status", match.group(1)
    if command == "rollback":
        return ("rollback",)
    raise ValueError("Only release, status and rollback commands are permitted")


def unpack(stream, target: Path, expected_digest: str) -> None:
    compressed = stream.read(64 * 1024 * 1024 + 1)
    if len(compressed) > 64 * 1024 * 1024:
        raise ValueError("Source archive too large")
    if hashlib.sha256(compressed).hexdigest() != expected_digest:
        raise ValueError("Source archive digest mismatch")
    with tarfile.open(fileobj=io.BytesIO(compressed), mode="r:gz") as archive:
        members = []
        total = 0
        for item in archive:
            members.append(item)
            total += item.size
            if len(members) > 30000 or total > 256 * 1024 * 1024:
                raise ValueError("Expanded source archive too large")
        names = set()
        for item in members:
            path = PurePosixPath(item.name)
            allowed = item.name in {
                "docker-compose.yml",
                "infra/init-multiple-databases.sql",
                "infra/keycloak/realm-mate.json",
                "scripts/ont/apply_rls.py",
            } or item.name.startswith(
                ("mate-platform-backend/", "metaplatform-frontend/", "infra/demo-cloud/")
            )
            sensitive = (
                "private" in path.parts
                or ".git" in path.parts
                or any(part.startswith(".env") for part in path.parts)
                or (
                    "artifacts" in path.parts
                    and item.name
                    not in {
                        "infra/demo-cloud/artifacts/requirements.txt",
                        "infra/demo-cloud/artifacts/source-revision.txt",
                    }
                )
            )
            if (
                not item.isfile()
                or not allowed
                or sensitive
                or path.is_absolute()
                or ".." in path.parts
                or "\\" in item.name
                or item.name in names
            ):
                raise ValueError("Unsafe source archive member")
            names.add(item.name)
        target.mkdir(parents=True, exist_ok=False)
        for item in members:
            destination = target / item.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            # The SSH receiver uses umask 077. Docker COPY preserves source directory
            # modes, so the non-root runtime needs normal permissions on public code.
            # The enclosing release directory and shared private configuration stay private.
            for directory in destination.parents:
                if directory == target:
                    break
                directory.chmod(0o755)
            with archive.extractfile(item) as source, destination.open("wb") as output:
                shutil.copyfileobj(source, output)
            destination.chmod(0o755 if item.mode & 0o111 else 0o644)


def stage_source(stream, base: Path, revision: str, expected_digest: str) -> Path:
    target = base / "releases" / (revision + "-" + expected_digest[:16])
    if target.exists():
        compressed = stream.read(64 * 1024 * 1024 + 1)
        if hashlib.sha256(compressed).hexdigest() != expected_digest:
            raise ValueError("Source archive digest mismatch")
        if (target / ".ci-digest").read_text().strip() != expected_digest:
            raise ValueError("Existing release digest mismatch")
    else:
        unpack(stream, target, expected_digest)
        if (
            target / "infra/demo-cloud/artifacts/source-revision.txt"
        ).read_text().strip() != revision:
            raise ValueError("Archive revision does not match the command")
        (target / ".ci-digest").write_text(expected_digest + "\n")
    return target


def deploy_release(base: Path, release: dict, operations) -> None:
    state_path = base / "state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    current = state["current"]
    activated = False
    stage = "build"
    try:
        operations.build(release)
        stage = "backup"
        operations.backup(current)
        stage = "activate"
        activated = True  # A partially failed compose up must also roll back.
        operations.activate(release)
        stage = "acceptance"
        operations.verify(release, fresh=True)
    except Exception as error:
        status = "failed"
        if activated:
            try:
                operations.activate(current)
                operations.verify(current)
                status = "rolled_back"
            except Exception:
                status = "rollback_failed"
        state["last_result"] = {
            "status": status,
            "revision": release["revision"],
            "failed_stage": stage,
            "error_type": type(error).__name__,
            "finished_at": time.time(),
        }
        state.pop("pending", None)
        write_json(state_path, state)
        raise DeploymentFailure(status) from error
    state.update(
        current=release,
        previous=current,
        last_result={
            "status": "success",
            "revision": release["revision"],
            "finished_at": time.time(),
        },
    )
    state.pop("pending", None)
    write_json(state_path, state)


class DockerOperations:
    def __init__(self, base: Path, config: dict, rebuild: bool = True):
        self.base = base
        self.config = config
        self.rebuild = rebuild

    def environment(self, release):
        return dict(
            os.environ,
            DEMO_BACKEND_IMAGE=release["backend"],
            DEMO_FRONTEND_IMAGE=release["frontend"],
            COMPOSE_PROJECT_NAME=self.config["project"],
            COMPOSE_PROFILES="",
        )

    def compose(self, release):
        return [
            "sudo",
            "-n",
            "docker",
            "compose",
            "-p",
            self.config["project"],
            "--env-file",
            self.config["private"] + "/.env",
            "-f",
            "docker-compose.yml",
            "-f",
            "infra/demo-cloud/compose.yml",
        ]

    def run(self, release, arguments, **kwargs):
        return subprocess.run(
            arguments, cwd=release["path"], env=self.environment(release), check=True, **kwargs
        )

    def infrastructure(self, release):
        result = self.run(
            release,
            [*self.compose(release), "config", "--format", "json"],
            capture_output=True,
            text=True,
        )
        services = json.loads(result.stdout)["services"]
        # Source-relative bind paths vary by release; infrastructure settings must not.
        signature = json.dumps({name: services[name] for name in INFRA}, sort_keys=True)
        return signature.replace(release["path"], "$SOURCE")

    def build(self, release):
        state = json.loads((self.base / "state.json").read_text(encoding="utf-8"))
        if self.infrastructure(release) != self.infrastructure(state["current"]):
            raise DeploymentFailure("Infrastructure changes require a maintenance deployment")
        if self.rebuild:
            self.run(
                release,
                [
                    *self.compose(release),
                    "build",
                    "--build-arg",
                    "PIP_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple/",
                    "mate-api-gateway",
                    "demo-web",
                ],
            )

    def backup(self, current):
        directory = self.base / "backups"
        directory.mkdir(exist_ok=True)
        stamp = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
        for database in ("metaplatform", "metaplatform_ont"):
            path = directory / f"{stamp}-{database}.sql.gz"
            with path.open("xb") as output:
                path.chmod(0o600)
                process = subprocess.Popen(
                    [
                        *self.compose(current),
                        "exec",
                        "-T",
                        "postgres",
                        "pg_dump",
                        "-U",
                        "meta",
                        "-d",
                        database,
                    ],
                    cwd=current["path"],
                    env=self.environment(current),
                    stdout=subprocess.PIPE,
                )
                with gzip.GzipFile(fileobj=output, mode="wb") as archive:
                    shutil.copyfileobj(process.stdout, archive)
                process.stdout.close()
                if process.wait() != 0:
                    raise DeploymentFailure("Database backup failed")

    def activate(self, release):
        self.run(
            release,
            [
                *self.compose(release),
                "up",
                "-d",
                "--no-deps",
                "--pull",
                "never",
                "--wait",
                "--wait-timeout",
                "300",
                *APPS,
            ],
        )

    def verify(self, release, fresh=False):
        prefix = ["python3", "infra/demo-cloud/"]
        if fresh:
            self.run(release, [prefix[0], prefix[1] + "bootstrap.py"])
        self.run(
            release,
            [prefix[0], prefix[1] + "verify.py", "--base-url", self.config["url"], "--read-only"],
        )
        if fresh:
            self.run(
                release, [prefix[0], prefix[1] + "verify.py", "--base-url", self.config["url"]]
            )
        # Application acceptance alone must not hide a failing infrastructure container.
        result = self.run(
            release,
            [*self.compose(release), "ps", "--format", "json"],
            capture_output=True,
            text=True,
        )
        text = result.stdout.strip()
        containers = (
            json.loads(text)
            if text.startswith("[")
            else [json.loads(row) for row in text.splitlines()]
        )
        actual = {item["Service"]: item for item in containers}
        if set(actual) != set(APPS + INFRA) or any(
            item["State"] != "running" or item.get("Health") != "healthy"
            for item in actual.values()
        ):
            raise DeploymentFailure("The complete demo stack is not healthy")


def worker(base: Path, config: dict, revision: str, rollback: bool = False) -> None:
    import fcntl

    with (base / "deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = json.loads((base / "state.json").read_text(encoding="utf-8"))
        operations = DockerOperations(base, config, rebuild=not rollback)
        try:
            operations.verify(state["current"])
            if rollback:
                release = state["previous"]
                if not release:
                    raise DeploymentFailure("No verified previous application version")
            else:
                release = {
                    "revision": revision,
                    "path": state["pending"]["path"],
                    "backend": "metaplatform-demo-backend:" + revision,
                    "frontend": "metaplatform-demo-web:" + revision,
                }
                if state["current"]["revision"] == revision:
                    state.pop("pending", None)
                    state["last_result"] = {
                        "status": "success",
                        "revision": revision,
                        "finished_at": time.time(),
                    }
                    write_json(base / "state.json", state)
                    return
                kit = Path(release["path"]) / "infra/demo-cloud"
                private = kit / "private"
                if private.is_symlink():
                    if private.resolve() != Path(config["private"]).resolve():
                        raise DeploymentFailure("Private configuration link mismatch")
                else:
                    private.symlink_to(config["private"], target_is_directory=True)
                shutil.copy2(
                    Path(state["current"]["path"])
                    / "infra/demo-cloud/artifacts/acceptance-state.json",
                    kit / "artifacts/acceptance-state.json",
                )
            deploy_release(base, release, operations)
        except Exception as error:
            # Log details privately on the server, return only a safe failure classification.
            print(f"Worker failed: {type(error).__name__}", flush=True)
            state = json.loads((base / "state.json").read_text(encoding="utf-8"))
            if state.pop("pending", None):
                state["last_result"] = {
                    "status": "failed",
                    "revision": revision,
                    "failed_stage": "preflight",
                    "error_type": type(error).__name__,
                }
                write_json(base / "state.json", state)


def main() -> None:
    import fcntl

    os.umask(0o077)
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    base = Path(config["base"])
    # Internal worker invocation is inaccessible through SSH_ORIGINAL_COMMAND.
    if (
        len(sys.argv) == 3
        and sys.argv[1] == "--worker"
        and not os.environ.get("SSH_ORIGINAL_COMMAND")
    ):
        worker(base, config, sys.argv[2], rollback=os.environ.get("DEMO_CI_ROLLBACK") == "1")
        return
    command = parse_command(os.environ.get("SSH_ORIGINAL_COMMAND", ""))
    state = json.loads((base / "state.json").read_text(encoding="utf-8"))
    if command[0] == "status":
        revision = command[1]
        if state.get("pending", {}).get("revision") == revision:
            print(json.dumps({"status": "running", "revision": revision}))
        elif state.get("last_result", {}).get("revision") == revision:
            print(json.dumps(state["last_result"]))
        else:
            print(json.dumps({"status": "unknown", "revision": revision}))
        return
    with (base / "deploy.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({"status": "busy"}))
            return
        state = json.loads((base / "state.json").read_text(encoding="utf-8"))
        if state.get("pending"):
            print(json.dumps({"status": "busy"}))
            return
        rollback = command[0] == "rollback"
        if rollback:
            if not state.get("previous"):
                raise DeploymentFailure("No verified previous version")
            revision = state["previous"]["revision"]
        else:
            revision, expected_digest = command[1:]
            target = stage_source(sys.stdin.buffer, base, revision, expected_digest)
        state["pending"] = {"revision": revision, "started_at": time.time()}
        if not rollback:
            state["pending"]["path"] = str(target)
        write_json(base / "state.json", state)
        environment = dict(os.environ, DEMO_CI_ROLLBACK="1" if rollback else "0")
        environment.pop("SSH_ORIGINAL_COMMAND", None)
        logs = base / "logs"
        logs.mkdir(exist_ok=True)
        with (logs / (revision + ".log")).open("ab") as output:
            process = subprocess.Popen(
                [sys.executable, str(Path(__file__).resolve()), "--worker", revision],
                stdin=subprocess.DEVNULL,
                stdout=output,
                stderr=output,
                env=environment,
                start_new_session=True,
            )
        state["pending"]["pid"] = process.pid
        write_json(base / "state.json", state)
        print(json.dumps({"status": "running", "revision": revision}))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"status": "rejected", "error_type": type(error).__name__}))
        raise SystemExit(1) from None
