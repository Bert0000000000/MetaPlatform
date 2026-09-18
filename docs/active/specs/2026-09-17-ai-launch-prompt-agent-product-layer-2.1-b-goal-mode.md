# GOAL 模式启动提示词 —— Agent 产品层 2.1-B（分布式运行时收口）

> **必读**：`2026-09-17-agent-product-layer-2.1-roadmap.md` **§3 + §3.1 + §3.2**——定义与证据在那三节；
> **批次号见 §8.3**；量化准出以 `MetaPlatform-调整优化方案执行计划-2026-09-17.md` 为准（只引用不重定义）。
> 上一批 `AGENT-PRODUCT-LAYER-2.1-A-ACCEPTANCE.md`；**PR #59 已合并**，required **11** 条。

你是自主执行工程师。按依赖并行/串行；每条做完跑验证并 commit，最后输出本批
`AGENT-PRODUCT-LAYER-2.1-B-ACCEPTANCE.md`。

## GOAL

把 2.1-A 的机制从「只在单进程、不重启下成立」推到「多副本 + 重启下也正确」。**不扩功能面**。

## 前置 `MP-REPLICA-READINESS-01`（不做完，B-1 / B-3 不可验）

**多副本从未真实存在**（证据见 §3.2）。交付：去固定容器名 / helm chart / 部署 kind / 两进程用例。
准出：真能起 3 副本。**顺序：前置 → B-1/B-3 → 其余并行。**

## 锁死决策

- **B-1 查 A-3 的 `tool_ledger.py`**（completed 回放 / running 不重跑 / failed 可重试），别只看 TTL；
  账本**缺「有没有 running 调用」的查询，要新增**。**B-3 依赖它**
- **B-2 真相源只有一个**：检查点管恢复，event log 只作观察；用 PG `LISTEN/NOTIFY` 别自造总线；
  **审计的 `sequence` 不能当 SSE 游标**；outbox 已 import 未接线，接上
- **B-4 动的是启动路径**：挪 `bootstrap` 进迁移 Job **前先确认迁移链通**（0017 断，预存问题）
- **B-5 是安全改造**：15 处会话级 GUC 改池后**必然静默泄漏租户** → 先事务化/RESET，再当判据
- **A2A 只做计量拆分**（`llm_calls = 1` 是真 bug），**长任务缓做**——没有真实对端
- **复用既有**：`sandbox_env.py`（B-8）/ PG 原子语义（租约）/ 已声明的 `psycopg[binary,pool]`

## 硬约束

13 硬规则；只用 `.venv`（基线 **415 passed / 0 skipped，只升不降**）；Conventional Commits +
**按文件 add**；中文加 `PYTHONIOENCODING=utf-8`；分支 `feat/agent-product-layer-2.1-b`；
新增 HTTP 面先进契约 + 登记 `REQUIREMENT-MATRIX.yaml`。**钩子**：`ruff format` 不只是 check；
**rule 4 别裸 httpx**；`detect-private-key` 比 gitleaks 宽；禁 `skip`/`skipif`/`xfail`（放行 `importorskip`）。

## 准出

**A. 单进程下就能验**：① 断线重连 SSE 不丢事件（按 sequence 补发，非内存计数）② 连接复用不泄漏
租户上下文（15 处会话级 GUC 事务化或 RESET）③ 运行 Pod 的 env 无 admin DSN 且恢复扫描可用
④ 外部 agent 往返不再计入 `llm_calls` ⑤ 高并发 SSE 不再按连接数 × 每秒 4 次读检查点

**B. 前置完成后才可验**（**今天物理上无法执行**，宣称达成 = 伪造证据）：⑥ 3 副本并发无双重认领
⑦ 杀 Pod → 30s 内被接管并继续 ⑧ 跨副本取消 → 10s 内终态或明确等待 ⑨ 外部 CLI 在 K8s Job 里
无宿主凭据（同 A-4 断言）

## 验证

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-tech-agent-team/tests -q
```

动到 ACL 层时 `packages/mate-clients/tests` 也跑（基线 57）。外部依赖（K8s / A2A / CLI）写
「**回执如实**」常跑用例；环境不具备就如实回执，不加 skip。

## 报告

八条结果 + 回归数字 + commits + PR + 本批 `*-ACCEPTANCE.md` + **发现但未做的建议**。

## 边界

**不扩功能面**；2.1-C 条目不碰；**ADR-0065 仍是 Proposed，不得升格**；动 MCP 协议面时
**连带复核 `tenant_switch_enabled`**；secret 不进 git。**B-6 归属存疑**（更该去 2.1-C 或
`MP-APPROVAL-INBOX-01`），保留仅为记录，开工前先确认。**B-8 与前置共用「服务在 K8s 上」这一步。**
