# MetaPlatform v6.0 应用架构

> **版本**：v6.0（前端 UI 决策补充）  
> **日期**：2026-08-19  
> **状态**：**草案**（待评审）  
> **作者**：Claude (MiniMax-M3) + 用户协作  
> **配套文档**：[v6.0 技术架构 spec](./2026-08-19-mp-v6-architecture.md)  
> **本文档**：在 v6.0 技术架构基础上，定义**应用层架构**（具体应用模块 + 关系 + 部署 + 安全 + 可观测 + 生命周期）

**本次更新**：前端 UI 决策——3 个 MP 自研前端统一用 Semi Design 19（不建 MP Design System / 不二次封装 / 不 CSS tokens 桥接），dsh Web 保持 dsh 自带 UI。

---

## 0. 一句话定位

**MetaPlatform v6.0 应用架构 = 用户层（5 类用户）+ 接入层（Ingress / WAF）+ 应用层（前端 / 数字员工 / 业务 / AI / 编排）+ 数据层 + 基础设施层。技术架构讲「用什么技术」，应用架构讲「怎么组织应用服务」。**

---

## 1. 业务背景与目标

### 1.1 MP 业务定位

| 维度 | 定位 |
|---|---|
| **产品** | 企业级 AI 平台（基于 Ontology 本体引擎） |
| **核心能力** | 本体建模 + 数字员工 + 业务流程 + 企业 RAG + 协议集成 |
| **目标用户** | 业务部门（订单 / 客户 / 合同）+ 数字员工开发者 + SRE / 架构师 + PM |
| **核心场景** | 业务用户跟数字员工对话 → 生成 Ontology 本体 → HITL 确认 → 落库 → 业务流程驱动 |

### 1.2 应用架构目标

| 目标 | 衡量 |
|---|---|
| **统一接入** | 一个入口（dsh Web + app-*）支持所有场景 |
| **模块化** | 17 域业务可独立部署、独立伸缩 |
| **可观测** | 每个应用都有 trace / metric / log |
| **安全合规** | 多租户隔离 + RBAC + 审计 |
| **可演进** | 新增业务域 / 数字员工 / 第三方集成不破坏现有 |

---

## 2. 设计原则

### 2.1 单一应用 vs 拆分的判断标准

| 情况 | 决策 |
|---|---|
| 强内聚（17 域业务） | 模块化单体应用（一个进程，模块边界清晰） |
| 异构（数字员工 / RAG / 业务） | 多应用拆分（独立进程） |
| 重计算（GraphRAG） | 独立应用（独立伸缩） |
| 频繁变更（数字员工 preset） | 独立应用（独立发布） |
| 标准化（CRUD） | Supabase PostgREST（自动 REST） |

### 2.2 4 个设计原则

```
1. 单一职责：每个应用只做一件事，做到最好
2. 自治：每个应用独立部署 / 伸缩 / 监控 / 恢复
3. 协议清晰：应用间通过 OpenAPI / JSON-RPC / Temporal signal 通信
4. 演进优先：新需求用新应用实现，不破坏老应用
```

---

## 3. 应用分层架构（5 层）

