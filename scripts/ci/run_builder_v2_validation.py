"""Reproduce local Builder gates on the explicitly owned 242e stack.

This entry does not provision, restart, delete or reset anything. Caller supplies
private connection inputs through environment; raw diagnostics remain ignored.
Public receipts contain only source identity, case identity, counts and hashes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
GOAL = "01a11b4d-ab28-7ed0-9a89-929e5fae1374"
PG_CONTAINER = "codex-242e-builder-v2-pg"
PRIVATE_ROOT = ROOT / ".superpowers/runtime/builder-v2/validation"
FRONTEND = ROOT / "metaplatform-frontend"
EXPECTED = {"core": 9, "migration": 2, "builder": 21}
ACCEPTED_PLAN = "docs/superpowers/plans/2026-10-08-metaplatform-builder-v2-alignment.md"


class Refused(Exception):
    """Safe refusal text; never forward driver/server/private exception text."""


def git(*args: str) -> str:
    return subprocess.check_output(
        ["git", *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
    ).strip()


def checkbox_only_change(before: str, after: str) -> bool:
    """Allow status marks only; preserve every other character in the plan."""

    def normalize(text: str) -> str:
        return re.sub(r"(?m)^(\s*[-*+] )\[[ xX]\](?=\s)", r"\1[ ]", text)

    return normalize(before) == normalize(after)


def accepted_plan_bookkeeping(source: str, path: str) -> bool:
    if path != ACCEPTED_PLAN or not (ROOT / path).is_file():
        return False
    before = subprocess.check_output(
        ["git", "show", f"{source}:{path}"], cwd=ROOT, stderr=subprocess.DEVNULL
    ).decode("utf-8")
    return checkbox_only_change(before, (ROOT / path).read_text(encoding="utf-8"))


def fingerprint() -> dict:
    paths = git("ls-files", "-z", "mate-platform-backend", "metaplatform-frontend").split("\0")
    records = {
        p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest()
        for p in paths
        if p
        and (ROOT / p).is_file()
        and Path(p).suffix in (".py", ".sql", ".ts", ".tsx", ".css", ".yaml", ".json")
    }
    return {
        "file_count": len(records),
        "sha256": hashlib.sha256(json.dumps(records, sort_keys=True).encode()).hexdigest(),
    }


def required(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise Refused(f"Missing caller input: {key}; no shared default is permitted")
    return value


def owned_container() -> None:
    try:
        result = subprocess.run(
            ["docker", "inspect", PG_CONTAINER],
            capture_output=True,
            text=True,
            timeout=20,
            check=True,
        )
        rows = json.loads(result.stdout)
        row = rows[0]
        labels = row["Config"]["Labels"] or {}
        ports = row["NetworkSettings"]["Ports"].get("5432/tcp", [])
        if (
            len(rows) != 1
            or row["Name"] != "/" + PG_CONTAINER
            or labels.get("com.docker.compose.project") != "codex-242e-builder-v2"
            or GOAL not in labels.values()
            or not row["State"]["Running"]
            or not any(p["HostIp"] == "127.0.0.1" and p["HostPort"] == "55493" for p in ports)
        ):
            raise Refused("Owned PostgreSQL name/goal/project/loopback-port guard rejected target")
    except Refused:
        raise
    except Exception:
        raise Refused(
            "Owned-container inspection unavailable; target ownership is unverified"
        ) from None


def database_identity(dsn: str, database: str, role: str) -> dict:
    try:
        import psycopg2

        parts = psycopg2.extensions.parse_dsn(dsn)
        if (
            parts.get("host") != "127.0.0.1"
            or parts.get("port") != "55493"
            or parts.get("dbname") != database
            or parts.get("user") != role
            or any(k in parts for k in ("service", "hostaddr"))
        ):
            raise Refused("Explicit independent database target guard rejected caller input")
        with psycopg2.connect(dsn, connect_timeout=5, options="-c statement_timeout=10000") as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT current_database(), current_user, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, current_setting('server_version_num')::int FROM pg_roles WHERE rolname=current_user"
                )
                db, user, su, bypass, create_db, create_role, version = cur.fetchone()
        if (
            (db, user) != (database, role)
            or any((su, bypass, create_db, create_role))
            or not 160000 <= version < 170000
        ):
            raise Refused("Actual database identity/version/nonprivileged flags rejected target")
        return {
            "database": db,
            "role": user,
            "superuser": su,
            "bypassrls": bypass,
            "createdb": create_db,
            "createrole": create_role,
            "major_version": 16,
        }
    except Refused:
        raise
    except Exception:
        raise Refused("Independent database connection preflight failed") from None


def explicit_url(key: str, port: int, path: str) -> str:
    value = required(key)
    parsed = urlsplit(value)
    if (
        parsed.scheme != "http"
        or parsed.hostname != "127.0.0.1"
        or parsed.port != port
        or parsed.path.rstrip("/") != path
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
    ):
        raise Refused(f"Independent loopback endpoint guard rejected {key}")
    return value.rstrip("/")


def browser_preflight() -> None:
    base = explicit_url("E2E_BASE_URL", 59260, "")
    explicit_url("E2E_GATEWAY_URL", 58110, "/api/v1")
    explicit_url("E2E_GATEWAY", 58110, "/api/v1")
    explicit_url("E2E_IAM_LOGIN_URL", 58110, "/api/v1/iam/auth/login")
    try:
        with urlopen(base, timeout=5) as response:
            if response.status != 200:
                raise Refused("Existing independent preview is not ready")
    except Exception:
        raise Refused(
            "Existing independent preview is not ready; this entry will not start it"
        ) from None
    for key, expected in {
        "PGHOST": "127.0.0.1",
        "PGPORT": "55493",
        "PGDATABASE": "codex_builder_ontology",
        "PGUSER": "builder_app",
    }.items():
        if required(key) != expected:
            raise Refused(f"Independent browser-source target guard rejected {key}")
    required("PGPASSWORD")


def identities_json(path: Path) -> set[tuple[str, str]]:
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    result: set[tuple[str, str]] = set()

    def add(file: str, title: str) -> None:
        identity = (Path(file.replace("\\", "/")).name, title)
        if identity in result:
            raise Refused("Duplicate collected browser identity")
        result.add(identity)

    if "cases" in payload:
        for case in payload["cases"]:
            add(case["file"], case["title"])
        return result

    def walk(suites: list[dict], parents: tuple[str, ...] = (), depth: int = 0) -> None:
        for suite in suites:
            title = suite.get("title", "")
            title_parts = Path(title.replace("\\", "/")).parts
            file_parts = Path(suite.get("file", "").replace("\\", "/")).parts
            # Playwright's JSON root wraps each file. Exclude that file label,
            # then retain every describe title, including nested/same-leaf suites.
            file_wrapper = (
                depth == 0 and bool(title_parts) and file_parts[-len(title_parts) :] == title_parts
            )
            lineage = parents if file_wrapper or not title else (*parents, title)
            for spec in suite.get("specs", []):
                for _test in spec.get("tests", []):
                    add(
                        spec.get("file", suite.get("file", "")),
                        " › ".join((*lineage, spec["title"])),
                    )
            walk(suite.get("suites", []), lineage, depth + 1)

    walk(payload["suites"])
    return result


def junit_summary(path: Path) -> tuple[dict, set[tuple[str, str]]]:
    cases = list(ET.parse(path).getroot().iter("testcase"))
    totals = {
        "tests": len(cases),
        "failures": sum(c.find("failure") is not None for c in cases),
        "errors": sum(c.find("error") is not None for c in cases),
        "skipped": sum(c.find("skipped") is not None for c in cases),
    }
    identities = {
        (Path(c.get("classname", "").replace("\\", "/")).name, c.get("name", "")) for c in cases
    }
    return totals, identities


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("preflight", "postgres", "core", "migration", "builder"))
    parser.add_argument(
        "--source-commit",
        required=True,
        help="Last reviewed implementation commit; receipts use a separate commit",
    )
    parser.add_argument(
        "--node", type=Path, help="Prepared official Node 22 executable; no global fallback"
    )
    parser.add_argument("--pnpm", type=Path, help="Prepared pnpm.cjs entrypoint")
    args = parser.parse_args()
    # Permit only evidence/repro edits after the reviewed implementation source.
    source = git("rev-parse", args.source_commit + "^{commit}")
    changed = git("diff", "--name-only", source).splitlines()
    allowed = ("docs/acceptance/", "scripts/ci/run_builder_v2_validation.")
    untracked = git("ls-files", "--others", "--exclude-standard").splitlines()
    if any(
        not p.startswith(allowed) and not accepted_plan_bookkeeping(source, p)
        for p in changed + untracked
    ):
        raise Refused("Current tree differs from reviewed source outside acceptance/repro paths")
    if sys.version_info[:2] != (3, 12):
        raise Refused("Use the locked workspace Python 3.12")
    dsn = required("PG_DSN")
    if required("VER_PG_DSN") != dsn:
        raise Refused("PG_DSN and VER_PG_DSN must select the same independent regression target")
    owned_container()
    identity = database_identity(dsn, "metaplatform_ont_test", "mate_ont_test")
    if args.mode == "preflight":
        print(
            json.dumps(
                {"source_commit": source, "owned_target_verified": True, "database": identity}
            )
        )
        return 0
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
    work = PRIVATE_ROOT / stamp
    if (
        subprocess.run(
            ["git", "check-ignore", "-q", str(work / "private.log")], cwd=ROOT
        ).returncode
        != 0
    ):
        raise Refused("Raw-output path is not Git ignored")
    work.mkdir(parents=True, exist_ok=False)
    record = {
        "source_commit": source,
        "checkout_head": git("rev-parse", "HEAD"),
        "date_utc": stamp,
        "mode": args.mode,
        "owned_target_verified": True,
        "database": identity,
        "source_tree": git("rev-parse", source + "^{tree}"),
        "commands": [],
        "sources_before": fingerprint(),
        "evidence_kind": "local current-source execution; no CI/deployment/GA claim",
    }
    env = os.environ.copy()
    env.pop("CI", None)
    env.pop("PYTEST_ADDOPTS", None)
    report = work / "results.xml"

    def run(command: list[str], cwd: Path = ROOT) -> int:
        record["commands"].append({"argv": command, "cwd": str(cwd)})
        with (work / "private.log").open("a", encoding="utf-8") as stream:
            return subprocess.run(
                command, cwd=cwd, env=env, stdout=stream, stderr=subprocess.STDOUT
            ).returncode

    if args.mode == "postgres":
        code = run([sys.executable, "scripts/ci/verify_ont_postgres.py", "--junit", str(report)])
    else:
        browser_preflight()
        from psycopg2.extensions import make_dsn

        browser_dsn = make_dsn(
            host=env["PGHOST"],
            port=env["PGPORT"],
            dbname=env["PGDATABASE"],
            user=env["PGUSER"],
            password=env["PGPASSWORD"],
        )
        record["browser_database"] = database_identity(
            browser_dsn, "codex_builder_ontology", "builder_app"
        )
        if not args.node or not args.pnpm or not args.node.is_file() or not args.pnpm.is_file():
            raise Refused("Browser modes require explicit prepared Node22 and pnpm paths")
        if (
            not subprocess.check_output([str(args.node), "--version"], text=True)
            .strip()
            .startswith("v22.")
        ):
            raise Refused("Browser modes require Node 22")
        env["PATH"] = str(args.node.resolve().parent) + os.pathsep + env.get("PATH", "")
        env["VITE_BACKEND_PORT"] = "58110"
        config = {
            "core": "playwright.config.ts",
            "migration": "playwright.migration.config.ts",
            "builder": "playwright.builder.config.ts",
        }[args.mode]
        # Runtime-only config removes even the original config's possible webServer
        # lifecycle. It preserves the test selection/assertions and original modes.
        generated = work / "playwright.config.ts"
        generated.write_text(
            "import config from "
            + json.dumps((FRONTEND / config).as_posix())
            + ";\nexport default { ...config, webServer: undefined, outputDir: "
            + json.dumps((work / "artifacts").as_posix())
            + " };\n",
            encoding="utf-8",
        )
        command = [
            str(args.node),
            str(args.pnpm),
            "exec",
            "playwright",
            "test",
            "--config",
            str(generated),
        ]
        # Relative testDir must continue to resolve to the source workspace.
        text = generated.read_text().replace(
            "webServer: undefined,",
            "webServer: undefined, testDir: "
            + json.dumps(
                (
                    FRONTEND / ("tests/e2e" if args.mode == "core" else "apps/web/tests/e2e")
                ).as_posix()
            )
            + ",",
        )
        generated.write_text(text, encoding="utf-8")
        if args.mode == "core":
            command += ["--project=ontology-loop-core"]
        listed = work / "collection.json"
        env["PLAYWRIGHT_JSON_OUTPUT_NAME"] = str(listed)
        code = run([*command, "--list", "--reporter=json"], FRONTEND)
        required_cases = identities_json(listed) if code == 0 else set()
        if len(required_cases) != EXPECTED[args.mode]:
            raise Refused("Exact required browser collection failed; see ignored local diagnostics")
        env["PLAYWRIGHT_JUNIT_OUTPUT_FILE"] = str(report)
        code = run([*command, "--workers=1", "--reporter=list,junit"], FRONTEND)
        record["collection"] = [{"file": f, "title": t} for f, t in sorted(required_cases)]
    if report.exists():
        totals, executed = junit_summary(report)
        record["results"] = totals
        record["junit_sha256"] = hashlib.sha256(report.read_bytes()).hexdigest()
        if args.mode != "postgres" and (
            executed != required_cases or totals["tests"] != EXPECTED[args.mode]
        ):
            code = 1
        if any(totals[k] for k in ("failures", "errors", "skipped")):
            code = 1
    else:
        code = 1
    record["sources_after"] = fingerprint()
    record["source_unchanged"] = record["sources_before"] == record["sources_after"]
    if not record["source_unchanged"]:
        code = 1
    record["exit_code"] = code
    (work / "safe-receipt.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, indent=2))
    return code


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Refused as exc:
        print("Validation refused: " + str(exc), file=sys.stderr)
        raise SystemExit(2) from None
    except Exception:
        print(
            "Validation failed before a safe receipt could be completed; inspect private inputs locally.",
            file=sys.stderr,
        )
        raise SystemExit(2) from None
