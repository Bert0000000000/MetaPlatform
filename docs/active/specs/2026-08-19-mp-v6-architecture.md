# MetaPlatform v6.0 架构 spec

> **版本**：v6.0（最终版 + dsh Docker 部署补充）  
> **日期**：2026-08-19  
> **状态**：**草案**（待评审）  
> **作者**：Claude (MiniMax-M3) + 用户协作  
> **取代**：v3.0 GA + v3.1/v3.2 增量路径  
> **配套 ADR**：ADR-0046 ~ ADR-0054（详见 §13）

---

## 0. 一句话定位

**MetaPlatform v6.0 = Supabase 全栈 + dsh 数字员工编排 + Temporal 业务 Workflow + GraphRAG/RAGFlow 双引擎 + 第三方审批 SaaS + K8s 沙箱 + HITL Hub 联动中枢。三层编排清晰分工：dsh 思考 + Temporal 编排 + Supabase + SaaS 执行。抛弃旧实现模式（Outbox / Kafka / Keycloak / 5 层隔离 / BPMN / 自建 llmgw / LangChain）。**

---

## 1. 背景与决策

### 1.1 核心决策清单

| # | 决策 | 旧方案 | **新方案（v6.0）** |
|---|---|---|---|
| 1 | 后端基础设施 | 自有 PG + Kafka + Redis + MinIO + Keycloak | **Supabase 全栈** |
| 2 | 数字员工编排平面 | 自建 SuperAI | **dsh (Cordis)** |
| 3 | LLM Gateway | 自建 llmgw | **dsh llm-pi-ai provider** |
| 4 | 业务 Workflow 编排 | 自建引擎 / LangChain | **Temporal.io**（新引入） |
| 5 | 事件流 | Kafka + Outbox + DLQ | **Postgres trigger + Database Webhook + pg_notify + Realtime** |
| 6 | 多租户隔离 | 5 层隔离 | **Postgres RLS 单一层** |
| 7 | 审批流 | Flowable BPMN Java引擎 | **第三方 SaaS API**（钉钉/飞书/企微） |
| 8 | HITL 联动 | 自建 | **HITL Hub**（新引入，统一4 种 HITL） |
| 9 | 长任务（1 周+） | 自建 | **Temporal 长任务 + 5 大机制** |
| 10 | RAG 引擎 | RAGFlow + LightRAG | **RAGFlow + Microsoft GraphRAG** |
| 11 | 身份认证 | Keycloak | **Supabase Auth (GoTrue)** |
| 12 | API 网关 | FastAPI + Kong | **Supabase PostgREST + Edge Functions** |
| 13 | 管理后台 | 自建 | **Supabase Studio + Temporal UI** |
| 14 | 实时推送 | 自建 WS | **Supabase Realtime** |
| 15 | 边缘函数 | 自建 Deno runtime | **Supabase Edge Functions (Deno)** |
| 16 | 对象存储 | MinIO | **Supabase Storage** |
| 17 | 向量检索 | 自装 pgvector | **Supabase Vector (pgvector)** |
| 18 | 缓存 | Redis Cluster | **Supabase 内置缓存** |
| 19 | 编排框架 | LangChain / LangGraph | **dsh 替代**（60% 复用） |
| 20 | 沙箱 | 自建 | **dsh sandbox（4 包）单层**（去掉 Firecracker） |
| 21 | dsh 部署 | 自建脚本 | **Docker + K8s Deployment + HPA** |
| 22 | 后端实现 | 自建 FastAPI + Python | **Supabase Edge Functions（Deno + TypeScript）+ PostgREST** |
| 23 | 后端语言 | Python | **TypeScript 全栈**（仅第三方服务保留 Python） |

### 1.2 抛弃的旧实现模式

- ❌ **Outbox 模式**（被 Postgres trigger + Webhook 替代）
- ❌ **Kafka + ZK + Schema Registry + Connect**（被 Supabase 事件能力替代）
- ❌ **Keycloak + OAuth2 + SAML + RBAC**（被 Supabase Auth 替代）
- ❌ **MinIO + bucket namespace**（被 Supabase Storage 替代）
- ❌ **Redis Cluster + key namespace**（被 Supabase 内置缓存替代）
- ❌ **FastAPI OpenAPI 单一契约源**（被 PostgREST 自动 REST 替代）
- ❌ **Flowable BPMN 引擎**（被第三方 SaaS 审批 API 替代）
- ❌ **自建审批引擎**（被第三方 SaaS API 替代）
- ❌ **5 层租户隔离**（被 RLS 单一层替代）
- ❌ **自建 llmgw + 缓存 + 配额 + 审计**（被 dsh token-meter + session-event 替代）
- ❌ **LightRAG**（被 Microsoft GraphRAG 替代）
- ❌ **LangChain / LangGraph**（被 dsh 60% 复用替代）

---

## 2. 设计原则

### 2.1 减少分散化组件

> v3.0 GA 有 30+ 服务。v6.0 目标：**核心组件 8 个**。

```
Supabase 一套（覆盖 PG + Auth + Realtime + Storage + Edge + PostgREST + Studio + Vector）
+
dsh（数字员工 + LLM provider）
+
Temporal（业务 Workflow）
+
GraphRAG + RAGFlow（RAG 双引擎）
+
第三方审批 SaaS（外部调度）
+
HITL Hub（联动中枢）
+
沙箱（dsh sandbox + MP-SANDBOX-01）
```

### 2.2 Supabase 原生能力优先

任何能用 Supabase 原生能力实现的，就不引入新组件。

### 2.3 能用 dsh 就用 dsh

60 个 dsh 包直接复用，自定义只保留必要的。

### 2.4 自研只做差异化

MP 自研只剩**业务封装层 + 12 Ontology Kernel + 沙箱（严格层）**，其余交给 Supabase + dsh + Temporal。

---

## 3. 组件清单（v6.0 最终）

### 3.1 完整组件清单

