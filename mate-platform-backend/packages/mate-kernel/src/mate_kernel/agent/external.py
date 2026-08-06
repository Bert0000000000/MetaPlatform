"""AGENT-EXT-01: External Agent —— Marketplace 第三方数字员工适配层。

7+N 中的「外部 Agent」—— 通过 HTTP / MCP / A2A 协议对接第三方 Marketplace Agent。
强制走第三方 Sandbox (L3 MicroVM / Firecracker) —— ADR-0040 决策 B1。
- Protocol：HTTP | MCP | A2A 三种接入
- Capability：能力声明（manifest）；SuperAI 按能力选择
- Invocation：调用 → 第三方 sandbox → 回执

M3 范围：内存版 manifest + 协议枚举 + mock invoker；
真实 MicroVM 在 SANDBOX-02 Batch 落（K8s Job）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Protocol, runtime_checkable


class ExtProtocol(str, Enum):
    HTTP = "http"
    MCP = "mcp"   # Model Context Protocol
    A2A = "a2a"   # Agent-to-Agent


class SandboxTier(str, Enum):
    L1_PROCESS = "l1_process"
    L2_CONTAINER = "l2_container"
    L3_MICROVM = "l3_microvm"  # Marketplace 强制


@dataclass(frozen=True, slots=True)
class Capability:
    name: str  # e.g. "translate", "ocr", "web_search"
    description: str
    input_schema_rid: str | None = None  # 关联 ObjectType（参数定义）
    output_schema_rid: str | None = None


@dataclass(frozen=True, slots=True)
class ExtAgentManifest:
    """Marketplace 上架的第三方 Agent 描述符。"""
    agent_rid: str  # ext.<tenant>.agent.<slug>.v<n>
    name: str
    vendor: str
    protocol: ExtProtocol
    endpoint: str  # http://... / mcp://... / a2a://...
    capabilities: tuple[Capability, ...]
    sandbox: SandboxTier = SandboxTier.L3_MICROVM  # 默认强制 L3
    version: str = "v1"
    enabled: bool = True

    def __post_init__(self) -> None:
        if self.sandbox != SandboxTier.L3_MICROVM:
            # 决策 B1：Marketplace 必须 L3；这里只 warn 层面拒绝
            raise ValueError(
                f"Marketplace agent must use L3_MICROVM (decision B1); got {self.sandbox}"
            )
        if not self.capabilities:
            raise ValueError("ExtAgentManifest.capabilities must be non-empty")


@dataclass(frozen=True, slots=True)
class ExtInvocation:
    """一次调用记录 —— 必走第三方 sandbox。"""
    invocation_id: str
    agent_rid: str
    capability: str
    parameters: dict[str, Any]
    sandbox_id: str  # MicroVM instance id
    started_at: datetime
    completed_at: datetime | None = None
    output: Any = None
    error: str | None = None
    status: str = "pending"  # pending / running / ok / failed


@runtime_checkable
class SandboxRunner(Protocol):
    """L3 MicroVM 抽象 —— 实际由 SANDBOX-02 实现。"""

    def run(self, agent: ExtAgentManifest, capability: str, params: dict[str, Any]) -> tuple[str, Any]:
        """返回 (sandbox_id, output)。"""
        ...


class MockMicroVMRunner:
    """Mock L3 sandbox —— 直接调用"第三方"函数，假装在 MicroVM 里跑。"""

    def __init__(self) -> None:
        self._counter = 0
        self._registry: dict[str, callable] = {}

    def register(self, capability: str, fn: callable) -> None:
        self._registry[capability] = fn

    def run(self, agent: ExtAgentManifest, capability: str, params: dict[str, Any]) -> tuple[str, Any]:
        self._counter += 1
        sandbox_id = f"microvm-{self._counter}"
        fn = self._registry.get(capability)
        if fn is None:
            raise KeyError(f"no mock impl for capability={capability!r}")
        out = fn(params)
        return sandbox_id, out


class ExtAgentRegistry:
    """Marketplace 索引 + 调用路由。"""

    def __init__(self, runner: SandboxRunner | None = None) -> None:
        self._agents: dict[str, ExtAgentManifest] = {}
        self.runner = runner or MockMicroVMRunner()

    def register(self, agent: ExtAgentManifest) -> None:
        if agent.agent_rid in self._agents:
            raise ValueError(f"agent already registered: {agent.agent_rid}")
        self._agents[agent.agent_rid] = agent

    def get(self, agent_rid: str) -> ExtAgentManifest:
        a = self._agents.get(agent_rid)
        if a is None:
            raise KeyError(f"agent not found: {agent_rid}")
        return a

    def find_by_capability(self, cap: str) -> tuple[ExtAgentManifest, ...]:
        return tuple(
            a for a in self._agents.values()
            if a.enabled and any(c.name == cap for c in a.capabilities)
        )

    def invoke(
        self,
        agent_rid: str,
        capability: str,
        parameters: dict[str, Any],
    ) -> ExtInvocation:
        agent = self.get(agent_rid)
        if not agent.enabled:
            raise RuntimeError(f"agent disabled: {agent_rid}")
        if not any(c.name == capability for c in agent.capabilities):
            raise ValueError(f"capability not declared: {capability!r}")
        inv = ExtInvocation(
            invocation_id=f"inv-{id(inv := object()) & 0xffffff:x}",
            agent_rid=agent_rid,
            capability=capability,
            parameters=parameters,
            sandbox_id="",
            started_at=datetime.now(timezone.utc),
        )
        try:
            sandbox_id, output = self.runner.run(agent, capability, parameters)
            inv = ExtInvocation(
                invocation_id=inv.invocation_id,
                agent_rid=inv.agent_rid,
                capability=inv.capability,
                parameters=inv.parameters,
                sandbox_id=sandbox_id,
                started_at=inv.started_at,
                completed_at=datetime.now(timezone.utc),
                output=output,
                status="ok",
            )
        except Exception as e:
            inv = ExtInvocation(
                invocation_id=inv.invocation_id,
                agent_rid=inv.agent_rid,
                capability=inv.capability,
                parameters=inv.parameters,
                sandbox_id="-",
                started_at=inv.started_at,
                completed_at=datetime.now(timezone.utc),
                error=str(e),
                status="failed",
            )
        return inv


__all__ = [
    "Capability",
    "ExtAgentManifest",
    "ExtAgentRegistry",
    "ExtInvocation",
    "ExtProtocol",
    "MockMicroVMRunner",
    "SandboxRunner",
    "SandboxTier",
]
