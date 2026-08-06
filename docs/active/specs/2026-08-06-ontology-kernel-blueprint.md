# Ontology Kernel + 数字员工 + SuperAI —— 蓝图 v0.4

> 起草：2026-08-06 · 状态：Ready for ADR 收口
>
> 上一版：v0.3（已合并"双层沙箱 + 用户级会话沙箱"）
> 本版新增：12 决策点收口 + 3 锁死问题 + 自建原则 + 完整 20 Batch 路线 + 现状对位
>
> 范围：mate-kernel（领域基元）+ mate-ont（语义/动能服务）+ mate-platform 横切（auth/tenancy/messaging/observability/lineage）+ 17 域 OpenAPI 合约 + 7 类数字员工 + SuperAI 编排平面。

---

## 0. 引用与可证伪边界

本文件区分三类内容：

1. **【Palantir 原文】** —— 直接来自 `https://www.palantir.com/docs/foundry/ontology/overview` 已抓取段落，存于 `palantir_ontology_dump/overview.txt`。
2. **【MetaPlatform 现状】** —— 基于仓库代码与 ADR 的事实判断，标注文件路径。
3. **【本蓝图推导】** —— 面向 v3.1 的设计建议；不是 Palantir 官方原话，需 ADR 通过。

**自建原则（v0.4 强约束）**：本蓝图**不引入 Palantir 任何官方开源组件**（包括但不限于 `palantir/foundry-platform-python`、`palantir/foundry-platform-typescript`、`palantir/foundry-dev-tools`、`palantir/magritte`、`palantir/conjure`）。所有 Ontology 服务端能力、SDK 形态、协议描述符**全部自建**。客户端统一用 OpenAPI Generator 封装在 `mate-clients/sdk/`。

---

## 1. 【Palantir 原文】可逐字引用的 5 条核心论断

1. **Operational Layer** —— The Palantir Ontology is an operational layer for the organization.
2. **On Top of Digital Assets** —— sits on top of the digital assets (datasets, virtual tables, and models).
3. **Digital Twin = Semantics + Kinetics** —— semantic elements (objects, properties, links) and kinetic elements (actions, functions, dynamic security).
4. **Polymorphism via Interface** —— Interfaces provide object type polymorphism, allowing for consistent modeling of and interaction with object types that share a common shape.
5. **Kinetics 包含 dynamic security** —— dynamic security 是 kinetic 元素的一部分。

> 待补抓：`/object-types /link-types /action-types /functions /interfaces /markings /aip/agents-overview` 正文章节。在补抓前，本蓝图对这几页的"可证伪"边界仅以"业内共识"引用。

---

## 2. 三大顶层原理

| # | 原理 | 出处 |
|---|---|---|
| 1 | **Operational Layer** —— 本体 = 组织级操作层，叠加在数据资产之上 | Palantir 原文 |
| 2 | **Digital Twin = Semantics + Kinetics** —— 业务由不可变类型 + 可变行为构成 | Palantir 原文 |
| 3 | **AI 穿透本体** —— AI 不直连业务表；通过 `ActionType.apply` 与 `Function` 读写 Ontology；输出 = proposal，用户确认后落库 | 蓝图推导 |

---

## 3. 12 Kernel 基元 + 落地策略

按"标识 / 类型 / 实例 / 推理 / 查询"5 层组织：

| 层 | 基元 | 字段（最小集） |
|---|---|---|
| 标识 | `ClassRef` | `rid` |
| 标识 | `Version` | `rid, parent_rid, created_at, author, change_set` |
| 类型 | `Property` | `rid, type_id, nullable, primary_key, title, format` |
| 类型 | `ObjectType` | `rid, primary_key, properties[], interfaces[], display_name` |
| 类型 | `LinkType` | `rid, src, dst, cardinality, directionality, link_properties[]` |
| 类型 | `ActionType` | `rid, parameters[], submission_criteria, side_effects, function_ref, on[]` |
| 类型 | `Interface` | `rid, properties[], required_links[], polymorphic_action_constraints[]` |
| 实例 | `Individual` | `rid, class_rid, props{rid→value}, primary_key` |
| 实例 | `LinkInstance` | `rid, link_type_rid, src, dst, props` |
| 推理 | `Axiom` | `rid, kind, operands[], rule_ref` |
| 函数 | `Function` | `rid, language, version, source_ref, signatures[]` |
| 查询 | `ObjectSet` | `class_rid, filter_expr, sort, paging, view_config` |

