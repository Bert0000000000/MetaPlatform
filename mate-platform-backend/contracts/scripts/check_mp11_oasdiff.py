"""Re-run oasdiff using only explicitly reviewed, fully pinned MP11 errors.

This is a standalone check, not a workflow or an approval command. Zero-error
comparisons never use the MP11 manifest. The original eight ADR-0082 lines stay
independent and unchanged. Exit 0 comes only from a successful oasdiff run.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import yaml

TOOL_VERSION = "1.33.0"
WINDOWS_TOOL_SHA = "f450465c0f4bd35ec49ba35b436820730843c5b21b5499e618963803bd8da919"
LEGACY_FILE = "mate-platform-backend/contracts/openapi/oasdiff-r1-approved-errors.txt"
LEGACY_SHA = "661058b35062d8fea8f9f2828db708cd14f40a5d39b08ff0a560d7722230f2af"
BASE_COMMIT = "303d3ca69cbe0d4f817cf2f4ca3294c8c9f0b7e5"
BASE_SEMANTIC_SHA = "e6dae4caadfff0a60ff56b3227c3a65b7a86ad71c7aa011b0f3b4a8b55fa4631"
REVISION_SEMANTIC_SHA = "13f56a35c64e1548140fce55f1f235760026d98265414cd3073f34a7d7e910ee"
ANNOTATIONS = {"description", "summary", "title", "example", "examples", "externalDocs"}
NAME_MAPS = {
    "properties",
    "schemas",
    "securitySchemes",
    "paths",
    "responses",
    "definitions",
    "$defs",
}
METHODS = {"get", "post", "put", "patch", "delete", "head", "options"}
SYMBOL_NODES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)


class ReviewFailure(Exception):
    def __init__(self, reason: str, detail: str):
        self.reason = reason
        super().__init__(detail)


def reject(reason, detail):
    raise ReviewFailure(reason, detail)


class UniqueKeyLoader(yaml.SafeLoader):
    """Never silently replace a duplicate key in a spec or review record."""


def unique_mapping(loader, node, deep=False):
    loader.flatten_mapping(node)
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in result:
            reject("duplicate-yaml-key", f"Duplicate YAML key: {key!r}")
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


UniqueKeyLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)


def read_yaml(path):
    loader = UniqueKeyLoader(path.read_text(encoding="utf-8"))
    try:
        return loader.get_single_data()
    finally:
        loader.dispose()


def normalize(value, parent=""):
    """The existing audit recipe; preserve names such as a property 'summary'."""
    if isinstance(value, list):
        return [normalize(item, parent) for item in value]
    if not isinstance(value, dict):
        return value
    result = {
        key: normalize(item, key)
        for key, item in value.items()
        if parent in NAME_MAPS or key not in ANNOTATIONS
    }
    branches = result.get("anyOf")
    if (
        isinstance(branches, list)
        and len(branches) == 2
        and "type" not in result
        and all(
            isinstance(branch, dict) and set(branch) == {"type"} and isinstance(branch["type"], str)
            for branch in branches
        )
    ):
        result["type"] = sorted({branch["type"] for branch in branches})
        del result["anyOf"]
    if isinstance(result.get("type"), list):
        result["type"] = sorted(result["type"])
    return result


def semantic_sha(value):
    serialized = json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def local_pointer(doc, ref):
    if not isinstance(ref, str) or not ref.startswith("#/"):
        reject("external-reference", "Only bundled, local OpenAPI references are permitted.")
    current = doc
    for token in ref[2:].split("/"):
        current = current[token.replace("~1", "/").replace("~0", "~")]
    return current


def expanded(value, doc, seen=frozenset()):
    if isinstance(value, list):
        return [expanded(item, doc, seen) for item in value]
    if not isinstance(value, dict):
        return value
    if "$ref" in value:
        ref = value["$ref"]
        target = local_pointer(doc, ref)
        if ref in seen:
            return {"$recursiveRef": ref}
        result = expanded(target, doc, seen | {ref})
        if len(value) > 1:
            result = {
                **result,
                **expanded({key: item for key, item in value.items() if key != "$ref"}, doc, seen),
            }
        return result
    return {key: expanded(item, doc, seen) for key, item in value.items()}


def operation_index(doc):
    pairs, ids = {}, set()
    for path, item in doc["paths"].items():
        for method, operation in item.items():
            if method not in METHODS:
                continue
            operation_id = operation["operationId"]
            if operation_id in ids:
                reject("duplicate-operation-id", f"Duplicate operationId: {operation_id}")
            ids.add(operation_id)
            pairs[(method.upper(), path)] = (method.upper(), path, operation, item)
    return pairs


def operation_sha(entry, doc):
    method, path, operation, item = entry
    return semantic_sha(
        normalize(
            expanded(
                {
                    "method": method,
                    "path": path,
                    "operation": operation,
                    "pathParameters": item.get("parameters", []),
                    "effectiveSecurity": operation.get("security", doc.get("security", [])),
                },
                doc,
            )
        )
    )


def diagnostic_key(row, *, manifest=False):
    if manifest:
        return (
            row["method"],
            row["basePath"],
            row["id"],
            row["fingerprint"],
            row["exactDiagnostic"],
            row["operationId"],
        )
    return (
        row["operation"],
        row["path"],
        row["id"],
        row["fingerprint"],
        f"{row['operation']} {row['path']} {row['text']}",
        row["operationId"],
    )


def run_oasdiff(args, directory, config, ignore, report):
    command = [
        str(args.oasdiff),
        "breaking",
        str(args.base),
        str(args.revision),
        "--fail-on",
        "ERR",
        "--allow-external-refs=false",
        "-f",
        "json",
        "--config",
        str(config),
        "--err-ignore",
        str(ignore),
    ]
    env = {key: value for key, value in os.environ.items() if key != "OASDIFF_CONFIG"}
    report["toolRuns"] += 1
    result = subprocess.run(
        command, cwd=directory, env=env, capture_output=True, text=True, timeout=60, check=False
    )
    if result.returncode not in (0, 1) or result.stderr.strip():
        reject("tool-failed", "oasdiff did not complete a clean comparison.")
    rows = json.loads(result.stdout) or []
    if not isinstance(rows, list) or any(row["level"] not in (1, 2, 3) for row in rows):
        reject("invalid-tool-output", "oasdiff returned an unsupported diagnostic format.")
    errors = [row for row in rows if row["level"] == 3]
    if result.returncode != int(bool(errors)):
        reject("invalid-tool-output", "oasdiff exit status disagrees with its error diagnostics.")
    return result.returncode, rows, errors


def validate_tool(args, report):
    actual_sha = hashlib.sha256(args.oasdiff.read_bytes()).hexdigest()
    if not re.fullmatch(r"[0-9a-f]{64}", args.oasdiff_sha256) or actual_sha != args.oasdiff_sha256:
        reject(
            "tool-pin-mismatch", "The executable does not match the independently pinned SHA256."
        )
    result = subprocess.run(
        [str(args.oasdiff), "--version"], capture_output=True, text=True, timeout=10, check=False
    )
    if (
        result.returncode
        or result.stderr.strip()
        or not re.search(rf"\boasdiff\s+(?:version\s+)?{re.escape(TOOL_VERSION)}\b", result.stdout)
    ):
        reject("tool-version-mismatch", f"Expected oasdiff {TOOL_VERSION}.")
    report.update(toolVersion=TOOL_VERSION, toolSha256=actual_sha)


def legacy_text(args, report):
    path = args.legacy_ignore or args.repo_root / LEGACY_FILE
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    actual_sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
    if actual_sha != LEGACY_SHA or len(text.splitlines()) != 8:
        reject("legacy-approval-drift", "The original eight ADR-0082 approvals changed.")
    report["legacyApprovalSha256"] = actual_sha
    return text


def validate_manifest(manifest, errors):
    if manifest["formatVersion"] != 1:
        reject("manifest-shape", "Unsupported review manifest version.")
    rows = manifest["diagnostics"]
    approved_errors = [row for row in rows if row["severity"] == "ERR"]
    warnings = [row for row in rows if row["severity"] == "WARN"]
    if (
        len(approved_errors) != 270
        or len(warnings) != 37
        or len(rows) != 307
        or manifest["summary"]["errors"] != 270
        or manifest["summary"]["warnings"] != 37
    ):
        reject("manifest-shape", "This audit covers exactly 270 ERR and 37 WARN diagnostics.")
    keys = {diagnostic_key(row, manifest=True): row for row in approved_errors}
    actual_keys = {diagnostic_key(row) for row in errors}
    if len(keys) != 270 or len(actual_keys) != len(errors):
        reject("manifest-shape", "Duplicate error identities are not permitted.")
    if actual_keys != set(keys):
        reject("unknown-diagnostic", "The actual ERR set is not the exact audited ERR set.")
    if any(
        row["reviewDecision"] != "approved" or row["ignoreEnabled"] is not True
        for row in approved_errors
    ):
        reject(
            "pending-review", "Every matched ERR needs explicit approval and ignoreEnabled=true."
        )
    if any(row["ignoreEnabled"] is not False for row in warnings):
        reject("manifest-shape", "WARN entries cannot become ERR ignore rules.")
    if (
        manifest["tool"]["name"] != "oasdiff"
        or manifest["tool"]["version"] != TOOL_VERSION
        or manifest["tool"]["binarySha256"] != WINDOWS_TOOL_SHA
        or manifest["legacyApproval"]["file"] != LEGACY_FILE
        or manifest["legacyApproval"]["lineCount"] != 8
        or manifest["legacyApproval"]["normalizedTextSha256"] != LEGACY_SHA
    ):
        reject("manifest-pin-mismatch", "The historical tool or legacy approval pins changed.")
    return approved_errors


def validate_specs(manifest, base, revision, report):
    hashes = [semantic_sha(normalize(doc)) for doc in (base, revision)]
    if (
        manifest["baseline"]["commit"] != BASE_COMMIT
        or hashes != [BASE_SEMANTIC_SHA, REVISION_SEMANTIC_SHA]
        or hashes
        != [manifest["baseline"]["semanticSha256"], manifest["revision"]["semanticSha256"]]
    ):
        reject(
            "bundle-hash-drift", "The baseline or revision bundle left the reviewed semantic pair."
        )
    indexes = [operation_index(doc) for doc in (base, revision)]
    checked = set()
    for row in manifest["diagnostics"]:
        for side, doc, index, path_key, hash_key in (
            ("baseline", base, indexes[0], "basePath", "baselineOperationSemanticSha256"),
            ("revision", revision, indexes[1], "revisionPath", "revisionOperationSemanticSha256"),
        ):
            key = (side, row["method"], row[path_key], row["operationId"], row[hash_key])
            if key in checked:
                continue
            entry = index.get((row["method"], row[path_key]))
            if (
                entry is None
                or entry[2]["operationId"] != row["operationId"]
                or operation_sha(entry, doc) != row[hash_key]
            ):
                reject(
                    "operation-hash-drift", "An audited operation or its referenced schema changed."
                )
            checked.add(key)
    report.update(baselineSemanticSha256=hashes[0], revisionSemanticSha256=hashes[1])


def source_symbols(source):
    symbols = {}
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, SYMBOL_NODES):
            symbols.setdefault(node.name, []).append(node)
    return symbols


def validate_sources(manifest, repo_root, report):
    groups = manifest["evidenceGroups"]
    if len(groups) != 13 or any(
        row["evidenceRef"] not in groups for row in manifest["diagnostics"]
    ):
        reject("manifest-shape", "The thirteen reviewed evidence groups must remain available.")
    git = shutil.which("git")
    if git is None:
        reject("source-hash-drift", "Git is required to verify the fixed baseline source.")
    cache, checked = {}, set()
    for group in groups.values():
        if not group["sourceEvidence"]:
            reject("manifest-shape", "An evidence group cannot omit its source symbols.")
        for evidence in group["sourceEvidence"]:
            relative = evidence["path"]
            path = (repo_root / relative).resolve()
            if Path(relative).is_absolute() or not path.is_relative_to(repo_root):
                reject(
                    "source-hash-drift", "Source evidence must stay inside the selected repository."
                )
            for side in ("baseline", "revision"):
                cache_key = (side, relative)
                if cache_key not in cache:
                    if side == "baseline":
                        result = subprocess.run(
                            [git, "show", f"{BASE_COMMIT}:{relative}"],
                            cwd=repo_root,
                            capture_output=True,
                            timeout=20,
                            check=True,
                        )
                        source = result.stdout.decode("utf-8")
                    else:
                        source = path.read_text(encoding="utf-8")
                    cache[cache_key] = source_symbols(source)
                nodes = cache[cache_key].get(evidence["symbol"], [])
                if (
                    len(nodes) != 1
                    or hashlib.sha256(
                        ast.dump(nodes[0], include_attributes=False).encode("utf-8")
                    ).hexdigest()
                    != evidence[side]["astSha256"]
                ):
                    reject("source-hash-drift", "A reviewed source symbol changed or is ambiguous.")
            checked.add((relative, evidence["symbol"]))
    if len(checked) != 50:
        reject("manifest-shape", "The fifty distinct reviewed source symbols must remain pinned.")
    report["checkedSourceSymbols"] = len(checked)


def check(args, report):
    validate_tool(args, report)
    old_text = legacy_text(args, report)
    base, revision = read_yaml(args.base), read_yaml(args.revision)
    # Resolve before invoking the tool: invalid or external references fail closed.
    expanded(base, base)
    expanded(revision, revision)
    with tempfile.TemporaryDirectory(prefix="mp11-oasdiff-") as temporary:
        directory = Path(temporary)
        config = directory / "config.yaml"
        config.write_text("{}\n", encoding="utf-8")
        legacy = directory / "legacy.txt"
        legacy.write_text(old_text, encoding="utf-8", newline="\n")
        raw_exit, raw_rows, errors = run_oasdiff(args, directory, config, legacy, report)
        report.update(rawExitCode=raw_exit, rawErrors=len(errors))
        if not errors:
            report.update(
                remainingErrors=0,
                remainingWarnings=sum(row["level"] == 2 for row in raw_rows),
            )
            return
        manifest = read_yaml(args.manifest)
        approved_errors = validate_manifest(manifest, errors)
        validate_specs(manifest, base, revision, report)
        validate_sources(manifest, args.repo_root, report)
        lines = [row["exactDiagnostic"] for row in approved_errors]
        if len(set(lines)) != 270 or any("\n" in line or "\r" in line for line in lines):
            reject(
                "manifest-shape", "The exact ignore lines must be unique single-line diagnostics."
            )
        reviewed = directory / "reviewed-exact-errors.txt"
        reviewed.write_text(old_text + "\n".join(lines) + "\n", encoding="utf-8", newline="\n")
        reviewed_exit, remaining, remaining_errors = run_oasdiff(
            args, directory, config, reviewed, report
        )
        report.update(
            auditApplied=True,
            reviewedExitCode=reviewed_exit,
            ignoredReviewedErrors=len(approved_errors),
            remainingErrors=len(remaining_errors),
            remainingWarnings=sum(row["level"] == 2 for row in remaining),
        )
        if reviewed_exit or remaining_errors:
            reject(
                "reviewed-tool-failed",
                "The exact approvals did not pass the original oasdiff check.",
            )
        expected_warnings = [row for row in raw_rows if row["level"] != 3]
        if remaining != expected_warnings:
            reject(
                "unexpected-filtering", "The ERR ignore file changed diagnostics outside its scope."
            )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, required=True)
    parser.add_argument("--revision", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--oasdiff", type=Path, required=True)
    parser.add_argument("--oasdiff-sha256", default=WINDOWS_TOOL_SHA)
    parser.add_argument("--legacy-ignore", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args(argv)
    for name in ("base", "revision", "manifest", "repo_root", "oasdiff", "legacy_ignore"):
        value = getattr(args, name)
        if value is not None:
            setattr(args, name, value.resolve())
    report = {"toolRuns": 0, "auditApplied": False}
    exit_code = 0
    try:
        check(args, report)
        report["status"] = "passed"
    except ReviewFailure as error:
        report.update(status="blocked", failure=error.reason, detail=str(error))
        exit_code = 1
    except (
        OSError,
        ValueError,
        KeyError,
        TypeError,
        yaml.YAMLError,
        RecursionError,
        subprocess.SubprocessError,
    ) as error:
        # Do not print raw subprocess arguments or source data in failures.
        report.update(
            status="blocked", failure="invalid-input-or-tool", detail=type(error).__name__
        )
        exit_code = 2
    output = json.dumps(report, ensure_ascii=True, sort_keys=True, indent=2) + "\n"
    if args.report:
        args.report.write_text(output, encoding="utf-8", newline="\n")
    print(output, end="")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
