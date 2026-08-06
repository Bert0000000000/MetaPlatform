"""mate-tech-ont v2 kernel HTTP 适配（RUNTIME-HTTP-01）。

把 v3.1 KERNEL-01 的 12 基元 Protocol 暴露为 5 核心 REST 端点：
- ObjectType CRUD
- Individual CRUD
- ObjectSet evaluate
- ActionType apply

所有写路径走 `OntologyRepository` Protocol；repository 单例由
`mate_tech_ont.main.on_startup` 选择 InMemory（dev）或 PG（prod）后挂到
`app.state.kernel_repo`。
"""

from __future__ import annotations