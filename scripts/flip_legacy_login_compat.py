"""把 docker-compose*.yml 的 LEGACY_LOGIN_COMPAT/INSECURE_SKIP_SIGNATURE 翻为 false，
并确保含 LEGACY 行的服务 env 块具备 KEYCLOAK_URL 与 SERVICE_CLIENT_SECRET
（legacy=false 时 load_auth_config 强制要求）。幂等：重复运行无变化。"""
from __future__ import annotations

import io
import sys

SECRET_LINE = "      SERVICE_CLIENT_SECRET: ${KEYCLOAK_CLIENT_SECRET}"
KEYCLOAK_LINE = "      KEYCLOAK_URL: http://keycloak:8080"


def transform(path: str) -> int:
    lines = io.open(path, encoding="utf-8").read().split("\n")
    out: list[str] = []
    changed = 0
    for i, ln in enumerate(lines):
        if 'LEGACY_LOGIN_COMPAT: "true"' in ln:
            out.append(ln.replace('LEGACY_LOGIN_COMPAT: "true"',
                                  'LEGACY_LOGIN_COMPAT: "false"'))
            changed += 1
            # 向后看同一 env 块，确认 KEYCLOAK_URL / SECRET 是否已配
            block_tail = lines[i + 1:i + 12]
            has_url = any("KEYCLOAK_URL:" in t for t in block_tail)
            has_secret = any("SERVICE_CLIENT_SECRET" in t for t in block_tail)
            if not has_url:
                out.append(KEYCLOAK_LINE)
                changed += 1
            if not has_secret:
                out.append(SECRET_LINE)
                changed += 1
        elif 'INSECURE_SKIP_SIGNATURE: "true"' in ln:
            out.append(ln.replace('INSECURE_SKIP_SIGNATURE: "true"',
                                  'INSECURE_SKIP_SIGNATURE: "false"'))
            changed += 1
        else:
            out.append(ln)
    io.open(path, "w", encoding="utf-8", newline="\n").write("\n".join(out))
    return changed


for p in sys.argv[1:]:
    n = transform(p)
    print(f"{p}: {n} edits")
