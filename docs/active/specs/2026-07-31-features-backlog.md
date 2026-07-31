# Mate Platform 功能未实现清单(按业务能力维度)

> 版本:v1.1 · 2026-07-31
> 数据源:`mate-platform-backend/contracts/openapi/generated/bundled.yaml`(252,516 bytes,214 个 spec 路由)
> 代码扫描:`mate-platform-backend/` 下所有 `.py` 文件(`.venv` / `node_modules` / `tests` / `.wheels` / `__pycache__` 已排除)
> 关联:
> - `docs/active/specs/2026-07-30-business-slices-rollout-status.md` v1.2(17 域接入进度)
> - `docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0(5 步模式)
> - `docs/active/decisions/ADR-0014-tech-services-integration.md`
> - `docs/active/delivery/evidence/P0-CLOSE-ACCEPTANCE.md`(7/30 收尾)
> - `docs/active/delivery/evidence/P2-W2-ACCEPTANCE.md`(7/31 主推进)

---

## 1. 范围与读法

按"业务能力(用户能做什么)"维度盘点,**不是接口清单**。每个功能标注:

- 🟢 **已实现**:有 handler、有业务逻辑、有测试
- 🟡 **部分实现**:代码骨架在,但关键能力缺失或路径别名未对齐
- 🔴 **未实现**:完全没建包,或仅有 OpenAPI 占位
- 🟠 **已落地但生产禁用**:deprecated / legacy 路径

**v1.1(7/31)更新要点**:
- **P0-CLOSE** 已 Accepted(7/30 23:30):`app-kb→kb`、`llm→llmgw`、`mcp` 5 endpoint 真正挂载
- **P2-W2** 已 Accepted(7/31 11:34):dashboard 38 endpoint 全部合规 / 新建 `mate-app-hub` 5 / `mate-app-arch` 27 / `mate-app-copilot` 33 共 **99+ endpoint 净增**
- **17 域接入进度 8/17 → 11/17**(apphub / arch / copilot 全部完成,dashboard 38/38 全合规)
- **未实现 spec 路由 125 → 55**

---

## 2. 平台核心能力(架构基线要求)

| # | 功能 | 状态 | 证据 / 阻塞 |
|---|---|---|---|
| F-01 | **Keycloak OIDC 单点登录 + JWT 颁发** | 🟢 | `infra/keycloak/realm-mate.json` + `SEC-IAM-01` |
| F-02 | **JWT 验证 + 租户绑定** | 🟢 | `mate-platform/auth/` 7 模块 + 29 tests |
| F-03 | **5 层租户隔离**(HTTP/DB/Kafka/Redis/MinIO) | 🟢 | `mate-platform/tenancy/` 4 模块 + 54 tests |
| F-04 | **跨租户 admin 通道** | 🟢 | `cross_tenant_admin` 角色 + audit.log |
| F-05 | **事件管道**(Outbox + 幂等消费者 + DLQ) | 🟢 | `PLATFORM-EVENT-01` Accepted(ADR-0013) |
| F-06 | **K8s 运行时** | 🟢 | `infra/helm/` 4 sub-charts + `infra/argocd/` |
| F-07 | **OTel 分布式追踪 + tenant.id 注入** | 🟢 | 17 OTel tests |
| F-08 | **NetworkPolicy 默认 deny + 显式 allow** | 🟢 | 19 tests |
| F-09 | **Secret 走 SealedSecret / ExternalSecret** | 🟢 | 全 externalSecretName 引用 |
| F-10 | **13 硬规则 pre-commit + CI 三层闭环** | 🟢 | GA-ACCEPTANCE,251 tests pass |

---

## 3. 17 域业务能力盘点(7/31 更新)

### 3.1 mate-app-kb(知识库业务聚合) — 🟢 已实现 + 路径已对齐

| 功能 | 状态 | 说明 |
|---|---|---|
| KB 对话(单轮) | 🟢 | `POST /api/v1/kb/chat`(P0-CLOSE 后 canonical) |
| KB 流式对话 | 🟢 | `POST /api/v1/kb/chat/stream` |
| 文档检索 | 🟢 | `POST /api/v1/kb/search` |
| KB 统计 | 🟢 | `GET /api/v1/kb/stats` |
| 文档上传 | 🟢 | `POST /api/v1/kb/upload` |
| 旧路径 `/api/v1/app-kb/*` deprecated alias | 🟢 | emit `Deprecation: true` header,Swagger 灰显 |
| 5 步模式完整接入 | 🟢 | canonical reference,12 + 10 path-alias tests pass |

### 3.2 mate-tech-rag(RAG 检索) — 🟢 已实现

| 功能 | 状态 | 说明 |
|---|---|---|
| 文档上传 + 解析 + ingest + 检索 + 状态(7 endpoint) | 🟢 | 全 implemented |
| 多后端适配(RAGFlow / LightRAG / GraphRAG / Milvus / PG hybrid) | 🟢 | 9 client + strategies |
| 5 步模式 | 🟢 | P1 wave 3,7 tests |

### 3.3 mate-tech-llmgw(LLM 网关) — 🟢 已实现 + 路径已对齐

| 功能 | 状态 | 说明 |
|---|---|---|
| LLM chat / chat/stream / embeddings | 🟢 | canonical `/api/v1/llmgw/*` |
| 旧路径 `/api/v1/llm/*` deprecated alias | 🟢 | API-GOV-01 §6 breaking change 已落 |
| 多 provider(OpenAI / Anthropic / 豆包 / 通义千问) | 🟢 | 4 provider |
| 缓存 / 配额 / PII / retry / SSE / tool registry | 🟢 | 全模块在 |
| 5 步模式 | 🟢 | P1 wave 2,7 tests |
| **多模态 provider** | 🔴 **未做** | PRD 提到,无实现 |

### 3.4 mate-tech-agent(AI Agent 编排) — 🟢 已实现

| 功能 | 状态 | 说明 |
|---|---|---|
| 4 endpoint(chat / chat/stream / state / review) | 🟢 | 全 implemented |
| LangGraph / memory / tools / guardrails / eval | 🟢 | 全模块在 |
| 5 步模式 | 🟢 | P1 wave 2,7 tests |

### 3.5 mate-tech-ont(本体引擎) — 🟢 已实现

| 功能 | 状态 | 说明 |
|---|---|---|
| 9 endpoint(ontology / class / instance / relations / sparql / explain) | 🟢 | 全 implemented |
| Neo4j / OWL / 版本 / 全文 / Dual-write / 租户 | 🟢 | 全模块在 |
| 5 步模式 | 🟢 | P2 wave 1,7 tests |
| **实例级审计 / 变更追踪** | 🟡 | versioning 部分覆盖 |
| **跨实例规则推理(SHACL / OWL Reasoner)** | 🔴 **未做** | spec 未声明 |
| **联邦查询 / 跨本体合并** | 🔴 **未做** | spec 未声明 |

### 3.6 mate-tech-msg(消息中心) — 🟢 已实现

| 功能 | 状态 | 说明 |
|---|---|---|
| publish + topics | 🟢 | 2 endpoint |
| Kafka + 租户命名空间 | 🟢 | `messaging/kafka_tenant.py` |
| 5 步模式 | 🟢 | P1 wave 1,7 tests |
| **订阅 / Webhook / 推送通道** | 🔴 **未做** | spec 只声明 publish + topics |
| **历史消息查询** | 🔴 **未做** | spec 没声明 |

### 3.7 mate-tech-obs(可观测聚合) — 🟢 已实现

| 功能 | 状态 | 说明 |
|---|---|---|
| health + instrument | 🟢 | 2 endpoint |
| Prometheus / OTel / Loki / Grafana | 🟢 | 全在 |
| 5 步模式 | 🟢 | P1 wave 1,7 tests |
| **Alertmanager 告警规则管理(写)** | 🔴 **未做** | spec 有 GET,无 PUT/POST |
| **自定义仪表盘配置(写)** | 🔴 **未做** | spec 有 GET,无 PUT |

### 3.8 mate-tech-mcp(MCP 协议层) — 🟢 P0-CLOSE 后已挂载

| 功能 | 状态 | 说明 |
|---|---|---|
| **MCP HTTP 5 endpoint 真正挂载** | 🟢 | P0-CLOSE 修复 main.py 破损 + 5 endpoint 落地(7 tests pass) |
| MCP Tool / Resource / Prompt / transport / 认证 | 🟢 | 7 tests pass |
| 5 步模式 | 🟢 | P1 wave 3,7 tests |
| 多 MCP server 联邦 / 外部 MCP 客户端 | 🔴 **未做** | copilot / a2a 域未实现 |

### 3.9 mate-tech-iam(身份管理) — 🟠 Deprecated

| 功能 | 状态 | 说明 |
|---|---|---|
| 本地身份源 + HS256 JWT | 🟠 | SEC-IAM-01 收口,生产禁用 |
| Keycloak JWT | 🟢 | `mate-platform/auth/` |
| 31 个 admin + 38 个 dashboard endpoint | 🟢 | mate-tech-iam 包仍存在 |

---

## 4. 8 域 P2 — 7/31 推进后状态

### 4.1 apphub(应用中心) — 🟢 P2-W2 已实现

| 功能 | 状态 | 说明 |
|---|---|---|
| 应用 / 分类 / 模块 / 页面 / 模板 5 个 GET | 🟢 | P2-W2 PR#12 新建 `mate-app-hub` 包,5 endpoint 全通 |
| 5 步模式 | 🟢 | install_auth + require_tenant + 4 tenant tests pass |
| in-memory 仓库 + 种子数据 | 🟢 | 9 tests pass |

### 4.2 arch(架构中心) — 🟢 27/29

| 功能 | 状态 | 说明 |
|---|---|---|
| 29 个 GET endpoint | 🟢 27 / 🔴 2 | P2-W2 PR#13 新建 `mate-app-arch` 包 |
| **未实现 2 个**:capabilities / capability-mappings / orgs / roles(规范化后) | 🔴 | 4 endpoint 待补 |
| 5 步模式 | 🟢 | install_auth + require_tenant + 4 tenant tests |
| BFS 影响分析 | 🟢 | in-memory + BFS 算法 |
| in-memory 仓库 + 种子数据 | 🟢 | 9 tests pass |

### 4.3 copilot(超级 AI 对话) — 🟢 32/35

| 功能 | 状态 | 说明 |
|---|---|---|
| 35 个 endpoint | 🟢 32 / 🔴 3 | P2-W2 PR#14 新建 `mate-app-copilot` 包 |
| **未实现 3 个**:`/copilot/actions/execute` / `/copilot/generate/process` / `/copilot/scheduling/templates` | 🔴 | 3 endpoint 待补 |
| **A2A 委托 / 外部 agent-cards** | 🟡 stub 501 | P2-W2 在 copilot 包内 stub,真实实现留 TD-4 / P2-W3 |
| **SQL Copilot**(audit / execute / explain / generate) | 🟢 | sqlparse 实现 |
| **代码 Copilot**(code / explain-code / review-code) | 🟢 | 已挂载 |
| **生成器**(dashboard / form / process) | 🟡 | 2/3 已挂(dashboard / form OK,process 缺) |
| **多模态 chat upload** | 🟢 | endpoint 已挂 |
| **本体图查询**(concepts / graph expand / graph query) | 🟢 | 3 endpoint |
| **NLQ**(execute / history) | 🟢 | 2 endpoint |
| **任务调度**(employees/match / execution/start / intent/detect / intents / plan/generate) | 🟡 | 6/7 endpoint,templates 缺 |
| **Action 平台**(match) | 🟡 | match OK,execute 缺 |
| **对话管理 / 全局搜索 / 登录** | 🟢 | 全 endpoint |
| **LLM provider** | 🟡 stub | 6 POST handler emit outbox + stub LLM;真实路由留 TD-6 / P2-W5 |
| 5 步模式 | 🟢 | install_auth + require_tenant + 5 tenant tests(含 a2a 501) |
| in-memory 仓库 + 种子数据 | 🟢 | 13 tests pass |

### 4.4 dashboard(仪表盘工作台) — 🟢 P2-W2 全合规

| 功能 | 状态 | 说明 |
|---|---|---|
| 38 个 endpoint | 🟢 38/38 | P2-W2 PR#11:9 个 PUT 全部补齐,38 全合规 |
| install_auth + JWT iss/aud 统一 + OutboxWriter 真实集成 | 🟢 | ADR-0014 step 1+5 |
| 5 步模式 | 🟢 | 6 happy-path + 5 tenant tests pass |

### 4.5 dw(数字员工聚合) — 🔴 无包代码

| 功能 | 状态 | 说明 |
|---|---|---|
| 15 个 GET endpoint(协作 / commit / 文档 / 员工 / 评估 / learning 等) | 🔴 | OpenAPI 已签,无 `mate-tech-dw/` 包 |

### 4.6 data / etl / metrics / scheduler(数据平台控制面) — 🔴 无 HTTP 路由

| 功能 | 状态 | 说明 |
|---|---|---|
| data 15 + etl 5 + metrics 5 + scheduler 5 = 30 endpoint | 🔴 | OpenAPI 已签,无 HTTP 挂载 |
| **底层能力** | 🟢 | DATA-D0-D8 已落地(retention / pii_mask / xdomain_audit),仅缺 HTTP 控制面 |
| **HTTP 控制面** | 🔴 | 30 endpoint 待挂 |

### 4.7 a2a(A2A 协议层) — 🟡 部分(由 copilot 代挂)

| 功能 | 状态 | 说明 |
|---|---|---|
| `/api/v1/a2a/agent-cards/search` + `/api/v1/a2a/delegations` | 🔴 | spec 已签,无 a2a 包 |
| `copilot/a2a/delegate` + `copilot/a2a/external` | 🟡 stub 501 | P2-W2 在 copilot 包内 stub,TD-4 真实实现 |

### 4.8 wfe(工作流引擎) — 🔴 无包代码

| 功能 | 状态 | 说明 |
|---|---|---|
| 流程试运行 + 流程校验 2 endpoint | 🔴 | OpenAPI 已签,无 `mate-app-wfe/` 包 |
| **Flowable 集成** | 🟢 | docker-compose.yml 已配 `flowable/flowable-engine:8.0.0` |

---

## 5. 跨域能力盘点(PRD 对照,7/31)

| 业务能力 | PRD 来源 | 现状(7/31) | 备注 |
|---|---|---|---|
| **A2A 协议层完整实现** | PRD-APP-COPILOT / PRD-APP-AGENT | 🟡 stub 501 | copilot 已挂,P2-W3 真实实现 |
| **SQL Copilot**(审计/执行/解释/生成) | PRD-APP-COPILOT §3.4 | 🟢 | sqlparse 实现 |
| **代码 Copilot**(生成/解释/review) | PRD-APP-COPILOT §3.3 | 🟢 | 已挂载 |
| **NLQ 自然语言查询** | PRD-APP-COPILOT §3.6 | 🟢 | 2 endpoint |
| **多模态 chat**(图像 / 语音) | PRD-APP-COPILOT §3.5 | 🟡 upload only | llmgw 真实多模态 provider 缺 |
| **任务调度**(plan / 员工匹配 / 意图) | PRD-APP-COPILOT §3.7 | 🟡 6/7 | templates 缺 |
| **Action 平台**(动作匹配 / 执行) | PRD-APP-COPILOT §3.8 | 🟡 match only | execute 缺 |
| **数字员工自主决策** | PRD-APP-DW | 🔴 | dw 域无包 |
| **本体推理**(SHACL / OWL Reasoner) | PRD-APP-ONTSTUDIO §6.4 | 🔴 | ont 仅有 SPARQL + Explain |
| **联邦查询 / 跨本体合并** | PRD-APP-ONTSTUDIO §6.5 | 🔴 | ont 域无 |
| **数据血缘 + 资产目录** | PRD-APP-ARCH §5.3 | 🟢 | arch 域 27/29 endpoint |
| **治理评审流程** | PRD-APP-ARCH §7 | 🟢 | arch 域 review-tickets / review-templates 已挂 |
| **应用市场 / 模板** | PRD-APP-APPHUB | 🟢 | 5 endpoint |
| **工作流编排 + 试运行** | PRD-APP-WFE | 🔴 | wfe 域无包 |
| **数据平台控制面**(CDC / ETL / Metrics / Scheduler) | ADR-0016 | 🔴 HTTP 未挂 | DATA-D0-D8 模块已落地,缺控制面 |
| **数据保留 + GDPR + PII 掩码 + 跨域审计** | ADR-0016 | 🟢 模块已落地 | 仅需挂 HTTP |

---

## 6. 13 硬规则合规盘点(7/31)

| 域 | install_auth | require_tenant | outbox | BearerAuth | 跨租户 tests | security 段 |
|---|---|---|---|---|---|---|
| **kb / rag / llmgw / agent / ont / msg / obs / mcp** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **apphub / arch / copilot / dashboard** | ✅ | ✅ | ✅/N/A | N/A | ✅ 4-5 | ✅ |
| **dw / data / etl / metrics / scheduler / a2a / wfe** | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | spec 已签 |
| iam | 🟠 deprecated | — | — | — | — | — |

**7 / 17 域完整 5 步合规** + 4 / 17 域部分合规 + 6 / 17 域待建包。

---

## 7. 工作量估算(7/31 更新)

| 阶段 | 内容 | 工作量 | 起点 |
|---|---|---|---|
| **P0 收口** | ✅ 已完成(7/30 P0-CLOSE + 7/31 P2-W2) | — | — |
| **P1 dw + 数据平台控制面 + wfe** | dw 15 + data 30 + wfe 2 = 47 endpoint | 4-6 周 | 本周 |
| **P2 arch 4 + copilot 3 + a2a 2 = 9 endpoint** | 路径补齐 + a2a 真实 | 1-2 周 | P1 启动后 |
| **TD-1~TD-7 技术债** | TenantAccessError 400 / Event.create 校验 / BearerAuth / A2A 真实 / in-memory→PG / LLM provider / pyright | 2-3 周 | 并行 |

合计 **7-11 周 / 8-12 个 PR**(从 7/30 的 10-16 周 大幅压缩)。

---

## 8. 关联文档

- `docs/active/specs/2026-07-31-backend-impl-backlog.md` v1.1 — 接口维度详单
- `docs/active/specs/2026-07-27-mate-platform-delivery-roadmap.md` v1.3 — 主 Roadmap(附录 B)
- `docs/active/specs/2026-07-30-business-slices-rollout-status.md` v1.2 — 17 域进度
- `docs/active/specs/2026-07-30-per-app-integration-checklist.md` v1.0 — 5 步模式
- `docs/active/delivery/evidence/P0-CLOSE-ACCEPTANCE.md`(7/30)
- `docs/active/delivery/evidence/P2-W2-ACCEPTANCE.md`(7/31)
- `docs/active/decisions/ADR-0014-tech-services-integration.md`

---

## 9. 变更记录

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-07-30 | v1.0 初版(spec 214 / 代码 89 / 未实现 125,8/17 接入) | TRAE 盘点 |
| **2026-07-31** | **v1.1**:**P0-CLOSE + P2-W2 已落地**:11/17 接入(dashboard/apphub/arch/copilot 完成);未实现 125 → 55;5 步合规矩阵更新 | TRAE 盘点 |