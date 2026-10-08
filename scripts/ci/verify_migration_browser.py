"""Reject absent/skipped migration browser cases in Playwright list/JUnit."""

import argparse
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SPEC = "ontology-migration-plan.spec.ts"
EXPECTED = 2


def listed_tests(suites: list[dict]) -> list[dict]:
    tests = []
    for suite in suites:
        for spec in suite.get("specs", []):
            if Path(spec.get("file", suite.get("file", ""))).name == SPEC:
                tests.extend(spec.get("tests", []))
        tests.extend(listed_tests(suite.get("suites", [])))
    return tests


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--list", type=Path)
    group.add_argument("--junit", type=Path)
    args = parser.parse_args()
    try:
        if args.list:
            tests = listed_tests(json.loads(args.list.read_text(encoding="utf-8-sig"))["suites"])
            if len(tests) != EXPECTED:
                raise ValueError(
                    f"Expected {EXPECTED} collected migration cases, found {len(tests)}"
                )
            print(f"Migration browser collection: {EXPECTED} required cases")
        else:
            cases = list(ET.parse(args.junit).getroot().iter("testcase"))
            if len(cases) != EXPECTED or any(
                SPEC not in case.get("classname", "") for case in cases
            ):
                raise ValueError("JUnit must contain exactly both migration cases")
            if any(
                any(case.find(tag) is not None for tag in ("skipped", "failure", "error"))
                for case in cases
            ):
                raise ValueError("Migration JUnit contains skipped, failed or errored cases")
            print(f"Migration browser gate: {EXPECTED} executed, 0 skipped")
        return 0
    except (ValueError, KeyError, OSError, ET.ParseError) as exc:
        print(f"Migration browser gate FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
