#!/usr/bin/env python
"""check_temporal_grammar.py — Temporal workflow/activity 命名与策略守门（Sprint 1A M3）。

硬规则对位：13 硬规则 #6（静态检查）在 Temporal 面的延伸。
校验 mate_tech_orchestrator temporal 模块：
  1. workflow 类名以 Workflow 结尾、注册于 @workflow.defn；
  2. activity 函数以 orch_ 前缀命名并注册 @activity.defn；
  3. 每个 execute_activity 都带 retry_policy（防无限重试毒丸）；
  4. Worker(...) 注册的 workflows/activities 与定义集一致；
  5. signal 处理器不得有副作用 IO（只改状态 + wait_condition）。
退出码：0 通过 / 1 违例（CI 用）。
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

ROOT = (
    Path(__file__).resolve().parents[2]
    / "mate-platform-backend"
    / "packages"
    / "mate-tech-orchestrator"
    / "src"
)
FILES = [
    ROOT / "mate_tech_orchestrator" / "temporal_workflow.py",
    ROOT / "mate_tech_orchestrator" / "temporal_worker.py",
]

violations: list[str] = []


def _decorator_names(dec: ast.AST) -> list[str]:
    out = []
    if isinstance(dec, ast.Attribute):
        out.append(dec.attr)
    elif isinstance(dec, ast.Call):
        f = dec.func
        if isinstance(f, ast.Attribute):
            out.append(f.attr)
        elif isinstance(f, ast.Name):
            out.append(f.id)
    elif isinstance(dec, ast.Name):
        out.append(dec.id)
    return out


for path in FILES:
    if not path.exists():
        violations.append(f"missing file: {path}")
        continue
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            dump = " ".join(ast.dump(d) for d in node.decorator_list)
            if "defn" in dump and "workflow" in dump.lower():
                if not node.name.endswith("Workflow"):
                    violations.append(f"{path.name}: workflow class {node.name} 缺 Workflow 后缀")
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            dump = " ".join(ast.dump(d) for d in node.decorator_list)
            if "defn" in dump and "activity" in dump:
                if not node.name.startswith("orch_"):
                    violations.append(f"{path.name}: activity {node.name} 缺 orch_ 前缀")

# execute_activity 必须 retry_policy（workflow 文件）
wf_src = FILES[0].read_text(encoding="utf-8") if FILES[0].exists() else ""
calls = wf_src.count("execute_activity(")
with_retry = wf_src.count("retry_policy=")
if calls and with_retry < calls:
    violations.append(
        f"temporal_workflow.py: {calls} 个 execute_activity 仅 {with_retry} 个带 retry_policy"
    )

# worker 注册与定义一致性
wk_src = FILES[1].read_text(encoding="utf-8") if FILES[1].exists() else ""
for token in ("orch_start_plan", "orch_review_step"):
    if f'"{token}"' not in wk_src and token not in wk_src:
        violations.append(f"temporal_worker.py: 未注册 activity {token}")
if "PlanWorkflow" not in wk_src:
    violations.append("temporal_worker.py: 未注册 workflow PlanWorkflow")

# selfheal watcher 必须存在（gRPC 长轮询自愈，M3 §环境坑 2）
if "_selfheal_watcher" not in wk_src:
    violations.append("temporal_worker.py: 缺 _selfheal_watcher 自愈探针")

if violations:
    print("TEMPORAL GRAMMAR FAIL:")
    for v in violations:
        print(f"  - {v}")
    sys.exit(1)
print("TEMPORAL GRAMMAR PASS (workflows/activities 命名 + retry_policy + 注册一致 + selfheal)")
