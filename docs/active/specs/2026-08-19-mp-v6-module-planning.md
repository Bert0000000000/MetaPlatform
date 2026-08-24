# MetaPlatform v6.0 模块规划

> **版本**：v6.0（阈值与实时触发补充）  
> **日期**：2026-08-19  
> **状态**：**草案**（待评审）  
> **作者**：Claude (MiniMax-M3) + 用户协作  
> **配套文档**：
> - [v6.0 技术架构 spec](./2026-08-19-mp-v6-architecture.md) - 技术栈
> - [v6.0 应用架构 spec](./2026-08-19-mp-v6-application-architecture.md) - 应用层

---

## 0. 一句话定位

**MetaPlatform v6.0 模块规划 = 把「19 个应用 + N 个内部模块 + 数字员工 preset + 第三方集成」按业务价值 + 技术依赖 + 演进顺序，组织成可执行的 4 个阶段（基础设施 → 核心引擎 → 业务能力 → 扩展生态）。**

---

## 1. 模块分类法

按 MP 业务定位，模块分 **5 类**：

```
┌──────────────────────────────────────────────┐
│ 1. 基础设施层（必选，所有阶段都需要）       │
│    K8s + Supabase + Temporal + dsh + 监控    │
├──────────────────────────────────────────────┤
│ 2. 核心引擎层（必备，平台根基）             │
│    12 Ontology Kernel + HITL Hub + 数字员工  │
├──────────────────────────────────────────────┤
│ 3. 业务能力层（按需，按 17 域分批）         │
│    17 域业务封装 + Workflow 引擎             │
├──────────────────────────────────────────────┤
│ 4. AI 能力层（增强）                        │
│    GraphRAG + RAGFlow + Embedding            │
├──────────────────────────────────────────────┤
│ 5. 扩展生态层（可选）                       │
│    数字员工 Marketplace + 第三方集成         │
└──────────────────────────────────────────────┘
```

---

## 2. 完整模块清单（50+ 模块）

### 2.1 基础设施层（10 个模块）

| # | 模块名 | 类型 | 技术 | 优先级 |
|---|---|---|---|---|
| **M01** | Supabase PG 集群 | 自托管 | Helm chart | 🔴 P0 |
| **M02** | Supabase Auth | 自带 | GoTrue | 🔴 P0 |
| **M03** | Supabase Realtime | 自带 | WebSocket + logical repl | 🔴 P0 |
| **M04** | Supabase Storage | 自带 | S3 兼容 | 🔴 P0 |
| **M05** | Supabase Edge Functions | 自带 | Deno + TS | 🔴 P0 |
| **M06** | Supabase PostgREST | 自带 | SQL → REST | 🔴 P0 |
| **M07** | Supabase Studio | 自带 | DBA GUI | 🔴 P0 |
| **M08** | Temporal Cluster | 自托管 | Helm chart | 🔴 P0 |
| **M09** | dsh K8s 部署 | 自研 | Docker + Helm | 🔴 P0 |
| **M10** | 可观测层（OTel + Grafana） | 自研 | Helm + Prometheus | 🔴 P0 |

### 2.2 核心引擎层（12 个模块）

| # | 模块名 | 类型 | 技术 | 优先级 |
|---|---|---|---|---|
| **M11** | 12 Ontology Kernel | 自研 | TypeScript / Edge Fn | 🔴 P0 |
| **M12** | ActionType.apply + HITL 三模式 | 自研 | Edge Function | 🔴 P0 |
| **M13** | HITL Hub（4 种 HITL） | 自研 | dsh service + Supabase PG | 🔴 P0 |
| **M14** | dsh 集成层（60 包） | dsh | Node.js | 🔴 P0 |
| **M15** | dsh session Postgres backend | 自研 | TypeScript | 🔴 P0 |
| **M16** | dsh Docker 镜像 + K8s | 自研 | Dockerfile + Helm | 🔴 P0 |
| **M17** | Temporal worker (Node SDK) | 自研 | TypeScript | 🔴 P0 |
| **M18** | Ontology 本体生成 + 预览 | 自研 | LLM + Edge Fn | 🟠 P1 |
| **M19** | 数字员工 preset ×7 | dsh | cordis.yml | 🟠 P1 |
| **M20** | dsh sandbox (Landlock/bwrap) | dsh | 进程级 | 🟠 P1 |
| **M21** | 数字员工状态机（5 状态） | 自研 | dsh + Supabase PG | 🟠 P1 |
| **M22** | 多级审批超时升级 | 自研 | Temporal + pg_cron | 🟠 P1 |