`rid` 形如 `ont.<tenant>.<kind>.<slug>.<version>`，与 `mate_platform/messaging/schemas.py:17-74` 一致。

**L1 = 直接迁移 v2**（决策点 L1）：OWL 风格旧表 deprecate，仅保留 OWL 导入导出入口。一次性数据迁移 + 回滚窗口。

---

## 4. 数字员工 × SuperAI 体系（决策点 A1-A4 收口）

| 决策 | 选项 | 落地 |
|---|---|---|
| A1 | RAG + 规则 + 偶发微调 | `MP-RAG-ONT-01` 主导本体语料 RAG；微调走 `OntologyManager` 变更管理 + 回归测试 |
| A2 | 7 + N | 7 个内置 Agent + Marketplace 第三方注册表 |
| A3 | 新建 `mate-tech-orchestrator` | 新包，独立于 LangGraph，吸收 `mate-app-copilot` 主入口 |
| A4 | 混合（基础共享 + 租户扩展） | 内置 7 个共享 + Marketplace 租户级订阅 |

### 4.1 7 + 1 类 Agent

| Agent | 职责 | Batch |
|---|---|---|
| Ontology Agent | 提 ObjectType/LinkType/Interface → proposal JSON | MP-AGENT-ONT-01 |
| Workflow Agent | 编排 BPMN + 调 `mate-app-wfe` | MP-AGENT-WF-01 |
| App Agent | 调 `mate-app-apphub` 生成 ObjectView + Workshop | MP-AGENT-APP-01 |
| Data Product Agent | 自动化 CDC + ADS 发布 | MP-AGENT-DATA-01 |
| OBS Agent | OTel/审计/告警（内置只读） | MP-AGENT-OBS-01 |
| Security Agent | marking 评估 + 跨域 ADS 异常 | MP-AGENT-SEC-01 |
| Knowledge Library Agent | 词表/同义词/单位 | MP-AGENT-KB-01 |
| 第三方 Agent (Marketplace) | 订阅式 | MP-AGENT-EXT-01 |
| **SuperAI (COPILOT)** | 编排平面 | MP-SUPER-COPILOT-01 |

### 4.2 三层沙箱

```
用户 A / B / C ...（每用户每会话）
  └─ Session Sandbox  ← 用户级隔离
       └─ Orchestrator (SuperAI)
            └─ Function Sandbox  ← 调用级隔离
                 └─ ActionType.apply
```

| 沙箱 | 等级 | 生命周期 | Batch |
|---|---|---|---|
| **Session Sandbox** | L2 容器 | 30 分钟（可配 24h） | MP-SESSION-01 |
| **Function Sandbox** | L2 容器 | 几秒到几分钟 | MP-SANDBOX-01 |
| **第三方 Sandbox** | **L3 MicroVM** | 跟随 Agent | MP-SANDBOX-02 |

---

## 5. 会话级沙箱（决策点 C1-C4 收口）

| 决策 | 选项 | 落地 |
|---|---|---|
| C1 | 默认 30 分钟，可配 24h | `session_ttl` 字段 |
| C2 | opt-in | 默认不加载跨会话偏好 |
| C3 | 默认不保留，可 opt-in 7 天 | `retention_policy: discard \| keep_7d` |
| C4 | 同步 | 多设备共用 plan + history |

**Session Sandbox 7 条硬要求**：
1. 每用户每会话独占上下文（Redis 命名 `session:{tenant}:{user}:{sid}`）
2. 上下文加密存储（DEK 来自 KMS）
3. 跨会话默认隔离
4. 跨域访问严格继承租户 + 用户身份
5. Plan 持久化 + 严格归属（PG `session_plans`）
6. 超时/配额（呼应 ADR-0018 cost ceiling）
7. 会话结束清理（按 `retention_policy`）

