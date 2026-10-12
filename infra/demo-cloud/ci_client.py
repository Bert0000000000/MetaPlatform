"""Transfer a verified source bundle and wait for the detached server release worker."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
import time
from pathlib import Path

from ci_gate import current_main

STATUS_TIMEOUT = 120
UPLOAD_TIMEOUT = 900


def invoke(ssh, command, input_file=None):
    result = subprocess.run(
        [*ssh, command],
        stdin=input_file,
        capture_output=True,
        text=True,
        check=True,
        timeout=UPLOAD_TIMEOUT if input_file is not None else STATUS_TIMEOUT,
    )
    return json.loads(result.stdout)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--operation", choices=("deploy", "rollback"), default="deploy")
    parser.add_argument(
        "--manifest", type=Path, default=Path("infra/demo-cloud/artifacts/bundle-manifest.json")
    )
    args = parser.parse_args()
    host = os.environ["DEMO_SSH_HOST"]
    user = os.environ["DEMO_SSH_USER"]
    port = os.environ.get("DEMO_SSH_PORT", "22")
    if not re.fullmatch(r"[a-zA-Z0-9.-]+", host) or not re.fullmatch(r"[a-z_][a-z0-9_-]*", user):
        parser.error("Invalid SSH host or user")
    if not port.isdigit() or not 1 <= int(port) <= 65535:
        parser.error("Invalid SSH port")
    manifest = (
        json.loads(args.manifest.read_text(encoding="utf-8"))
        if args.operation == "deploy"
        else None
    )
    if manifest:
        revision = manifest["source_revision"]
        if not re.fullmatch(r"[0-9a-f]{40}", revision):
            parser.error("Bundle must identify a full commit SHA")
        if current_main(os.environ["GITHUB_REPOSITORY"]) != revision:
            print("main advanced; superseded deployment skipped.")
            return
        entry = manifest["files"][0]
        if Path(entry["name"]).name != entry["name"]:
            parser.error("Unsafe bundle filename")
        bundle = args.manifest.parent / entry["name"]
        if hashlib.sha256(bundle.read_bytes()).hexdigest() != entry["sha256"]:
            parser.error("Bundle hash mismatch")

    with tempfile.TemporaryDirectory(prefix="metaplatform-ci-") as directory:
        key = Path(directory) / "identity"
        key.write_text(os.environ["DEMO_SSH_KEY"].strip() + "\n", encoding="utf-8")
        key.chmod(0o600)
        known_hosts = Path(directory) / "known_hosts"
        known_hosts.write_text(os.environ["DEMO_SSH_KNOWN_HOSTS"].strip() + "\n", encoding="utf-8")
        ssh = [
            os.environ.get("DEMO_SSH_BIN", "ssh"),
            "-T",
            "-i",
            str(key),
            "-p",
            port,
            "-o",
            "BatchMode=yes",
            "-o",
            "IdentitiesOnly=yes",
            "-o",
            "StrictHostKeyChecking=yes",
            "-o",
            "UserKnownHostsFile=" + str(known_hosts),
            "-o",
            "ConnectTimeout=20",
            "-o",
            "ServerAliveInterval=30",
            user + "@" + host,
        ]

        deadline = time.monotonic() + 4200
        while True:
            if manifest:
                # Check again after waiting for a previous detached worker.
                if current_main(os.environ["GITHUB_REPOSITORY"]) != revision:
                    print("main advanced; superseded deployment skipped.")
                    return
                print(
                    f"Uploading {bundle.stat().st_size} bytes; transfer budget {UPLOAD_TIMEOUT}s.",
                    flush=True,
                )
                started = time.monotonic()
                with bundle.open("rb") as source:
                    response = invoke(ssh, f"release {revision} {entry['sha256']}", source)
                print(
                    f"Upload request completed in {time.monotonic() - started:.1f}s: "
                    + response["status"],
                    flush=True,
                )
            else:
                response = invoke(ssh, "rollback")
            if response["status"] != "busy":
                break
            if time.monotonic() > deadline:
                raise SystemExit("Another release is still running; deployment not started.")
            time.sleep(30)
        if response["status"] != "running":
            raise SystemExit("Server did not accept the release: " + response["status"])
        revision = response["revision"]
        print(f"Server is deploying {revision}; worker survives SSH disconnection.", flush=True)
        while time.monotonic() < deadline:
            response = invoke(ssh, "status " + revision)
            if response["status"] != "running":
                print(json.dumps(response, indent=2))
                output = Path("infra/demo-cloud/artifacts/deploy-result.json")
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_text(json.dumps(response, indent=2), encoding="utf-8")
                if response["status"] != "success":
                    raise SystemExit("Deployment failed; inspect the recorded rollback result.")
                return
            time.sleep(30)
        raise SystemExit("Server worker still running; inspect its status before retrying.")


if __name__ == "__main__":
    main()
