"""G23：FunctionStub —— 测试/演练桩（记录调用 + 可配置返回）。

配合 repo.register_function(function_ref, stub)（既有 invoker 机制）：
单测/沙盒演练不必注册真实源码或沙箱执行器。
"""

from __future__ import annotations

from typing import Any

__all__ = ["FunctionStub"]


class FunctionStub:
    """记录每次调用的 (target_iid, parameters) 并返回可配置结果。

    用法::

        stub = FunctionStub(result={"decision": "approve"})
        repo.register_function("ont.t.fn.decide.v1", stub)
        ...  # apply 后断言 stub.calls == [(target, params)]
    """

    def __init__(self, result: Any = None, *, error: Exception | None = None,
                 fail_first_n: int = 0) -> None:
        self.result = result
        self.error = error
        self.fail_first_n = fail_first_n  # 前 N 次抛错（演练失败路径）
        self.calls: list[tuple[str | None, dict[str, Any]]] = []

    def __call__(self, target_iid: str | None, parameters: dict[str, Any]) -> Any:
        self.calls.append((target_iid, dict(parameters)))
        if len(self.calls) <= self.fail_first_n and self.error is not None:
            raise self.error
        if self.error is not None and len(self.calls) <= self.fail_first_n:
            raise self.error
        return self.result
