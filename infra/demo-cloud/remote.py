"""Use the approved deployment key with strict host verification for SSH transfers."""

from __future__ import annotations

import argparse
import shlex
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", required=True)
    parser.add_argument("--user", default="ubuntu")
    actions = parser.add_subparsers(dest="action", required=True)
    execute = actions.add_parser("exec")
    execute.add_argument("command")
    upload = actions.add_parser("upload")
    upload.add_argument("source", type=Path)
    upload.add_argument("destination")
    args = parser.parse_args()
    git_ssh = Path("C:/Program Files/Git/usr/bin/ssh.exe")
    binary = str(git_ssh) if git_ssh.exists() else shutil.which("ssh")
    if not binary:
        raise SystemExit("OpenSSH is required on the build machine.")
    private = HERE / "private/ssh"
    command = [
        binary,
        "-i",
        str(private / "deploy"),
        "-o",
        f"UserKnownHostsFile={private / 'known_hosts'}",
        "-o",
        "StrictHostKeyChecking=yes",
        "-o",
        "BatchMode=yes",
        "-o",
        "IdentitiesOnly=yes",
        "-o",
        "ConnectTimeout=10",
        f"{args.user}@{args.host}",
    ]
    if args.action == "exec":
        result = subprocess.run([*command, args.command])
    else:
        if not args.destination.startswith("/home/ubuntu/metaplatform-demo-"):
            raise SystemExit("Upload destination must stay inside the named demo directory.")
        with args.source.open("rb") as stream:
            result = subprocess.run(
                [*command, "umask 077; cat > " + shlex.quote(args.destination)], stdin=stream
            )
        if result.returncode == 0:
            print(f"Uploaded {args.source.name} ({args.source.stat().st_size} bytes).", flush=True)
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
