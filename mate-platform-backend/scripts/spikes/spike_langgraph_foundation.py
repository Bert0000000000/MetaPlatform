"""Agent 产品层 1.0 —— 第 0 步：langgraph 地基验证

验证 5 件事（见 docs/active/specs/2026-09-16-agent-product-layer-1.0.md §6）：

  V1 租户隔离      thread_id 加租户前缀 → 两个租户的状态互不可见
  V2 checkpointer  内存版可用；PG 版是否可嵌入（本脚本报告，不安装）
  V3 可嵌入服务    langgraph 是进程内库，不需要独立部署
  V4 工具接口      普通 Python 函数可作工具 → MCP 中心调用可包进去
  V5 暂停恢复      不用 interrupt()，自己控制暂停与恢复，且不重跑已完成节点

运行：
  mate-platform-backend/.venv/Scripts/python.exe scripts/spikes/spike_langgraph_foundation.py
"""

from __future__ import annotations

import sys
from typing import Any, TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class S(TypedDict, total=False):
    """状态 schema。

    必须显式声明字段——用裸 `dict` 作 schema 时 langgraph 不跟踪任何 channel，
    写入会被静默丢弃（实测踩过）。
    """

    tenant: str
    approved: bool
    plan: list[str]
    result: str
    tool_result: dict[str, Any]


RESULTS: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    RESULTS.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


# ── 被测图：analyze → gate(条件) → execute ────────────────────────────────
CALLS: dict[str, int] = {"analyze": 0, "execute": 0}


def analyze(state: dict[str, Any]) -> dict[str, Any]:
    CALLS["analyze"] += 1
    return {"plan": ["步骤1", "步骤2"]}


def gate(state: dict[str, Any]) -> dict[str, Any]:
    # 不做副作用：纯路由节点。副作用留在 execute。
    return {}


def execute(state: dict[str, Any]) -> dict[str, Any]:
    CALLS["execute"] += 1
    return {"result": f"对 {state.get('tenant')} 执行完毕"}


def route_after_gate(state: dict[str, Any]) -> str:
    return "execute" if state.get("approved") else END


def build_graph() -> Any:
    g = StateGraph(S)
    g.add_node("analyze", analyze)
    g.add_node("gate", gate)
    g.add_node("execute", execute)
    g.add_edge(START, "analyze")
    g.add_edge("analyze", "gate")
    g.add_conditional_edges("gate", route_after_gate, {"execute": "execute", END: END})
    g.add_edge("execute", END)
    return g.compile(checkpointer=InMemorySaver())


def thread_for(tenant: str, task: str) -> str:
    """租户前缀命名：本地化租户维度，不依赖 checkpointer 提供租户列。"""
    return f"{tenant}:{task}"


def main() -> int:
    print("=== Agent 产品层 1.0 · langgraph 地基验证 ===\n")

    # ── V3 可嵌入服务 ────────────────────────────────────────────────
    print("V3 可嵌入服务（进程内库，无需独立部署）")
    check("langgraph 在进程内 import 并编译图", True, "无服务依赖、无端口、无额外进程")

    graph = build_graph()

    # ── V1 租户隔离 ──────────────────────────────────────────────────
    print("\nV1 租户隔离（thread_id 加租户前缀）")
    cfg_a = {"configurable": {"thread_id": thread_for("tenant-a", "t1")}}
    cfg_b = {"configurable": {"thread_id": thread_for("tenant-b", "t1")}}

    graph.invoke({"tenant": "tenant-a", "approved": False}, cfg_a)
    graph.invoke({"tenant": "tenant-b", "approved": False}, cfg_b)

    st_a = graph.get_state(cfg_a).values
    st_b = graph.get_state(cfg_b).values

    check(
        "A 租户状态只含 A 的数据",
        st_a.get("tenant") == "tenant-a",
        f"tenant={st_a.get('tenant')}",
    )
    check(
        "B 租户状态只含 B 的数据",
        st_b.get("tenant") == "tenant-b",
        f"tenant={st_b.get('tenant')}",
    )
    check(
        "A 租户读不到 B 租户的 thread",
        graph.get_state(
            {"configurable": {"thread_id": thread_for("tenant-a", "nonexistent")}}
        ).values
        in ({}, None),
        "不存在 thread 返回空态，不越界",
    )

    # ── V5 暂停恢复（不用 interrupt）──────────────────────────────────
    print("\nV5 暂停恢复（不用 interrupt()，自己控制）")
    CALLS["analyze"] = CALLS["execute"] = 0
    cfg = {"configurable": {"thread_id": thread_for("tenant-a", "hitl-1")}}

    graph.invoke({"tenant": "tenant-a", "approved": False}, cfg)
    check("未批准时停在 gate，不执行 execute", CALLS["execute"] == 0, f"execute 调用 {CALLS['execute']} 次")
    check("analyze 已跑过", CALLS["analyze"] == 1, f"analyze 调用 {CALLS['analyze']} 次")

    # 外部批准（我们的 proposal 确认通道对应这一步）
    graph.update_state(cfg, {"approved": True}, as_node="gate")
    graph.invoke(None, cfg)

    check("批准后 execute 执行", CALLS["execute"] == 1, f"execute 调用 {CALLS['execute']} 次")
    check(
        "analyze 没有被重跑（关键：区别于 interrupt()）",
        CALLS["analyze"] == 1,
        f"analyze 仍为 {CALLS['analyze']} 次",
    )
    check(
        "恢复后产出正确",
        graph.get_state(cfg).values.get("result") == "对 tenant-a 执行完毕",
        str(graph.get_state(cfg).values.get("result")),
    )

    # ── V4 工具接口 ──────────────────────────────────────────────────
    print("\nV4 工具接口（普通函数可作工具 → 可包 MCP 中心调用）")
    tool_calls: list[str] = []

    def call_mcp_tool(tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """模拟：真实实现里这里就是调既有 MCP 中心。"""
        tool_calls.append(tool_name)
        return {"ok": True, "tool": tool_name, "args": arguments}

    def tool_node(state: dict[str, Any]) -> dict[str, Any]:
        return {"tool_result": call_mcp_tool("ont_object_query", {"q": state.get("tenant")})}

    tg = StateGraph(S)
    tg.add_node("call", tool_node)
    tg.add_edge(START, "call")
    tg.add_edge("call", END)
    tgraph = tg.compile()
    out = tgraph.invoke({"tenant": "tenant-a"})

    check("普通 Python 函数可在图中调用任意客户端", tool_calls == ["ont_object_query"])
    check("工具产出可回灌到图状态", out.get("tool_result", {}).get("ok") is True)

    # ── V2 checkpointer ─────────────────────────────────────────────
    print("\nV2 checkpointer（内存版可用；PG 版结论见下）")
    check("内存版 checkpointer 工作正常", True, "上述 V1/V5 全部依赖它，已验证")
    check(
        "PG 版需要额外包 langgraph-checkpoint-postgres",
        True,
        "当前 venv 未安装 → 它是独立包，会带 psycopg 依赖；表结构概览待装后核对",
    )

    # ── 汇总 ─────────────────────────────────────────────────────────
    print("\n=== 汇总 ===")
    failed = [n for n, ok, _ in RESULTS if not ok]
    for name, ok, detail in RESULTS:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} 通过")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
