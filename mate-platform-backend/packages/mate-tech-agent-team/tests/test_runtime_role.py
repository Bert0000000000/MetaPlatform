"""B-4 / `MP-RUNTIME-DB-POOL-01` 的判据：admin DSN 移出运行 Pod。

B-4 之前的形态：运行 Pod 的环境里同时有 ``MATE_AGENT_TEAM_ADMIN_DSN``（能建表、
能授权 = 整库钥匙）与业务 DSN。RLS 那道墙在它面前**等于不存在**——任何能读到这个
Pod 环境的人（一次 SSRF、一次 `/proc/self/environ`、一次误配的日志）就拿到了它。

拆完之后三件事各自可判定：

1. **运行 Pod 的 env 里没有 admin DSN** —— 配了就**启动失败**（不是警告），
   否则"去掉它"变成一句没人执行的话；
2. **恢复扫描仍可用** —— 它改走**控制面身份**（只读 ``checkpoints``，跨租户靠一条
   permissive 策略），而不是 admin；
3. **服务能起来** —— 建表挪进迁移 Job 之后，运行 Pod 不带 admin 也照样启动。
"""

from __future__ import annotations

import asyncio

import pytest
from mate_tech_agent_team import migrate
from mate_tech_agent_team.api import run_control as rc
from mate_tech_agent_team.checkpoint import bootstrap
from mate_tech_agent_team.wiring import (
    ROLE_ENV,
    _refuse_admin_dsn_in_api_role,
    runtime_role,
)

# ── 1. 运行角色与"配了就失败" ──────────────────────────────────────────


def test_role_defaults_to_all_so_single_process_is_unchanged(monkeypatch) -> None:
    """缺省 ``all``：单进程形态与加这一条之前**逐字一致**。"""
    monkeypatch.delenv(ROLE_ENV, raising=False)
    assert runtime_role() == "all"


def test_api_role_refuses_an_admin_dsn(monkeypatch) -> None:
    """**主判据**：``api`` 角色带着 admin DSN 就启动失败。"""
    monkeypatch.setenv("MATE_AGENT_TEAM_ADMIN_DSN", "postgresql://meta:meta@db/x")
    with pytest.raises(RuntimeError) as exc:
        _refuse_admin_dsn_in_api_role()
    assert "迁移 Job" in str(exc.value)


def test_api_role_without_an_admin_dsn_is_fine(monkeypatch) -> None:
    monkeypatch.delenv("MATE_AGENT_TEAM_ADMIN_DSN", raising=False)
    _refuse_admin_dsn_in_api_role()  # 不抛就是通过


# ── 2. 恢复扫描改走控制面身份 ───────────────────────────────────────────


def test_the_recovery_index_prefers_the_control_dsn(monkeypatch) -> None:
    """**控制面身份优先**：配了它就用它，不再把 admin 交给恢复扫描。"""
    monkeypatch.setenv(rc.DSN_ENV, "postgresql://mate_app:x@db/x")
    monkeypatch.setenv(rc.ADMIN_DSN_ENV, "postgresql://meta:meta@db/x")
    monkeypatch.setenv(rc.CONTROL_DSN_ENV, "postgresql://mate_control:x@db/x")

    control = rc.RunControl.from_env(service=None)  # type: ignore[arg-type]
    assert control._run_index is not None
    assert control._run_index._dsn == "postgresql://mate_control:x@db/x"  # type: ignore[attr-defined]


def test_without_a_control_dsn_it_falls_back_to_admin_for_local_forms(monkeypatch) -> None:
    """没配控制面 DSN 时回落到 admin —— 本地/单进程的旧形态不该被迫改配置。"""
    monkeypatch.setenv(rc.DSN_ENV, "postgresql://mate_app:x@db/x")
    monkeypatch.setenv(rc.ADMIN_DSN_ENV, "postgresql://meta:meta@db/x")
    monkeypatch.delenv(rc.CONTROL_DSN_ENV, raising=False)

    control = rc.RunControl.from_env(service=None)  # type: ignore[arg-type]
    assert control._run_index is not None
    assert control._run_index._dsn == "postgresql://meta:meta@db/x"  # type: ignore[attr-defined]


# ── 3. 迁移 Job ────────────────────────────────────────────────────────


def test_the_migration_refuses_to_run_without_an_admin_dsn(monkeypatch) -> None:
    """迁移**必须**有 admin：没有就非零退出（Job 才会红，而不是静默什么都没建）。"""
    monkeypatch.delenv(migrate.ADMIN_DSN_ENV, raising=False)
    with pytest.raises(SystemExit):
        migrate.run_migration()


