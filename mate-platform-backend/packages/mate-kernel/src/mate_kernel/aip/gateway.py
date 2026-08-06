"""AIP Gateway —— AIP-GATEWAY-01 Batch。

LLM provider 抽象 + token 计数 + 路由策略 + budget 控制。
位于 7+1 数字员工与各 LLM 之间的统一入口。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Iterable, Protocol, runtime_checkable


class ProviderKind(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    AZURE_OPENAI = "azure_openai"
    LOCAL_OLLAMA = "ollama"


@dataclass(frozen=True, slots=True)
class ProviderConfig:
    kind: ProviderKind
    model: str  # e.g. "gpt-4o", "claude-sonnet-4", "llama3.1:70b"
    api_base: str | None = None
    api_key_ref: str | None = None  # 引用 secret manager key，不直接持有


@dataclass(frozen=True, slots=True)
class BudgetPolicy:
    """Per-(user, tenant) budget cap + 滑动窗口。"""
    max_input_tokens_per_minute: int = 60_000
    max_output_tokens_per_minute: int = 20_000
    max_usd_per_day: float = 10.0


@dataclass(frozen=True, slots=True)
class ChatMessage:
    role: str  # "system" | "user" | "assistant" | "tool"
    content: str
    name: str | None = None


@dataclass(frozen=True, slots=True)
class ChatRequest:
    messages: tuple[ChatMessage, ...]
    temperature: float = 0.7
    max_output_tokens: int = 1024
    stop: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class ChatResponse:
    content: str
    input_tokens: int
    output_tokens: int
    model: str
    finish_reason: str  # "stop" | "length" | "tool_use"


@runtime_checkable
class LLMProvider(Protocol):
    """Provider 抽象 —— 各 LLM 实现此 Protocol（KERNEL-01 风格）。"""

    def chat(self, req: ChatRequest, config: ProviderConfig) -> ChatResponse: ...
    def estimate_tokens(self, text: str) -> int: ...


# ─────────────────── 路由策略 ───────────────────


class RoutingStrategy(str, Enum):
    ROUND_ROBIN = "round_robin"
    LOWEST_LATENCY = "lowest_latency"
    CHEAPEST = "cheapest"
    PINNED = "pinned"


@dataclass(frozen=True, slots=True)
class RouteDecision:
    config: ProviderConfig
    reason: str


class ProviderRegistry:
    """Provider 注册表 + 路由选择。"""

    def __init__(self) -> None:
        self._providers: dict[ProviderKind, LLMProvider] = {}
        self._configs: dict[str, ProviderConfig] = {}
        self._rr_counter = 0

    def register_provider(self, kind: ProviderKind, provider: LLMProvider) -> None:
        self._providers[kind] = provider

    def register_config(self, name: str, config: ProviderConfig) -> None:
        self._configs[name] = config

    def get_provider(self, kind: ProviderKind) -> LLMProvider:
        if kind not in self._providers:
            raise KeyError(f"no provider for kind: {kind}")
        return self._providers[kind]

    def route(
        self,
        strategy: RoutingStrategy,
        eligible: tuple[str, ...],
        pinned: str | None = None,
    ) -> RouteDecision:
        if not eligible:
            raise ValueError("eligible configs empty")
        if strategy == RoutingStrategy.PINNED:
            if not pinned or pinned not in self._configs:
                raise ValueError("PINNED strategy requires pinned config")
            return RouteDecision(self._configs[pinned], "pinned")
        if strategy == RoutingStrategy.ROUND_ROBIN:
            name = eligible[self._rr_counter % len(eligible)]
            self._rr_counter += 1
            return RouteDecision(self._configs[name], f"round_robin[{name}]")
        # LOWEST_LATENCY / CHEAPEST — 仅按字典顺序演示，runtime 注入 metric
        name = sorted(eligible)[0]
        return RouteDecision(self._configs[name], f"{strategy.value}[{name}]")


# ─────────────────── Budget 计数 ───────────────────


@dataclass
class TokenBucket:
    """滑动窗口 budget。"""
    window_seconds: int = 60
    max_in: int = 60_000
    max_out: int = 20_000
    _in_history: list[tuple[float, int]] = field(default_factory=list)
    _out_history: list[tuple[float, int]] = field(default_factory=list)

    def consume(self, in_tokens: int, out_tokens: int, now: float | None = None) -> bool:
        now = now or __import__("time").time()
        self._evict(now)
        cur_in = sum(t for _, t in self._in_history)
        cur_out = sum(t for _, t in self._out_history)
        if cur_in + in_tokens > self.max_in or cur_out + out_tokens > self.max_out:
            return False
        self._in_history.append((now, in_tokens))
        self._out_history.append((now, out_tokens))
        return True

    def _evict(self, now: float) -> None:
        cutoff = now - self.window_seconds
        self._in_history = [(t, v) for t, v in self._in_history if t > cutoff]
        self._out_history = [(t, v) for t, v in self._out_history if t > cutoff]


class BudgetExceeded(RuntimeError):
    pass


class BudgetGate:
    """Per-user token bucket gate。"""

    def __init__(self, policy: BudgetPolicy) -> None:
        self.policy = policy
        self._buckets: dict[str, TokenBucket] = {}

    def acquire(self, user_id: str, in_tokens: int, out_tokens: int) -> None:
        b = self._buckets.setdefault(
            user_id,
            TokenBucket(
                max_in=self.policy.max_input_tokens_per_minute,
                max_out=self.policy.max_output_tokens_per_minute,
            ),
        )
        if not b.consume(in_tokens, out_tokens):
            raise BudgetExceeded(
                f"budget exceeded for user={user_id}: in={in_tokens} out={out_tokens}"
            )


__all__ = [
    "ProviderKind",
    "ProviderConfig",
    "BudgetPolicy",
    "ChatMessage",
    "ChatRequest",
    "ChatResponse",
    "LLMProvider",
    "RoutingStrategy",
    "RouteDecision",
    "ProviderRegistry",
    "TokenBucket",
    "BudgetGate",
    "BudgetExceeded",
]