| 层次 | 组件 | 角色 | 类型 |
|---|---|---|---|
| **前端** | app-* | 业务前端（React + Semi Design） | MP 自研 |
| | dsh Web UI | 数字员工开发台 | dsh 自带 |
| | Supabase Studio | DB / Realtime 管理后台 | Supabase 自带 |
| | Temporal UI | Workflow 调试 / 排查（SRE 用） | Temporal 自带 |
| **编排层** | **dsh (DeepSeek Harness)** | **数字员工 agent loop + LLM provider** | **dsh** |
| | **⭐ Temporal.io** | **业务 Workflow 编排（ActionType 触发）** | **Temporal** |
| | **⭐ HITL Hub** | **4 种 HITL 联动中枢** | **MP 自研（dsh service）** |
| **业务后端** | ⭐ **Supabase Edge Functions** | **17 域业务逻辑 + 12 Ontology Kernel + ActionType.apply** | **Supabase（Deno + TS）** |
| | **Supabase PostgREST** | **标准 CRUD 自动 REST API** | **Supabase** |
| **数字员工** | dsh preset ×7 | 7 个内置数字员工 | dsh preset |
| **数据库** | Supabase Postgres | 主库（schema + RLS + pgvector + trigger） | Supabase |
| **认证** | Supabase Auth | JWT + OAuth2 + Magic Link | Supabase |
| **授权** | Postgres RLS | 行级安全（多租户） | Supabase |
| **API** | Supabase PostgREST | 自动 REST API | Supabase |
| **边缘函数** | Supabase Edge Functions | webhook + cron + 轻量逻辑 | Supabase |
| **实时** | Supabase Realtime | WebSocket 推送 | Supabase |
| **管理** | Supabase Studio | DBA GUI + RLS Editor | Supabase |
| **存储** | Supabase Storage | S3 兼容对象存储 | Supabase |
| **向量** | Supabase Vector (pgvector) | embedding 检索 | Supabase |
| **RAG 引擎 1** | RAGFlow | 文档解析 + chunk + BM25 + 向量 | 第三方 |
| **RAG 引擎 2** | Microsoft GraphRAG | KG + Leiden 社区 + 全局摘要 | 第三方 |
| **沙箱** | ⭐ **dsh sandbox（4 包）单层** | **进程级沙箱（bwrap / Landlock / Seatbelt）** | **dsh 自带** |
| | ~~MP-SANDBOX-01~~ | ~~Firecracker~~（**v6.0 去掉**，v3.0 保留路径） | ~~MP 自研~~ |
| **审批** | ⭐ 第三方审批 SaaS | 钉钉 / 飞书 / 企微 | 外部调度 |
| **事件流** | Postgres trigger + Webhook + pg_notify + Realtime | 替代 Kafka | Supabase |
| **LLM provider** | dsh `llm-pi-ai` + `llm-deepseek` | 多 LLM provider | dsh 自带 |
| **dsh 部署** | dsh Docker 镜像 + K8s Deployment + HPA | 数字员工 K8s 编排 | MP 自研 |
| **dsh 镜像构建** | Dockerfile（多阶段）+ GH Actions + Harbor | CI/CD | MP 自研 |
| **dsh 持久化** | ⭐ 自建 Postgres backend（复用 Supabase PG） | session 跨副本共享 | MP 自研 |
| **dsh config** | PVC / ConfigMap（cordis.yml / preset 只读） | dsh 本地配置 | K8s Storage |
| **部署** | K8s + Helm + ArgoCD | 生产部署 | 基础设施 |
| **可观测 - 采集** | **OTel Collector** | **traces / metrics / logs 采集（语言无关 SDK）** | **基础设施** |
| **可观测 - 存储** | Tempo + Prometheus + Loki | trace / metric / log 存储 | 基础设施 |
| **可观测 - 面板** | Grafana | 统一可视化 + 告警 | 基础设施 |

### 3.2 dsh 用到的包（60 个直接复用）

| 类别 | 包 |
|---|---|
| **core (7)** | session / system-prompt / tools / agent / agent-loop / scope / agent-spine |
| **数字员工 (4)** | preset / bundle / extensions / interaction |
| **协议 (3)** | mcp-client / acp / hooks |
| **会话 (7)** | session-persistence (×3) / session-projection / session-title / session-query / spill |
| **能力 (8)** | sandbox (×3) / skill / compaction / context / subagent (×3) / jobs |
| **web (3)** | web / web-search / web-fetch |
| **LLM (5)** | llm / token-meter / llm-retry / llm-pi-ai / llm-deepseek |
| **协作 (6)** | plan / guard / todo / goal / schedule / feedback |
| **工具 (5)** | attachment / workspace / boot / util / storage |
| **遥测 (2)** | session-telemetry / session-telemetry-otel |
| **SDK (3)** | sdk-protocol / sdk-client / sdk-server |
| **Python SDK (2)** | python-sdk / python-sdk-runtime |
| **底层 (4)** | subprocess / e2b / native-landlock / settings |
| **前端 (1)** | apps/web（作数字员工开发台） |
| **基础设施 (2)** | test-support / examples |

### 3.3 不走 dsh 的 15 个包

| 类别 | 不走原因 |
|---|---|
| **5 个强约束** | identity / credentials / api / typert / host+client+cli |
| **9 个 dev agent 专属** | shell (×3) / terminal / code-runtime / lsp / fs |
| **1 个业务冲突** | workflow（MP-Workflow Path C 自研） |

### 3.4 不引入 LangChain / LangGraph

| 能力 | v6.0 替代方案 |
|---|---|
| LLM 调用 + Function Calling | dsh llm-pi-ai provider（自带） |
| Tool 注册 | dsh ctx.tools（自带） |
| Agent loop | dsh core/agent-loop（自带） |
| Multi-agent 协作 | dsh subagent（自带） |
| Prompt 管理 | dsh system-prompt（自带） |
| Session 持久化 | dsh session/（自带） |
| 业务 workflow 编排 | Temporal（引入） |
| HITL | Temporal signal + HITL Hub |

---

## 5. 架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                    MetaPlatform v6.0 架构                        │
└──────────────────────────────────────────────────────────────────┘

                  ┌─────────────────────────────────┐
                  │   用户：浏览器 / dsh Web / IDE  │
                  │   / 移动端 / CLI                 │
                  └────────────────┬─────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│              Supabase（全栈，一套 = 全部能力）                   │
│                                                                   │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│   │  Auth       │ │  Realtime  │ │  PostgREST   │            │
│   │  (GoTrue)   │ │  (WS)      │ │  (REST)      │            │
│   └──────────────┘ └──────────────┘ └──────────────┘            │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│   │  Edge        │ │  Storage   │ │  Studio      │            │
│   │  Functions   │ │  (S3)      │ │  (GUI)       │            │
│   │  (Deno)      │ │             │ │               │            │
│   └──────────────┘ └──────────────┘ └──────────────┘            │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│   │  Vector      │ │  Database    │ │  pg_cron    │            │
│   │  (pgvector)  │ │  Webhooks   │ │  (定时)     │            │
│   └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                   │
│                      Postgres 主库                              │
│   ┌───────────────────────────────────────────────────────┐    │
│   │  schema: auth + storage + public + graphql_public   │    │
│   │  + hitl_requests + dsh_sessions + outbox + temporal  │    │
│   │  + RLS（每表 tenant_id 强制隔离）                    │    │
│   │  + trigger（自动派生事件 / 状态 / 审计）              │    │
│   │  + pg_notify（DB 内部 trigger 通知）                 │    │
│   └───────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ JWT 透传
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│         ⭐ HITL Hub（联动中枢）                                  │
│                                                                   │
│   - 统一 hitl_requests 表                                        │
│   - 4 种 HITL 类型（workflow_saas / workflow_dsh / tool_dsh /    │
│     action_confirm）                                            │
│   - Realtime WS 推送 + 统一审批面板                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│              dsh 编排平面（数字员工 + LLM）                    │
│                                                                   │
│   ┌───────────────────────────────────────────────────────┐    │
│   │  dsh Cordis（一切皆插件）                            │    │
│   │   ├─ 60 个 dsh 包（直接复用）                        │    │
│   │   ├─ 7 个数字员工 preset                             │    │
│   │   ├─ LLM provider：llm-pi-ai + llm-deepseek        │    │
│   │   ├─ 数字员工状态机：running / waiting_tool /       │    │
│   │   │  waiting_hitl / waiting_external / resumed      │    │
│   │   ├─ Session 持久化 + LLM context 压缩               │    │
│   │   └─ 外部 MCP / ACP / SDK 接入                       │    │
│   └───────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│         ⭐ Temporal（业务 Workflow 编排）                       │
│                                                                   │
│   - ActionType.apply 触发 Workflow                              │
│   - DAG 节点：数据 / agent / 审批 / 通知 / HITL                │
│   - 长任务（1 周+）+ 多级超时升级                              │
│   - 持久化 workflow history                                      │
│   - Temporal UI（SRE 排查用）                                    │
│   - 存储：复用 Supabase Postgres（temporal schema）            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌──────────────┐     ┌─────────────────┐    ┌──────────────────┐
│  RAGFlow    │     │ ⭐ GraphRAG  │    │ ⭐ 第三方审批    │
│  文档 RAG   │     │ (Microsoft)     │    │ SaaS            │
│  BM25+向量  │     │ KG+社区+摘要  │    │ 钉钉/飞书/企微 │
└──────────────┘     └─────────────────┘    └──────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│              沙箱层（双层）                                       │
│                                                                   │
│   第1层：dsh sandbox（4 包）                                   │
│   - 进程级隔离（bwrap / Landlock / Seatbelt）                  │
│   - 适用：内置数字员工作业 / 半可信第三方                       │
│                                                                   │
│   第2层：MP-SANDBOX-01                                         │
│   - VM 级隔离（Firecracker MicroVM）                           │
│   - 适用：第三方 Marketplace 不可信代码                          │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│              基础设施层                                          │
│                                                                   │
│   K8s + Helm + ArgoCD + OTel + Prometheus + Grafana            │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. 核心数据流

