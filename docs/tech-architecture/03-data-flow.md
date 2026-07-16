# §3 跨层数据流

> **目标**：明确 MetaPlatform 内部组件之间的数据流方向、一致性模型、事件契约。
> **对应 spec**：v1.2 §5 顶层架构 + §6 关键决策
> **状态**：v1.0 草稿

---

## §3.1 数据流总览

```
┌─────────────────────────────────────────────────────────────────┐
│ 用户操作                                                          │
│    ↓                                                              │
│ L1-1 (React + LLM)                                                │
│    ↓ GraphQL / REST                                               │
│ L1-3 (页面生成器)  /  L1-4 (流程)  /  L2-1 (业务对象)              │
│    ↓                                                              │
│ L2-2 (本体引擎 — Neo4j + PG + Kafka)                              │
│    │                                                              │
│    ├─ 同步：业务元数据 → PG (事务)                                │
│    ├─ 同步：本体 → Neo4j (事务)                                    │
│    └─ 异步：事件 → Kafka                                          │
│           │                                                       │
│           ├─► L1-3 (订阅业务对象变化 → 重新生成 UI)                │
│           ├─► L1-4 (订阅业务对象变化 → 触发流程)                  │
│           ├─► L2-3 (订阅实例变化 → 写入 Doris / Hudi)              │
│           └─► L3-3 (审计 → ClickHouse)                            │
│                                                                    │
│ L2-3 (RAG + 非结构 + MDM + 湖 + 仓)                              │
│    │                                                              │
│    ├─ 同步：业务查询 → Doris / MinIO / Milvus                     │
│    ├─ 异步：CDC → Kafka → 下游                                    │
│    └─ 异步：Hudi 写入 (批)                                         │
│                                                                    │
│ L3-1 (AI Substrate — LLM Gateway / Embedding / Vector / Agent)    │
│    │                                                              │
│    └─ 同步：所有层的 AI 调用 → LLM Gateway → 模型                   │
│                                                                    │
│ L3-2 (能力库 — Wasm 沙箱)                                          │
│    │                                                              │
│    └─ 同步：能力调用 → 沙箱执行                                    │
│                                                                    │
│ L3-3 (平台底座 — APISIX / Keycloak / Casbin / 审计)               │
│    │                                                              │
│    └─ 横切：所有层走 APISIX + Keycloak + Casbin + 审计              │
└─────────────────────────────────────────────────────────────────┘
```

---

## §3.2 关键数据流详解

### 数据流 1：用户创建一个业务对象类型

**场景**：用户拖拽创建一个 "Customer" 实体类型。

```
[用户] 在 L1-1 拖拽 "Customer" 实体
    ↓
[L1-1 NL 解析器] 解析为 GraphQL Mutation: createEntityType
    ↓ GraphQL over HTTPS
[APISIX] 路由 + JWT 鉴权
    ↓
[L3-3 权限中心] Casbin 检查 (用户有 create:entity_type 权限)
    ↓ 通过
[L2-1 业务对象层] createEntityType(name="Customer", properties=[...])
    ↓
[L2-2 本体引擎] EntityTypeService.createEntityType()
    ├─ 写 PG (元数据) —— 事务 A
    ├─ 写 Neo4j (本体) —— 事务 B
    └─ 发 Kafka EntityTypeCreated
            ├─► L1-3 订阅 → 重新生成 UI
            ├─► L1-4 订阅 → 无操作（类型变更不触发流程）
            ├─► L2-3 订阅 → 准备 instance_customer 表
            └─► L3-3 订阅 → 写入审计
    ↓
[返回] GraphQL Response: { id, name, properties, ... }
    ↓
[L1-1 前端] 展示成功 + 自动跳转
```

**关键设计**：
- **PG 事务先提交**（元数据）→ **Neo4j 事务后提交**（本体）→ **Kafka 事件最后发**（通知）
- 失败回滚：PG 失败 → 直接回滚；Neo4j 失败 → 重试 3 次；Kafka 失败 → 告警
- **Outbox 模式**：v0.2 引入，避免 Kafka 失败导致的不一致

**一致性模型**：
- PG ↔ Neo4j：**最终一致**（秒级）
- PG ↔ Kafka：**Outbox 模式**（v0.2 后强一致）
- 事件订阅者：至少一次（at-least-once），消费方去重

---

### 数据流 2：业务对象实例创建 + 数据入湖入仓

**场景**：用户在表单上填写客户信息并提交。

