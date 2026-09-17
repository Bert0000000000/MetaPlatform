"""A2A 出站适配器（轨 2 · 外联）。

**只导出本仓类型**（R10）：``A2AOutboundRequest`` / ``A2AOutboundResult`` /
``A2ATransport`` / ``A2AOutboundClient`` / ``A2AOutboundRuntime``。官方 ``a2a-sdk``
**不在**这里 import——它在 :mod:`.sdk` 里，且由 :func:`build_a2a_outbound_client`
惰性加载。于是"没装 a2a-sdk"也不会让本包 import 失败，注入替身的测试更不需要它。

两条 A2A 不变量（没有深度/父子；终态 Task 不收消息）的落地位置见 :mod:`.outbound`
的模块注释——那是本轨最该被记住的一页。
"""

from __future__ import annotations

from .outbound import (
    DEFAULT_A2A_ENDPOINT,
    DEFAULT_ROLE_SLUGS,
    FALLBACK_ROLE_SLUG,
    A2AOutboundClient,
    A2AOutboundRequest,
    A2AOutboundResult,
    A2AOutboundRuntime,
    A2ATerminalTask,
    A2ATransport,
    build_a2a_outbound_client,
)

__all__ = [
    "DEFAULT_A2A_ENDPOINT",
    "DEFAULT_ROLE_SLUGS",
    "FALLBACK_ROLE_SLUG",
    "A2AOutboundClient",
    "A2AOutboundRequest",
    "A2AOutboundResult",
    "A2AOutboundRuntime",
    "A2ATerminalTask",
    "A2ATransport",
    "build_a2a_outbound_client",
]
