"""Require precise safe Builder V2 collection and executed, zero-skip results."""

import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path

FILES = {
    "ontology-ia-v2-navigation.spec.ts",
    "ontology-builder-v2.spec.ts",
    "platform-builder-v2.spec.ts",
}
parser = argparse.ArgumentParser()
parser.add_argument("--list", type=Path, required=True)
parser.add_argument("--junit", type=Path)
args = parser.parse_args()
cases = json.loads(args.list.read_text(encoding="utf-8"))["cases"]
identities = {(c["file"], c["title"]) for c in cases}
assert len(identities) == len(cases), "Duplicate case identity"
assert {c["file"] for c in cases} == FILES, "Exact builder files were not collected"
assert all(c["project"] == "builder-v2" for c in cases), "Unexpected project"
assert len(cases) >= 21, "Builder inventory unexpectedly reduced"
assert (
    "ontology-builder-v2.spec.ts",
    "real Ont + own PG: editor WIP, five-step publication, saved source sync and actual sample query",
) in identities, "Real builder write chain was not collected"
if args.junit:
    root = ET.parse(args.junit).getroot()
    executed = list(root.iter("testcase"))
    actual = {(c.attrib["classname"], c.attrib["name"]) for c in executed}
    assert len(actual) == len(executed) == len(cases), "Duplicate or missing execution identity"
    assert actual == identities, "Execution differs from collection"
    assert not list(root.iter("skipped")), "Skipped required cases"
    assert not list(root.iter("failure")) and not list(root.iter("error")), "Failed builder cases"
    assert not list(root.iter("system-out")) and not list(root.iter("system-err")), (
        "Unsafe diagnostic payload"
    )
print(
    f"Builder browser audit: {len(cases)} exact identities"
    + (" executed; zero skips/failures" if args.junit else " collected")
)