```
[用户] 在 L1-3 Customer 表单填写 {name: "Alice", email: "alice@x.com"}
    ↓
[L1-3 页面生成器] 提交 GraphQL Mutation: createEntityInstance
    ↓
[APISIX + Keycloak + Casbin]
    ↓ 通过
[L2-1 业务对象层] createEntityInstance(...)
    ↓
[L2-2 本体引擎] EntityInstanceService.createInstance()
    ├─ 校验业务规则
    ├─ 写 Neo4j (实例)
    ├─ 写 PG (实例 + 审计)
    └─ 发 Kafka EntityInstanceCreated
            ├─► L2-3 订阅 ← 关键
            │     ├─ 检查 instance_customer 表是否存在
            │     │   └─ 不存在 → 自动建表 (Doris CreateTable)
            │     ├─ 写入 Doris (实时)
            │     ├─ 写入 Hudi (批，10s 缓冲)
            │     └─ 写入 Milvus (Embedding，异步)
            ├─► L1-4 订阅 → 触发"客户注册"流程
            └─► L3-3 订阅 → 审计
    ↓
[返回] 成功
```

**关键设计**：
- **实时一致性**：业务对象 → Doris（秒级）
- **批量一致性**：业务对象 → Hudi（10s 级）
- **异步一致性**：业务对象 → Milvus（30s 级，Embedding 较慢）

**失败处理**：
- Neo4j 写成功但 Kafka 发失败：v0.2 Outbox 模式补救；v0.1 接受丢失
- Doris 写失败：消息重试 3 次；再失败进入死信队列
- Hudi 写失败：非阻塞，记录日志

---

### 数据流 3：RAG 检索（NL 问答）

**场景**：用户问"公司的差旅报销标准是什么？"

```
[用户] 在 L1-1 输入问题
    ↓
[L1-1 NL 解析器] 调用 LLM Gateway
    ├─ 路由决策（基于问题类型 + 成本预算）
    │  ├─ 简单 → 小模型（Qwen-7B）
    │  └─ 复杂 → 大模型（Claude）
    ├─ Context Store 注入：
    │  ├─ 用户当前页面
    │  ├─ 用户最近 10 个操作
    │  └─ 租户级共享知识
    └─ LLM 返回意图：{intent: "search", target: "policy", query: "差旅报销"}
    ↓
[L2-3 RAG 知识库] 执行检索
    ├─ Embedding 问题 → 向量
    ├─ Milvus 检索 → top 10 文档
    ├─ BGE-Reranker 重排 → top 3
    └─ 拼接引用
    ↓
[L3-1 LLM Gateway] 二次调用
    ├─ 注入检索结果
    ├─ 生成回答 + 引用
    └─ 流式返回
    ↓
[L1-1] 流式显示回答 + 引用链接
```

**关键设计**：
- **两阶段 LLM 调用**：第一次分类 + 检索意图；第二次生成回答
- **Context Store 分层**：用户级 / 租户级 / 全局级
- **缓存**：相同问题命中缓存（Redis）

---

### 数据流 4：流程自动化 + AI 节点

**场景**：合同审批流程，含 AI 风险评估节点。

```
[用户] 在 L1-4 启动"合同审批"流程
    ↓
[Flowable] 创建流程实例
    ├─ 节点 1：发起人填写合同基本信息
    ├─ 节点 2：直属领导审批
    ├─ 节点 3：AI 风险评估 ← AI 节点
    │   └─ 调用 LangGraph Agent
    │        ├─ 检索合同条款（RAG）
    │        ├─ LLM 分析风险
    │        └─ 输出：{risk_level: "high", reasoning: "..."}
    ├─ 节点 4：(高风险) 法务审批
    │   └─ (低风险) 财务审批
    └─ 节点 5：归档 → 写回业务对象
    ↓
[业务对象层] 写"合同"业务对象
    ↓
[事件总线] 发布 ContractApproved
    ↓
[L2-3 数据栈] 写入 Doris / Hudi
```

**关键设计**：
- **AI 节点幂等**：基于流程实例 ID + 节点 ID 去重
- **AI 节点超时**：5s 超时后走降级路径
- **AI 节点可观测**：记录 prompt/response/耗时

---

## §3.3 事件契约（Kafka Schema）

### 命名规范

- **Topic**：`metaplatform.<domain>.<aggregate>`
- **示例**：`metaplatform.ontology.entity-type`

### 事件格式（CloudEvents 1.0 + 自定义扩展）

```json
{
  "specversion": "1.0",
  "id": "evt-001",
  "source": "metaplatform/ontology-engine",
  "type": "com.metaplatform.ontology.entity-type.created.v1",
  "time": "2026-07-02T10:00:00.123Z",
  "datacontenttype": "application/json",
  "subject": "Customer",
  
  "metaplatformtenantid": "default-tenant",
  "metaplatformactorid": "alice",
  "metaplatformtraceid": "abc123",
  
  "data": {
    "entityType": {
      "id": "uuid-...",
      "name": "Customer",
      "properties": [...]
    }
  }
}
```

