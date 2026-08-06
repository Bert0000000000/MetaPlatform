"""AIP Gateway (AIP-GATEWAY-01) 测试。"""

from __future__ import annotations

import pytest

from mate_kernel.aip.gateway import (
    BudgetExceeded,
    BudgetGate,
    BudgetPolicy,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ProviderConfig,
    ProviderKind,
    ProviderRegistry,
    RouteDecision,
    RoutingStrategy,
    TokenBucket,
)


class _FakeProvider:
    def __init__(self, resp_content: str = "ok") -> None:
        self._content = resp_content

    def chat(self, req: ChatRequest, config: ProviderConfig) -> ChatResponse:
        total = sum(len(m.content) for m in req.messages) // 4
        return ChatResponse(
            content=self._content,
            input_tokens=total,
            output_tokens=10,
            model=config.model,
            finish_reason="stop",
        )

    def estimate_tokens(self, text: str) -> int:
        return max(1, len(text) // 4)


class TestProviderRegistry:
    def _reg(self) -> tuple[ProviderRegistry, ProviderConfig, ProviderConfig]:
        r = ProviderRegistry()
        c1 = ProviderConfig(kind=ProviderKind.OPENAI, model="gpt-4o")
        c2 = ProviderConfig(kind=ProviderKind.ANTHROPIC, model="claude-sonnet-4")
        r.register_config("gpt4o", c1)
        r.register_config("claude", c2)
        return r, c1, c2

    def test_register_provider_and_get(self) -> None:
        r, _, _ = self._reg()
        r.register_provider(ProviderKind.OPENAI, _FakeProvider())
        p = r.get_provider(ProviderKind.OPENAI)
        assert isinstance(p, _FakeProvider)

    def test_get_missing_provider_raises(self) -> None:
        r, _, _ = self._reg()
        with pytest.raises(KeyError, match="no provider"):
            r.get_provider(ProviderKind.AZURE_OPENAI)

    def test_route_round_robin(self) -> None:
        r, _, _ = self._reg()
        d1 = r.route(RoutingStrategy.ROUND_ROBIN, ("gpt4o", "claude"))
        d2 = r.route(RoutingStrategy.ROUND_ROBIN, ("gpt4o", "claude"))
        assert d1.config.model != d2.config.model

    def test_route_pinned(self) -> None:
        r, c1, _ = self._reg()
        d = r.route(RoutingStrategy.PINNED, ("gpt4o", "claude"), pinned="gpt4o")
        assert d.config == c1
        assert d.reason == "pinned"

    def test_route_pinned_without_pinned_raises(self) -> None:
        r, _, _ = self._reg()
        with pytest.raises(ValueError, match="PINNED"):
            r.route(RoutingStrategy.PINNED, ("gpt4o",))

    def test_route_empty_eligible_raises(self) -> None:
        r, _, _ = self._reg()
        with pytest.raises(ValueError, match="empty"):
            r.route(RoutingStrategy.ROUND_ROBIN, ())

    def test_route_cheapest_deterministic(self) -> None:
        r, _, _ = self._reg()
        d = r.route(RoutingStrategy.CHEAPEST, ("gpt4o", "claude"))
        assert d.config.model == "claude-sonnet-4"  # 按字典序最小


class TestChatRequest:
    def test_basic(self) -> None:
        req = ChatRequest(
            messages=(ChatMessage(role="user", content="hi"),),
        )
        assert req.messages[0].role == "user"
        assert req.temperature == 0.7

    def test_immutable(self) -> None:
        req = ChatRequest(messages=(ChatMessage(role="user", content="hi"),))
        with pytest.raises(Exception):
            req.temperature = 0.0  # type: ignore[misc]


class TestFakeProviderChat:
    def test_returns_response(self) -> None:
        p = _FakeProvider("hello back")
        req = ChatRequest(messages=(ChatMessage(role="user", content="hi there"),))
        resp = p.chat(req, ProviderConfig(kind=ProviderKind.OPENAI, model="gpt-4o"))
        assert resp.content == "hello back"
        assert resp.input_tokens > 0
        assert resp.finish_reason == "stop"


class TestBudgetGate:
    def test_basic_consume(self) -> None:
        gate = BudgetGate(BudgetPolicy(max_input_tokens_per_minute=100))
        gate.acquire("alice", in_tokens=30, out_tokens=10)
        gate.acquire("alice", in_tokens=40, out_tokens=10)  # 总 70 in ✓

    def test_exceeds(self) -> None:
        gate = BudgetGate(BudgetPolicy(max_input_tokens_per_minute=50))
        gate.acquire("alice", in_tokens=30, out_tokens=10)
        with pytest.raises(BudgetExceeded, match="budget exceeded"):
            gate.acquire("alice", in_tokens=30, out_tokens=10)

    def test_separate_users(self) -> None:
        gate = BudgetGate(BudgetPolicy(max_input_tokens_per_minute=30))
        gate.acquire("alice", in_tokens=30, out_tokens=0)
        gate.acquire("bob", in_tokens=30, out_tokens=0)  # bob 独立 ✓


class TestTokenBucket:
    def test_window_eviction(self) -> None:
        import time
        b = TokenBucket(window_seconds=1, max_in=100, max_out=100)
        now = time.time()
        assert b.consume(50, 0, now=now)
        # 跨过窗口
        assert b.consume(80, 0, now=now + 2.0)

    def test_consume_over_max(self) -> None:
        b = TokenBucket(max_in=10, max_out=10)
        assert not b.consume(20, 0)