### 6.1 场景1：用户登录 + JWT 注入

```
1. 浏览器访问 dsh Web / app-*
2. Supabase Auth UI
3. 用户名 + 密码验证
4. 颁发 JWT（含 tenant_id claim + role + sub）
5. 浏览器存 token（httpOnly cookie）
6. 每次请求带 Authorization: Bearer <jwt>
7. Supabase PostgREST / Edge Functions 自动解析 JWT
8. RLS 自动按 JWT 的 tenant_id 过滤数据
```

### 6.2 场景2：数字员工作业（普通流程）

```
1. 用户在 dsh Web 提问
2. dsh agent loop（core/agent + agent-loop）→ running 状态
3. LLM 决策：调什么 tool
4. dsh tool 调用：
   - 内部：调 MP 业务 API（FastAPI → Supabase PostgREST / Edge）
   - 外部：MCP server / ACP client
5. LLM 流式输出 token
6. dsh session/event 记录每一步
7. Realtime WS 推送给浏览器（实时进度）
8. 最终答案返回用户
```

### 6.3 场景3：ActionType 触发业务 Workflow

```
1. 业务调用 ActionType.apply(parameters)
2. action_runner 启动 Temporal Workflow
3. Workflow 按 DAG 执行节点：
   - 数据节点（db_read / db_write activity）
   - agent 节点（调 dsh Python SDK 跑数字员工）
   - 审批节点（调 HITL Hub / 第三方 SaaS）
   - 通知节点（Realtime / Email）
4. 节点执行完成，触发下一个节点
5. Workflow 完成后，结果返回给调用方
```

### 6.4 场景4：业务 HITL（4 种类型联动）

```
类型 A：业务 HITL（SaaS 审批）
  ActionType → Temporal workflow → approval_request activity
  → HITL Hub 注册 hitl_requests
  → 调钉钉 API 创建审批
  → Workflow 进入 wait_condition（最长 7 天）
  → 用户在钉钉审批
  → webhook → Edge Function → HITL Hub 更新 + Temporal signal
  → Workflow 恢复执行

类型 B：业务 HITL（dsh Web 内联审批）
  Temporal activity → HITL Hub.request_hitl（type=workflow_dsh）
  → 浏览器 HITL 面板弹窗 → 用户批准/拒绝
  → Edge Function → Temporal signal
  → Workflow 恢复

类型 C：数字员工作业 tool HITL
  dsh agent 调敏感 tool → dsh interaction waterfall 拦截
  → HITL Hub.request_hitl_sync（type=tool_dsh）
  → 浏览器弹窗 → 用户批准/拒绝
  → waterfall 放行

类型 D：AI proposal 确认
  ActionType.apply(mode='preview')
  → HITL Hub（type=action_confirm）
  → 用户在 dsh Web 预览 + 批准/拒绝
  → ActionType.apply(mode='confirmed')
```

### 6.5 场景5：1 周+ 长审批异步处理

```
Day 0 14:00  用户发起审批
  → 数字员工进入 waiting_external 状态
  → dsh session 持久化到 Supabase PG
  → dsh 资源释放（agent loop 退出 / LLM context 压缩）
  → Temporal workflow 独立运行

Day 1-6  pg_cron 每日 reminder
  Day 1  A经理超时 → 自动升级 B
  Day 3  B总监超时 → 自动升级 C
  Day 6  C副总超时 → 自动升级 D
  webhook + polling 双重对账
  DB trigger 阻止业务变更

Day 7 16:00 钉钉审批通过
  → webhook → Edge Function → Temporal signal
  → Workflow 完成 → workflow-completed-handler
  → HITL Hub 更新 + dsh session 恢复
  → 多通道通知（Realtime WS / Email / 钉钉）

Day 8 09:00 用户重新打开 dsh Web
  → 自动加载上次 session
  → 显示"上次任务已完成"
  → 用户点 [继续] → agent loop 恢复执行
  → 数字员工继续推进剩余任务
```

### 6.6 场景6：RAG 检索

```
用户问："Mate平台里有哪些订单系统相关的 ObjectType？"
   ↓
dsh Knowledge Curator preset
   ↓
query 路由（dsh llm）：提取实体 "订单系统 / Order"
   ↓
双路并行检索：
   ├─ RAGFlow（文档 chunk + BM25 + 向量）
   └─ GraphRAG（KG 实体 + 关系 + Leiden 社区报告）
   ↓
结果融合 + 去重 + 排序
   ↓
dsh llm（pi-ai provider）生成最终答案
   ↓
流式输出（Realtime WS）+ session/event 落日志
```

---

## 7. 关键技术决策

### 7.1 事件流：trigger + Webhook + pg_notify + Realtime

**旧方案**：Kafka + Outbox + DLQ + Kafka Connect  
**新方案**：Postgres trigger + Database Webhook + pg_notify + Supabase Realtime

### 7.2 多租户：RLS 单一层

**旧方案**：5 层隔离  
**新方案**：Postgres RLS，按 JWT tenant_id 自动过滤

### 7.3 审批流：第三方 SaaS API

**旧方案**：Java Flowable BPMN 引擎  
**新方案**：调第三方 SaaS API（钉钉 / 飞书 / 企微）

### 7.4 LLM：dsh 自带 provider

**旧方案**：自建 llmgw  
**新方案**：dsh llm-pi-ai + llm-deepseek provider

### 7.5 RAG：RAGFlow + GraphRAG

**旧方案**：RAGFlow + LightRAG  
**新方案**：RAGFlow（文档 RAG）+ Microsoft GraphRAG（KG RAG）

### 7.6 沙箱：dsh sandbox + MP-SANDBOX-01 双层

