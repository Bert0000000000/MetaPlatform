"""失败重试的策略（1.5 任务 4）。

**重试包住哪一段，是这件事的真问题**：本图里 ``worker`` 节点先**派活**（建
``team_task`` 行、落审计行、越权转 proposal 都是副作用），再调运行时。所以重试
循环只包住**运行时那一次调用**——派活在循环外面，只发生一次。

**刻意不用 langgraph 的节点级 ``RetryPolicy``**：它重跑的是整个节点函数，等于
"重试几次就派几次活、落几行审计"，正是 1.0 定「不用 ``interrupt()``」的同一个
理由——不能把一个**已经产生副作用**的节点再跑一遍。框架能力在这条边界上不安全，
所以这里只有"次数 + 退避"这点策略，不含任何编排语义。

**哪些失败可重试**由实现自己声明：抛 :class:`~mate_tech_agent_team.runtime.
TransientRunError` = "这一次没跑成，且没有任何副作用落地"。确定性失败（员工不
存在、参数不合法）走正常的 ``SubTaskResult(status="error")``，不重试——重试是给
"可能这次不行"准备的，不是给"每次都不行"准备的。
"""

from __future__ import annotations

from dataclasses import dataclass

#: 重试次数的部署默认值（含第一次尝试）。
DEFAULT_MAX_ATTEMPTS = 3

#: 退避基数（秒）；第 n 次失败后等 ``base_delay * 2^(n-1)``。
DEFAULT_BACKOFF_SECONDS = 0.25


@dataclass(frozen=True, slots=True)
class RetryPolicy:
    """一个失败节点的重试策略：最多试几次、每次之间等多久。

    ``max_attempts`` 是**含首次尝试**的总次数（``max_attempts=1`` = 不重试）。
    """

    max_attempts: int = DEFAULT_MAX_ATTEMPTS
    base_delay: float = DEFAULT_BACKOFF_SECONDS

    def __post_init__(self) -> None:
        if self.max_attempts < 1:
            raise ValueError(f"max_attempts 至少为 1 次尝试，收到 {self.max_attempts}")

    def delay_for(self, attempt: int) -> float:
        """第 ``attempt`` 次失败之后、下一次尝试之前等多久（1-based，指数退避）。"""
        return max(self.base_delay, 0.0) * (2 ** (attempt - 1))


__all__ = ["DEFAULT_BACKOFF_SECONDS", "DEFAULT_MAX_ATTEMPTS", "RetryPolicy"]
