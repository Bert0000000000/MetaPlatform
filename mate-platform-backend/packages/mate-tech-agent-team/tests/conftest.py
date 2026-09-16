"""共用测试夹具。

**Windows 事件循环**：psycopg 的 async 连接不能在 ProactorEventLoop 上跑
（``Psycopg cannot use the 'ProactorEventLoop'``）。测试进程里先切到 Selector。

**PG 可用性**：需要一个活的 Postgres 与 ``mate_app`` 角色。缺失时相关用例
skip 而不是 fail——CI 未必起得到 PG，但隔离断言**只能**在 PG 上做。

夹具只暴露**值**，不暴露模块级符号：跨测试目录 ``from conftest import ...``
在一个 session 里收集多个测试包时会解析歧义（本仓 mate-tech-mcp 已踩过）。
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
from collections.abc import Callable, Iterator

import pytest

# 认证：测试进程内自签 HS256 token（与 mate-tech-orchestrator 测试同法）。
# 必须在 install_auth 读取配置前设好。
os.environ.setdefault("INSECURE_SKIP_SIGNATURE", "1")
os.environ.setdefault("KEYCLOAK_URL", "http://localhost:8080")
os.environ.setdefault("KEYCLOAK_REALM", "metaplatform")
os.environ.setdefault("KEYCLOAK_AUDIENCE", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_ID", "metaplatform-backend")
os.environ.setdefault("SERVICE_CLIENT_SECRET", "test-secret")

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# 用 127.0.0.1 而不是 localhost：Windows 上 localhost 会先试 ::1，
# 而 Docker 的端口映射在 ::1 上常表现为"连上后被立刻关闭"，白等一个超时。
ADMIN_DSN = "postgresql://meta:meta@127.0.0.1:5432/metaplatform"
APP_DSN = "postgresql://mate_app:mate_app@127.0.0.1:5432/metaplatform"

RLS_TEST_SCHEMA = "agent_team_rls_test"

_JWT_SECRET = "test-secret"


def make_token(
    *,
    tenant_id: str = "tenant-acme",
    roles: list[str] | None = None,
    permissions: list[str] | None = None,
) -> str:
    import jwt as pyjwt

    realm_roles = ["PLATFORM_SUPER_ADMIN"] if roles is None else roles
    now = int(time.time())
    claims: dict[str, object] = {
        "sub": "u-1",
        "iss": "http://localhost:8080/realms/metaplatform",
        "aud": "metaplatform-backend",
        "azp": "metaplatform-backend",
        "preferred_username": "u-1",
        "realm_access": {"roles": realm_roles},
        "scope": "platform.read platform.write",
        "attributes": {"tenant_id": [tenant_id]},
        "tenant_id": tenant_id,
        "roles": realm_roles,
        "iat": now,
        "exp": now + 3600,
    }
    if permissions is not None:
        claims["permissions"] = permissions
    return pyjwt.encode(claims, _JWT_SECRET, algorithm="HS256")


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(tenant_id='tenant-acme')}"}


@pytest.fixture
def other_tenant_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(tenant_id='tenant-other')}"}


@pytest.fixture
def admin_token() -> str:
    """默认管理员令牌 —— 角色 ``PLATFORM_SUPER_ADMIN`` → 平台内置能力全集。

    直接调服务层（不经 HTTP）的用例也要带它：1.3 轨 1 起**发起用户的包络
    从令牌解析**，没有令牌就建立不起链根，包络为空（fail-closed），派活一律
    转成待授权提案、一个员工都不会跑。
    """
    return make_token()


@pytest.fixture
def issue_token() -> Callable[..., str]:
    """自造令牌（改角色 / 加权限标记），用于闸门的正负例。"""
    return make_token


def _pg_available() -> bool:
    try:
        import psycopg

        with psycopg.connect(APP_DSN, connect_timeout=5):
            pass
    except Exception:
        return False
    return True


@pytest.fixture
def pg_dsns() -> tuple[str, str]:
    """(admin_dsn, app_dsn)；PG 不可用时 skip 掉用例而不是判红。

    可用性在**夹具调用时**才探测——放在模块导入期会因别处的连接风暴
    （例如同机另一个测试套件正在压 PG）误判为不可用。
    """
    if not _pg_available():
        pytest.skip("需要本机 Postgres + mate_app 角色（隔离断言必须在真库上做）")
    return ADMIN_DSN, APP_DSN


@pytest.fixture
def rls_schema(pg_dsns: tuple[str, str]) -> Iterator[str]:
    """装好 langgraph 表 + RLS 的独立 schema，用完拆掉。"""
    import psycopg
    from mate_tech_agent_team.checkpoint import bootstrap

    admin_dsn, _ = pg_dsns
    bootstrap(admin_dsn, schema=RLS_TEST_SCHEMA)
    yield RLS_TEST_SCHEMA
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(f"DROP SCHEMA IF EXISTS {RLS_TEST_SCHEMA} CASCADE")