| 层 | dsh sandbox | MP-SANDBOX-01 |
|---|---|---|
| 颗粒度 | 进程级 | VM 级 |
| 冷启动 | < 100ms | 1-5s |
| 适用 | 内置数字员工作业 / 半可信 | 第三方不可信 Marketplace |
| 实现 | bwrap / Landlock / Seatbelt | Firecracker / K8s Job |

### 7.7 数字员工：dsh preset ×7 + 状态机

**5 种状态**：

| 状态 | 持续时间 | dsh 资源 | 用户感知 |
|---|---|---|---|
| running | 分钟 | 活跃 | 实时对话 |
| waiting_tool | 秒 | 活跃 | 实时对话 |
| waiting_hitl | 分钟-小时 | 活跃 | 弹 HITL 面板 |
| **waiting_external** | **小时-周** | **持久化 + 释放** | **后台任务通知** |
| completed | — | 释放 | 完成通知 |

### 7.8 API：PostgREST + Edge Functions

| 场景 | 方案 |
|---|---|
| 标准 CRUD | PostgREST 自动 |
| 复杂业务逻辑 | Supabase Edge Functions |
| 长任务 / 重型 | Temporal workflow |
| 数字员工 API | dsh preset |

### 7.9 HITL Hub：联动中枢

**4 种 HITL 类型**：

| 类型 | 谁审批 | 在哪审批 |
|---|---|---|
| workflow_saas | 业务用户 | 钉钉 / 飞书 / 企微 |
| workflow_dsh | 业务用户 | dsh Web |
| tool_dsh | 数字员工用户 | dsh Web |
| action_confirm | 数字员工用户 | dsh Web |

**统一**：
- 状态表：`hitl_requests`
- 事件流：dsh session/event
- 通知：Supabase Realtime WS
- 面板：dsh Web 统一 HITL 面板

### 7.10 长任务 5 大机制

| 机制 | 作用 |
|---|---|
| **多级审批超时升级** | 24h → B / 48h → C / 72h → D |
| **pending_approval 状态冻结** | DB trigger 阻止业务变更 |
| **webhook + polling 双重对账** | pg_cron 每小时轮询兜底 |
| **自动 reminder + 升级** | pg_cron 每日检查 |
| **关键上下文持久化** | hitl_requests.context 字段 |

### 7.11 Temporal 长任务能力

- ✅ **History 持久化**：workflow 局部变量自动序列化
- ✅ **signal**：接收外部信号（审批结果）
- ✅ **wait_condition**：最长 7 天（可配置）
- ✅ **Activity heartbeat**：检测 worker 健康
- ✅ **retry + backoff**：失败自动重试
- ✅ **version**：workflow 版本管理

### 7.12 Temporal UI 与 dsh Web UI 分工

| 角色 | 使用 UI |
|---|---|
| 业务用户 | dsh Web（自己对话 / 任务进度 / HITL 面板） |
| SRE / 业务 Lead | Temporal UI（workflow 执行细节）+ Supabase Studio |
| 开发者 | Temporal UI（调试）+ IDE |

**业务用户不直接接触 Temporal UI**（太技术化），SRE 用。

### 7.13 编排栈：dsh + Temporal + Supabase 三层分工

```
第1层：dsh（"怎么思考"）
  - 数字员工 agent loop  - LLM provider
  - tool 调用决策
  - session / event 管理

第2层：Temporal（"业务怎么流转"）
  - DAG 工作流编排
  - 长任务 + HITL + 持久化
  - 多语言 SDK

第3层：Supabase + SaaS（"业务依赖什么"）
  - Postgres / Realtime / Edge
  - 钉钉 / 飞书 / 企微 审批
  - 数字员工 dsh preset
```

### 7.14 dsh Docker 部署设计

dsh 是 Node.js + TypeScript + pnpm monorepo 应用，**完全可以 Docker 部署**。dsh 仓库本身无官方 Dockerfile（preview 阶段），由 MP 自建。

#### 三种部署模式

| 模式 | 用途 | 实现 |
|---|---|---|
| **K8s Deployment** | 数字员工长期运行（生产） | dsh web + 多副本 + HPA |
| **K8s Job** | 短时任务（数字员工作业） | dsh headless + 一次性 |
| **Docker Compose** | 开发 / 测试 / 本地 | docker-compose.yml |

#### Dockerfile（多阶段构建）

```dockerfile
# === 阶段1：依赖安装 ===
FROM node:22.19-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY patches ./patches
COPY vendor ./vendor
COPY packages ./packages
COPY apps ./apps
COPY examples ./examples
COPY tsconfig.base.json tsconfig.json ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts && \
    pnpm rebuild esbuild node-pty lefthook koffi

# === 阶段2：构建 ===
FROM node:22.19-alpine AS build
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /repo
COPY --from=deps /repo ./
RUN pnpm run build

# === 阶段3：运行时（最小化） ===
FROM node:22.19-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@10 --activate && \
    apk add --no-cache tini
WORKDIR /app
COPY --from=build /repo/apps/web/dist /app/apps/web/dist
COPY --from=build /repo/apps/cli/dist /app/apps/cli/dist
COPY --from=build /repo/packages /app/packages
COPY --from=build /repo/node_modules /app/node_modules
COPY --from=build /repo/pnpm-workspace.yaml /app/
COPY --from=build /repo/package.json /app/
RUN addgroup -g1001 dsh && \
    adduser -D -u1001 -G dsh dsh && \
    mkdir -p /app/data /app/config && \
    chown -R dsh:dsh /app
USER dsh
ENV NODE_ENV=production DSH_PORT=3080 DSH_HOME=/app/data
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3080/health || exit 1
EXPOSE 3080
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "dsh", "web", "--host", "0.0.0.0", "--port", "3080"]
```

#### 关键配置

| 配置 | 值 | 原因 |
|---|---|---|
| **基础镜像** | node:22.19-alpine | dsh 要求 Node ≥22.19 |
| **进程管理** | tini | 正确处理 PID1 + 信号 |
| **用户** | dsh (uid 1001) | 非 root 运行（K8s 安全） |
| **镜像大小** | ~400MB | 多阶段构建 + Alpine |
| **健康检查** | wget /health | K8s liveness/readiness 探针 |
| **DEEPSEEK_API_KEY** | ExternalSecret | 不进 git（13 硬规则延伸） |

#### 镜像标签策略

```bash
# 版本号 + Git SHA（精确回滚）
mp/dsh-web:v6.0.0-abc1234

# latest（仅 dev）
mp/dsh-web:latest
```

#### ⭐ dsh 持久化方案（关键，）

dsh 官方只提供 JSONL / SQLite 两种持久化后端（每个 session 一个文件 / 一个 db 文件），**无法支持 K8s 多副本共享 session**。

**v6.0 正确做法**：**自建 Postgres backend（MP 自研）**，复用 Supabase PG。

| 持久化方案 | 是否可用 | 原因 |
|---|---|---|
| dsh JSONL + PVC | ❌ | K8s 多副本**不共享** PVC；只能挂一个 Pod |
| dsh SQLite + PVC | ❌ | 单文件**并发写差**；dsh 文档明确"Only one live writer per session" |
| ⭐ 自建 Postgres backend + Supabase PG | ✅ | 多副本共享；与业务数据同库；高可用 |

##### Supabase PG 表设计