### 2.3 业务能力层（17 域 + 7 个）

| # | 域 | ObjectType 核心 | ActionType 核心 | 优先级 |
|---|---|---|---|---|
| **M23** | Customer | Customer / Contact / Lead | customer.create / merge | 🟠 P1 |
| **M24** | Order | Order / LineItem / Shipment | order.create / approve / cancel | 🟠 P1 |
| **M25** | Product | Product / SKU / Category | product.create / update | 🟠 P1 |
| **M26** | Contract | Contract / Clause / Party | contract.create / sign / archive | 🟠 P1 |
| **M27** | Supplier | Supplier / RFQ | supplier.create / qualify | 🟡 P2 |
| **M28** | Inventory | Warehouse / Stock / Movement | stock.in / out / transfer | 🟡 P2 |
| **M29** | Finance | Invoice / Payment / Ledger | invoice.create / pay | 🟡 P2 |
| **M30** | Expense | Expense / Receipt | expense.submit / approve | 🟡 P2 |
| **M31** | Document | Document / Version / Folder | document.upload / share | 🟡 P2 |
| **M32** | Project | Project / Task / Milestone | project.create / assign | 🟡 P2 |
| **M33** | Workflow | Process / State / Transition | process.start / pause | 🟡 P2 |
| **M34** | Approval | Request / Step / Decision | request.create / approve | 🟡 P2 |
| **M35** | Notification | Message / Channel / Template | message.send | 🟡 P2 |
| **M36** | User | User / Role / Permission | user.create / assign | 🟡 P2 |
| **M37** | Organization | Org / Department / Team | org.create / restructure | 🟡 P2 |
| **M38** | Knowledge | Article / Tag / Embedding | article.create / search | 🟡 P2 |
| **M39** | Analytics | Metric / Dashboard / Report | report.generate | 🟡 P2 |
| **M40** | Workflow Path C 引擎 | 自研 | Edge Function + Temporal | 🟠 P1 |

### 2.4 AI 能力层（5 个模块）

| # | 模块名 | 类型 | 技术 | 优先级 |
|---|---|---|---|---|
| **M41** | GraphRAG（KG RAG） | 第三方 | ms-graphrag（Python） | 🟠 P1 |
| **M42** | RAGFlow（文档 RAG） | 第三方 | 第三方 Python | 🟠 P1 |
| **M43** | Embedding Service | 自研 | OpenAI / 本地模型 | 🟠 P1 |
| **M44** | 数字员工 Knowledge Curator preset | dsh | dsh preset | 🟠 P1 |
| **M45** | RAG 路由（智能分流） | 自研 | Edge Function | 🟠 P1 |

### 2.5 扩展生态层（5 个模块）

| # | 模块名 | 类型 | 技术 | 优先级 |
|---|---|---|---|---|
| **M46** | 第三方审批 SaaS 适配 | 自研 | Edge Function | 🟠 P1 |
| **M47** | 钉钉 webhook 接收 | 自研 | Edge Function | 🟠 P1 |
| **M48** | 飞书 webhook 接收 | 自研 | Edge Function | 🟠 P1 |
| **M49** | 企微 webhook 接收 | 自研 | Edge Function | 🟠 P1 |
| **M50** | 数字员工 Marketplace | 自研 | dsh bundle + ExternalSecret | 🔵 P3 |

### 2.6 阈值与实时触发层（7 个模块）

> **场景 21：阈值配置**（业务用户配阈值）+ **场景 22：实时触发**（业务事件触发后立即比对阈值，不达标立即触发 action）
>
> **核心设计**：threshold 是**配置数据**（存 Supabase PG），action 是**实时响应**（trigger + pg_notify + Edge Function）。配置与执行分离。

| # | 模块名 | 类型 | 技术 | 优先级 |
|---|---|---|---|---|
| **M81** | quality-thresholds 表 | 自研 | Supabase PG + RLS | 🟠 P1 |
| **M82** | quality-check-events 表 | 自研 | Supabase PG | 🟠 P1 |
| **M83** | threshold-policy-engine（阈值 + action_policy 配置）| 自研 | Edge Function + Supabase Studio | 🟡 P2 |
| **M84** | threshold-realtime-monitor（实时监控）| 自研 | Postgres trigger + pg_notify + Edge Function | 🟠 P1 |
| **M85** | threshold-action-router（不达标 → action 路由）| 自研 | Edge Function + dsh preset + Temporal | 🟠 P1 |
| **M86** | threshold-check-worker（定时巡检 + 兜底）| 自研 | pg_cron + Temporal workflow | 🟠 P1 |
| **M87** | threshold-alert-history（告警历史 + 趋势）| 自研 | Supabase PG + Grafana | 🟡 P2 |

