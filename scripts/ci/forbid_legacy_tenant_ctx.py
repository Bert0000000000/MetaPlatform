#!/usr/bin/env python3
"""CI hook: 禁止 v3.1 KERNEL-01 之后 import 旧 `mate_tech_ont.security.tenant`。

13 硬规则 #3 的实施收口（GA-ACCEPTANCE 后启用）。
- 扫描 mate-kernel 与 mate-tech-* 新增 Python 文件
- 命中 `from mate_tech_ont.security.tenant import` 或 `import mate_tech_ont.security.tenant` → exit 1

用法：`python scripts/ci/forbid_legacy_tenant_ctx.py packages/mate-kernel/src packages/mate-tech-ont-v2/src`
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

FORBIDDEN_PATTERNS = (
    re.compile(r"^\s*from\s+mate_tech_ont\.security\.tenant\s+import\b"),
    re.compile(r"^\s*import\s+mate_tech_ont\.security\.tenant\b"),
)


def scan(root: Path) -> list[tuple[Path, int, str]]:
    hits: list[tuple[Path, int, str]] = []
    for path in root.rglob("*.py"):
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            for pat in FORBIDDEN_PATTERNS:
                if pat.search(line):
                    hits.append((path, lineno, line.strip()))
                    break
    return hits


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(
            "usage: forbid_legacy_tenant_ctx.py <root> [root ...]",
            file=sys.stderr,
        )
        return 2
    all_hits: list[tuple[Path, int, str]] = []
    for arg in argv[1:]:
        root = Path(arg)
        if not root.exists():
            continue
        all_hits.extend(scan(root))
    if all_hits:
        print(
            f"FAIL: legacy tenant ctx imports found ({len(all_hits)}):",
            file=sys.stderr,
        )
        for path, lineno, line in all_hits:
            print(f"  {path}:{lineno}: {line}", file=sys.stderr)
        return 1
    print("OK: no legacy tenant ctx imports")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))