**多设备同步（C4）**意味着 Session 状态是**逻辑单实例、物理多副本**：写走 `mate_platform.messaging.outbox` + Redis Stream 广播。

---

## 6. 沙箱 + 凭证（决策点 B1-B4 收口）

| 决策 | 选项 | 落地 |
|---|---|---|
| B1 | Function L2 + 第三方 L3 | Function Runtime K8s Pod；Marketplace 强制 L3 |
| B2 | 会话级短期 token（30 分钟） | `auth/session.py` 新增颁发，Function 拿 service-to-service 短期凭证 |
| B3 | 每次 plan ≥1 HITL 暂停 | Orchestrator 状态机强校验（`session_plans.status=awaiting_user`） |
| B4 | SANDBOX-01 进 M1 | 跟 KERNEL-01 并行 |

**Function Sandbox 6 条硬要求**：
1. 每次调用一个独立实例
2. 沙箱间默认零网络（default-deny + allowlist）
3. 租户身份继承 + 不可伪造（沙箱启动时注入）
4. Outbox 出口白名单（`metaplatform.*.v1`）
5. 审计全留痕（OTel + ADS）
6. 超时/资源配额

**L2 = K8s Job/Pod**（锁死问题 L2 最佳实践）：Function Runtime 默认起 K8s Job，**不**走 Python 进程池；原因——(a) 进程池共享 host 内核，跨租户 RCE 风险高；(b) K8s Job 天然可被 NetworkPolicy / ResourceQuota 约束；(c) 跟我们已有的 PLATFORM-K8S-01 复用。**L3 MicroVM** 留给 Marketplace 第三方 Agent（Firecracker / gVisor 选型在 MP-SANDBOX-02 落地）。

---

## 7. 现状对位（20 处敏感区）

> 受 Ontology 重构影响的现有模块，全部基于仓库实际路径。

| # | 模块 | 风险 | 处理 |
|---|---|---|---|
| 1 | `mate-kernel/types/{entity,value,event,error,result}.py` | 要扩展为 12 基元 | 原 5 个保留为 alias |
| 2 | `mate-tech-ont/repositories/sql_models.py:16-72` | OWL 风格 | 直接迁移 v2，旧表 deprecate（L1） |
| 3 | `mate-tech-ont/inference/engine.py:25-49` | 升通用 Axiom | 兼容旧 Rule |
| 4 | `mate-tech-ont/inference/shacl_engine.py:1-32` | 是否换 `pyshacl` | v0.4 暂保留自研，v0.5 评估 |
| 5 | `mate-tech-ont/sparql/cypher.py:13-58` | bug + 玩具 | 直接被 ObjectSet 编译器替代 |
| 6 | `mate-tech-ont/owl/io.py:19-59` | rdflib | 保留导入导出 |
| 7 | `mate-tech-ont/versioning/store.py:17-91` | 缺 rollback/diff/branch | MP-ONT-MANAGER-05 补 |
| 8 | `mate-tech-ont/dual_write/writer.py:25-100` | 回滚不完整 | MP-ONT-OBJECTSET-04 收口 |
| 9 | `mate-tech-ont/repos/neo4j_repo.py:33-141` | K-hop 加速 | 升级为路径服务 |
| 10 | `mate-tech-ont/security/tenant.py:12-37` | 与 `mate_platform.tenancy` 重复 | KERNEL-01 统一 |
| 11 | `mate_platform/tenancy/context.py:15-54` | 扩展为 `SessionContext` | SESSION-01 落地 |
| 12 | `mate_platform/tenancy/repository.py:26-55` | Kernel 是否下沉 | KERNEL-01 评估 |
| 13 | `mate_platform/tenancy/db_filter.py:78-138` | 与 ObjectSet 编译器交互 | OBJECTSET-04 评估 |
| 14 | `mate_platform/tenancy/rls_session.py:67-340` | Session 级 RLS | SESSION-01 补 |
| 15 | `mate_platform/messaging/outbox.py:39-225` | ActionType.apply 必经 | MANAGER-05 补 awaiting_user 状态 |
| 16 | `mate_platform/auth/{verifier,identity,middleware}.py` | 缺会话级 token | SESSION-01 新增 |
| 17 | `mate_platform/observability/*` | sandbox/session span 主题 | SANDBOX-01/SESSION-01 |
| 18 | `mate-tech-data/services/ads_publisher.py:75-260` | ontology 表不入 ADS | DATA Batch 补 |
| 19 | `mate-tech-data/services/debezium_engine.py` | CDC 不订阅 ontology 表 | MANAGER-05 补 |
| 20 | `mate-tech-rag/` + `mate-tech-llmgw/` | 本体语料格式 | RAG-ONT-01 |

