#!/usr/bin/env python3
"""把 ADR-0068 的租户切换边界应用到**运行中**的 Keycloak（幂等）。

为什么需要它：compose 里的 Keycloak 用 `--import-realm` 只在 realm **首建**时导
`realm-mate.json`；已存在的 realm（存量栈）重启不会重导。本脚本走 Admin REST API
把同一份 JSON 里的 client 结构落上去，让「改了 realm 文件」对活栈也生效——
新栈则不需要它（import 直接生效）。

做什么（与 `infra/keycloak/realm-mate.json` 单一事实源对齐，**不自己另写一份**）：

1. 两个专用 client（`mcp-tenant-proxy` / `agent-team-runtime`）：
   建齐（若缺）→ 用 JSON 里的表示整份 PUT（幂等更新 secret / mapper）→
   把 `tenant_switch_enabled` 链成 defaultClientScope（若未链）。
2. 共享 client（`metaplatform-backend`）：摘掉 `tenant_switch_enabled` 的
   optional 链接（B-10 负例：此后持共享密钥者申请不到该 scope）。

用法（宿主机上，对 compose 栈的 Keycloak）::

    PYTHONIOENCODING=utf-8 python scripts/keycloak/apply_tenant_boundary.py \
        --keycloak-url http://127.0.0.1:8180 \
        --admin-user admin --admin-password admin

凭据默认取环境变量 KEYCLOAK_URL / KEYCLOAK_ADMIN / KEYCLOAK_ADMIN_PASSWORD
（与 compose 同名变量一致）。输出只打变更动作，**不打任何 secret 值**。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

REALM_FILE = Path(__file__).resolve().parents[2] / "infra" / "keycloak" / "realm-mate.json"
REALM = "metaplatform"
SWITCH_SCOPE = "tenant_switch_enabled"
#: 共享 client（摘 optional 链接）与专用 client（建 + 链 default）在此显式列出，
#: 与 realm JSON 的结构约定一一对应；改名单要连 ADR-0068 一起改。
SHARED_CLIENT = "metaplatform-backend"
DEDICATED_CLIENTS = ("mcp-tenant-proxy", "agent-team-runtime")


class AdminApi:
    def __init__(self, base: str, token: str) -> None:
        self._base = base.rstrip("/")
        self._token = token

    def request(
        self, method: str, path: str, body: dict[str, Any] | None = None, ok404: bool = False
    ) -> tuple[int, Any]:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            f"{self._base}{path}",
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read().decode() if resp.status != 204 else ""
                return resp.status, (json.loads(raw) if raw.strip() else None)
        except urllib.error.HTTPError as exc:
            if exc.code == 404 and ok404:
                return 404, None
            detail = exc.read().decode(errors="replace")[:300]
            raise RuntimeError(f"{method} {path} -> HTTP {exc.code}: {detail}") from exc

    def get(self, path: str) -> Any:
        _, payload = self.request("GET", path)
        return payload

    def post(self, path: str, body: dict[str, Any]) -> str | None:
        status, payload = self.request("POST", path, body)
        # Keycloak 建 client 回 201 + Location 尾部是 id；其余 POST 回 204。
        if isinstance(payload, dict):
            return str(payload.get("id") or "")
        return None


def admin_token(base: str, user: str, password: str) -> str:
    """master realm 的 admin-cli 密码流（compose 的 KEYCLOAK_ADMIN 同源）。"""
    body = urllib.parse.urlencode(
        {
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": user,
            "password": password,
        }
    ).encode()
    req = urllib.request.Request(
        f"{base.rstrip('/')}/realms/master/protocol/openid-connect/token",
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return str(json.loads(resp.read().decode())["access_token"])
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:200]
        raise RuntimeError(f"Keycloak admin 登录失败（HTTP {exc.code}）：{detail}") from exc


def client_by_id(api: AdminApi, client_id: str) -> dict[str, Any] | None:
    rows = api.get(f"/admin/realms/{REALM}/clients?clientId={urllib.parse.quote(client_id)}")
    for row in rows or []:
        if row.get("clientId") == client_id:
            return row
    return None


def scope_id(api: AdminApi) -> str:
    for row in api.get(f"/admin/realms/{REALM}/client-scopes") or []:
        if row.get("name") == SWITCH_SCOPE:
            return str(row["id"])
    raise RuntimeError(
        f"realm 缺 client scope `{SWITCH_SCOPE}`（realm JSON 有而活栈没有——"
        "说明活栈 realm 与仓库结构已分叉，先人工核对再跑本脚本）"
    )


def apply(api: AdminApi, realm_doc: dict[str, Any]) -> list[str]:
    actions: list[str] = []
    sid = scope_id(api)
    wanted = {c["clientId"]: c for c in realm_doc.get("clients", [])}

    # ── 专用 client：建齐 / 对齐表示 / 链 default scope ──────────────────────
    for client_id in DEDICATED_CLIENTS:
        rep = dict(wanted[client_id])
        existing = client_by_id(api, client_id)
        if existing is None:
            # 建：表示里去掉链接字段（链接走独立的 default-client-scopes 端点）
            create = {k: v for k, v in rep.items() if k != "defaultClientScopes"}
            api.post(f"/admin/realms/{REALM}/clients", create)
            existing = client_by_id(api, client_id)
            if existing is None:  # pragma: no cover - 防御性，建完查不到属于 Keycloak 异常
                raise RuntimeError(f"client `{client_id}` 建完查不到")
            actions.append(f"+ client `{client_id}`（新建）")
        else:
            # 幂等对齐：secret / mapper / 开关以 realm JSON 为准（PUT 整份表示，
            # 保留 `id` 等服务端字段；scope 链接走下面的独立端点）。
            merged = {k: v for k, v in existing.items() if k != "id"}
            merged.update({k: v for k, v in rep.items() if k != "defaultClientScopes"})
            api.request("PUT", f"/admin/realms/{REALM}/clients/{existing['id']}", merged)
            actions.append(f"~ client `{client_id}`（表示已对齐 realm JSON）")
        cid = str(existing["id"])
        linked = {
            str(row.get("id"))
            for row in api.get(f"/admin/realms/{REALM}/clients/{cid}/default-client-scopes") or []
        }
        if sid not in linked:
            api.request("PUT", f"/admin/realms/{REALM}/clients/{cid}/default-client-scopes/{sid}")
            actions.append(f"+ `{client_id}` defaultClientScopes += {SWITCH_SCOPE}")

    # ── 共享 client：摘 optional 链接（B-10 负例的落地动作）─────────────────
    shared = client_by_id(api, SHARED_CLIENT)
    if shared is None:
        raise RuntimeError(f"活栈里没有共享 client `{SHARED_CLIENT}`——先核对 realm")
    cid = str(shared["id"])
    optionals = api.get(f"/admin/realms/{REALM}/clients/{cid}/optional-client-scopes") or []
    if any(row.get("id") == sid for row in optionals):
        api.request("DELETE", f"/admin/realms/{REALM}/clients/{cid}/optional-client-scopes/{sid}")
        actions.append(f"- `{SHARED_CLIENT}` optionalClientScopes -= {SWITCH_SCOPE}")
    else:
        actions.append(f"= `{SHARED_CLIENT}` 已无 {SWITCH_SCOPE} 链接（无需变更）")
    return actions


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--keycloak-url",
        default=os.getenv("KEYCLOAK_URL", "http://127.0.0.1:8180"),
        help="Keycloak 根地址（默认取 KEYCLOAK_URL 或 http://127.0.0.1:8180）",
    )
    parser.add_argument("--admin-user", default=os.getenv("KEYCLOAK_ADMIN", "admin"))
    parser.add_argument("--admin-password", default=os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin"))
    parser.add_argument(
        "--realm-file",
        default=str(REALM_FILE),
        help="期望结构的 realm JSON（默认仓库内 infra/keycloak/realm-mate.json）",
    )
    args = parser.parse_args()

    realm_doc = json.loads(Path(args.realm_file).read_text(encoding="utf-8"))
    api = AdminApi(
        args.keycloak_url, admin_token(args.keycloak_url, args.admin_user, args.admin_password)
    )
    actions = apply(api, realm_doc)
    for line in actions:
        print(line)
    print(f"=== APPLY TENANT BOUNDARY 完成（{len(actions)} 项，幂等可重跑）===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
