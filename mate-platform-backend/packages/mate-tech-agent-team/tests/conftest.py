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
from collections.abc import Iterator

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

ADMIN_DSN = "postgresql://meta:meta@localhost:5432/metaplatform"
APP_DSN = "postgresql://mate_app:mate_app@localhost:5432/metaplatform"

RLS_TEST_SCHEMA = "agent_team_rls_test"

_JWT_SECRET = "test-secret"


def make_token(*, tenant_id: str = "tenant-acme") -> str:
    import jwt as pyjwt

    now = int(time.time())
    return pyjwt.encode(
        {
            "sub": "u-1",
            "iss": "http://localhost:8080/realms/metaplatform",
            "aud": "metaplatform-backend",
            "azp": "metaplatform-backend",
            "preferred_username": "u-1",
            "realm_access": {"roles": ["PLATFORM_SUPER_ADMIN"]},
            "scope": "platform.read platform.write",
            "attributes": {"tenant_id": [tenant_id]},
            "tenant_id": tenant_id,
            "roles": ["PLATFORM_SUPER_ADMIN"],
            "iat": now,
            "exp": now + 3600,
        },
        _JWT_SECRET,
        algorithm="HS256",
    )


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(tenant_id='tenant-acme')}"}


@pytest.fixture
def other_tenant_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(tenant_id='tenant-other')}"}


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