```
┌──────────────────────────────────────────────────────────────────┐
│                          用户层                                    │
│   业务用户 │ 数字员工开发者 │ SRE / 架构师 │ PM │ 外部系统集成  │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ HTTPS / WebSocket
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                       接入层                                       │
│   Cloudflare / WAF / CDN                                          │
│   K8s Ingress + cert-manager                                      │
│   Kong API Gateway（限流 / 鉴权 / 监控）                          │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                       应用层                                       │
│   ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│   │ 前端应用       │  │ 数字员工应用    │  │ 业务应用      │  │
│   │ - app-web       │  │ - dsh-runtime   │  │ - edge-biz    │  │
│   │ - dsh-web       │  │ - dsh-scheduler │  │ - edge-ont    │  │
│   │ - mate-studio  │  │ - hitl-hub      │  │ - edge-flow   │  │
│   └─────────────────┘  └─────────────────┘  └────────────────┘  │
│   ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│   │ AI 应用         │  │ 编排应用       │  │ 集成应用      │  │
│   │ - graphrag      │  │ - temporal      │  │ - approval-saas │  │
│   │ - ragflow       │  │ - workflow      │  │ - webhook      │  │
│   └─────────────────┘  └─────────────────┘  └────────────────┘  │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                       数据层                                       │
│   Supabase Postgres（业务 + Ontology + dsh session + hitl）      │
│   Supabase Storage（对象） + Realtime（推送）                    │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                       基础设施层                                  │
│   K8s + Helm + ArgoCD                                              │
│   OTel + Tempo + Prometheus + Loki + Grafana                    │
│   Vault / ExternalSecret + NetworkPolicy                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. 应用模块清单（19 个核心应用）

### 4.1 前端应用（4 个）

> **UI 统一规范**：3 个 MP 完全自研前端统一用 **Semi Design 19**，**不建 MP Design System 包、不做二次封装、不做 CSS tokens 桥接**。dsh Web 用 dsh 自带 UI（保持原样，不破坏 dsh 生态）。

| 应用 | UI 库 | 角色 | 用户 |
|---|---|---|---|
| **app-web** | **Semi Design 19** + React + Vite | 业务前端 | 业务用户 |
| **dsh-web** | **dsh 自带 UI**（保留原样）| 数字员工开发台 + 对话界面 | 业务用户 / 开发者 |
| **mate-studio** | **Semi Design 19** + React + Vite | 管理后台（业务侧）| PM / 业务 Lead |
| **admin-web** | **Semi Design 19** + React + Vite | MP 内部管理（租户 / 用户 / 计费）| SRE / 架构师 |

**约束**：
- 3 个 MP 自研前端直接用 Semi Design 官方组件，**不二次封装**、**不建自定义 design system**
- 跟随 Semi Design 升级（19 → 后续版本）
- 业务色按需配置（用 Semi ConfigProvider）

### 4.2 数字员工应用（3 个）

| 应用 | 技术 | 角色 |
|---|---|---|
| **dsh-runtime** | dsh K8s Deployment（Node.js） | 数字员工 agent loop 长驻进程 |
| **dsh-scheduler** | dsh K8s Job + dsh headless | 短时数字员工作业（headless 模式） |
| **hitl-hub** | dsh service + Supabase PG | 4 种 HITL 类型联动中枢 |

### 4.3 业务应用（5 个）

| 应用 | 技术 | 角色 |
|---|---|---|
| **edge-biz** | Supabase Edge Functions (Deno) | 17 域标准业务逻辑（替代 FastAPI） |
| **edge-ontology** | Supabase Edge Functions | 12 Ontology Kernel 增删改查 |
| **edge-workflow** | Supabase Edge Functions | Workflow Path C 引擎 |
| **edge-action** | Supabase Edge Functions | ActionType.apply 实现 + HITL 三模式 |
| **edge-admin** | Supabase Edge Functions | 管理类操作（用户 / 租户 / 配置） |

### 4.4 AI 应用（3 个）

| 应用 | 技术 | 角色 |
|---|---|---|
| **graphrag** | Python（ms-graphrag） | KG 实体/关系抽取 + Leiden 社区 |
| **ragflow** | Python（第三方） | 文档解析 + chunk + BM25 + 向量 |
| **embedding-svc** | Python | embedding 模型封装 |

### 4.5 编排应用（2 个）

| 应用 | 技术 | 角色 |
|---|---|---|
| **temporal-server** | Temporal（官方镜像） | workflow orchestrator |
| **temporal-worker** | Node.js + Temporal SDK | 执行 Activity（DB / Edge / SaaS 调用）|

### 4.6 集成应用（2 个）

| 应用 | 技术 | 角色 |
|---|---|---|
| **approval-saas** | Edge Functions | 第三方审批 SaaS 适配（钉钉/飞书/企微） |
| **webhook-router** | Edge Functions | 接收外部 webhook + 路由到 HITL Hub |

---

## 5. 应用关系图

```
┌──────────────────────────────────────────────────────────────────┐
│                       应用关系图                                  │
│                                                                   │
│                          ┌─────────────────┐                     │
│                          │  app-web       │                     │
│                          │  (业务前端)     │                     │
│                          └────────┬────────┘                     │
│                                   │ PostgREST + Edge            │
│                                   ▼                             │
│                          ┌─────────────────┐                     │
│                          │  edge-biz      │                     │
│                          │  (17 域)       │                     │
│                          └────────┬────────┘                     │
│                                   │                             │
│       ┌───────────────┬───────────┼───────────┬───────────────┐   │
│       ▼               ▼           ▼           ▼               ▼   │
│  ┌─────────┐ ┌─────────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │edge-   │ │edge-workflow│ │edge-    │ │hitl-hub │ │approval- │ │
│  │ontology│ │ (Path C)   │ │action   │ │(4 种HITL)│ │saas      │ │
│  └────┬────┘ └──────┬──────┘ └────┬────┘ └─────┬────┘ └────┬─────┘ │
│       │             │             │            │           │       │
│       └─────────────┴─────────────┼────────────┴───────────┘       │
│                                     │ Temporal signal                 │
│                                     ▼                                  │
│                          ┌─────────────────┐                     │
│                          │temporal-worker  │                     │
│                          │(Node SDK)       │                     │
│                          └────────┬────────┘                     │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                     │
│                          │ Supabase PG    │                     │
│                          │ (ontology_*)   │                     │
│                          └─────────────────┘                     │
│                                                                   │
│  ┌─────────────────┐        ┌─────────────────┐                │
│  │  dsh-web       │ <────> │  dsh-runtime   │                │
│  │  (数字员工UI) │  WS   │  (agent loop)  │                │
│  └─────────────────┘        └────────┬────────┘                │
│                                       │ tool call                  │
│                                       ▼                            │
│                              ┌─────────────────┐                │
│                              │edge-biz /       │                │
│                              │graphrag /       │                │
│                              │ragflow /        │                │
│                              │temporal-worker  │                │
│                              └─────────────────┘                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. 应用间接口（4 类）

