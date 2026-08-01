"""dbt engine adapter — runs dbt commands via the ``dbt`` CLI.

The adapter shells out to ``dbt`` using
``asyncio.subprocess.create_subprocess_exec``. This is the standard
way to run dbt in production (via dbt Cloud CLI, dbt Core CLI, or
a containerized dbt runner).

Supported dbt commands:
    - ``dbt run``      — execute models
    - ``dbt run-operation`` — run a macro (for metric compute)
    - ``dbt list``     — list resources (for lineage discovery)
    - ``dbt show``     — show compiled SQL / preview results

Configuration (all from environment variables):

    DBT_BIN_PATH    — path to the dbt binary
                      (default: ``dbt``)
    DBT_PROJECT_DIR — path to the dbt project root
                      (default: ``/opt/dbt``)
    DBT_PROFILES_DIR — path to the dbt profiles directory
                      (default: ``/root/.dbt``)
    DBT_TARGET      — dbt target name
                      (default: ``prod``)
"""
from __future__ import annotations

import asyncio
import json
import os
import re
from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------
class DbtMetricsError(Exception):
    """Raised when a dbt CLI invocation fails."""

    def __init__(
        self, message: str, *,
        returncode: int = -1,
        stdout: str = "",
        stderr: str = "",
    ) -> None:
        super().__init__(message)
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class DbtResult:
    """Result of a dbt operation."""

    metric_id: str
    status: str  # success | failed | unknown
    returncode: int
    stdout: str
    stderr: str
    values: list[dict[str, Any]] = field(default_factory=list)
    lineage: list[dict[str, Any]] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
