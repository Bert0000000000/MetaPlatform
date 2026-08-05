# Mate Platform 功能未实现清单(按业务能力维度)

> 版本:v1.0 · 2026-07-30
> 数据源:`mate-platform-backend/contracts/openapi/generated/bundled.yaml` + `packages/*/src/` 代码扫描 + PRD 与 ADR
> 关联:
> - `docs/active/specs/2026-07-30-business-slices-rollout-status.md` v1.2(17 域接入进度)
> - `docs/active/specs/2026-07-30-backend-impl-backlog.md` v1.0(接口维度开发清单)
> - `docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0(5 步模式)
> - `docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md` v3.0(架构基线)

---

## 1. 范围与读法

按"业务能力(用户能做什么)"维度盘点,**不是接口清单**。每个功能标注:

- 🟢 **已实现**:有 handler、有业务逻辑、有测试
- 🟡 **部分实现**:代码骨架在,但关键能力缺失或路径别名未对齐
- 🔴 **未实现**:完全没建包,或仅有 OpenAPI 占位
- 🟠 **已落地但生产禁用**:deprecated / legacy 路径

**8 / 17 域已 5 步模式接入**(kb / msg / obs / agent / llmgw / rag / mcp / ont);**8 域 P2 待建包代码**。

---

## 2. 平台核心能力(架构基线要求)

| # | 功能 | 状态 | 证据 / 阻塞 |
|---|---|---|---|
| F-01 | **Keycloak OIDC 单点登录 + JWT 颁发** | 🟢 已实现 | `infra/keycloak/realm-mate.json` + `SEC-IAM-01` 已 Accepted |
| F-02 | **JWT 验证 + 租户绑定** | 🟢 已实现 | `mate-platform/auth/` 7 模块 + 29 tests pass |
| F-03 | **5 层租户隔离**(HTTP/DB/Kafka/Redis/MinIO) | 🟢 已实现 | `mate-platform/tenancy/` 4 模块 + 54 tests(含 12 跨租户 negative) |
| F-04 | **跨租户 admin 通道** | 🟢 已实现 | `cross_tenant_admin` 角色 + audit.log 落地 |
| F-05 | **事件管道**(Outbox + 幂等消费者 + DLQ) | 🟢 已实现 | `PLATFORM-EVENT-01` Accepted(ADR-0013),Bitnami Kafka sub-chart |
| F-06 | **K8s 运行时**(Helm umbrella + ArgoCD) | 🟢 已实现 | `infra/helm/` 4 sub-charts + `infra/argocd/`(PLATFORM-K8S-01) |
| F-07 | **OTel 分布式追踪 + tenant.id 注入** | 🟢 已实现 | `infra/helm/charts/otel-collector` + 17 OTel tests |
| F-08 | **NetworkPolicy 默认 deny + 显式 allow** | 🟢 已实现 | `infra/helm/charts/network-policies/` + 19 tests |
| F-09 | **Secret 走 SealedSecret / ExternalSecret** | 🟢 已实现 | `infra/helm/charts/keycloak/values.yaml` 全部 externalSecretName |
| F-10 | **13 硬规则 pre-commit + CI 三层闭环** | 🟢 已实现 | GA-ACCEPTANCE 收口,251 tests pass |

---

## 3. 17 域业务能力盘点

### 3.1 mate-app-kb(知识库业务聚合) — 🟢 已实现

| 功能 | 状态 | 说明 |
|---|---|---|
| KB 对话(单轮) | 🟢 | `POST /api/v1/kb/chat`(代码挂在 `app-kb` 别名,需路径对齐) |
| KB 流式对话 | 🟢 | `POST /api/v1/kb/chat/stream` |
| 文档检索 | 🟢 | `POST /api/v1/kb/search` |
| KB 统计 | 🟢 | `GET /api/v1/kb/stats` |
| 文档上传 | 🟢 | `POST /api/v1/kb/upload` |
| 5 步模式完整接入 | 🟢 | canonical reference,12 tests pass |
| BearerAuth + OutgoingAuthMiddleware | 🟢 | `mate-app-kb/src/mate_app_kb/clients.py` |
| 路径别名 | 🟡 | 代码挂 `/api/v1/app-kb/*`,spec 写 `/api/v1/kb/*`,需在 main.py 修 prefix |

### 3.2 mate-tech-rag(RAG 检索) — 🟢 已实现

| 功能 | 状态 | 说明 |
|---|---|---|
| 文档上传 + 解析 | 🟢 | `POST /api/v1/rag/upload` + `POST /api/v1/rag/parse` |
| 文档入库(ingest) | 🟢 | `POST /api/v1/rag/ingest` |
| 检索 | 🟢 | `POST /api/v1/rag/search` |
| 系统状态 | 🟢 | `GET /api/v1/rag/status` / `GET /api/v1/rag/stats` |
| PG 存储统计 | 🟢 | `GET /api/v1/rag/admin/pg-stats` |
| 多后端适配(RAGFlow / LightRAG / GraphRAG / Milvus / PG hybrid) | 🟢 | `clients/` 9 个 client + `strategies/base.py` |
| Embedder | 🟢 | `mate_tech_rag/embedder.py` |
| 向量存储 | 🟢 | `mate_tech_rag/vector_store.py`(Milvus + PG) |
| 5 步模式完整接入 | 🟢 | BUSINESS-SLICES P1 wave 3,7 tests pass |

### 3.3 mate-tech-llmgw(LLM 网关) — 🟡 部分实现

| 功能 | 状态 | 说明 |
|---|---|---|
| LLM 单轮 chat | 🟢 | `POST /api/v1/llmgw/chat`(代码挂在 legacy `/api/v1/llm/`,需重挂到 `llmgw`) |
| LLM 流式 chat | 🟢 | `POST /api/v1/llmgw/chat/stream` |
| Embeddings | 🟢 | `POST /api/v1/llmgw/embeddings` |
| 多 provider 适配(OpenAI / Anthropic / 豆包 / 通义千问) | 🟢 | `providers/` 4 个 provider |
| LLM 缓存 | 🟢 | `cache/llm_cache.py` |
| 用量计量 + 成本记录 | 🟢 | `cost/recorder.py` |
| 配额桶 + 守卫 | 🟢 | `quota/{bucket,guard}.py` |
| PII 掩码 | 🟢 | `security/pii_mask.py` |
| 重试 + fallback 链 | 🟢 | `retry/fallback.py` |
| SSE 流式 | 🟢 | `stream/sse.py` |
| Tool registry(函数调用) | 🟢 | `tools/registry.py` |
| 路径迁移 `llm → llmgw` | 🟡 | API-GOV-01 ACCEPTANCE §6 已标 breaking change |
| 多模态(Multimodal chat / 图像 / 语音) | 🔴 **未做** | spec 没要求,但 PRD 提到 |
| Function call 完整实现 | 🟡 | 有 registry 但需与 agent 编排集成 |

### 3.4 mate-tech-agent(AI Agent 编排) — 🟢 已实现

| 功能 | 状态 | 说明 |
|---|---|---|
| Agent 对话 | 🟢 | `POST /api/v1/agent/chat` |
| Agent 流式对话 | 🟢 | `POST /api/v1/agent/chat/stream` |
| Agent 状态查询 | 🟢 | `GET /api/v1/agent/state/{id}` |
| Agent 状态删除 | 🟢 | `DELETE /api/v1/agent/state/{id}` |
| Agent review | 🟢 | `POST /api/v1/agent/review` |
| LangGraph 编排 | 🟢 | `graph.py` + `state.py` + `memory.py` |
| Tool 集成(RAG / Flowable) | 🟢 | `tools/{rag_tool,flowable_tool}.py` |
| 短期记忆 / 长期记忆 | 🟢 | `memory/{_json_store,pg_saver}.py` |
| 4 场景(s1-s4)编排 | 🟢 | `scenarios/s1_s4.py` |
| Guardrails(内容护栏) | 🟢 | `security/guard.py` + `scenarios/guardrails.py` |
| Eval(QA 集) | 🟢 | `eval/qa_set.py` |
| 5 步模式完整接入 | 🟢 | BUSINESS-SLICES P1 wave 2,7 tests pass |

### 3.5 mate-tech-ont(本体引擎) — 🟢 已实现

| 功能 | 状态 | 说明 |
|---|---|---|
| 本体创建 | 🟢 | `POST /api/v1/ont/ontologies` |
| 本体查询 | 🟢 | `GET /api/v1/ont/ontologies/{id}` |
| Class 创建 | 🟢 | `POST /api/v1/ont/classes` |
| Class 查询 | 🟢 | `GET /api/v1/ont/classes/{id}` |
| Instance CRUD | 🟢 | `POST/GET/DELETE /api/v1/ont/instances{,/{iid}}` |
| Instance 关系 CRUD | 🟢 | `POST/GET /api/v1/ont/instances/relations` |
| SPARQL 查询 | 🟢 | `POST /api/v1/ont/sparql` |
| SPARQL Explain | 🟢 | `POST /api/v1/ont/explain` |
| Neo4j 图存储 | 🟢 | `repos/neo4j_repo.py` |
| OWL IO(导入导出) | 🟢 | `owl/io.py` |
| 版本控制 | 🟢 | `versioning/store.py` |
| 全文检索 | 🟢 | `search/fulltext.py` |
| 租户隔离 | 🟢 | `security/tenant.py` |
| Dual-write(Neo4j + PG) | 🟢 | `dual_write/writer.py` |
| 5 步模式完整接入 | 🟢 | BUSINESS-SLICES P2 wave 1,7 tests pass |
| 实例级审计 / 变更追踪 | 🟡 | versioning 部分覆盖,实例粒度审计需补 |
| 跨实例规则推理(SHACL / OWL Reasoner) | 🔴 **未做** | spec 未声明,但 PRD 设计需求 |
| 联邦查询 / 跨本体合并 | 🔴 **未做** | spec 未声明 |

### 3.6 mate-tech-msg(消息中心) — 🟢 已实现

| 功能 | 状态 | 说明 |
|---|---|---|
| 消息发布 | 🟢 | `POST /api/v1/msg/publish` |
| Topic 列表 | 🟢 | `GET /api/v1/msg/topics` |
| Kafka 集成 | 🟢 | `PLATFORM-EVENT-01` 落地,producer / consumer |
| 租户命名空间 | 🟢 | `mate-platform/messaging/kafka_tenant.py` |
| 5 步模式完整接入 | 🟢 | BUSINESS-SLICES P1 wave 1,7 tests pass |
| 消息订阅 / Webhook / 推送通道 | 🔴 **未做** | spec 只有 publish + topics,没订阅 API |
| 消息持久化查询 | 🔴 **未做** | spec 没提供历史消息查询 endpoint |

### 3.7 mate-tech-obs(可观测聚合) — 🟢 已实现

| 功能 | 状态 | 说明 |
|---|---|---|
| Health 探针 | 🟢 | `GET /api/v1/obs/health` |
| 自监控指标 | 🟢 | `GET /api/v1/obs/instrument` |
| Prometheus 拉取 | 🟢 | `infra/prometheus/prometheus.yml` |
| OTel collector | 🟢 | `infra/helm/charts/otel-collector/` |
| Loki 日志聚合 | 🟢 | `infra/loki/` + `promtail` |
| Grafana 仪表盘 | 🟢 | `infra/grafana/provisioning/` |
| 5 步模式完整接入 | 🟢 | BUSINESS-SLICES P1 wave 1,7 tests pass |
| Alertmanager 告警规则管理(写) | 🔴 **未做** | `admin/operations/alerts/rules` 在 spec,但当前只读 GET |
| 自定义仪表盘配置(写) | 🔴 **未做** | spec 有相关 GET,无 PUT/POST |

### 3.8 mate-tech-mcp(MCP 协议层) — 🟡 部分实现

| 功能 | 状态 | 说明 |
|---|---|---|
| MCP Tool 注册 | 🟢 | `tools/{kb_search,rate_limit}.py` + `registry.py` |
| MCP Resource(本体查询) | 🟢 | `resources/ontology.py` |
| MCP Prompt 模板 | 🟢 | `prompts/templates.py` |
| MCP Server transport | 🟢 | `transports/server.py` + `server.py` |
| MCP 认证 | 🟢 | `auth.py` |
| 5 步模式完整接入 | 🟢 | BUSINESS-SLICES P1 wave 3,7 tests pass |
| **FastAPI HTTP 路由挂载**(spec 5 endpoint) | 🔴 **未做** | `GET /api/v1/mcp/{prompts,resources,tools}` + `POST .../{name}` 路由未挂到 main.py |
| KB search tool(挂 mate-app-kb) | 🟢 | 已接 mate-app-kb client |
| 限流(rate limit) | 🟢 | `tools/rate_limit.py` |
| 多 MCP server 联邦 / 外部 MCP 客户端 | 🔴 **未做** | copilot / a2a 域 spec 提到 |

### 3.9 mate-tech-iam(身份管理) — 🟠 Deprecated

| 功能 | 状态 | 说明 |
|---|---|---|
| 本地身份源 + HS256 JWT | 🟠 Deprecated | SEC-IAM-01 收口,生产 profile 拒绝加载 |
| Keycloak JWT 验证 | 🟢(已迁) | `mate-platform/auth/` |
| 5 域 endpoint(login / logout / me / refresh / sso-providers) | 🟠 实现存在但 deprecated | `/api/v1/iam/auth/*` |
| 31 个 admin endpoint(users / permissions / orgs / logs / configs) | 🟢 仍在 | `/api/v1/admin/*`(在 `mate-tech-iam/api/{users,permissions,orgs,logs,configs}.py`) |
| 29 个 dashboard endpoint | 🟢 仍在 | `/api/v1/dashboard/*`(在 `mate-tech-iam/api/dashboard.py`) |

---

## 4. 8 域 P2 — 🔴 完全未实现

### 4.1 apphub(应用中心) — 🔴 无包代码

| 功能 | 状态 | 说明 |
|---|---|---|
| 应用列表 / 分类 / 模块 / 页面 / 模板 5 个只读 endpoint | 🔴 | OpenAPI 已签,无 `packages/mate-app-hub/` |
| 5 步模式 | 🔴 | 需新建包 |

### 4.2 arch(架构中心) — 🔴 无包代码

| 功能 | 状态 | 说明 |
|---|---|---|
| 应用 / 业务流程 / 能力地图 / 数据资产 / 部署 / 治理 / 价值流 等 29 个只读 endpoint | 🔴 | OpenAPI 已签,无 `packages/mate-app-arch/` |
| 数据资产目录 / 能力树 / 技术雷达 / 影响分析 | 🔴 | |
| 治理:原则 / 评审模板 / 评审工单 / 技术债 | 🔴 | |
| 5 步模式 | 🔴 | 需新建包 |

### 4.3 copilot(超级 AI 对话) — 🔴 无包代码

| 功能 | 状态 | 说明 |
|---|---|---|
| 35 个 endpoint 全维度业务能力 | 🔴 | OpenAPI 已签,无 `packages/mate-app-copilot/` |
| **A2A 协议代理**:委托 / 外部 agent-cards | 🔴 | `a2a/delegate` `a2a/external` |
| **SQL Copilot**:审计 / 执行 / 解释 / 生成 SQL | 🔴 | `analysis/{audit-sql,execute-sql,explain-sql,generate-sql}` |
| **多模态 chat**:图像上传理解 | 🔴 | `chat/multimodal/upload` |
| **代码 Copilot**:代码生成 / 解释 / review | 🔴 | `code` `generate/explain-code` `generate/review-code` |
| **生成器**:仪表盘 / 表单 / 流程 | 🔴 | `generate/{dashboard,form,process}` |
| **本体图查询**:概念搜索 / 图展开 / 图查询 | 🔴 | `ontology/concepts/search` `ontology/graph/{expand,query}` |
| **自然语言查询**(NLQ):执行 + 历史 | 🔴 | `queries/{execute,history}` |
| **任务调度**:员工匹配 / 计划生成 / 意图识别 | 🔴 | `scheduling/*` |
| **Action 平台**:动作匹配 / 执行 | 🔴 | `actions/{execute,match}` |
| **对话管理**:会话 / 历史 / 知识库 | 🔴 | `conversations` `knowledge-bases` `datasources` `models/multimodal` |
| **全局搜索** | 🔴 | `search` |
| **登录认证** | 🔴 | `auth/login` |
| 5 步模式 | 🔴 | 需新建包 |

### 4.4 dashboard(仪表盘工作台) — 🟡 部分实现

| 功能 | 状态 | 说明 |
|---|---|---|
| 登录 / 个人资料 / 权限聚合 / 会话 / 设置 | 🟢 | `mate-tech-iam/api/dashboard.py` 实现 |
| API Key 管理 / 通知 / 待办 / 工人列表 | 🟢 | 已实现 |
| 指标卡片 + 趋势 | 🟢 | 已实现 |
| 异常事件 / 异常规则 | 🟢 | 已实现 |
| 交付物管理 / 全局搜索 | 🟢 | 已实现 |
| **9 个 PUT/PATCH 改写 endpoint** | 🔴 | profile PUT / api-keys 改写 / 通知偏好 PUT 等 |
| **架构中心 29 个 + 应用中心 5 个的入口集成** | 🔴 | spec 把 arch / apphub 拆分,dashboard 应作为统一入口 |
| 5 步模式 | 🟢 | 已 5 步接入,但挂在 mate-tech-iam 包 |

### 4.5 dw(数字员工聚合) — 🔴 无包代码

| 功能 | 状态 | 说明 |
|---|---|---|
| 协作 / commit / 文档 / 员工 / 任务 / 评估 / extract / 知识库 / learning / 模型 / 工具 / trace 15 个 GET | 🔴 | OpenAPI 已签,无 `packages/mate-tech-dw/` |
| 数字员工评测 / 反馈 / 提取 | 🔴 | |
| 5 步模式 | 🔴 | 需新建包 |

### 4.6 data(数据平台) — 🔴 无 HTTP 路由

| 功能 | 状态 | 说明 |
|---|---|---|
| CDC 任务 CRUD + 启停 + 状态 | 🔴 | `cdc-tasks{,/{id},/{id}/pause,/{id}/resume,/{id}/status}`,数据源测试 |
| ETL 任务 CRUD + 运行 + 停止 + 状态 | 🔴 | `etl/tasks{,...}` |
| 指标 CRUD + 计算 + lineage + values | 🔴 | `metrics{,...,/{id}/compute,/{id}/lineage,/{id}/values}` |
| 调度 DAG + 任务 CRUD + 暂停 + 触发 | 🔴 | `scheduler/{dag,tasks{,...}}` |
| **底层能力**(DATA-D0-D8 已实现) | 🟢 | `mate-platform/auth/retention.py`(retention) + `mate-clients/security/pii_mask.py`(PII 掩码) + `mate-platform/observability/xdomain_audit.py`(跨域审计) |
| **缺** HTTP 控制面挂载 | 🔴 | 已落地的 9 阶段 45 tests 没暴露成 REST API |

### 4.7 a2a(A2A 协议层) — 🔴 无包代码

| 功能 | 状态 | 说明 |
|---|---|---|
| Agent Cards 搜索 | 🔴 | `GET /api/v1/a2a/agent-cards/search` |
| 委托查询 | 🔴 | `GET /api/v1/a2a/delegations` |
| A2A 协议层完整实现(agent-card 协议 / 任务委托 / 跨 agent 协作) | 🔴 | 需新建包 |

### 4.8 wfe(工作流引擎) — 🔴 无包代码

| 功能 | 状态 | 说明 |
|---|---|---|
| 流程试运行 | 🔴 | `POST /api/v1/wfe/flows/test` |
| 流程校验 | 🔴 | `GET /api/v1/wfe/flows/validate` |
| **Flowable engine 集成**(已部署但未接 HTTP) | 🟢 | `docker-compose.yml` 已配 `flowable/flowable-engine:8.0.0` |
| 5 步模式 | 🔴 | 需新建包 |

---

## 5. 跨域缺失能力(与 PRD 对照)

| 能力 | PRD 来源 | 现状 |
|---|---|---|
| **A2A 协议层完整实现** | PRD-APP-COPILOT / PRD-APP-AGENT | copilot 与 a2a 域均无包代码 |
| **多模态 chat**(图像 / 语音 / 视频) | PRD-APP-COPILOT §3.5 | llmgw 有占位但未实现 |
| **数字员工自主决策**(RAG + Agent + Ontology 联合) | PRD-APP-DW | dw 域无包代码 |
| **本体推理**(SHACL / OWL Reasoner) | PRD-APP-ONTSTUDIO §6.4 | ont 域有 SPARQL + Explain,但无 Reasoner |
| **数据血缘 + 资产目录** | PRD-APP-ARCH §5.3 | arch 域 29 个 endpoint 无包代码 |
| **治理评审流程** | PRD-APP-ARCH §7 | arch 域 review-tickets / review-templates 未实现 |
| **应用市场 / 应用模板** | PRD-APP-APPHUB | apphub 域无包代码 |
| **SQL Copilot 全套** | PRD-APP-COPILOT §3.4 | copilot 域无包代码 |
| **代码 Copilot 全套** | PRD-APP-COPILOT §3.3 | copilot 域无包代码 |
| **NLQ 自然语言查询** | PRD-APP-COPILOT §3.6 | copilot 域无包代码 |
| **任务调度(plan 生成 / 员工匹配 / 意图识别)** | PRD-APP-COPILOT §3.7 | copilot 域无包代码 |
| **工作流编排 + 试运行** | PRD-APP-WFE | wfe 域无包代码 |
| **数据平台控制面**(CDC / ETL / Metrics / Scheduler) | ADR-0016(DATA-D0-D8) | 后端模块已落地,**HTTP 路由未挂** |
| **数据保留 + GDPR + PII 掩码 + 跨域审计** | ADR-0016 | mate-platform / mate-clients 已实现模块,**未挂 HTTP** |

---

## 6. 13 硬规则合规盘点(按域)

| 域 | install_auth | require_tenant | outbox | BearerAuth | 跨租户 tests | security 段 |
|---|---|---|---|---|---|---|
| **kb** | ✅ | ✅ | ✅ | ✅ | ✅ 3 | ✅ |
| **rag** | ✅ | ✅ | ✅ | ✅ | ✅ 7 | ✅ |
| **llmgw** | ✅ | ✅ | ✅ | ✅ | ✅ 7 | ✅ |
| **agent** | ✅ | ✅ | ✅ | ✅ | ✅ 7 | ✅ |
| **ont** | ✅ | ✅ | ✅ | ✅ | ✅ 7 | ✅ |
| **msg** | ✅ | ✅ | ✅ | ✅ | ✅ 7 | ✅ |
| **obs** | ✅ | ✅ | ✅ | ✅ | ✅ 7 | ✅ |
| **mcp** | ✅ | ✅ | ✅ | ✅ | ✅ 7 | ✅ |
| **iam** | ✅ deprecated | — | — | — | — | — |
| **apphub / arch / copilot / dashboard / dw / data / a2a / wfe** | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | spec 已签 |

**8 域 P2 完全不合规**——任何 PR 都不通过 §13 硬规则 3/4/9。

---

## 7. 工作量估算

| 阶段 | 内容 | 工作量 | 优先级 |
|---|---|---|---|
| **基础设施收口** | 路径对齐 `app-kb→kb` / `llm→llmgw` / mcp 路由挂载 / dashboard 9 个 PUT | 1-2 周 | **P0** |
| **8 域 P2 建包** | apphub / a2a / wfe / dw 各 1-2 周 + copilot 3-4 周 + arch 3-4 周 + data 1 周 | 8-12 周 | **P1** |
| **数据平台控制面挂载** | data/etl/metrics/scheduler 39 endpoint 挂到 DATA-D0-D8 模块 | 1-2 周 | **P2**(DATA-D0-D8 完成后) |

合计 **10-16 周 / 12-20 个 PR**。

---

## 8. 与接口维度清单的关系

| 维度 | 文件 | 用途 |
|---|---|---|
| **功能(本文件)** | `2026-07-30-features-backlog.md` v1.0 | 业务方 / 产品方视角,看"用户能做什么还没做" |
| **接口** | `2026-07-30-backend-impl-backlog.md` v1.0 | 工程师视角,看"每个 endpoint 怎么落地" |
| **进度** | `2026-07-30-business-slices-rollout-status.md` v1.2 | 17 域接入进度官方表 |
| **模式** | `2026-07-30-per-app-integration-checklist.md` v1.0 | 5 步接入 checklist |

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-30 | 初版 v1.0(基于 main + bundled.yaml + 代码扫描) | TRAE 盘点 |