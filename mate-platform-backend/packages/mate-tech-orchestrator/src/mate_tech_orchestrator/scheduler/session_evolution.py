"""scheduler.session_evolution — 会话级能力热进化（PRD-01 M1，MP-EMP-EVOLVE-01）。

每个数字员工**会话**获得一个独立的 :class:`CapabilityRuntime`（composition
kernel 试点语义不变）：会话打开时对全局注册角色做**快照挂载**，会话内可
`mount` / `unmount` 能力（技能/工具），依赖角色的 fiber **反应式**失活 /
复激活；会话关闭（close）后按快照**还原**（FR-EMP-EVOLVE-006，I1 快照语义）。

全局（非会话）dispatch 路径不受影响——会话门仅当请求带 ``X-Session-Id``
且该会话存在时生效（PRD-01 FR-EMP-EVOLVE-001/002/006/007）。
"""

from __future__ import annotations

import time

import structlog

from .capability_runtime import CapabilityRuntime
from .role_registry import CapabilityBinding, get_role_registry

logger = structlog.get_logger(__name__)

_TTL_DEFAULT = 30 * 60  # 会话默认 30 分钟（决策 C1 对齐）


class SessionScope:
    """一个员工会话的进化域：自己的 CapabilityRuntime + 快照。"""

    def __init__(self, session_id: str, tenant_id: str, ttl_s: int = _TTL_DEFAULT) -> None:
        self.session_id = session_id
        self.tenant_id = tenant_id
        self.runtime = CapabilityRuntime()
        self.created_at = time.monotonic()
        self.ttl_s = ttl_s
        # 快照：会话打开时全局已注册的（角色→能力）——close 时还原依据
        self._snapshot: dict[str, tuple[CapabilityBinding, ...]] = {}
        self._mounted: dict[str, str] = {}
        self._evolve_proposals: dict[str, dict] = {}  # name → ref（会话内挂载，不落盘 FR-007）

    async def open(self) -> int:
        """快照挂载当前租户全部已注册角色。返回挂载角色数。"""
        reg = get_role_registry()
        count = 0
        for role in reg.iter_all():
            if role.tenant_id != self.tenant_id:
                continue
            self._snapshot[role.role] = role.capabilities
            for b in role.capabilities:
                if b.worker_kind == "mcp":
                    await self.runtime.track_capability(
                        self.tenant_id,
                        b.name,
                        b.ref,
                    )
            await self.runtime.attach_role(role)
            count += 1
        logger.info(
            "evolve.session.opened",
            session_id=self.session_id,
            tenant=self.tenant_id,
            roles=count,
        )
        return count

    async def mount(self, name: str, ref: str, *, worker_kind: str = "mcp") -> None:
        """会话内热挂载一个能力（FR-001）。不写全局注册表（FR-007）。"""
        if worker_kind != "mcp":
            raise ValueError(f"session mount supports mcp capabilities only, got {worker_kind}")
        await self.runtime.track_capability(self.tenant_id, name, ref)
        self._mounted[name] = ref
        logger.info(
            "evolve.capability.mounted",
            session_id=self.session_id,
            tenant=self.tenant_id,
            name=name,
        )

    async def unmount(self, name: str) -> bool:
        """会话内卸载（FR-002）：依赖角色 fiber 反应式失活（内核语义）。"""
        ok = await self.runtime.untrack_capability(self.tenant_id, name)
        if ok:
            self._mounted.pop(name, None)
            logger.info(
                "evolve.capability.unmounted",
                session_id=self.session_id,
                tenant=self.tenant_id,
                name=name,
            )
        return ok

    async def attach_worker_role(self, role_name: str, caps: list[CapabilityBinding]) -> None:
        """会话内把新能力挂到一个角色（进化用：角色能力面即时扩容）。"""
        from .role_registry import DigitalEmployeeRole

        role = DigitalEmployeeRole(
            tenant_id=self.tenant_id,
            role=role_name,
            name=role_name,
            capabilities=tuple(caps),
        )
        for b in caps:
            if b.worker_kind == "mcp":
                await self.runtime.track_capability(self.tenant_id, b.name, b.ref)
        await self.runtime.attach_role(role)

    # ── PRD-01 M3：进化提案闸（FR-003：提议走 proposal 人审）──
    def propose_evolution(self, name: str, ref: str, reason: str = "") -> str:
        """员工提议挂载新能力 → pending（人审前不生效）。"""
        pid = f"evop-{abs(hash((self.session_id, name))) % 10**8}"
        self._evolve_proposals[pid] = {
            "name": name,
            "ref": ref,
            "reason": reason,
            "status": "pending",
        }
        logger.info(
            "evolve.proposal.created", session_id=self.session_id, proposal_id=pid, name=name
        )
        return pid

    async def approve_evolution(self, pid: str) -> dict:
        p = self._evolve_proposals.get(pid)
        if p is None or p["status"] != "pending":
            raise KeyError(f"evolution proposal {pid!r} not pending")
        await self.mount(p["name"], p["ref"])
        p["status"] = "approved"
        logger.info("evolve.proposal.approved", session_id=self.session_id, proposal_id=pid)
        return {"proposal_id": pid, **p}

    def reject_evolution(self, pid: str) -> dict:
        p = self._evolve_proposals.get(pid)
        if p is None or p["status"] != "pending":
            raise KeyError(f"evolution proposal {pid!r} not pending")
        p["status"] = "rejected"
        logger.info("evolve.proposal.rejected", session_id=self.session_id, proposal_id=pid)
        return {"proposal_id": pid, **p}

    async def close(self) -> dict[str, int]:
        """会话关闭（FR-006 快照还原）：销毁会话域（全局注册从未被改动，
        因此「还原」= 丢弃会话覆写；全局语义回到会话前）。"""
        stats = {
            "mounted": len(self._mounted),
            "snapshot_roles": len(self._snapshot),
        }
        await self.runtime.dispose()
        logger.info(
            "evolve.session.closed",
            session_id=self.session_id,
            **stats,
        )
        return stats

    def expired(self) -> bool:
        return (time.monotonic() - self.created_at) > self.ttl_s

    def status(self) -> dict:
        snap = self.runtime.snapshot()
        return {
            "session_id": self.session_id,
            "tenant_id": self.tenant_id,
            "mounted": dict(self._mounted),
            "snapshot_roles": sorted(self._snapshot),
            "fibers": snap,
        }


