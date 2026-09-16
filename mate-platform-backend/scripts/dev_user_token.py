"""本地联调取数脚本：登录取用户 token（给 E2E 脚本与手工验证用）。

用法：
  .venv/Scripts/python.exe scripts/dev_user_token.py
打印 token 到 stdout（仅本机联调，不要把输出写进任何文件/日志）。
"""

from __future__ import annotations

import json
import sys

import httpx

GATEWAY = "http://localhost:8100"


def login(username: str = "admin", password: str = "admin123") -> str:
    resp = httpx.post(
        f"{GATEWAY}/api/v1/iam/auth/login",
        json={"username": username, "password": password},
        timeout=30.0,
    )
    resp.raise_for_status()
    body = json.loads(resp.text)
    return str(body.get("accessToken") or body.get("access_token") or "")


def main() -> int:
    token = login()
    if not token:
        print("login returned no token", file=sys.stderr)
        return 1
    sys.stdout.write(token)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
