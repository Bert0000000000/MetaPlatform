# 决策纪要：12 决策点 + 3 锁死问题

> 日期：2026-08-06 · 来源：蓝图 `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` v0.4 讨论
> 关联：ADR-0021 / ADR-0040 / ADR-0041

## A 组 · 顶层设计

| # | 决策点 | 选择 | 落地 |
|---|---|---|---|
| A1 | AI 训练 | **b** RAG + 规则 + 偶发微调 | MP-RAG-ONT-01 主导本体语料 RAG；微调走 OntologyManager 变更管理 + 回归测试 |
| A2 | Agent 数量 | **7 + N** | 7 内置 + Marketplace 第三方注册表 |
| A3 | 多 Agent 编排 | **b** 新建 `mate-tech-orchestrator` | 新包独立于 LangGraph，吸收 `mate-app-copilot` 主入口 |
| A4 | 数字员工归属 | **c** 混合 | 内置 7 共享 + Marketplace 租户级订阅 |

## B 组 · 沙箱设计

| # | 决策点 | 选择 | 落地 |
|---|---|---|---|
| B1 | 默认沙箱等级 | **b** Function L2 + 第三方 L3 | Function Runtime K8s Pod；Marketplace 强制 MicroVM |
| B2 | 凭证模型 | **b** 会话级短期 token | `auth/session.py` 颁发，Function 拿 service-to-service 凭证 |
| B3 | HITL 强制 | **a** 每次 ≥1 暂停 | Orchestrator 状态机强校验 |
| B4 | SANDBOX-01 进 M1 | **a** 是 | 跟 KERNEL-01 并行 |

## C 组 · 会话沙箱

| # | 决策点 | 选择 | 落地 |
|---|---|---|---|
| C1 | 会话默认时长 | **c** 可配置 | 默认 30 分钟，可配 24h |
| C2 | 跨会话偏好 | **b** opt-in | 默认不加载，UI 显式选择 |
| C3 | 素材 GC | **c** 默认不保留 | 默认 discard，可 opt-in keep_7d |
| C4 | 多设备同会话 | **a** 同步 | 多设备共用 plan + history |

## 锁死问题

| # | 问题 | 选择 | 落地 |
|---|---|---|---|
| L1 | OWL 兼容层 | **b** 直接迁移 v2 | 一次性数据迁移 + 旧表 deprecate，owl/io.py 保留导入导出 |
| L2 | Function Runtime 宿主 | **K8s Job/Pod**（最佳实践） | Function Runtime 默认 K8s Job；拒绝 Python 进程池 |
| L3 | OntologyManager 存储 | **a** PG 表 | `ont_versions` + `ont_proposals` + `ont_branches` |

## 决策一致性自检

- A1(b) + C1(c) 一致：偶发微调有变更窗口；不会与 30 分钟会话冲突
- A2(7+N) + A4(c) + B1(b) 一致：7 内置共享 + N 第三方 L3 强制
- A3(b) + B3(a) + C4(a) 一致：新建 orchestrator 状态机强校验 HITL + 同步 plan
- B2(b) + ADR-0041 一致：会话级短期 token 颁发流已闭环
- L1(b) + ADR-0021 §3 一致：OWL 兼容层迁移窗口已定
- L2(K8s) + B1(b) 一致：L2 容器 = K8s Job/Pod
- L3(a) + ADR-0021 §2 一致：Version 是 PG 不可变表

## 下一步动作

1. 蓝图 v0.4 已落档：`docs/active/specs/2026-08-06-ontology-kernel-blueprint.md`
2. 三份 ADR 草稿已落档：
   - `docs/active/decisions/ADR-0021-kernel-12-primitives.md`
   - `docs/active/decisions/ADR-0040-sandbox-architecture.md`
   - `docs/active/decisions/ADR-0041-session-sandbox.md`
3. v3.1 任务板登记 20 个 Batch（依赖图见蓝图 v0.4 §8）
4. 待 v0.5 补抓 Palantir 官方 7 个核心页正文，替换"可证伪"行