class SessionEvolution:
    """所有员工会话的进化域注册处（模块单例，见 get_session_evolution）。"""

    def __init__(self) -> None:
        self._sessions: dict[str, SessionScope] = {}

    async def open_session(
        self, session_id: str, tenant_id: str, ttl_s: int = _TTL_DEFAULT
    ) -> SessionScope:
        old = self._sessions.get(session_id)
        if old is not None:
            await old.close()
        scope = SessionScope(session_id, tenant_id, ttl_s)
        await scope.open()
        self._sessions[session_id] = scope
        return scope

    def get(self, session_id: str) -> SessionScope | None:
        scope = self._sessions.get(session_id)
        if scope is not None and scope.expired():
            return None  # 过期视为不存在（TTL 由后台清理/下次访问触发）
        return scope

    async def close_session(self, session_id: str) -> dict[str, int] | None:
        scope = self._sessions.pop(session_id, None)
        if scope is None:
            return None
        return await scope.close()

    def sweep_expired(self) -> int:
        dead = [sid for sid, s in self._sessions.items() if s.expired()]
        for sid in dead:
            self._sessions.pop(sid, None)
        return len(dead)

    def dispatch_runtime(self, session_id: str | None) -> CapabilityRuntime | None:
        """dispatch 会话门：会话存在→其 runtime；否则 None（走全局默认）。"""
        if not session_id:
            return None
        scope = self.get(session_id)
        return scope.runtime if scope else None


_default: SessionEvolution | None = None


def get_session_evolution() -> SessionEvolution:
    global _default
    if _default is None:
        _default = SessionEvolution()
    return _default


def set_session_evolution(evo: SessionEvolution | None) -> None:
    global _default
    _default = evo
