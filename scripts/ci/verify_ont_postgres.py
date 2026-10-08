"""Execute mandatory ADR-0082/0080 PostgreSQL regressions; never accept skips.

Run with the workspace venv Python, from any directory. The business role is
checked before pytest collection. FORCE RLS is covered separately by ga-014:
these regression fixtures seed/read multiple tenants and auxiliary tables.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "mate-platform-backend"
SUITES = (
    "test_ont_migration_plan",
    "test_ont_data_sync_integrity",
    "test_ont_model_write_atomicity",
    "test_ont_link_cardinality_concurrency",
    "test_ont_version_mechanism",
    "test_ont_query_semantics_unified",
)
DSN_KEYS = (
    "PG_DSN",
    "VER_PG_DSN",
    "SYNC_IT_PG_DSN",
    "MODEL_AT_PG_DSN",
    "LINKC_PG_DSN",
    "QSEM_PG_DSN",
)


def resolve_dsn(env: dict[str, str]) -> str:
    version, generic = env.get("VER_PG_DSN"), env.get("PG_DSN")
    if not version and not generic:
        raise ValueError("Required PostgreSQL gate needs explicit VER_PG_DSN or PG_DSN")
    if version and generic and version != generic:
        raise ValueError("VER_PG_DSN and PG_DSN must select the same isolated target")
    return version or generic


def validate_identity(user: str, superuser: bool, bypassrls: bool) -> None:
    if superuser or bypassrls:
        raise ValueError(f"Business test role {user!r} must be NOSUPERUSER NOBYPASSRLS")


def preflight(dsn: str) -> None:
    try:
        with psycopg2.connect(dsn, connect_timeout=5, options="-c statement_timeout=10000") as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
                )
                user, superuser, bypass = cur.fetchone()
                validate_identity(user, superuser, bypass)
                cur.execute("SELECT current_database(), current_setting('server_version_num')::int")
                database, version = cur.fetchone()
                if not 160000 <= version < 170000:
                    raise ValueError("Required gate expects PostgreSQL 16")
    except psycopg2.Error as exc:
        # Never print the DSN or a driver message which may contain credentials.
        raise ValueError("Required PostgreSQL connection preflight failed") from exc
    print(
        f"PostgreSQL preflight: database={database!r}, role={user!r}, NOSUPERUSER NOBYPASSRLS, PostgreSQL 16",
        flush=True,
    )


def check_junit(path: Path, required: set[str]) -> int:
    cases = list(ET.parse(path).getroot().iter("testcase"))
    if not cases:
        raise ValueError("Required JUnit contains no executed tests")
    if any(
        any(case.find(tag) is not None for tag in ("skipped", "failure", "error")) for case in cases
    ):
        raise ValueError("Required JUnit contains skipped, failed or errored tests")
    executed = {part for case in cases for part in case.get("classname", "").split(".")}
    missing = required - executed
    if missing:
        raise ValueError(f"Required suites not executed: {', '.join(sorted(missing))}")
    return len(cases)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--junit", type=Path, default=ROOT / ".ci/ont-postgres.xml")
    parser.add_argument(
        "--rls", action="store_true", help="Run the separate required FORCE RLS specialty"
    )
    args = parser.parse_args()
    try:
        dsn = resolve_dsn(dict(os.environ))
        preflight(dsn)
        report = args.junit.resolve()
        report.parent.mkdir(parents=True, exist_ok=True)
        # A previous successful report can never substitute for this run.
        report.unlink(missing_ok=True)
        env = dict(os.environ)
        env.update(dict.fromkeys(DSN_KEYS, dsn))
        suites = ("test_tenant_isolation_hard",) if args.rls else SUITES
        directory = "security" if args.rls else "integration"
        files = [f"packages/mate-tech-ont/tests/{directory}/{suite}.py" for suite in suites]
        result = subprocess.run(
            [sys.executable, "-m", "pytest", *files, "-q", f"--junitxml={report}"],
            cwd=BACKEND,
            env=env,
            check=False,
        )
        count = check_junit(report, set(suites))
        if result.returncode:
            return result.returncode
        print(
            f"Required PostgreSQL gate: {count} executed, 0 skipped, {len(suites)} required suites present"
        )
        return 0
    except (ValueError, OSError, ET.ParseError) as exc:
        print(f"PostgreSQL gate FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