应用层 6 处：`mate-app-copilot`（升 Orchestrator）/ `mate-app-wfe`（Workflow Agent 落点）/ `mate-app-apphub`（App Agent）/ `marketplace/jobs/installer_ontology.py:1-9`（真实 installer）/ `mate-app-a2a`（跨 Agent 通信）/ `mate-app-arch`（Workshop）。

CI 治理 4 处：`scripts/ci/forbid_raw_sql.py` 与 ObjectSet 编译器输出协调；`scripts/ci/forbid_bare_httpx.py` 沙箱边界分清；`.pre-commit-config.yaml` 加 2 个 guardrail（sandbox/session）；`ADR-0014` manifest.yaml 接入。

---

## 8. 完整 20 Batch 路线（38 周 ≈ 9 个月）

```
M1 (8 周, 6 Batch)         M2 (10 周, 6 Batch)         M3 (12 周, 8 Batch)
─────────────────────      ──────────────────────      ─────────────────────
KERNEL-01        ┐         ACTION-03          ┐         AGENT-WF-01
MODEL-02         │         OBJECTSET-04       │         AGENT-APP-01
SANDBOX-01  ◀────┤         MANAGER-05         │         AGENT-DATA-01
SESSION-01       │         AGENT-ONT-01       │         AGENT-OBS-01
AIP-GATEWAY-01   │         AGENT-SEC-01       │         AGENT-KB-01
AGENT-ORCH-01    ┘         RAG-ONT-01         ┘         AGENT-EXT-01
                                                        SANDBOX-02
                                                        SUPER-COPILOT-01
```

依赖图：
- KERNEL-01 → 全部
- MODEL-02 → 全部
- SANDBOX-01 → ACTION-03 / MANAGER-05 / SUPER-COPILOT-01
- SESSION-01 → AGENT-ORCH-01 / SUPER-COPILOT-01
- AIP-GATEWAY-01 → 全部 Agent Batch
- AGENT-ORCH-01 → M2/M3
- MANAGER-05 → 全部写路径 Batch

---

## 9. 跟 13 硬规则对位

| 硬规则 | 由谁承担 |
|---|---|
| ① OpenAPI 先行 | 32 个 ontology 端点 + Agent 工具白名单 |
| ③ 没有 tenant 不访问 repo | Session/Function Sandbox 入口强校验 |
| ④ 外部系统没有 ACL Client | 沙箱内禁裸 httpx |
| ⑨ 没有审计/指标/trace | `session.*` / `sandbox.*` / `action.apply` 全 OTel + ADS |
| ⑩ 状态以验收证据为准 | 每个 Batch 配 `MP-*-ACCEPTANCE.md` |
| ⑫ Secret 不进 git | 会话 DEK 不进日志/outbox |
| ⑬ NetworkPolicy default-deny | 沙箱专用 NetworkProfile |

---

## 10. 验收与文档

- 每个 Batch 产出 `docs/active/delivery/evidence/MP-*-ACCEPTANCE.md`，引用 ADR + operationId + 测试 + GA CI 结果
- 3 份新 ADR：ADR-0021（Kernel 12 基元）/ ADR-0040（沙箱架构）/ ADR-0041（Session Sandbox）
- 决策纪要：`docs/active/decisions/PENDING-DECISIONS.md`
- v0.5 任务：补抓 Palantir 官方 `/object-types /link-types /action-types /functions /interfaces /markings /aip/agents-overview` 正文，替换"可证伪"行
