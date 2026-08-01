"""Pre-commit hook for ADR-0015 rule 12 (Secret 不进 git).

Scans ``infra/helm/**/*.yaml`` for *inline* secret material
(``password: secret123``, ``apiKey: xxx``, ...) and refuses it. Secrets
must be referenced via ``existingSecretName`` / ``existingSecretKey``
(SealedSecret or ExternalSecret).

Allowed value forms (not flagged):
  - empty / null-ish           ``password:``  ``password: ""``
  - env-var / template ref     ``password: ${DB_PASSWORD}``
                                ``password: {{ .Values.x }}``
  - angle-bracket placeholder  ``password: <your-password>``
  - reference keys             ``existingSecretName:``, ``secretName:``,
                                ``existingSecretKey:``

Excluded paths:
  - ``templates/``  (Helm templates, incl. SealedSecret ``encryptedData``
    blobs which are intentionally committed encrypted)
  - ``Chart.yaml`` / ``_helpers.tpl``
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


# Keys whose literal value, when present, must not be committed.
SECRET_KEY_PATTERN = re.compile(
    r"^\s*(?P<key>password|apiKey|secretKey|token)\s*:\s*(?P<val>.*)$",
    re.IGNORECASE,
)

# Keys that are the *reference* form and are always allowed.
ALLOWED_KEY_RE = re.compile(
    r"^\s*(existingSecret\w*|secretName|existingConfigMap)\s*:",
    re.IGNORECASE,
)


def _is_plain_secret(value: str) -> bool:
    """True if the value is a plain literal (not a reference / empty / var)."""
    v = value.strip()
    if not v:
        return False
    # Inspect the inner literal after stripping surrounding quotes so
    # quoted placeholders ('"<your-password>"') are recognised too.
    inner = v.strip("'\"")
    if not inner:
        return False
    low = inner.lower()
    if low in {"null", "~", "none"}:
        return False
    # env-var / helm template / angle-bracket placeholder references
    if inner.startswith("${") or inner.startswith("{{") or inner.startswith("<"):
        return False
    # already a reference to an existing secret
    if "existingsecret" in low or "secretname" in low:
        return False
    return True


def is_template_path(path: Path) -> bool:
    """True for Helm template files (SealedSecret encryptedData lives here)."""
    parts = {p.lower() for p in path.parts}
    return "templates" in parts


def check_line(line: str) -> str | None:
    """Return the offending key if the line commits an inline secret."""
    if ALLOWED_KEY_RE.match(line):
        return None
    stripped = line.split("#", 1)[0]  # drop trailing YAML comment
    m = SECRET_KEY_PATTERN.match(stripped)
    if not m:
        return None
    if _is_plain_secret(m.group("val")):
        return m.group("key")
    return None


def check_file(path: Path) -> list[tuple[int, str]]:
    if not path.is_file() or is_template_path(path):
        return []
    out: list[tuple[int, str]] = []
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return []
    for lineno, line in enumerate(content.splitlines(), start=1):
        key = check_line(line)
        if key:
            out.append((lineno, key))
    return out


def main() -> int:
    files = [Path(p) for p in sys.argv[1:]]
    bad: list[tuple[Path, int, str]] = []
    for f in files:
        for lineno, key in check_file(f):
            bad.append((f, lineno, key))

    if bad:
        print("forbid_external_secret_plain: rule 12 violation(s):")
        for f, lineno, key in bad:
            print(f"  {f}:{lineno}: inline secret key '{key}'")
        print(
            "\nReason: inline secret material in helm values bypasses "
            "SealedSecret / ExternalSecret. Reference secrets via "
            "existingSecretName / existingSecretKey. See ADR-0015 rule 12."
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