| 接口类型 | 协议 | 用途 | 示例 |
|---|---|---|---|
| **同步 API** | HTTP / PostgREST / JSON-RPC | 短时调用（< 5 秒） | dsh → edge-biz 查询订单 |
| **异步事件** | Postgres trigger + Database Webhook + Realtime WS | 状态变更、通知 | 订单状态变 → Realtime 推送 |
| **长任务** | Temporal workflow | 1+ 分钟任务（含 HITL） | ActionType.apply → Temporal workflow |
| **HITL 信号** | Temporal signal + HITL Hub | 人在回路 | 钉钉 webhook → Temporal signal |

### 6.1 接口契约规范

| 维度 | 规范 |
|---|---|
| API 契约 | **OpenAPI 3.1**（PostgREST 自动 + Edge Functions 手写 + Temporal 信号约定） |
| 鉴权 | Supabase Auth JWT（所有调用） |
| 多租户 | JWT 含 `tenant_id`，RLS 自动隔离 |
| 错误码 | HTTP 标准 + 自定义业务错误码（4xx） |
| 超时 | 同步 ≤ 5 秒；异步 / 长任务 ≥ 5 秒 |
| 重试 | 同步不重试（客户端决定）；异步 Temporal 自动重试 |
| 幂等 | 写操作必须幂等（带 `idempotency_key`） |

### 6.2 应用调用链示例

**示例1：用户查看订单列表**

```
浏览器 → app-web → PostgREST GET /orders → Supabase PG（RLS 自动按 tenant 过滤）
响应时间：< 200ms
```

**示例2：数字员工创建订单**

```
dsh-runtime（agent loop）
  ↓ tool: create_order
  ↓ HTTP POST /functions/v1/create-order
edge-biz (Edge Function)
  ↓ INSERT INTO orders
Supabase PG
  ↓ trigger: notify_order_created
  ↓ Database Webhook → workflow-router
temporal-worker
  ↓ 启动 OrderApprovalWorkflow
  ↓ Activity: db_read / db_write / approval_request
approval-saas（Edge Function）
  ↓ 调钉钉 API
钉钉（用户审批）
  ↓ webhook → webhook-router
  ↓ HITL Hub 更新 + Temporal signal
workflow 完成
  ↓ Realtime WS → 浏览器
```

---

## 7. 应用部署拓扑

### 7.1 K8s namespace 划分

| Namespace | 用途 | 应用 |
|---|---|---|
| `mp-frontend` | 前端应用 | app-web, dsh-web, mate-studio, admin-web |
| `mp-runtime` | 数字员工运行 | dsh-runtime, dsh-scheduler |
| `mp-business` | 业务 Edge Functions | edge-biz, edge-ontology, edge-workflow, edge-action, edge-admin |
| `mp-ai` | AI 服务 | graphrag, ragflow, embedding-svc |
| `mp-orchestration` | 编排 | temporal-server, temporal-worker |
| `mp-integration` | 集成 | approval-saas, webhook-router, hitl-hub |
| `mp-data` | 数据服务 | (Supabase 全套) |
| `mp-monitoring` | 可观测 | otel-collector, grafana, tempo, prometheus, loki |
| `mp-infra` | 基础设施 | vault, cert-manager, argocd |

### 7.2 应用 Deployment 模板