**M81-M82 核心表设计**：

```sql
-- 阈值配置（业务用户配）
CREATE TABLE quality_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    scope TEXT NOT NULL,                       -- 'ontology_quality' / 'rag_retrieval' / 'workflow_health'
    scope_target TEXT,
    metric_name TEXT NOT NULL,                  -- 'coverage' / 'hit_rate' / 'p99_latency' / 'failure_rate'
    comparator TEXT NOT NULL,                   -- 'gt' / 'lt' / 'gte' / 'lte'
    threshold_value NUMERIC NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning',    -- 'info' / 'warning' / 'critical'
    
    -- 实时 vs 定时
    trigger_mode TEXT DEFAULT 'both',            -- 'realtime' / 'scheduled' / 'both'
    trigger_events TEXT[],                      -- ['order_created', 'workflow_completed']
    
    -- action 策略（不达标时立即做什么）
    notify_channels TEXT[],                     -- ['realtime_ws', 'email', 'dingtalk']
    action_policy TEXT NOT NULL DEFAULT 'alert_only',  -- 'alert_only' / 'auto_fix' / 'hitl_required' / 'auto_workflow'
    action_config JSONB,                        -- 具体 action 配置
    cooldown_minutes INT DEFAULT60,             -- 重复告警冷却
    
    -- 元数据
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quality_thresholds ENABLE ROW LEVEL SECURITY;

-- 事件级检查结果（实时触发记录）
CREATE TABLE quality_check_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    threshold_id UUID REFERENCES quality_thresholds(id),
    event_type TEXT NOT NULL,                    -- 'order_created' / 'workflow_completed'
    event_id UUID,                              -- 触发此检查的事件 ID
    metric_name TEXT NOT NULL,
    actual_value NUMERIC NOT NULL,
    passed BOOLEAN NOT NULL,
    action_triggered BOOLEAN DEFAULT false,
    action_type TEXT,                           -- 'auto_fix' / 'hitl_required' / 'auto_workflow'
    action_status TEXT,                         -- 'pending' / 'executing' / 'completed' / 'failed'
    action_result JSONB,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_check_events ON quality_check_events (tenant_id, metric_name, checked_at DESC);
ALTER TABLE quality_check_events ENABLE ROW LEVEL SECURITY;
```

**M84 实时监控链路（关键场景）**：

```
业务事件（INSERT/UPDATE/DELETE）
  ↓
Postgres trigger（AFTER）
  ↓
pg_notify('quality_threshold_violated', payload)
  ↓
Edge Function（threshold-realtime-monitor）长连接监听
  ↓
1. 加载该事件相关的 thresholds（缓存）
2. 计算当前指标
3. 不达标 → 触发对应 action
   ├─ 'alert_only' → 发通知
   ├─ 'auto_fix' → 调 dsh preset 自动修复
   ├─ 'hitl_required' → HITL Hub 弹窗
   └─ 'auto_workflow' → 启动 Temporal workflow
4. 写入 quality_check_events（审计 + 趋势）
```

**action_policy 类型**：

| 类型 | 实现 | 例子 |
|---|---|---|
| `alert_only` | 仅通知 | Realtime + 邮件 + 钉钉 |
| `auto_fix` | 自动修复 | dsh preset 自动补全 / 重写 query / compression |
| `hitl_required` | HITL | 复杂决策让用户确认 |
| `auto_workflow` | 启动 Temporal workflow | 复杂修复流程 |

**M86 定时巡检（兜底）**：

```
pg_cron 每日 02:00
  ↓
启动 Temporal workflow: quality_inspection
  ↓
1. 加载所有 enabled thresholds
2. 逐项检查（即使已有实时事件触发过）
3. 写入 quality_check_events
4. 生成 inspection_report（LLM）
5. 通知相关人
```

**M86 兜底价值**：
- 实时 trigger 漏触发（pg_notify 队列满 / Edge Function 宕机）→ 定时补检查
- 趋势分析 → 看 7 天 / 30 天指标变化
- 整体质量报告 → 周报 / 月报

**与其他模块的关系**：