def test_the_migration_actually_creates_everything(
    monkeypatch, pg_dsns: tuple[str, str], rls_schema: str
) -> None:
    """跑一次迁移 → schema、表、RLS、控制面角色**全都在**。

    这条是"把 bootstrap 挪进 Job 之后服务还能起来"的证据：迁移跑完，服务
    需要的东西一件不少。
    """
    import psycopg

    admin_dsn, _ = pg_dsns
    monkeypatch.setenv(migrate.ADMIN_DSN_ENV, admin_dsn)
    monkeypatch.setenv("MATE_AGENT_TEAM_SCHEMA", rls_schema)
    # bootstrap 的 schema 是位置参数默认值；这里直接调带 schema 的那条路。
    bootstrap(
        admin_dsn,
        schema=rls_schema,
        control_role="mate_control",
        control_password="mate_control_pw",
    )

    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname = %s", (rls_schema,)
            ).fetchall()
        }
        assert {"checkpoints", "active_run_lease", "run_event", "tool_invocations"} <= tables

        # 控制面角色：存在、能登、且**只有** checkpoints 的 SELECT
        granted = {
            row[0]
            for row in conn.execute(
                "SELECT table_name FROM information_schema.role_table_grants"
                " WHERE grantee = 'mate_control' AND table_schema = %s",
                (rls_schema,),
            ).fetchall()
        }
        assert granted == {"checkpoints"}, f"控制面角色被授多了：{granted}"

        # permissive 策略在：跨租户读得到（这就是恢复扫描需要的那一件事）
        policies = conn.execute(
            "SELECT polname, polpermissive FROM pg_policy p"
            " JOIN pg_class c ON c.oid = p.polrelid"
            " JOIN pg_namespace n ON n.oid = c.relnamespace"
            " WHERE n.nspname = %s AND c.relname = 'checkpoints'"
            "   AND polname = 'control_plane_read'",
            (rls_schema,),
        ).fetchall()
        assert policies and policies[0][1] is True, "控制面策略没建出来"

    # app 角色的租户策略**没有被动过**：两条策略是 OR 关系，互不影响
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        tenant_policy = conn.execute(
            "SELECT count(*) FROM pg_policy p"
            " JOIN pg_class c ON c.oid = p.polrelid"
            " JOIN pg_namespace n ON n.oid = c.relnamespace"
            " WHERE n.nspname = %s AND c.relname = 'checkpoints'"
            "   AND polname = 'tenant_iso'",
            (rls_schema,),
        ).fetchone()
        assert tenant_policy is not None and tenant_policy[0] == 1


def test_a_control_role_name_that_is_not_an_identifier_is_refused(
    pg_dsns: tuple[str, str], rls_schema: str
) -> None:
    """角色名会拼进 DDL（``CREATE ROLE`` 不接受参数绑定），必须挡在标识符校验上。"""
    admin_dsn, _ = pg_dsns
    with pytest.raises(ValueError, match="标识符"):
        bootstrap(admin_dsn, schema=rls_schema, control_role="bad; DROP TABLE t")


@pytest.mark.asyncio
async def test_the_runtime_pod_env_has_no_admin_dsn_when_rendered() -> None:
    """**渲染出来的 Deployment 里没有 admin DSN**（判据 ③ 的静态那一半）。

    helm 不在时退化成对模板原文的断言——照样在跑，只是弱一档。
    """
    import shutil
    import subprocess
    from pathlib import Path

    import yaml

    templates = Path(__file__).resolve().parents[4] / "infra" / "helm" / "charts" / "agent-team"
    helm = shutil.which("helm")
    if helm is None:
        text = (templates / "templates" / "deployment.yaml").read_text(encoding="utf-8")
        assert "MATE_AGENT_TEAM_ADMIN_DSN" not in text
        assert "MATE_AGENT_TEAM_CONTROL_DSN" in text
        return

    proc = await asyncio.to_thread(
        subprocess.run,
        [helm, "template", "agent-team", str(templates)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    objects = [o for o in yaml.safe_load_all(proc.stdout) if isinstance(o, dict)]

    deploys = [o for o in objects if o.get("kind") == "Deployment"]
    assert deploys, "渲染不出 Deployment"
    container = deploys[0]["spec"]["template"]["spec"]["containers"][0]
    names = [entry["name"] for entry in container.get("env", [])]

    assert "MATE_AGENT_TEAM_ADMIN_DSN" not in names, "运行 Pod 里还有 admin DSN"
    assert "MATE_AGENT_TEAM_CONTROL_DSN" in names
    assert "MATE_AGENT_TEAM_DSN" in names, "业务 DSN 反而没了？"
    assert container["envFrom"], "非密配置应该还在"

    # admin DSN **只**出现在那个一次性 Job 里
    jobs = [o for o in objects if o.get("kind") == "Job"]
    assert len(jobs) == 1, f"迁移 Job 缺了（或多了）：{[j['metadata']['name'] for j in jobs]}"
    job_names = [
        entry["name"]
        for entry in jobs[0]["spec"]["template"]["spec"]["containers"][0].get("env", [])
    ]
    assert "MATE_AGENT_TEAM_ADMIN_DSN" in job_names, "迁移 Job 反而没有 admin DSN"
