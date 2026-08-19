"""mate_app_copilot.dispatcher — SuperAI 多级 fallback 派发（任务2）。

背景
----
当前 LLM FC 决策不可用 / 不返回 ``dispatch_employee`` 时，走单一的
``_fallback_decision``（role slug 子串匹配）。这层兜底在 role 数增长后召回率
会迅速下降。

做法
----
提供 4 级 fallback 链（顺序可配），每级有独立 handler：

  1. ``a2a`` — A2A 协议直发（``OrchestratorClient.dispatch``，已有；用 ``target_hint``）
  2. ``kernel_role`` — ``mate_kernel.agent.orchestrator.AgentSelector`` 把 rid
     按前缀分类到 ``AgentRole``（kernel 内核 stub，零 LLM）
  3. ``embedding_match`` — ``SemanticRouter`` 算 top-k 候选，按相似度派发 top-1
  4. ``keyword_substring`` — role slug 子串匹配（``_fallback_decision`` 等价行为）

每级可独立注入 ``handler``（``None`` 即跳过该级），便于单测。任意 handler
抛异常都会降级到下一级；首条命中即返回 ``DispatchResult``。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from .semantic_router import CandidateRole, SemanticRouter


# ────────────────── 数据结构 ──────────────────


@dataclass(frozen=True, slots=True)
class FallbackStep:
    """Fallback 链中一级。"""

    kind: str  # "a2a" | "kernel_role" | "embedding_match" | "keyword_substring"
    target: str | None = None  # 可选 hint（a2a agent_rid / AgentRole.value / role_slug）


@dataclass(frozen=True, slots=True)
class DispatchResult:
    """派发结果。"""

    source: str  # 命中 fallback kind；"none" = 全部失败
    target_rid: str | None  # 派发目标（None = 全部失败）
    reason: str
    candidates: tuple[CandidateRole, ...] = ()  # 决策过程观察用（前端 trace）

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "target_rid": self.target_rid,
            "reason": self.reason,
            "candidates": [c.to_dict() for c in self.candidates],
        }


DEFAULT_CHAIN: tuple[FallbackStep, ...] = (
    FallbackStep("a2a"),
    FallbackStep("kernel_role"),
    FallbackStep("embedding_match"),
    FallbackStep("keyword_substring"),
)


# ────────────────── handler 类型签名 ──────────────────


# (target_hint, user_message) → DispatchResult | None；None = 不命中，让链继续
A2AHandler = Callable[[str, str], Awaitable[DispatchResult | None]]
KernelRoleHandler = Callable[[str, str], DispatchResult | None]
# (user_message, roles) → DispatchResult | None
EmbeddingHandler = Callable[[str, list[dict[str, Any]]], DispatchResult | None]
KeywordHandler = Callable[[str, list[dict[str, Any]]], DispatchResult | None]


# ────────────────── 主入口 ──────────────────


async def dispatch_by_routing(
    user_message: str,
    available_roles: list[dict[str, Any]],
    *,
    fallback_chain: list[FallbackStep] | tuple[FallbackStep, ...] | None = None,
    a2a_handler: A2AHandler | None = None,
    kernel_role_handler: KernelRoleHandler | None = None,
    embedding_handler: EmbeddingHandler | None = None,
    keyword_substring_handler: KeywordHandler | None = None,
    semantic_router: SemanticRouter | None = None,
    target_hint: str | None = None,
) -> DispatchResult:
    """按 ``fallback_chain`` 顺序降级，每级试对应 handler；首个非 ``None`` 即返回。

    Parameters
    ----------
    user_message:
        用户原始消息。
    available_roles:
        orchestrator 注册的 role 列表（与 ``run_agent_loop.roles`` 同源）。
    fallback_chain:
        降级链；缺省 = ``DEFAULT_CHAIN``（a2a → kernel_role → embedding_match →
        keyword_substring）。
    a2a_handler / kernel_role_handler / embedding_handler / keyword_substring_handler:
        各级的 handler；``None`` = 跳过该级。
    semantic_router:
        ``embedding_handler`` 缺省时由本入口内部 ``SemanticRouter`` 跑；可注入
        自定义 router 以共享缓存。
    target_hint:
        上层（LLM FC、调用方）已选定的 target_rid。``a2a`` / ``kernel_role``
        级若 ``step.target`` 缺省则回退到此值。

    Returns
    -------
    DispatchResult
        ``source="none"`` 表示链上无一步命中。
    """
    chain = list(fallback_chain) if fallback_chain else list(DEFAULT_CHAIN)

    if not available_roles:
        return DispatchResult(
            source="none",
            target_rid=None,
            reason="no available roles",
        )

    # 让 embedding_handler 缺省时复用 caller 传入的 router（共享 cache）
    _embedding_router = semantic_router

    last_candidates: tuple[CandidateRole, ...] = ()

    for step in chain:
        kind = step.kind
        try:
            if kind == "a2a":
                if a2a_handler is None:
                    continue
                hint = step.target or target_hint
                if not hint:
                    continue
                result = await a2a_handler(hint, user_message)
                if result is not None:
                    return result

            elif kind == "kernel_role":
                if kernel_role_handler is None:
                    continue
                hint = step.target or target_hint
                if not hint:
                    continue
                result = kernel_role_handler(hint, user_message)
                # 仅当 handler 真正选定 target_rid 才算命中；
                # SUPERAI 默认 / 无效分类 → 让链继续降级。
                if result is not None and result.target_rid:
                    return result

            elif kind == "embedding_match":
                if embedding_handler is None:
                    continue
                result = embedding_handler(user_message, available_roles)
                if result is not None and result.target_rid:
                    if result.candidates:
                        last_candidates = result.candidates
                    return result

            elif kind == "keyword_substring":
                if keyword_substring_handler is None:
                    continue
                result = keyword_substring_handler(user_message, available_roles)
                if result is not None and result.target_rid:
                    return result

            else:
                # 未知 kind：跳过
                continue

        except Exception:
            # 任何 handler 异常 → 降级到下一级
            continue

    return DispatchResult(
        source="none",
        target_rid=None,
        reason="no fallback step matched",
        candidates=last_candidates,
    )


# ────────────────── 默认 handler 工厂 ──────────────────


def make_keyword_substring_handler() -> KeywordHandler:
    """等价于 ``_fallback_decision`` 的 keyword_substring 匹配（向后兼容）。"""

    def _handler(user_message: str, roles: list[dict[str, Any]]) -> DispatchResult | None:
        text = user_message.lower()
        for role in roles:
            slug = str(role.get("role") or "")
            if slug and slug in text:
                return DispatchResult(
                    source="keyword_substring",
                    target_rid=slug,
                    reason=f"role slug {slug!r} found in user message (substring)",
                )
        return None

    return _handler


def make_embedding_match_handler(
    *,
    router: SemanticRouter | None = None,
    top_k: int = 3,
    min_similarity: float = 0.05,
) -> EmbeddingHandler:
    """用 ``SemanticRouter`` 选 top-1 候选（相似度 > ``min_similarity`` 才命中）。

    低于阈值时仍返回 ``DispatchResult(target_rid=None)`` 让上层知道「算过但不
    够相似」；最终降级会落到 ``source="none"``。
    """
    r = router or SemanticRouter()

    def _handler(
        user_message: str, roles: list[dict[str, Any]],
    ) -> DispatchResult | None:
        cands = r.route(user_message, roles, top_k=top_k)
        if not cands:
            return None
        best = cands[0]
        cands_tuple = tuple(cands)
        if best.similarity < min_similarity:
            return DispatchResult(
                source="embedding_match",
                target_rid=None,
                reason=(
                    f"best similarity {best.similarity:.3f} below threshold "
                    f"{min_similarity}"
                ),
                candidates=cands_tuple,
            )
        return DispatchResult(
            source="embedding_match",
            target_rid=best.role_slug,
            reason=(
                f"top candidate by similarity ({best.similarity:.3f}, "
                f"reason={best.reason})"
            ),
            candidates=cands_tuple,
        )

    return _handler


def make_kernel_role_handler() -> KernelRoleHandler:
    """用 ``mate_kernel.agent.orchestrator.AgentSelector`` 把 rid 分类。"""
    from mate_kernel.agent.orchestrator import AgentSelector  # 局部导入避免循环

    selector = AgentSelector()

    def _handler(target_rid: str, user_message: str) -> DispatchResult | None:
        role = selector.select(target_rid)
        if role.value == "superai":
            # 默认 = SUPERAI；不构成有效命中，让链继续
            return DispatchResult(
                source="kernel_role",
                target_rid=None,
                reason=(
                    f"AgentSelector classify {target_rid!r} as SUPERAI "
                    "(default; not a specific agent)"
                ),
            )
        return DispatchResult(
            source="kernel_role",
            target_rid=role.value,
            reason=f"AgentSelector classified {target_rid!r} as {role.value}",
        )

    return _handler


__all__ = [
    "A2AHandler",
    "DEFAULT_CHAIN",
    "DispatchResult",
    "EmbeddingHandler",
    "FallbackStep",
    "KeywordHandler",
    "KernelRoleHandler",
    "dispatch_by_routing",
    "make_embedding_match_handler",
    "make_kernel_role_handler",
    "make_keyword_substring_handler",
]