```sql
-- session 头信息
CREATE TABLE dsh_session_headers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    version INT NOT NULL DEFAULT 0,
    cwd TEXT,
    parent_session UUID,
    seed_length INT,
    origin TEXT,
    delegation_depth INT NOT NULL DEFAULT 0,
    agent_preset TEXT,
    -- 业务扩展
    title TEXT,
    status TEXT DEFAULT 'running',
    pending_workflow_id TEXT,
    pending_tool_call_id TEXT,
    pending_tool_call_result JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- session 事件流（event sourcing）
CREATE TABLE dsh_session_events (
    session_id UUID NOT NULL REFERENCES dsh_session_headers(id) ON DELETE CASCADE,
    seq INT NOT NULL,
    type TEXT NOT NULL,
    time TIMESTAMPTZ NOT NULL,
    data JSONB NOT NULL,
    source_event_seqs TEXT[],
    surface_op TEXT,
    PRIMARY KEY (session_id, seq)
);

-- RLS 自动隔离（多租户）
ALTER TABLE dsh_session_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsh_session_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dsh_session_headers
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY tenant_isolation ON dsh_session_events
    USING (session_id IN (
        SELECT id FROM dsh_session_headers 
        WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    ));
```

##### 自建 Postgres backend 实现要点

实现 `@deepseek-ai/dsh-session-persistence` Service Definition：
- `append(id, events)`：批量 INSERT `dsh_session_events`，校验 contiguous seq
- `load(id)`：JOIN header + events，按 seq 排序，**实现 crash recovery**（未关闭 turn 合成 closers）
- `list()`：从 `dsh_session_headers` 列表
- `listSnapshots()`：轻量列表（仅 header）

##### PVC 用途（仅 config）

```yaml
volumes:
- name: dsh-config
  configMap: { name: dsh-config }  # cordis.yml / preset 只读
- name: dsh-cache
  emptyDir: {}  # 临时缓存（可丢弃）
# ❌ 不需要 dsh-data PVC（session 在 Supabase PG）
```

#### dsh sandbox 容器化（特殊配置）

dsh sandbox 的 Landlock / bwrap 需要原生能力：

```yaml
# dsh sandbox Job
securityContext:
  capabilities:
    add: [SYS_ADMIN]  # bwrap 必需
  # 可选：hostPID: true（仅严格隔离场景）
```

### 7.15 Edge Functions 替代 FastAPI

v6.0 **不再需要 mate-platform FastAPI 后端**。所有业务逻辑用 Supabase Edge Functions (Deno + TypeScript) + PostgREST 自动 CRUD 实现。

#### 标准 CRUD（PostgREST 自动）

```sql
-- 定义业务表，自动得到 REST API
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- ⭐ 自动得到：
-- GET /orders
-- POST /orders
-- PATCH /orders?id=eq.xxx
-- DELETE /orders?id=eq.xxx
```

#### 复杂业务逻辑（Edge Functions）

```typescript
// supabase/functions/create-order-with-approval/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Client } from 'https://esm.sh/@temporalio/client@latest'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  )
  const auth = verifyJWT(req.headers.get('authorization'))
  const body = await req.json()
  
  // 1. 创建订单（PostgREST 等价）
  const { data: order } = await supabase.from('orders').insert({
    tenant_id: auth.tenant_id,
    customer_id: body.customer_id,
    amount: body.amount,
    status: 'pending_approval',
  }).select().single()
  
  // 2. 启动 Temporal workflow
  const temporal = new Client({ address: Deno.env.get('TEMPORAL_ADDRESS')! })
  await temporal.workflow.start('OrderApprovalWorkflow', {
    args: [order.id, auth.tenant_id],
    taskQueue: 'order-approval',
  })
  
  return new Response(JSON.stringify({ order_id: order.id }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

#### 12 Ontology Kernel（Edge Functions + PG schema）

```sql
CREATE TABLE ontology_object_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    rid TEXT NOT NULL,
    slug TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'v1',
    properties JSONB NOT NULL,
    link_types TEXT[],
    action_types TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, rid)
);
ALTER TABLE ontology_object_types ENABLE ROW LEVEL SECURITY;

CREATE TABLE ontology_action_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    rid TEXT NOT NULL,
    name TEXT NOT NULL,
    parameters JSONB NOT NULL,
    permission TEXT,
    workflow_name TEXT,
    UNIQUE(tenant_id, rid)
);
```

```typescript
// supabase/functions/apply-ontology-change/index.ts
serve(async (req) => {
  const auth = verifyJWT(req.headers.get('authorization'))
  const { change_id } = await req.json()
  
  // 事务性应用本体变更
  const { data, error } = await supabase.rpc('apply_ontology_change', {
    p_tenant_id: auth.tenant_id,
    p_change_id: change_id,
  })
  if (error) throw error
  
  return new Response(JSON.stringify({ applied: true, ...data }))
})
```

#### Temporal Worker（Node.js SDK）

```typescript
// temporal_workers/order-approval/src/worker.ts
import { Worker } from '@temporalio/worker'

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    taskQueue: 'order-approval',
    activities: {
      dbRead: dbReadActivity,
      dbWrite: dbWriteActivity,
      agentInvoke: agentInvokeActivity,
      approvalRequest: approvalRequestActivity,
    },
  })
  await worker.run()
}
```

#### Edge Functions 限制与缓解

| 限制 | 缓解 |
|---|---|
| Edge Functions timeout 150 秒 | 长任务用 Temporal workflow，不放 Edge |
| Edge Functions 冷启动 | Supabase Edge 调度优化 + 业务用 keep-alive |
| 复杂业务流 | Temporal workflow 编排 |
| 多步事务 | Edge Function 内 supabase.rpc 调 PG function |

### 7.16 可观测层设计

可观测**语言无关**，OpenTelemetry SDK 在所有语言中都有。

#### 数据采集（多语言 SDK）

| 组件 | OTel SDK | 输出 trace | 输出 metric | 输出 log |
|---|---|---|---|---|
| dsh | `@opentelemetry/sdk-node` | dsh session 每次调 LLM/tool | dsh_requests_total | dsh session log |
| Supabase Edge Functions | `@supabase/functions-js` | 每次 Edge Function 调用 | edge_function_duration | stdout |
| Temporal worker | `@temporalio/interceptors-opentelemetry` | workflow/activity trace | workflow_duration | workflow log |
| PostgREST | OTel 自动（Supabase 自带） | 每次 SQL 查询 | postgrest_requests_total | sql log |
| GraphRAG（Python） | `opentelemetry-python` | KG 抽取每步 | kg_extraction_duration | log |
| RAGFlow（Python） | `opentelemetry-python` | 文档摄取各阶段 | ingestion_duration | log |

#### 数据流

```
┌──────────────────────────────────────────────────────────┐
│ 可观测层（语言无关）                              │
│                                                           │
│  数据采集（多语言 SDK） │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ TS SDK │ │ Python SDK│ │ SQL trigger │       │
│  │ dsh │ │ GraphRAG │  │ Supabase │       │
│  │ Edge │  │ RAGFlow │  │ trigger │       │
│  └──────────┘ └──────────┘ └──────────┘        │
│                │ │
│                ▼                                         │
│  ┌────────────────────────────────────┐                │
│  │ OTel Collector（K8s Deployment）│                │
│  │  - 接收 traces / metrics / logs  │                │
│  │  - 采样 +转发 │                │
│  └────────────────────────────────────┘                │
│       ┌────────┼────────┐                                │
│       ▼        ▼        ▼                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ │
│  │Tempo │ │Prom. │ │ Loki │                            │
│  └──────┘ └──────┘ └──────┘                            │
│       └────────┴────────┘                                │
│                │                                         │
│                ▼                                         │
│  ┌────────────────────────────────────┐                │
│  │ Grafana（统一面板 + 告警）        │                │
│  └────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────┘
```

#### 关键 Dashboard

| 角色 | Dashboard |
|---|---|
| **业务用户** | dsh Web（自己任务进度 / HITL 弹窗） |
| **SRE** | 系统指标 / Temporal workflow 状态 / Supabase Studio |
| **开发者** | Grafana Tempo / Loki（代码级 trace） |
| **PM** | 业务指标（订单量 / 审批时长 / HITL 通过率） |

具体 Dashboard：
- **应用 Dashboard**：API 延迟 / 错误率 / QPS
- **数字员工 Dashboard**：活跃会话数 / LLM token 用量 / 长任务数
- **HITL Dashboard**：pending HITL / 平均审批时长 / SaaS 失败率
- **Temporal Dashboard**：workflow throughput / Activity 失败率 / 长任务数
- **RAG Dashboard**：检索延迟 / KG 节点数 / 命中率

---

## 8. 部署架构

```
┌──────────────────────────────────────────────────────────────────┐
│ K8s 集群（生产）                                                │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Supabase 自托管（Helm chart）                            │  │
│  │  ├─ postgres（PG 主库 + pgvector + temporal schema）   │  │
│  │  ├─ auth（GoTrue JWT）                                   │  │
│  │  ├─ realtime（WebSocket + logical replication）         │  │
│  │  ├─ storage（S3 兼容）                                  │  │
│  │  ├─ functions（Edge runtime / Deno）                    │  │
│  │  ├─ postgrest（自动 REST）                              │  │
│  │  ├─ studio（Web 管理后台）                              │  │
│  │  └─ kong（API 网关）                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Temporal Cluster                                         │  │
│  │  ├─ temporal-server（workflow engine）                    │  │
│  │  ├─ temporal-worker（执行 Activity）                     │  │
│  │  └─ temporal-web（UI，SRE 用）                          │  │
│  │  存储：Supabase Postgres（temporal schema）              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ MP 自有服务                                              │  │
│  │  ├─ mate-platform（FastAPI 17 域 + 12 Kernel）           │  │
│  │  ├─ dsh（数字员工编排 + LLM provider）                  │  │
│  │  ├─ ragflow（文档 RAG）                                 │  │
│  │  ├─ graphrag（KG RAG）                                  │  │
│  │  ├─ mate-hitl-hub（HITL 联动中枢）                     │  │
│  │  └─ mate-sandbox（Firecracker 严格沙箱）               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 外部 SaaS（外部调度）                                   │  │
│  │  └─ 审批：钉钉 / 飞书 / 企微                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 8.1 dsh K8s Deployment 详细配置