| 模块 | 复用关系 |
|---|---|
| M81-M82 表 | 复用 **M01 Supabase PG** + **RLS**（已有） |
| M83 policy 配置 | 复用 **M76 registry-mcp** 等 Registry 模式 |
| M84 实时监控 | 复用 **M05 Edge Functions** + **dsh preset**（auto_fix） |
| M85 action router | 复用 **M13 HITL Hub** + **M08 Temporal** |
| M87 历史 / 趋势 | 复用 **M10 OTel + Grafana** |

---

## 3. 模块依赖关系图

```
┌──────────────────────────────────────────────────────────────┐
│                     模块依赖图（M01-M50）                    │
│                                                               │
│  【P0 基础】 │
│  M01 Supabase PG ──┬─→ M02 Auth ──→ M05 Edge ──→ M07 Studio│
│                  │                  │                          │
│                  ├─→ M03 Realtime ─→ M06 PostgREST              │
│                  │                  │                          │
│                  ├─→ M04 Storage                             │
│                  │                                            │
│                  ├─→ M08 Temporal Cluster ──→ M17 Worker     │
│                  │                                            │
│                  └─→ M09 dsh K8s ──→ M10 可观测                │
│                          │                                    │
│                          ▼                                    │
│                  【P1 核心引擎】                                │
│  M11 Ontology Kernel ──→ M12 ActionType + HITL              │
│                  │                  │                          │
│                  └─→ M13 HITL Hub                              │
│                          │                                    │
│                  M14 dsh 集成层 ──→ M19 7 个 preset          │
│                          │                                    │
│                  M15 session Postgres backend                │
│                  M16 dsh Docker                              │
│                  M17 Temporal worker                          │
│                  M18 Ontology 生成 + 预览                      │
│                  M20 dsh sandbox                             │
│                  M21 数字员工状态机                            │
│                  M22 多级审批超时                            │
│                          │                                    │
│                          ▼                                    │
│                  【P1 业务能力】                                │
│  M40 Workflow 引擎 + M23-M39 17 域业务                       │
│          （按 ADR-0014 5 步接入：                              │
│           schema → RLS → CRUD → Action → Workflow）          │
│                          │                                    │
│                          ▼                                    │
│                  【P1 AI 能力】                                │
│  M43 Embedding Service ──→ M41 GraphRAG                     │
│                          │                                    │
│                  M42 RAGFlow                                 │
│                          │                                    │
│                  M44 Knowledge Curator preset                │
│                          │                                    │
│                  M45 RAG 路由                                │
│                          │                                    │
│                          ▼                                    │
│                  【P1 集成】                                  │
│  M46-M49 审批 SaaS 适配                                    │
│                          │                                    │
│                          ▼                                    │
│                  【P3 扩展生态】（可选）                      │
│  M50 数字员工 Marketplace                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. 4 阶段演进路线

### 阶段 1：基础设施（Q4-2026，10 周）

**目标**：搭好平台底座，能跑通 hello world

| 模块 | 关键交付 |
|---|---|
| M01-M07 | Supabase 自托管 K8s 部署 + 监控 |
| M08 | Temporal Cluster 部署 + Supabase PG 复用 |
| M09 | dsh Docker 镜像 + K8s Deployment |
| M10 | OTel + Grafana 全栈监控 |

**核心 Batch**：
- MP-V6-FOUNDATION-01（4 周）
- MP-V6-TEMPORAL-01（3 周）
- MP-V6-DSH-DOCKER-01 + MP-V6-DSH-K8S-01（4 周）
- MP-V6-OBSERVABILITY-01（2 周）

**退出标准**：
- ✅ Supabase 集群可访问
- ✅ Temporal UI 可访问
- ✅ dsh Web 在 K8s 上跑起来
- ✅ Grafana 有 dashboard
- ✅ 第一个 hello world dsh session 能跑通

### 阶段 2：核心引擎（Q1-2027，12 周）

**目标**：数字员工框架 + Ontology 引擎就绪，能定义业务本体

| 模块 | 关键交付 |
|---|---|
| M11 | 12 Ontology Kernel（Edge Functions + PG schema） |
| M12 | ActionType.apply + HITL 三模式 |
| M13 | HITL Hub（4 种 HITL） |
| M14 | dsh 60 包集成 + vendor 模式 |
| M15 | dsh session Postgres backend |
| M17 | Temporal worker (Node SDK) |
| M18 | Ontology 本体生成 + 预览 |
| M19 | 7 个数字员工 preset |
| M20 | dsh sandbox |
| M21 | 数字员工状态机 |
| M22 | 多级审批超时升级 |

**核心 Batch**：
- MP-V6-DSH-01（4 周）
- MP-V6-DSH-POSTGRES-BACKEND-01（3 周）
- MP-V6-AUTH-01（2 周）
- MP-V6-HITL-HUB-01（4 周）
- MP-V6-ONTOLOGY-GEN-01（4 周）

**退出标准**：
- ✅ 能在 dsh Web 跟 Ontology Explorer 对话
- ✅ 生成 Order 本体能预览
- ✅ HITL 确认后能落库
- ✅ 7 个数字员工 preset 都跑通

### 阶段 3：业务能力 + AI（Q1-Q2-2027，14 周）

**目标**：17 域业务可上线，AI 能力可用

| 模块 | 关键交付 |
|---|---|
| M23-M26（P1 4 域）| Customer / Order / Product / Contract |
| M27-M39（P2 13 域）| Supplier / Inventory / Finance / ... |
| M40 | Workflow Path C 引擎 |
| M41-M45 | GraphRAG + RAGFlow + Embedding + RAG 路由 |
| **M81-M87** | **阈值 + 实时触发（场景 21 + 22）** | 🟠 P1 |

**核心 Batch**：
- MP-V6-DOMAIN-MIGRATE-01（8 周，先做 4 个 P1 域）
- MP-V6-EDGE-FN-01（6 周，迁移 17 域到 Edge Functions）
- MP-V6-TEMPORAL-TS-01（3 周）
- MP-V6-RAG-01（4 周）
- **MP-V6-THRESHOLD-01（4 周，阈值 + 实时触发 + 兜底）**

**退出标准**：
- ✅ Customer / Order / Product / Contract 4 域可上线
- ✅ GraphRAG + RAGFlow 可用
- ✅ Knowledge Curator 数字员工能搜知识库
- ✅ Workflow Path C 引擎能跑流程

### 阶段 4：集成 + 扩展（Q2-Q3-2027，6 周）

**目标**：审批流跑通，Marketplace 可选

| 模块 | 关键交付 |
|---|---|
| M46-M49 | 钉钉 / 飞书 / 企微审批 SaaS 适配 |
| M50 | 数字员工 Marketplace（可选） |

**核心 Batch**：
- MP-V6-APPROVAL-01（6 周，3 家 SaaS 适配）
- MP-V6-MARKETPLACE-01（4 周，可选）

**退出标准**：
- ✅ 订单审批走钉钉能跑通
- ✅ 飞书 / 企微也能用
- ✅ （可选）第三方数字员工可上架

---

## 5. 模块优先级矩阵

| 阶段 | 时机 | 模块数 | 关键模块 |
|---|---|---|---|
| **P0 必选** | Q4-2026 | 10（M01-M10）| Supabase / Temporal / dsh / 可观测 |
| **P1 核心** | Q1-2027 | 12（M11-M22）| Ontology Kernel + HITL Hub + 7 个数字员工 |
| **P1 业务** | Q1-Q2-2027 | 18（M23-M40）| 17 域 + Workflow 引擎 |
| **P1 AI** | Q1-Q2-2027 | 5（M41-M45）| GraphRAG + RAGFlow |
| **P1 阈值** | Q1-Q2-2027 | 7（M81-M87）| 阈值配置 + 实时触发 + 兜底巡检 |
| **P1 集成** | Q2-2027 | 4（M46-M49）| 审批 SaaS |
| **P3 可选** | Q2-Q3-2027 | 1（M50）| 数字员工 Marketplace |

**总模块数**：87（M01-M50 + M81-M87）

---

## 6. 模块关键路径

```
M01-M10 基础设施（必须先做完）
  ↓
