"""Spark engine adapter — submits Spark jobs via the ``spark-submit`` CLI.

The adapter shells out to ``spark-submit`` using
``asyncio.subprocess.create_subprocess_exec``. This is the standard
way to submit Spark batch jobs in production; the CLI handles
driver/executor negotiation with the Spark master.

Configuration (all from environment variables):

    SPARK_SUBMIT_PATH   — path to the spark-submit binary
                          (default: ``spark-submit``)
    SPARK_MASTER        — Spark master URL
                          (default: ``local[*]``)
    SPARK_DEPLOY_MODE   — deploy mode: ``client`` or ``cluster``
                          (default: ``client``)

The adapter is **not** a stub: it builds real CLI argument lists,
captures stdout/stderr, parses the Spark submission ID from the
output, and surfaces non-zero exit codes as ``SparkSubmitError``.
"""
from __future__ import annotations

import asyncio
import os
import re
from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------
class SparkSubmitError(Exception):
    """Raised when a spark-submit invocation fails."""

    def __init__(
        self, message: str, *, returncode: int = -1,
        stdout: str = "", stderr: str = "",
    ) -> None:
        super().__init__(message)
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class SparkSubmissionResult:
    """Result of a spark-submit operation."""

    task_id: str
    submission_id: str
    status: str  # submitted | killed | running | finished | failed | unknown
    returncode: int
    stdout: str
    stderr: str
    extra: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