#### dsh-web-deployment.yaml（核心）

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dsh-web
  namespace: mp-platform
  labels: { app: dsh-web, version: v6.0 }
spec:
  replicas: 3
  selector:
    matchLabels: { app: dsh-web }
  strategy:
    type: RollingUpdate
    rollingUpdate: { maxSurge: 1, maxUnavailable: 0 }
  template:
    metadata: { labels: { app: dsh-web } }
    spec:
      securityContext: { runAsNonRoot: true, runAsUser: 1001, fsGroup: 1001 }
      containers:
      - name: dsh-web
        image: mp/dsh-web:v6.0.0
        ports: [{ containerPort: 3080, name: http }]
        env:
        - { name: NODE_ENV, value: production }
        - { name: DSH_PORT, value: "3080" }
        - name: DEEPSEEK_API_KEY
          valueFrom: { secretKeyRef: { name: dsh-secrets, key: deepseek-api-key } }
        - name: SUPABASE_URL
          value: http://supabase-postgres.mp-platform.svc:5432
        - name: SUPABASE_ANON_KEY
          valueFrom: { secretKeyRef: { name: supabase-secrets, key: anon-key } }
        - name: TEMPORAL_ADDRESS
          value: temporal.mp-platform.svc:7233
        # ⭐ Postgres backend 配置（Supabase PG）
        - name: SUPABASE_URL
          value: http://supabase-postgres.mp-platform.svc:5432
        - name: SUPABASE_SERVICE_KEY
          valueFrom: { secretKeyRef: { name: supabase-secrets, key: service-role-key } }
        resources:
          requests: { memory: "512Mi", cpu: "500m" }
          limits: { memory: "2Gi", cpu: "2000m" }
        livenessProbe:
          httpGet: { path: /health, port: 3080 }
          initialDelaySeconds: 60
          periodSeconds: 30
          failureThreshold: 3
        readinessProbe:
          httpGet: { path: /ready, port: 3080 }
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 2
        # ⭐ PVC 仅存 config / cache（session 在 Supabase PG）
        volumeMounts:
        - { name: dsh-config, mountPath: /app/config }
        - { name: dsh-cache, mountPath: /app/cache }
      volumes:
      - name: dsh-config
        configMap: { name: dsh-config }  # cordis.yml / preset
      - name: dsh-cache
        emptyDir: {}  # 临时缓存（可丢弃）
---
apiVersion: v1
kind: Service
metadata: { name: dsh-web, namespace: mp-platform }
spec:
  type: ClusterIP
  selector: { app: dsh-web }
  ports: [{ port: 80, targetPort: 3080 }]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dsh-web
  namespace: mp-platform
  annotations: { cert-manager.io/cluster-issuer: letsencrypt-prod }
spec:
  tls: [{ hosts: [dsh.mp-platform.local], secretName: dsh-tls }]
  rules:
  - host: dsh.mp-platform.local
    http:
      paths: [{ path: /, pathType: Prefix, backend: { service: { name: dsh-web, port: { number: 80 } } } }]
```

#### dsh HPA 自动伸缩

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: dsh-web-hpa, namespace: mp-platform }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: dsh-web }
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
  - type: Resource
    resource: { name: memory, target: { type: Utilization, averageUtilization: 80 } }
```

#### dsh Job（按需任务）

```yaml
apiVersion: batch/v1
kind: Job
metadata: { name: dsh-task-{taskId}, namespace: mp-platform }
spec:
  ttlSecondsAfterFinished: 3600  # 1小时后清理
  template:
    spec:
      restartPolicy: OnFailure
      containers:
      - name: dsh-task
        image: mp/dsh-web:v6.0.0
        command: ["pnpm", "dsh", "headless", "--profile", "/app/config/cordis.yml"]
        env:
        - name: DEEPSEEK_API_KEY
          valueFrom: { secretKeyRef: { name: dsh-secrets, key: deepseek-api-key } }
        - name: TASK_INPUT
          value: "{...}"
        resources:
          requests: { memory: "1Gi", cpu: "1000m" }
          limits: { memory: "4Gi", cpu: "2000m" }
```

#### CI/CD 流程