```yaml
# 示例：edge-biz Edge Function Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: edge-biz
  namespace: mp-business
spec:
  replicas: 3
  selector: { matchLabels: { app: edge-biz } }
  template:
    spec:
      containers:
      - name: edge-biz
        image: mp/edge-biz:v6.0.0
        ports: [{ containerPort: 8080 }]
        env:
        - name: SUPABASE_URL
          value: http://supabase-postgres.mp-data.svc:5432
        - name: TEMPORAL_ADDRESS
          value: temporal.mp-orchestration.svc:7233
        resources:
          requests: { memory: "256Mi", cpu: "250m" }
          limits: { memory: "1Gi", cpu: "1000m" }
        livenessProbe:
          httpGet: { path: /health, port: 8080 }
        readinessProbe:
          httpGet: { path: /ready, port: 8080 }
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: edge-biz-hpa, namespace: mp-business }
spec:
  scaleTargetRef: { kind: Deployment, name: edge-biz }
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
```

### 7.3 应用分级与 SLA

| 级别 | 应用 | SLA | 多副本 |
|---|---|---|---|
| **L1 核心** | edge-biz, edge-action, dsh-runtime, temporal-worker | 99.95% | ≥3 |
| **L2 重要** | edge-ontology, edge-workflow, graphrag, ragflow | 99.9% | ≥2 |
| **L3 标准** | admin-web, mate-studio, embedding-svc | 99.5% | ≥1 |
| **L4 辅助** | webhook-router, approval-saas | 99.0% | ≥1 |

---

## 8. 应用安全模型

### 8.1 6 层安全防护

| 层 | 内容 | 实现 |
|---|---|---|
| **1. 边缘层** | WAF / DDoS 防护 | Cloudflare / AWS WAF |
| **2. 接入层** | TLS / cert-manager | Let's Encrypt |
| **3. 鉴权层** | JWT / OAuth2 / SAML | Supabase Auth |
| **4. 授权层** | RLS / RBAC | Supabase PG RLS + dsh role |
| **5. 应用层** | Input validation / Rate limit | Kong + Edge Functions |
| **6. 数据层** | 加密 / 备份 | Supabase 加密 + WAL 归档 |

### 8.2 网络隔离（K8s NetworkPolicy）

```yaml
# 默认拒绝所有 namespace 流量
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny-all, namespace: mp-platform }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
# 允许业务前端 → Edge Functions
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: frontend-to-edge, namespace: mp-business }
spec:
  podSelector: { matchLabels: { app: edge-biz } }
  ingress:
  - from:
    - namespaceSelector: { matchLabels: { name: mp-frontend } }
    ports: [{ port: 8080 }]
---
# 允许 Edge Functions → Supabase PG
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: edge-to-pg, namespace: mp-business }
spec:
  podSelector: { matchLabels: { app: edge-biz } }
  egress:
  - to:
    - namespaceSelector: { matchLabels: { name: mp-data } }
    ports: [{ port: 5432 }]
```

### 8.3 Secret 管理

| Secret 类型 | 存储 | 注入方式 |
|---|---|---|
| LLM API Key | Vault / ExternalSecret | K8s Secret → env |
| 数据库密码 | Vault / ExternalSecret | K8s Secret → env |
| OAuth2 Client Secret | Vault / ExternalSecret | K8s Secret → env |
| Temporal Namespace Key | Vault | K8s Secret → env |
| 应用配置 | ConfigMap | K8s ConfigMap → env |

**关键**：**所有 Secret 不进 git**。

---

## 9. 应用可观测性

### 9.1 4 类用户看到的应用视图

| 角色 | 看的应用 | 工具 |
|---|---|---|
| **业务用户** | 自己与数字员工的对话、HITL 弹窗 | dsh Web |
| **数字员工开发者** | 数字员工 preset 状态 + session log | dsh Web + Supabase Studio |
| **SRE** | 所有应用健康 / 链路 / 指标 | Grafana + Temporal UI + Supabase Studio |
| **架构师 / PM** | 业务指标 + 工作流时长 + HITL 通过率 | Grafana Dashboard |

### 9.2 关键 Dashboard

| Dashboard | 包含指标 |
|---|---|
| **应用健康** | 各应用 QPS / 错误率 / 延迟 / 副本数 |
| **数字员工** | 活跃会话数 / LLM token 用量 / 长任务数 |
| **HITL** | pending HITL 数 / 平均审批时长 / SaaS 失败率 |
| **Temporal Workflow** | workflow throughput / Activity 失败率 / 长任务数 |
| **RAG** | 检索延迟 / KG 节点数 / 命中率 |
| **基础设施** | CPU / 内存 / 网络 / 磁盘 |

### 9.3 应用健康检查标准