M11-M13 Ontology + HITL（核心引擎基础）
  ↓
M14-M22 dsh + 数字员工（agent 层）
  ↓
M23-M40 17 域 + Workflow（业务能力）
  ↓
M41-M45 RAG（增强）
  ↓
M81-M87 阈值 + 实时触发（业务事件 + action 联动）
  ↓
M46-M49 审批（集成）
  ↓
M50 Marketplace（可选扩展）
```

**关键路径上的模块**：
1. **M01-M10**（基础设施）：不完成无法开发其他
2. **M11**（Ontology Kernel）：不完成无业务可定义
3. **M13**（HITL Hub）：不完成无 HITL 能力
4. **M14 + M19**（dsh + preset）：不完成无数字员工
5. **M23-M26**（4 个核心业务域）：客户/订单/产品/合同是 MVP 必备

---

## 7. 模块工作量估算

| 阶段 | 模块数 | 周 | 团队 |
|---|---|---|---|
| 阶段1 基础设施 | 10 | 10 | SRE + AI 团队 |
| 阶段2 核心引擎 | 12 | 12 | AI 团队 + 后端 |
| 阶段3 业务能力 + AI + 阈值 | 30 | 18 | 后端 + AI 团队 |
| 阶段4 集成 + 扩展 | 5 | 6 | 后端 + SRE |
| **合计** | **87** | **50 周 ≈12 个月** | 4 团队协作 |

---

## 8. 团队分工

| 团队 | 负责模块 |
|---|---|
| **AI 团队** | M14-M22（dsh + 数字员工）+ M41-M45（RAG + Knowledge Curator）|
| **后端团队** | M11-M13（Ontology + HITL）+ M23-M40（17 域 + Workflow）+ M46-M49（审批集成）|
| **前端团队** | app-web / dsh-web / mate-studio / admin-web（4 个前端应用）|
| **SRE 团队** | M01-M10（基础设施）+ M50（Marketplace 可选）|

---

## 9. 模块依赖表

| 模块 | 依赖 |
|---|---|
| M11 Ontology Kernel | M01（PG）+ M05（Edge Functions）|
| M12 ActionType.apply | M11 + M13 + M17 |
| M13 HITL Hub | M01 + M08 + M09 |
| M14 dsh 集成 | M09 + M11 |
| M15 session Postgres | M01 + M09 |
| M17 Temporal worker | M08 + M05 |
| M18 Ontology 生成 | M11 + M13 + dsh llm provider |
| M19 7 个 preset | M14 + M11 + M13 |
| M21 数字员工状态机 | M15 + M13 |
| M22 多级审批超时 | M13 + M08 + M05 |
| M23-M39 17 域 | M11（ObjectType 接入）+ M05（Edge Functions）+ M40（Workflow）|
| M40 Workflow 引擎 | M08 + M17 + M11 |
| M41 GraphRAG | M43（Embedding）|
| M42 RAGFlow | M43 + M01 |
| M44 Knowledge Curator | M19 + M41 + M42 |
| M45 RAG 路由 | M41 + M42 + M44 |
| M46-M49 审批 SaaS | M13 + M08 + M17 |

---

## 10. 模块风险与缓解

| 风险 | 模块 | 缓解 |
|---|---|---|
| **Supabase 版本升级** | M01-M07 | Pin 版本 + 升级窗口测试 |
| **dsh preview 接口 breaking** | M09 / M14 | vendor 模式 + pin SHA |
| **Temporal 长任务资源** | M17 / M40 | history 走 PG + 自动分页 |
| **HITL 信号丢失** | M13 | 多通道兜底 + pg_cron 兜底 |
| **17 域 schema 复杂** | M23-M39 | 按 ADR-0014 5 步接入 + canonical reference |
| **GraphRAG LLM 成本** | M41 | dsh token-meter 监控 + 限额 |
| **第三方 SaaS 依赖** | M46-M49 | 三家适配互备 |

---

## 11. 模块命名规范

| 维度 | 规范 |
|---|---|
| 模块 ID | M + 两位数字（M01-M50）|
| 模块名 | 英文短名（如 ontology-kernel）|
| 命名空间 | K8s namespace = 类别（mp-runtime / mp-business）|
| 镜像 | `mp/<module>:v<major>.<minor>.<patch>-<git-sha>` |
| 文档 | 每个模块一份 README + 集成 checklist |

---

## 12. 一句话总结

> **v6.0 模块规划 = 87 个模块分 6 类（基础设施 10 / 核心引擎 12 / 业务能力 18 / AI 5 / 扩展生态 5 / 阈值与实时触发 7），按 4 阶段演进（基础设施 → 核心引擎 → 业务 + AI + 阈值 → 集成扩展），总工作量 50 周 ≈12 个月。核心增量：M81-M87 阈值 + 实时触发（trigger → pg_notify → Edge Function → action），让业务事件能立即驱动自动化响应。**

---

## 13. 评审签字

| 角色 | 姓名 | 签字 | 日期 |
|---|---|---|---|
| 架构师 | | | |
| AI Lead | | | |
| 后端 Lead | | | |
| 前端 Lead | | | |
| SRE Lead | | | |
| PM | | | |

---

*MetaPlatform v6.0 模块规划完毕。*  
*配套文档：技术架构 spec（讲技术）+ 应用架构 spec（讲应用组织）+ 模块规划（本 spec，讲模块演进）。*