```yaml
# .github/workflows/dsh-build.yml
name: dsh build
on:
  push: { tags: ['v*'] }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with: { version: 10 }
    - uses: actions/setup-node@v4
      with: { node-version: 22.19, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm run build
    - run: pnpm run test
    - run: |
        docker build -t mp/dsh-web:${{ github.sha }} .
        docker tag mp/dsh-web:${{ github.sha }} mp/dsh-web:latest
    - run: |
        echo "${{ secrets.HARBOR_PASSWORD }}" | docker login -u admin --password-stdin registry.mp-platform.local
        docker push registry.mp-platform.local/mp/dsh-web:${{ github.sha }}
```

---

## 9. 安全设计

| 维度 | 设计 |
|---|---|
| **身份** | Supabase Auth（JWT）+ OAuth2 |
| **多租户** | Postgres RLS（按 JWT tenant_id 自动过滤） |
| **存储** | Supabase Storage（S3 兼容）+ RLS bucket policy |
| **API** | PostgREST JWT 自动校验 |
| **Edge Functions** | 内部 service token |
| **Temporal** | workflow ID + namespace 隔离 + JWT 调 client |
| **HITL** | hitl_requests RLS + 签名校验 webhook |
| **凭证** | ExternalSecret / Vault |
| **网络** | K8s NetworkPolicy default-deny |
| **可观测** | OTel + 落审计表 |
| **dsh 容器** | runAsNonRoot (uid 1001) + tini + 健康检查 |
| **dsh sandbox** | capability SYS_ADMIN + namespace 隔离 |
| **dsh 镜像** | 镜像扫描（trivy）+ 多阶段构建 |

---

## 10. 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| **Supabase 自托管运维** | 🟠 中 | Supabase 官方 Helm chart + SRE 培训 |
| **Realtime 可靠性弱于 Kafka** | 🟠 中 | 大流量场景可选择性升级 Kafka |
| **第三方审批 SaaS 依赖** | 🟠 中 | 三家适配互备（钉钉/飞书/企微） |
| **RLS 写错导致数据泄露** | 🔴 高 | Supabase Studio RLS Editor 审核 + 严格测试 |
| **GraphRAG LLM 调用成本高** | 🟡 低 | dsh token-meter 监控 + 预留 limit |
| **dsh preview 接口 breaking** | 🟡 低 | dsh 走 vendor 模式 + pin SHA |
| **Temporal 长任务资源** | 🟡 低 | workflow history 走 PG + 自动分页 |
| **1 周+ 审批 webhook 丢失** | 🟠 中 | webhook + polling 双重对账 |
| **HITL Hub 单点** | 🟡 低 | HITL Hub 本身是 dsh service，多副本部署 |
| **长任务 context 丢失** | 🟡 低 | 关键上下文双写到 hitl_requests.context |

---

## 11. 实施路线

### 11.1 阶段划分

| 阶段 | 周 | 内容 |
|---|---|---|
| **Q4-2026 准备** | 4 | 写架构 spec + ADR + 团队培训 Supabase / Temporal |
| **Q1-2027 基础设施** | 12 | Supabase + Temporal + dsh 自托管 + K8s |
| **Q1-2027 业务迁移** | 8 | 17 域迁 Supabase PG + Temporal 工作流迁移 |
| **Q2-2027 数字员工** | 6 | dsh 集成 + 7 preset + HITL Hub |
| **Q2-2027 收口** | 4 | K8s 部署 + Studio 培训 + 13 硬规则对照 |

**总工作量**：46 周 ≈ 10.5 个月

### 11.2 关键 Batch

| Batch | 周 | 内容 |
|---|---|---|
| **MP-V6-FOUNDATION-01** | 4 | Supabase 自托管 + K8s + 监控 |
| **MP-V6-TEMPORAL-01** | 3 | Temporal 集群部署 + 复用 Supabase PG |
| **MP-V6-DSH-01** | 4 | dsh 集成 + 60 包接入 + vendor 策略 |
| **MP-V6-AUTH-01** | 2 | Supabase Auth + RLS + JWT |
| **MP-V6-DOMAIN-MIGRATE-01** | 8 | 17 域从自有 PG 迁 Supabase PG |
| **MP-V6-HITL-HUB-01** | 4 | HITL Hub + hitl_requests 表 + 4 种 HITL 类型 |
| **MP-V6-LLM-01** | 2 | dsh llm-pi-ai 配置 + 多 provider |
| **MP-V6-RAG-01** | 4 | RAGFlow + GraphRAG 集成 |
| **MP-V6-APPROVAL-01** | 6 | 第三方审批 SaaS + 多级超时升级 |
| **MP-V6-REALTIME-01** | 3 | Realtime WS + trigger 派生 |
| **MP-V6-EVENTS-01** | 2 | Database Webhook + pg_cron worker |
| **MP-V6-EDGE-FN-01** | 6 | 17 域业务迁移到 Supabase Edge Functions（替代 FastAPI） |
| **MP-V6-TEMPORAL-TS-01** | 3 | Temporal worker 改 TypeScript SDK（Node 部署） |
| **MP-V6-OBSERVABILITY-01** | 2 | OTel Collector + Tempo + Prometheus + Loki + Grafana 部署 |
| **MP-V6-SANDBOX-01** | ~~3~~ | ~~dsh sandbox + Firecracker 双层~~（**v6.0 取消 Firecracker**，只留 dsh sandbox） |
| **MP-V6-LONG-TASK-01** | 4 | 1 周+ 长任务 5 大机制 |
| **MP-V6-DSH-DOCKER-01** | 2 | dsh Dockerfile（多阶段）+ GH Actions |
| **MP-V6-DSH-K8S-01** | 2 | dsh K8s Deployment + HPA + Service + Ingress |
| **MP-V6-DSH-POSTGRES-BACKEND-01** | 3 | 自建 dsh session persistence Postgres backend（Supabase PG） |
| **MP-V6-DEPLOY-01** | 2 | Helm chart + ArgoCD |

### 11.3 依赖关系

```
MP-V6-FOUNDATION-01（前置）
    ├─ MP-V6-TEMPORAL-01
    │    └─ MP-V6-HITL-HUB-01
    │         ├─ MP-V6-APPROVAL-01
    │         └─ MP-V6-LONG-TASK-01
    ├─ MP-V6-DSH-01
    │    ├─ MP-V6-DSH-DOCKER-01
    │    │    └─ MP-V6-DSH-K8S-01
    │    ├─ MP-V6-DSH-POSTGRES-BACKEND-01
    │    ├─ MP-V6-LLM-01
    │    ├─ MP-V6-RAG-01
    │    └─ MP-V6-SANDBOX-01
    ├─ MP-V6-AUTH-01
    │    └─ MP-V6-DOMAIN-MIGRATE-01
    │         └─ MP-V6-EDGE-FN-01
    │              └─ MP-V6-TEMPORAL-TS-01
    ├─ MP-V6-REALTIME-01
    │    └─ MP-V6-EVENTS-01
    │         └─ MP-V6-DEPLOY-01（收口）
    └─ MP-V6-OBSERVABILITY-01
```

**总 Batch 数**：19 个 | **总工作量**：46 周 ≈ 10.5 个月

---

## 12. 业务约束对应

