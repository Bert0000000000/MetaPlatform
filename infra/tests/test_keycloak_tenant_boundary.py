"""ADR-0068 · Keycloak realm 租户切换边界的结构判据（N1/N2）。

静态 JSON 检查（不起 Keycloak）——与 ``test_chart_structure.py`` 同一形态：
真实验证（活栈 drill）见各批验收文档。守住的结构性质：

* N1：共享 client ``metaplatform-backend`` 的 default / optional scopes
  都**不**含 ``tenant_switch_enabled``（B-10 负例的 realm 侧落地）；
* N2：该 scope 只作为两个**专用** client（``mcp-tenant-proxy`` /
  ``agent-team-runtime``）的 defaultClientScope 存在，且这两个 client
  只开 client_credentials（无标准流 / 密码流）；
* 两个专用 client 的 audience mapper 指向 ``metaplatform-backend``
  （下游 AuthConfig 不用改）。
"""

from __future__ import annotations

import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
REALM = REPO / "infra" / "keycloak" / "realm-mate.json"
SWITCH_SCOPE = "tenant_switch_enabled"
SHARED = "metaplatform-backend"
DEDICATED = ("mcp-tenant-proxy", "agent-team-runtime")


def _doc() -> dict:
    return json.loads(REALM.read_text(encoding="utf-8"))


def _clients(doc: dict) -> dict[str, dict]:
    return {c["clientId"]: c for c in doc["clients"]}


def test_the_switch_scope_still_exists_as_a_realm_scope() -> None:
    names = {s["name"] for s in _doc()["clientScopes"]}
    assert SWITCH_SCOPE in names


def test_the_shared_client_cannot_request_the_switch_scope() -> None:
    """N1：共享密钥申请不到切换 scope——default 与 optional 都不链。"""
    shared = _clients(_doc())[SHARED]
    assert SWITCH_SCOPE not in shared.get("defaultClientScopes", [])
    assert SWITCH_SCOPE not in shared.get("optionalClientScopes", [])


def test_the_switch_scope_is_bound_only_to_the_dedicated_clients() -> None:
    """N2：全 realm 里只有两个专用 client 把切换 scope 挂成 default。"""
    doc = _doc()
    holders = [
        c["clientId"]
        for c in doc["clients"]
        if SWITCH_SCOPE in c.get("defaultClientScopes", [])
        or SWITCH_SCOPE in c.get("optionalClientScopes", [])
    ]
    assert sorted(holders) == sorted(DEDICATED)


def test_the_dedicated_clients_are_service_only() -> None:
    """专用 client 只该做 client_credentials：不开标准流 / 密码流 / 公开形态。"""
    clients = _clients(_doc())
    for client_id in DEDICATED:
        rep = clients[client_id]
        assert rep.get("serviceAccountsEnabled") is True, client_id
        assert rep.get("standardFlowEnabled") is False, client_id
        assert rep.get("directAccessGrantsEnabled") is False, client_id
        assert rep.get("publicClient") is False, client_id


def test_the_dedicated_clients_target_the_shared_audience() -> None:
    """aud=metaplatform-backend：llmgw / 网关 / MCP 的 AuthConfig 不用改。"""
    clients = _clients(_doc())
    for client_id in DEDICATED:
        mappers = clients[client_id].get("protocolMappers", [])
        audiences = [
            m["config"].get("included.custom.audience")
            for m in mappers
            if m.get("protocolMapper") == "oidc-audience-mapper"
        ]
        assert SHARED in audiences, client_id


def test_the_shared_client_keeps_its_user_facing_mappers() -> None:
    """收口不动共享 client 的用户面：密码流 / tenant-id mapper 原样保留
    （用户登录与用户令牌的租户 claim 不受影响）。"""
    shared = _clients(_doc())[SHARED]
    assert shared.get("directAccessGrantsEnabled") is True
    mappers = shared.get("protocolMappers", [])
    kinds = {m.get("protocolMapper") for m in mappers}
    assert "oidc-usermodel-attribute-mapper" in kinds
    assert "oidc-audience-mapper" in kinds
