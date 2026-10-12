"""One-time, root-owned CI controller installation; preserves the live demo and other keys."""

from __future__ import annotations

import argparse
import json
import os
import pwd
import re
import shutil
import subprocess
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--public-key", type=Path, required=True)
    parser.add_argument("--baseline-revision", required=True)
    parser.add_argument("--user", default="ubuntu")
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.baseline_revision):
        parser.error("The verified baseline must use a full commit SHA")
    if os.geteuid() != 0:
        parser.error("Run the one-time installer with sudo")
    root = args.root.resolve(strict=True)
    app = root / "app"
    private = app / "infra/demo-cloud/private"
    environment = {}
    for row in (private / ".env").read_text(encoding="utf-8").splitlines():
        if row and not row.startswith("#"):
            key, value = row.split("=", 1)
            environment[key] = value
    project = environment["COMPOSE_PROJECT_NAME"]
    if (
        project != "metaplatform-demo"
        or not (app / "infra/demo-cloud/artifacts/acceptance-state.json").is_file()
    ):
        parser.error("The verified existing demo is required; this is not a fresh deployment")
    public_key = args.public_key.read_text(encoding="utf-8").strip()
    if not re.fullmatch(r"ssh-ed25519 [A-Za-z0-9+/=]+(?: [A-Za-z0-9_.-]+)?", public_key):
        parser.error("Expected one ed25519 public key")
    account = pwd.getpwnam(args.user)
    installed = Path("/usr/local/lib/metaplatform-demo-ci")
    installed.mkdir(mode=0o755, exist_ok=True)
    os.chown(installed, 0, 0)
    installed.chmod(0o755)
    shutil.copyfile(Path(__file__).with_name("ci_server.py"), installed / "ci_server.py")
    (installed / "ci_server.py").chmod(0o644)
    os.chown(installed / "ci_server.py", 0, 0)
    ci_base = root / "ci"
    ci_base.mkdir(mode=0o700, exist_ok=True)
    os.chown(ci_base, account.pw_uid, account.pw_gid)
    config = {
        "base": str(ci_base),
        "project": project,
        "private": str(private),
        "url": "http://127.0.0.1:" + environment["DEMO_HTTP_PORT"],
    }
    (installed / "config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
    (installed / "config.json").chmod(0o644)
    os.chown(installed / "config.json", 0, 0)
    state_path = ci_base / "state.json"
    if not state_path.exists():
        revision = (app / "infra/demo-cloud/artifacts/source-revision.txt").read_text().strip()
        if not args.baseline_revision.startswith(revision):
            parser.error("The baseline revision does not match the existing source")
        state = {
            "current": {
                "revision": args.baseline_revision,
                "path": str(app),
                "backend": environment["DEMO_BACKEND_IMAGE"],
                "frontend": environment["DEMO_FRONTEND_IMAGE"],
            },
            "previous": None,
        }
        state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
        state_path.chmod(0o600)
        os.chown(state_path, account.pw_uid, account.pw_gid)
    authorized = Path(account.pw_dir) / ".ssh/authorized_keys"
    authorized.parent.mkdir(mode=0o700, exist_ok=True)
    os.chown(authorized.parent, account.pw_uid, account.pw_gid)
    lines = authorized.read_text(encoding="utf-8").splitlines() if authorized.exists() else []
    key_value = public_key.split()[1]
    if not any(key_value in row.split() for row in lines):
        lines.append(
            'restrict,command="/usr/bin/python3 /usr/local/lib/metaplatform-demo-ci/ci_server.py" '
            + public_key
        )
        authorized.write_text("\n".join(lines) + "\n", encoding="utf-8")
    authorized.chmod(0o600)
    os.chown(authorized, account.pw_uid, account.pw_gid)
    fingerprint = subprocess.check_output(
        ["/usr/bin/ssh-keygen", "-lf", str(args.public_key)], text=True
    ).strip()
    print("Installed restricted demo CI access: " + fingerprint)


if __name__ == "__main__":
    main()
