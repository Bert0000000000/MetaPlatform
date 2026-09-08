"""PRD-01 M1 — 会话级能力热进化单测（fiber 反应式 + 快照还原 + TTL + 跨租户）。"""
from __future__ import annotations

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
for _p in ("mate-kernel", "mate-common", "mate-platform", "mate-clients",
           "mate-tech-db", "mate-app-a2a"):
    _d = os.path.join(os.path.dirname(__file__), "..", "..", _p, "src")
    if os.path.isdir(_d) and _d not in sys.path:
        sys.path.insert(0, _d)

from mate_tech_orchestrator.scheduler.role_registry import (  # noqa: E402
    CapabilityBinding,
    set_role_registry,
    RoleRegistry,
)
from mate_tech_orchestrator.scheduler.session_evolution import (  # noqa: E402
    SessionEvolution,
    get_session_evolution,
    set_session_evolution,
)


def run(coro):
    return asyncio.run(coro)


def _fresh_registry():
    reg = RoleRegistry()
    set_role_registry(reg)
    reg.register(
        tenant_id="t-a", role="ontology", name="ontology",
        capabilities=[CapabilityBinding(name="list_classes", worker_kind="mcp",
                                        ref="ont_list_classes")],
    )
    return reg


class TestHotMount:
    def test_mount_unmount_reactive(self) -> None:
        _fresh_registry()
        evo = SessionEvolution()
        run(evo.open_session("s1", "t-a"))
        sc = evo.get("s1")
        assert sc is not None
        # 基线：快照角色 active，能力可用
        assert sc.runtime.allows("t-a", "list_classes") is True
        assert sc.runtime.is_role_active("t-a", "ontology") is True
        # 热挂载新能力（FR-001）
        run(sc.mount("hot_skill", "sk_hot"))
        assert sc.runtime.allows("t-a", "hot_skill") is True
        # 卸载快照能力（FR-002）→ 依赖角色 fiber 失活
        assert run(sc.unmount("list_classes")) is True
        assert sc.runtime.allows("t-a", "list_classes") is False
        assert sc.runtime.is_role_active("t-a", "ontology") is False
        # 重挂载 → 反应式复激活（FR-002 复激活）
        run(sc.mount("list_classes", "ont_list_classes"))
        assert sc.runtime.allows("t-a", "list_classes") is True
        assert sc.runtime.is_role_active("t-a", "ontology") is True

    def test_mount_non_mcp_rejected(self) -> None:
        _fresh_registry()
        evo = SessionEvolution()
        run(evo.open_session("s2", "t-a"))
        try:
            run(evo.get("s2").mount("x", "r", worker_kind="a2a"))
            assert False, "should reject"
        except ValueError:
            pass

    def test_unmount_unknown_returns_false(self) -> None:
        _fresh_registry()
        evo = SessionEvolution()
        run(evo.open_session("s3", "t-a"))
        assert run(evo.get("s3").unmount("nope")) is False


class TestSnapshotRestore:
    def test_close_restores_global_semantics(self) -> None:
        reg = _fresh_registry()
        evo = SessionEvolution()
        run(evo.open_session("s4", "t-a"))
        sc = evo.get("s4")
        run(sc.mount("hot2", "sk2"))
        stats = run(evo.close_session("s4"))
        assert stats["snapshot_roles"] == 1
        # 全局注册表从未被会话改动（FR-007：会话内覆写不落盘）
        role = reg.get("t-a", "ontology")
        assert [b.name for b in role.capabilities] == ["list_classes"]
        # 会话已不存在 → dispatch 门回到全局
        assert evo.dispatch_runtime("s4") is None

    def test_reopen_after_close_is_clean(self) -> None:
        _fresh_registry()
        evo = SessionEvolution()
        run(evo.open_session("s5", "t-a"))
        run(evo.get("s5").mount("tmp", "r"))
        run(evo.close_session("s5"))
        run(evo.open_session("s5", "t-a"))
        sc = evo.get("s5")
        assert sc.runtime.allows("t-a", "tmp") is True  # 未跟踪=legacy 放行面
        assert "tmp" not in sc.status()["mounted"]


class TestTtlAndGate:
    def test_expired_session_gated_out(self) -> None:
        _fresh_registry()
        evo = SessionEvolution()
        run(evo.open_session("s6", "t-a", ttl_s=0))
        import time as _t
        _t.sleep(0.05)
        assert evo.get("s6") is None
        assert evo.dispatch_runtime("s6") is None

    def test_cross_tenant_not_visible(self) -> None:
        _fresh_registry()
        evo = SessionEvolution()
        run(evo.open_session("s7", "t-a"))
        # t-b 租户查询同会话能力：runtime 按 tenant key 隔离
        sc = evo.get("s7")
        assert sc.runtime.allows("t-b", "list_classes") is True  # 未跟踪→放行
        # 但 mount 到 t-a 的能力不构成 t-b 的跟踪
        run(sc.mount("capA", "refA"))
        assert "capability:t-a:capA" in sc.runtime.snapshot()["capabilities"]
        assert "capability:t-b:capA" not in sc.runtime.snapshot()["capabilities"]


class TestSingleton:
    def test_default_singleton(self) -> None:
        evo = get_session_evolution()
        assert get_session_evolution() is evo
        set_session_evolution(None)
        assert get_session_evolution() is not None  # 重建


class TestSweep:
    def test_sweep_expired(self) -> None:
        import asyncio as _a
        import time as _t
        _fresh_registry()
        evo = SessionEvolution()
        _a.run(evo.open_session("old", "t-a", ttl_s=0))
        _a.run(evo.open_session("new", "t-a"))
        _t.sleep(0.05)
        assert evo.sweep_expired() == 1
        assert evo.get("old") is None
        assert evo.get("new") is not None
