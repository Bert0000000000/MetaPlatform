"""Change only the isolated demo's web bind address, port and allowed origin."""

from __future__ import annotations

import argparse
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind-address", choices=("127.0.0.1", "0.0.0.0"), required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--origin", required=True)
    args = parser.parse_args()
    origin = args.origin.rstrip("/")
    parsed = urlsplit(origin)
    if (
        not 1 <= args.port <= 65535
        or parsed.scheme not in ("http", "https")
        or not parsed.hostname
        or parsed.path
        or parsed.query
        or parsed.fragment
        or parsed.username
    ):
        parser.error("Provide a valid port and an HTTP(S) origin without path or credentials.")
    path = HERE / "private/.env"
    if not path.exists():
        raise SystemExit("Run prepare.py first.")
    changes = {
        "DEMO_BIND_ADDRESS": args.bind_address,
        "DEMO_HTTP_PORT": str(args.port),
        "DEMO_ORIGIN": origin,
    }
    lines = []
    for line in path.read_text(encoding="utf-8").splitlines():
        key = line.partition("=")[0]
        lines.append(f"{key}={changes.pop(key)}" if key in changes else line)
    lines += [f"{key}={value}" for key, value in changes.items()]
    temporary = path.with_name(".env.web-update")
    temporary.write_text("\n".join(lines) + "\n", encoding="utf-8")
    temporary.chmod(0o600)
    temporary.replace(path)
    print(
        f"Web configuration: {args.bind_address}:{args.port}, origin {origin}; apply with Compose up."
    )


if __name__ == "__main__":
    main()