class DbtMetricsEngine:
    """Real dbt engine adapter using the ``dbt`` CLI.

    The engine is safe to share across coroutines — each call creates
    its own subprocess. Configuration is read from the environment
    at construction time (``from_env``) or accepted explicitly.
    """

    # Parse "OK" / "ERROR" status lines from dbt output
    _STATUS_RE = re.compile(r"^(OK|ERROR|PASS|WARN)\b", re.MULTILINE)

    def __init__(
        self,
        *,
        dbt_bin: str = "dbt",
        project_dir: str = "/opt/dbt",
        profiles_dir: str = "/root/.dbt",
        target: str = "prod",
        timeout_seconds: float = 600.0,
    ) -> None:
        self._dbt_bin = dbt_bin
        self._project_dir = project_dir
        self._profiles_dir = profiles_dir
        self._target = target
        self._timeout = timeout_seconds

    @classmethod
    def from_env(cls, *, timeout_seconds: float = 600.0) -> DbtMetricsEngine:
        """Build an engine from environment variables."""
        return cls(
            dbt_bin=os.environ.get("DBT_BIN_PATH", "dbt"),
            project_dir=os.environ.get("DBT_PROJECT_DIR", "/opt/dbt"),
            profiles_dir=os.environ.get("DBT_PROFILES_DIR", "/root/.dbt"),
            target=os.environ.get("DBT_TARGET", "prod"),
            timeout_seconds=timeout_seconds,
        )

    # -----------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------
    async def compute_metric(
        self,
        metric_id: str,
        *,
        expression: str | None = None,
        select: str | None = None,
        full_refresh: bool = False,
        vars: dict[str, Any] | None = None,
    ) -> DbtResult:
        """Run ``dbt run`` to compute a metric's underlying models.

        This executes the dbt models that the metric depends on.
        The ``select`` parameter targets specific models.
        """
        cmd = self._base_cmd("run")
        if select:
            cmd.extend(["--select", select])
        if full_refresh:
            cmd.append("--full-refresh")
        if vars:
            cmd.extend(["--vars", json.dumps(vars)])

        stdout, stderr, rc = await self._exec(cmd, metric_id)

        if rc != 0:
            raise DbtMetricsError(
                f"dbt run failed for metric {metric_id}: {stderr[:500]}",
                returncode=rc, stdout=stdout, stderr=stderr,
            )

        return DbtResult(
            metric_id=metric_id,
            status="success",
            returncode=rc,
            stdout=stdout,
            stderr=stderr,
        )

    async def get_lineage(
        self, metric_id: str, *, select: str | None = None,
    ) -> DbtResult:
        """Run ``dbt list`` to discover model lineage.

        With ``--resource-type model`` and ``--output json``, dbt
        emits one JSON object per resource. The engine parses these
        into a lineage list.
        """
        cmd = self._base_cmd("list")
        cmd.extend(["--resource-type", "model", "--output", "json"])
        if select:
            cmd.extend(["--select", select])

        stdout, stderr, rc = await self._exec(cmd, metric_id)

        if rc != 0:
            raise DbtMetricsError(
                f"dbt list failed for metric {metric_id}: {stderr[:500]}",
                returncode=rc, stdout=stdout, stderr=stderr,
            )

        lineage = self._parse_jsonl(stdout)
        return DbtResult(
            metric_id=metric_id,
            status="success",
            returncode=rc,
            stdout=stdout,
            stderr=stderr,
            lineage=lineage,
        )

    async def get_values(
        self,
        metric_id: str,
        *,
        expression: str,
        limit: int = 100,
    ) -> DbtResult:
        """Run ``dbt run-operation`` to query metric values.

        Executes a dbt macro that computes the metric expression and
        returns the result as a JSON array.
        """
        cmd = self._base_cmd("run-operation")
        cmd.extend(["get_metric_values", "--args", json.dumps({
            "expression": expression,
            "limit": limit,
        })])

        stdout, stderr, rc = await self._exec(cmd, metric_id)

        if rc != 0:
            raise DbtMetricsError(
                f"dbt run-operation failed for metric {metric_id}: {stderr[:500]}",
                returncode=rc, stdout=stdout, stderr=stderr,
            )

        values = self._parse_values_block(stdout)
        return DbtResult(
            metric_id=metric_id,
            status="success",
            returncode=rc,
            stdout=stdout,
            stderr=stderr,
            values=values,
        )

    async def test_metric(
        self, metric_id: str, *, select: str | None = None,
    ) -> DbtResult:
        """Run ``dbt test`` to validate metric models."""
        cmd = self._base_cmd("test")
        if select:
            cmd.extend(["--select", select])

        stdout, stderr, rc = await self._exec(cmd, metric_id)

        status = "success" if rc == 0 else "failed"
        return DbtResult(
            metric_id=metric_id,
            status=status,
            returncode=rc,
            stdout=stdout,
            stderr=stderr,
        )

    # -----------------------------------------------------------------
    # Internals
    # -----------------------------------------------------------------
    def _base_cmd(self, subcommand: str) -> list[str]:
        """Build the base dbt command with global flags."""
        return [
            self._dbt_bin, subcommand,
            "--project-dir", self._project_dir,
            "--profiles-dir", self._profiles_dir,
            "--target", self._target,
        ]

    async def _exec(
        self, cmd: list[str], metric_id: str,
    ) -> tuple[str, str, int]:
        """Execute a dbt command and return (stdout, stderr, returncode)."""
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
            raise DbtMetricsError(
                f"dbt timed out after {self._timeout}s for metric {metric_id}",
                returncode=-1,
            ) from exc

        stdout = stdout_b.decode("utf-8", errors="replace") if stdout_b else ""
        stderr = stderr_b.decode("utf-8", errors="replace") if stderr_b else ""
        rc = proc.returncode if proc.returncode is not None else -1
        return stdout, stderr, rc

    def _parse_jsonl(self, stdout: str) -> list[dict[str, Any]]:
        """Parse newline-delimited JSON from dbt list --output json."""
        results: list[dict[str, Any]] = []
        for line in stdout.strip().splitlines():
            line = line.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                results.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return results

    def _parse_values_block(self, stdout: str) -> list[dict[str, Any]]:
        """Extract JSON array from dbt run-operation output.

        dbt macros typically print JSON between markers or as a
        standalone block. We search for a JSON array pattern.
        """
        # Look for a JSON array in the output
        json_array_re = re.compile(r"\[[\s\S]*?\]")
        for line in stdout.splitlines():
            line = line.strip()
            if line.startswith("[") and line.endswith("]"):
                try:
                    parsed = json.loads(line)
                    if isinstance(parsed, list):
                        return parsed
                except json.JSONDecodeError:
                    continue
        # Try to find a JSON array anywhere in the output
        match = json_array_re.search(stdout)
        if match:
            try:
                parsed = json.loads(match.group(0))
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass
        return []
