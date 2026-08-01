"""G2 batch validator — runs all forbid_*.py + require_evidence.py.

Walks the repo, applies each hook's file pattern, invokes the hook
with the matching file list (chunked to avoid command-line length
limits on Windows), and prints a summary.

Exit non-zero if any hook fails.
"""
from __future__ import annotations

import fnmatch
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
HOOKS = [
    {
        "name": "forbid_raw_sql (rule 3)",
        "entry": "scripts/ci/forbid_raw_sql.py",
        "pattern": "mate-platform-backend/**/src/**/*.py",
        "exclude_re": re.compile(r"__pycache__|\.venv|node_modules"),
    },
    {
        "name": "forbid_bare_httpx (rule 4)",
        "entry": "scripts/ci/forbid_bare_httpx.py",
        "pattern": "mate-platform-backend/**/src/**/*.py",
        "exclude_re": re.compile(r"__pycache__|\.venv|node_modules"),
    },
    {
        "name": "forbid_skip_tests (rule 7)",
        "entry": "scripts/ci/forbid_skip_tests.py",
        "pattern": "mate-platform-backend/**/tests/**/*.py",
        "exclude_re": re.compile(r"__pycache__|\.venv|node_modules"),
    },
    {
        "name": "forbid_legacy_fallback (rule 5)",
        "entry": "scripts/ci/forbid_legacy_fallback.py",
        "pattern": None,  # pass_filenames: false
        "exclude_re": None,
    },
    {
        "name": "require_evidence (rule 10)",
        "entry": "scripts/ci/require_evidence.py",
        "pattern": None,  # pass_filenames: false
        "exclude_re": None,
    },
]
CHUNK_SIZE = 50  # files per invocation; avoids Win ERROR_FILENAME_EXCED_RANGE


def collect(pattern: str | None, exclude_re: re.Pattern[str] | None) -> list[str]:
    if pattern is None:
        return []
    files = [
        str(p).replace("\\", "/")
        for p in REPO_ROOT.glob(pattern)
        if p.is_file()
        and (exclude_re is None or not exclude_re.search(str(p)))
    ]
    return sorted(files)


def run_hook(hook: dict, files: list[str]) -> int:
    print(f"\n=== {hook['name']} ===", flush=True)
    if not files:
        # pass_filenames: false hook
        cmd = ["python", hook["entry"]]
        r = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
        if r.stdout:
            print(r.stdout[-800:])
        if r.stderr:
            print(r.stderr[-800:])
        print(f"exit: {r.returncode}")
        return r.returncode

    total_rc = 0
    for i in range(0, len(files), CHUNK_SIZE):
        chunk = files[i : i + CHUNK_SIZE]
        cmd = ["python", hook["entry"], *chunk]
        r = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
        if r.returncode != 0:
            if r.stdout:
                print(r.stdout[-1500:])
            if r.stderr:
                print(r.stderr[-800:])
            print(f"chunk {i//CHUNK_SIZE + 1} exit: {r.returncode}")
            total_rc = r.returncode
            break  # fail fast
    if total_rc == 0:
        print(f"OK ({len(files)} files scanned)")
    return total_rc


def main() -> int:
    print(f"G2 batch validator — repo root: {REPO_ROOT}", flush=True)
    overall = 0
    for hook in HOOKS:
        files = collect(hook["pattern"], hook["exclude_re"])
        rc = run_hook(hook, files)
        if rc != 0:
            overall = rc
    print(f"\n=== G2 summary: {'PASS' if overall == 0 else 'FAIL'} ===", flush=True)
    return overall


if __name__ == "__main__":
    raise SystemExit(main())