| 业务场景 | v6.0 实现 |
|---|---|
| 17 域业务封装 | FastAPI + Supabase PostgREST（CRUD）+ Edge（复杂） |
| 数字员工编排 | dsh preset ×7 + 状态机 |
| 多租户 | RLS 单一层 |
| 事件可靠传递 | trigger + Webhook + pg_cron worker |
| 实时推送 | Supabase Realtime |
| 审批流 | 第三方 SaaS API |
| LLM 多 provider | dsh llm-pi-ai |
| RAG | RAGFlow + GraphRAG |
| 沙箱 | dsh sandbox + MP-SANDBOX-01 |
| 管理后台 | Supabase Studio + Temporal UI |
| API 网关 | PostgREST + Edge |
| HITL 联动 | HITL Hub 统一 4 种类型 |
| 长任务 | Temporal + 5 大机制 |
| 凭证 | ExternalSecret + Vault |

---

## 13. ADR 引用

| ADR | 主题 |
|---|---|
| **ADR-0046** | 「能用 dsh 就用 dsh」原则 + 60% 复用率 |
| **ADR-0047** | dsh 作为数字员工编排平面（替代 SuperAI） |
| **ADR-0048** | dsh 企业端 IAM 接入（Supabase Auth） |
| **ADR-0049** | MP v6.0 架构总方案（Supabase 全量 + Temporal） |
| **ADR-0050** | 事件流改造（trigger + Webhook 替代 Kafka + Outbox） |
| **ADR-0051** | 审批流改造（第三方 SaaS 替代 Flowable） |
| **ADR-0052** | v6.0 编排栈选型（dsh + Temporal + Supabase，不引入 LangChain） |
| **ADR-0053** | HITL Hub 设计（统一 4 种 HITL 类型 + 长任务 5 大机制） |
| **ADR-0054** | dsh Docker 部署方案（多阶段 Dockerfile + K8s Deployment + HPA） |
| **ADR-0055** | dsh Postgres backend（自建 session persistence，复用 Supabase PG） |
| **ADR-0056** | 本体生成 + HITL 落库流程（pending_object_changes + Temporal） |
| **ADR-0057** | polyglot 微服务架构（Python + TypeScript 并存） |
| **ADR-0058** | v6.0 后端 TypeScript 化（Edge Functions 替代 FastAPI + 去掉 Firecracker） |
| **ADR-0059** | v6.0 可观测层设计（OTel + Grafana，语言无关） |

---

## 14. 附录

### 14.1 与 v3.0 GA 的对比

| 维度 | v3.0 GA | v6.0 | 改进 |
|---|---|---|---|
| **核心组件数** | 30+ 服务 | **6 核心服务** | -80% |
| **认证系统** | Keycloak | Supabase Auth | -1 |
| **数据库** | 自有 PG | Supabase PG | -1 |
| **事件流** | Kafka + Outbox | trigger + Webhook | -3 |
| **缓存** | Redis Cluster | Supabase 内置 | -1 |
| **对象存储** | MinIO | Supabase Storage | -1 |
| **API 网关** | FastAPI + Kong | PostgREST + Edge | -1 |
| **后端服务** | mate-platform FastAPI（Python） | **Supabase Edge Functions（TypeScript）** | -1 |
| **审批流** | Flowable Java | 第三方 SaaS | -1 引擎 |
| **LLM Gateway** | 自建 llmgw | dsh 自带 | -1 服务 |
| **RAG** | RAGFlow + LightRAG | RAGFlow + GraphRAG | +1 引擎 |
| **业务 Workflow** | 自建 / 无 | Temporal | +1 引擎 |
| **HITL 联动** | 无 | HITL Hub | +1 中枢 |
| **严格沙箱** | MP-SANDBOX-01 Firecracker | **v6.0 去掉**（dsh sandbox 足够） | -1 |

### 14.2 术语表

| 术语 | 含义 |
|---|---|
| **dsh** | DeepSeek Harness（基于 Cordis 的 agent harness） |
| **Cordis** | Koishi 团队的依赖注入框架（dsh 底层） |
| **preset** | dsh 的 per-session cordis.yml 组合 |
| **bundle** | dsh 的可安装 plugin 包 |
| **PostgREST** | Supabase 自动从 PG schema 生成 REST API |
| **Edge Functions** | Supabase 的 Deno runtime 边缘函数 |
| **Realtime** | Supabase 基于 PG logical replication 的 WebSocket |
| **pg_cron** | Postgres 内置定时任务扩展 |
| **Database Webhook** | Supabase trigger 发 HTTP 请求 |
| **Temporal** | 开源 workflow orchestrator（前 Uber Cadence） |
| **GraphRAG** | Microsoft 的 KG + Leiden 社区 RAG 范式 |
| **Leiden** | 社区检测算法（用于 KG 社区发现） |
| **HITL** | Human-in-the-Loop（人在回路） |
| **MP-SANDBOX-01** | MP 自研 Function Sandbox |
| **RAGFlow** | 通用 RAG 框架 |
| **RLS** | Row Level Security（Postgres 行级安全） |
| **HPA** | Horizontal Pod Autoscaler（K8s 自动伸缩） |
| **PVC** | PersistentVolumeClaim（v6.0 仅用于 dsh config / cache，**不存 session**） |
| **tini** | 轻量 init 进程（处理 PID1 + 信号转发） |
| **Landlock** | Linux 内核 5.13+ 沙箱机制（dsh sandbox 用） |
| **bwrap** | bubblewrap（用户态 namespace 沙箱） |
| **SYS_ADMIN** | Linux capability（bwrap / Landlock 必需） |
| **dsh session-persistence** | dsh 会话持久化 Service Definition（接口契约） |
| **session-persistence-jsonl** | dsh 官方 JSONL 后端（每 session 一个 .jsonl.zstd 文件） |
| **session-persistence-sqlite** | dsh 官方 SQLite 后端（一个 db 文件） |
| **session-persistence-postgres** | **MP 自建** Postgres 后端（复用 Supabase PG） |

### 14.3 待办事项

- [ ] 写 ADR-0046 ~ ADR-0054
- [ ] 评估 Supabase 版本兼容性
- [ ] 团队 Supabase + Temporal 培训
- [ ] GraphRAG 自部署方案（vs SaaS 版本）
- [ ] 第三方审批 SaaS 适配层详细设计
- [ ] Supabase + Temporal 共用 PG schema 隔离方案
- [ ] HITL Hub 详细设计文档
- [ ] 数字员工状态机 spec
- [ ] 沙箱（dsh sandbox + Firecracker）部署方案
- [ ] Temporal UI 与 Supabase Auth 对接方案
- [ ] dsh Dockerfile + GH Actions 详细脚本
- [ ] dsh K8s Helm chart（包装 Deployment + Service + HPA）
- [ ] Harbor 镜像仓库搭建 + 镜像扫描（trivy）

---

## 15. 评审签字

| 角色 | 姓名 | 签字 | 日期 |
|---|---|---|---|
| 架构师 | | | |
| 后端 Lead | | | |
| 前端 Lead | | | |
| SRE Lead | | | |
| PM | | | |

---

*MetaPlatform v6.0 架构 spec 最终版完毕。*  
*本文档整合了 dsh / Supabase / Temporal / HITL Hub / 长任务 / 状态机 / 沙箱 等所有讨论结论。*  
*待评审后定稿。*