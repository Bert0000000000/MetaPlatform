"""Pre-commit hook for ADR-0015 rule 4.

Forbids bare `httpx.Client()` / `httpx.AsyncClient()` in app-* and
mate-platform / mate-clients source code; the platforms must go
through mate-clients.security.BearerAuth + OutgoingAuthMiddleware.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


# Match `httpx.Client(` or `httpx.AsyncClient(` in business code.
# Tests and client modules themselves are excluded by the caller
# (the hook is registered with `files:` regex that scopes to src/).
PATTERN = re.compile(r"""\bhttpx\.(Async)?Client\s*\(""")
EXCLUDE_FILES = {
    "clients.py",
    "llmgw_provider.py",
    "bearer.py",
    "outgoing.py",
    # Auth infrastructure that legitimately talks to the IDP directly:
    #   - identity.py: obtains client_credentials tokens (cannot use a Bearer
    #     token to fetch one).
    #   - jwks.py: fetches public JWKS keys for JWT verification (public
    #     endpoint, no Bearer required).
    "identity.py",
    "jwks.py",
}


def main() -> int:
    files = [Path(p) for p in sys.argv[1:]]
    bad: list[tuple[Path, int, str]] = []
    for f in files:
        if not f.is_file():
            continue
        if f.name in EXCLUDE_FILES:
            continue
        try:
            text = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            if PATTERN.search(line):
                bad.append((f, lineno, line.strip()))

    if bad:
        print("forbid_bare_httpx: rule 4 violation(s):")
        for f, lineno, line in bad:
            print(f"  {f}:{lineno}: {line}")
        print(
            "\nReason: bare httpx.Client() bypasses the SEC-IAM-01 + "
            "SEC-TENANT-01 ACL (Bearer + X-Tenant-Id). Use "
            "mate_clients.security.OutgoingAuthMiddleware. See ADR-0015 rule 4."
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())