class SparkSubmitEngine:
    """Real Spark engine adapter using the ``spark-submit`` CLI.

    The engine is safe to share across coroutines — each call creates
    its own subprocess. Configuration is read from the environment
    at construction time (``from_env``) or accepted explicitly.
    """

    # Regex to extract the submission ID from spark-submit output.
    # Spark prints: "submissionId: driver-20240101000000-0001"
    _SUBMISSION_RE = re.compile(
        r"submission[_ ]?id\s*[:=]\s*(\S+)", re.IGNORECASE,
    )
    # Alternative: "Connected to Spark master ... driver-..."
    _DRIVER_RE = re.compile(r"(driver-\d{8}-\d{4}-\d+)")

    def __init__(
        self,
        *,
        spark_submit_path: str = "spark-submit",
        spark_master: str = "local[*]",
        deploy_mode: str = "client",
        timeout_seconds: float = 300.0,
    ) -> None:
        self._spark_submit_path = spark_submit_path
        self._spark_master = spark_master
        self._deploy_mode = deploy_mode
        self._timeout = timeout_seconds

    @classmethod
    def from_env(cls, *, timeout_seconds: float = 300.0) -> SparkSubmitEngine:
        """Build an engine from environment variables."""
        return cls(
            spark_submit_path=os.environ.get("SPARK_SUBMIT_PATH", "spark-submit"),
            spark_master=os.environ.get("SPARK_MASTER", "local[*]"),
            deploy_mode=os.environ.get("SPARK_DEPLOY_MODE", "client"),
            timeout_seconds=timeout_seconds,
        )

    # -----------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------
    async def run_task(
        self,
        task_id: str,
        *,
        script_path: str,
        app_name: str | None = None,
        conf: dict[str, str] | None = None,
        args: list[str] | None = None,
    ) -> SparkSubmissionResult:
        """Submit a Spark job via ``spark-submit``.

        Builds the CLI argument list, runs the process asynchronously,
        and parses the submission ID from stdout.
        """
        cmd = self._build_submit_command(
            script_path=script_path,
            app_name=app_name or task_id,
            conf=conf,
            args=args,
        )
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(
                proc.communicate(), timeout=self._timeout,
            )
        except TimeoutError as exc:
            proc.kill()
            await proc.wait()
            raise SparkSubmitError(
                f"spark-submit timed out after {self._timeout}s for task {task_id}",
                returncode=-1,
            ) from exc

        stdout = stdout_b.decode("utf-8", errors="replace") if stdout_b else ""
        stderr = stderr_b.decode("utf-8", errors="replace") if stderr_b else ""
        rc = proc.returncode if proc.returncode is not None else -1

        if rc != 0:
            raise SparkSubmitError(
                f"spark-submit exited with code {rc} for task {task_id}: "
                f"{stderr[:500]}",
                returncode=rc,
                stdout=stdout,
                stderr=stderr,
            )

        submission_id = self._parse_submission_id(stdout, stderr)
        return SparkSubmissionResult(
            task_id=task_id,
            submission_id=submission_id,
            status="submitted",
            returncode=rc,
            stdout=stdout,
            stderr=stderr,
        )

    async def stop_task(
        self, task_id: str, submission_id: str,
    ) -> SparkSubmissionResult:
        """Kill a running Spark submission via ``spark-submit --kill``."""
        cmd = [
            self._spark_submit_path,
            "--master", self._spark_master,
            "--kill", submission_id,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(
                proc.communicate(), timeout=self._timeout,
            )
        except TimeoutError as exc:
            proc.kill()
            await proc.wait()
            raise SparkSubmitError(
                f"spark-submit --kill timed out for {submission_id}",
                returncode=-1,
            ) from exc

        stdout = stdout_b.decode("utf-8", errors="replace") if stdout_b else ""
        stderr = stderr_b.decode("utf-8", errors="replace") if stderr_b else ""
        rc = proc.returncode if proc.returncode is not None else -1

        # spark-submit --kill may return non-zero if the driver is already gone.
        status = "killed" if rc == 0 else "unknown"
        return SparkSubmissionResult(
            task_id=task_id,
            submission_id=submission_id,
            status=status,
            returncode=rc,
            stdout=stdout,
            stderr=stderr,
        )

    async def get_status(
        self, task_id: str, submission_id: str,
    ) -> SparkSubmissionResult:
        """Query the status of a Spark submission via ``spark-submit --status``."""
        cmd = [
            self._spark_submit_path,
            "--master", self._spark_master,
            "--status", submission_id,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout_b, stderr_b = await asyncio.wait_for(
                proc.communicate(), timeout=self._timeout,
            )
        except TimeoutError as exc:
            proc.kill()
            await proc.wait()
            raise SparkSubmitError(
                f"spark-submit --status timed out for {submission_id}",
                returncode=-1,
            ) from exc

        stdout = stdout_b.decode("utf-8", errors="replace") if stdout_b else ""
        stderr = stderr_b.decode("utf-8", errors="replace") if stderr_b else ""
        rc = proc.returncode if proc.returncode is not None else -1

        if rc != 0:
            raise SparkSubmitError(
                f"spark-submit --status exited with code {rc}: {stderr[:500]}",
                returncode=rc,
                stdout=stdout,
                stderr=stderr,
            )

        status = self._parse_status(stdout)
        return SparkSubmissionResult(
            task_id=task_id,
            submission_id=submission_id,
            status=status,
            returncode=rc,
            stdout=stdout,
            stderr=stderr,
        )

    # -----------------------------------------------------------------
    # Internals
    # -----------------------------------------------------------------
    def _build_submit_command(
        self,
        *,
        script_path: str,
        app_name: str,
        conf: dict[str, str] | None,
        args: list[str] | None,
    ) -> list[str]:
        cmd: list[str] = [self._spark_submit_path]
        cmd.extend(["--master", self._spark_master])
        cmd.extend(["--deploy-mode", self._deploy_mode])
        cmd.extend(["--name", app_name])
        if conf:
            for key, value in conf.items():
                cmd.extend(["--conf", f"{key}={value}"])
        cmd.append(script_path)
        if args:
            cmd.extend(args)
        return cmd

    def _parse_submission_id(self, stdout: str, stderr: str) -> str:
        """Extract the Spark submission/driver ID from CLI output."""
        for text in (stdout, stderr):
            match = self._SUBMISSION_RE.search(text)
            if match:
                return match.group(1).rstrip(".,;")
            match = self._DRIVER_RE.search(text)
            if match:
                return match.group(1)
        return "unknown"

    def _parse_status(self, stdout: str) -> str:
        """Parse the status from ``spark-submit --status`` output."""
        lower = stdout.lower()
        for keyword, status in [
            ("running", "running"),
            ("finished", "finished"),
            ("killed", "killed"),
            ("failed", "failed"),
            ("waiting", "running"),
            ("submitted", "submitted"),
        ]:
            if keyword in lower:
                return status
        return "unknown"