### 事件版本化

- **v1、v2、...**：破坏性变更升版本
- **v1.1、v1.2、...**：向后兼容
- **Schema Registry**：Confluent Schema Registry（含方言转换）

### 事件发布原则

1. **每个聚合根有独立 topic**（entity-type / entity-instance / business-object）
2. **每个事件含 tenant_id + actor_id**（审计）
3. **每个事件含 trace_id**（链路追踪）
4. **事件 payload 用 JSON**（人类可读 + 跨语言）
5. **Outbox 模式**（v0.2 引入）保证至少一次

---

## §3.4 一致性模型

| 数据流 | 一致性 | 延迟 | 失败处理 |
|---|---|---|---|
| PG 元数据 ↔ Neo4j 本体 | 最终一致 | < 1s | 重试 3 次 |
| PG 元数据 ↔ Kafka 事件 | 最终一致 (v0.2 强一致) | < 100ms | Outbox 模式 |
| Neo4j ↔ Doris | 最终一致 | < 5s | 重试 + 死信 |
| Neo4j ↔ Hudi | 最终一致 | < 30s | 批写 + 重试 |
| Neo4j ↔ Milvus | 最终一致 | < 30s | 异步 + 监控 |
| L1-1 ↔ LLM | 强一致（请求-响应）| < 10s | 超时 + 降级 |
| L1-4 ↔ Flowable | 强一致（事务）| < 1s | 流程回滚 |
| L1-4 ↔ LLM Agent | 最终一致 | < 30s | 节点重试 |

---

## §3.5 事务边界

### 业务事务（强一致）

- **业务对象创建**：PG + Neo4j（v0.2 用 Saga，v0.1 接受最终一致）
- **流程节点完成**：Flowable 内部事务
- **能力调用**：能力内部事务

### 跨服务事务（最终一致）

- **业务对象 → Doris**：事件驱动
- **业务对象 → Hudi**：事件驱动 + 批
- **业务对象 → Milvus**：事件驱动 + 异步

### 事务模式

| 模式 | 场景 | 实现 |
|---|---|---|
| **本地事务** | 单服务内 | PG 事务 |
| **Saga** | 跨服务 | Temporal / 自研（v0.2 起步）|
| **Outbox** | 业务 → 事件 | 业务表 + outbox 表 + 后台 worker（v0.2 起步）|
| **CDC** | 数据库 → 下游 | Debezium（v0.2 起步）|

---

## §3.6 数据流在 v0.1 plan 中的覆盖

| 数据流 | v0.1 覆盖 | 备注 |
|---|---|---|
| 业务对象类型 CRUD | ✅ 本体引擎 v0.1 Task 1-11 | |
| 业务对象实例 CRUD | ⚠️ v0.1 部分（事件）| 业务对象层在 MVP 第 2 期 |
| 数据入湖入仓 | ✅ 数据栈 v0.1 Task 7-8 | Doris 实时 + Hudi 批 |
| RAG 检索 | ❌ v0.1 不做 | RAG/非结构/MDM 在 MVP 第 2 期 |
| 流程自动化 | ❌ v0.1 不做 | 流程自动化在 MVP 第 2 期 |
| AI 节点 | ❌ v0.1 不做 | AI Substrate 在 MVP 第 2 期 |

**结论**：v0.1 plan 覆盖了 §3.2 中"数据流 1"和"数据流 2"的核心路径。"数据流 3"和"数据流 4"在 MVP 第 2 期补全。

**v0.1 plan 是否需要重写**：不需要。但需要补充：
- Outbox 模式（避免 Kafka 失败丢消息）—— **v0.2 必加**
- 死信队列（消费失败的兜底）—— **v0.2 必加**
- 链路追踪（trace_id 串联）—— **v0.2 必加**

---

## §3.7 数据流安全

| 数据类型 | 加密 | 脱敏 | 审计 |
|---|---|---|---|
| 用户身份 | TLS 1.3 + JWT | - | 全量 |
| 业务数据 | TLS 1.3 + 静态加密 | PII 自动脱敏 | 全量 |
| LLM 调用 | TLS 1.3 | PII 注入前脱敏 | 全量（合规）|
| 事件总线 | TLS + SASL | 按需 | 全量 |
| 备份 | 静态加密 (AES-256) | 备份中脱敏 | 元数据审计 |

**密钥管理**：HashiCorp Vault + External Secrets Operator

---

**生成时间**：2026-07-02 14:45
**对应 spec 版本**：v1.2
**下一步**：阅读 [04-cross-cutting-concerns.md](./04-cross-cutting-concerns.md)