| 指标 | 健康 | 警告 | 严重 |
|---|---|---|---|
| 错误率 | < 0.1% | 0.1-1% | > 1% |
| P99 延迟 | < 1s | 1-3s | > 3s |
| CPU 利用率 | < 60% | 60-80% | > 80% |
| 内存利用率 | < 70% | 70-90% | > 90% |
| 副本数 | ≥ minReplicas | - | < minReplicas |

---

## 10. 应用生命周期管理

### 10.1 应用生命周期阶段

```
开发 → 测试 → 预发 → 生产 → 退役
```

### 10.2 应用上线流程

```
1. 代码提交（CI 检查通过）
2. 自动构建镜像（GH Actions + Harbor）
3. 自动部署到 dev 环境（ArgoCD）
4. dev 环境集成测试（vitest + pytest + 集成 e2e）
5. 部署到 staging 环境（SRE 审核）
6. 灰度到生产（5% → 25% → 50% → 100%）
7. 全量生产
8. 监控告警 + 流量切换
```

### 10.3 应用退役流程

```
1. 标记 deprecated（标注 6 个月后下线）
2. 停止新功能开发
3. 迁移存量用户到替代应用
4. 灰度下线（关闭流量入口）
5. 删除 K8s Deployment + Service
6. 清理 PG 表 / 索引 / 文件
7. 删除代码仓库
```

### 10.4 版本管理

| 维度 | 规范 |
|---|---|
| 镜像标签 | `mp/<app>:v<major>.<minor>.<patch>-<git-sha>` |
| API 版本 | OpenAPI 3.1 + `/v1/` `/v2/` 路径前缀 |
| 数据 schema | Supabase migrations（SQL 文件） |
| 文档版本 | 与代码版本同步更新 |

---

## 11. 应用演进路线

### 11.1 v6.0 → v6.1 → v7.0 演进

| 阶段 | 时机 | 新增应用 |
|---|---|---|
| **v6.0**（2026 Q4 - 2027 Q2） | 当前 | 19 个核心应用 |
| **v6.1**（2027 Q2-Q3） | dsh 数字员工 + Marketplace 上线 | 新增 dsh-marketplace 应用（数字员工插件市场） |
| **v6.2**（2027 Q3-Q4） | 跨租户联邦 / 实时协作 | 新增 realtime-collab（多用户协同编辑 Ontology） |
| **v7.0**（2028） | 多 Region + AI 自治 | 新增 region-router / ai-ops |

### 11.2 应用拆分 vs 合并决策标准

| 情况 | 拆分 | 合并 |
|---|---|---|
| 不同团队维护 | ✅ | |
| 不同伸缩需求 | ✅ | |
| 不同故障隔离要求 | ✅ | |
| 强业务内聚 | | ✅ |
| 同步调用频繁（> 100 QPS）| | ✅ |
| 共享同一进程模型 | | ✅ |

---

## 12. 关键决策点

| 决策 | 选项 | 建议 |
|---|---|---|
| **应用间通信** | 同步（HTTP）/ 异步（队列） | **同步为主**，异步只在 HITL / 长任务 |
| **应用部署模式** | K8s / Lambda / FaaS | **K8s**（多语言 + 容器化） |
| **API 契约** | OpenAPI / Protobuf / gRPC | **OpenAPI 3.1**（人类可读 + 工具丰富）|
| **跨语言 RPC** | gRPC / JSON-RPC / Thrift | **JSON-RPC over HTTP**（简单）|
| **应用监控** | OTel / Datadog / New Relic | **OTel + Grafana**（开源 + 灵活） |

---

## 13. 一句话总结

> **v6.0 应用架构 = 19 个核心应用分 6 类（前端 4 / 数字员工 3 / 业务 5 / AI 3 / 编排 2 / 集成 2），按 K8s namespace 分层隔离，4 类接口（同步 API / 异步事件 / 长任务 / HITL），6 层安全防护，OTel + Grafana 统一可观测，应用上线分 dev / staging / prod 三阶段。**

---

## 14. 配套文档

- [v6.0 技术架构 spec](./2026-08-19-mp-v6-architecture.md) - 技术栈 + 关键技术决策
- v6.0 数据架构 spec - （待补充）数据模型 + 迁移
- v6.0 部署架构 spec - （待补充）K8s + ArgoCD + Helm
- v6.0 安全架构 spec - （待补充）安全模型 + 合规

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

*MetaPlatform v6.0 应用架构完毕。*  
*本文档与 v6.0 技术架构 spec 配套使用，前者讲应用组织，后者讲技术选型。*