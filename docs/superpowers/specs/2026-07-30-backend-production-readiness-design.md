# Mate Platform 后端生产化改造设计

> 日期：2026-07-30
> 状态：已完成方案讨论，待书面评审
> 基线报告：`docs/active/reports/REPORT-后端逻辑全量盘点-2026-07-30.md`

## 1. 目标与已批准决策

本设计用于将当前 Development Prototype / Integration Skeleton 改造为符合 v3.0/v3.1 架构、全部现行 PRD 和生产上线要求的后端系统。

已批准决策：

1. 采用生产上线优先，而不是先追求页面可见功能数量。
2. 允许破坏性切换，不保留旧认证、旧 mock、旧 fallback 和旧 API 兼容运行层。
3. 旧 SQLite、JSON、内存种子和 mock 数据全部重置，不迁移业务数据。
4. v3.1 Data Track 与主后端共同构成 GA 硬前置。
5. Kubernetes 是唯一生产基线；Docker Compose 只用于本地开发。
6. 采用“架构底座先行，再按垂直业务切片迁移”。
7. 所有 HTTP 接口采用 OpenAPI/Swagger 契约先行。
8. `API-GOV-01` 是第一批实施任务。

## 2. 总体实施策略

推进层级：

```text
L0 架构与生产底座
→ L1 技术服务与公共能力
→ L2 业务垂直切片
→ L3 Data Track 完整闭环
→ L4 GA 验收与生产发布
```

公共规则必须先成为代码、测试和 CI 门禁，随后才允许业务模块迁入。每个切片同时交付 PRD 映射、OpenAPI、领域逻辑、正式存储、鉴权与租户、测试、可观测、Kubernetes 和回滚能力。

## 3. 目标代码结构

唯一后端代码根为 `mate-platform-backend/`。根目录重复的 `services/api-gateway` 和 `services/auth-service` 在确认构建引用后删除，只保留 monorepo 中的权威源码。

```text
mate-platform-backend/
├── packages/
│   ├── mate-kernel/
│   ├── mate-platform/
│   ├── mate-clients/
│   ├── mate-tech-{iam,msg,obs,mcp,llmgw,ont,rag,agent,data}/
│   └── mate-app-{dashboard,kb,copilot,dw,apphub,arch,wfe,a2a}/
├── services/
├── contracts/{openapi,events,pact}/
├── migrations/
├── tests/{architecture,unit,contract,integration,e2e,performance,chaos}/
└── deploy/{local,helm,argocd,policies}/
```

### 3.1 四层模块边界

每个领域模块统一为：

```text
domain/          纯领域实体、值对象、事件、策略、异常
application/     command、query、handler、DTO、port
infrastructure/  repository、外部 client、消息、配置
api/             route、schema、dependency、HTTP error mapping
bootstrap.py     依赖装配
```

强制依赖规则：

- Domain 不导入 FastAPI、SQLAlchemy、httpx、Redis、Kafka或具体数据库包。
- Application 只通过 Port/Protocol 使用仓储和外部服务。
- Infrastructure 实现 Port。
- API 只负责协议转换、鉴权依赖、校验和状态码映射。
- Route 不直接执行 SQL、不实例化 httpx client、不修改全局业务字典。
- 禁止模块级可变业务状态。
- 依赖只在 `bootstrap.py` 或 FastAPI lifespan 装配。
- 使用 architecture tests 自动阻止反向依赖。

### 3.2 技术服务和业务服务边界

技术服务提供可复用能力：RAG、Agent Runtime、Ontology、LLM Gateway、MCP、Message、Observability、Data Control Plane。

业务服务实现 PRD 语义和跨技术服务编排：Dashboard、KB、Copilot、Digital Worker、APPHUB、ARCH、WFE、A2A。

前端不得直接拼接多个技术服务来模拟业务事务。

## 4. OpenAPI/Swagger 契约治理

### 4.1 唯一契约源

```text
mate-platform-backend/contracts/openapi/
├── platform.yaml
├── common/{errors,pagination,security,tracing,tenancy}.yaml
├── services/
│   ├── iam.yaml
│   ├── dashboard.yaml
│   ├── msg.yaml
│   ├── obs.yaml
│   ├── mcp.yaml
│   ├── llmgw.yaml
│   ├── ont.yaml
│   ├── rag.yaml
│   ├── agent.yaml
│   ├── data.yaml
│   ├── kb.yaml
│   ├── copilot.yaml
│   ├── dw.yaml
│   ├── apphub.yaml
│   ├── arch.yaml
│   ├── wfe.yaml
│   └── a2a.yaml
└── generated/bundled.yaml
```

`generated/bundled.yaml` 是 Swagger UI、SDK、Prism、契约测试和前端联调的唯一聚合输入。FastAPI runtime OpenAPI 必须与该契约比对。

### 4.2 接口开发顺序

```text
PRD Requirement
→ Requirement Matrix
→ OpenAPI 3.1
→ 契约评审
→ Prism Mock
→ 生成类型/SDK
→ 契约测试
→ 后端实现
→ Runtime OpenAPI Diff
→ E2E
```

禁止先写路由后补 Swagger。

### 4.3 统一接口规则

- 外部路径统一 `/api/v1/{domain}/...`。
- `operationId` 全局唯一且发布后稳定。
- JSON 使用 camelCase；时间为 RFC 3339 UTC；ID 为字符串。
- 统一 Authorization、X-Request-Id、traceparent。
- 客户端不能提交可信 tenant Header。
- 统一错误模型与 400/401/403/404/409/422/429/500/502/503/504。
- 幂等写入支持 `Idempotency-Key`。
- 长任务返回 `202 Accepted` 和统一 Operation 资源。
- 每个 operation 标注权限、Owner、可见性和生命周期。
- 破坏性变更通过明确 API 新版本发布。

### 4.4 Swagger运行方式

本地和测试环境提供 Swagger UI、Swagger Editor、Redoc、Prism。生产仅提供受身份保护的只读 Swagger/Redoc；禁用 Editor 和 Prism，并过滤内部或敏感接口。

### 4.5 PRD追踪

`docs/active/delivery/REQUIREMENT-MATRIX.yaml` 将每个 Requirement 关联到 PRD、service、operationId、contract、handler、tests 和验收状态。CI 阻止孤立路由、无 handler 的契约、无测试的 operation，以及标记完成但返回 mock 的实现。

## 5. 安全、身份与租户

### 5.1 Keycloak唯一身份源

Keycloak负责登录、Token、SSO、Realm、基础角色、会话和 MFA。mate-tech-iam 负责组织、岗位、业务角色、权限目录、ABAC、业务资料、审计和 Keycloak 身份映射。

必须删除：

- 本地密码认证；
- 本地 HS256 access/refresh token；
- 开发用户、租户和角色 Header；
- 第二套登录会话；
- 生产默认 secret。

### 5.2 RequestContext

所有 Application handler 显式接收不可变上下文：request_id、trace_id、tenant_id、user_id、roles、permissions、locale。

AuthService 验证 Keycloak JWT；网关移除外部身份 Header并生成受保护的内部身份；服务验证内部服务身份。tenant 只能来自可信 token 映射，Repository 每次读写必须显式接收 tenant_id。

### 5.3 全栈隔离

- PostgreSQL：独立 schema/tenant 条件及必要的 RLS。
- Redis：tenant key prefix。
- Kafka：事件强制 tenant_id。
- Milvus：明确 collection/partition 隔离策略。
- Neo4j：tenant property和查询约束。
- MinIO：tenant prefix/bucket policy。
- 测试必须证明跨租户读写失败。

## 6. 数据、事务与集成模式

### 6.1 正式存储

PostgreSQL是业务元数据唯一关系存储，每个 Bounded Context 使用独立 schema，Alembic管理版本。生产禁止 SQLite 和启动时 `create_all`。

### 6.2 Transactional Outbox

业务数据和 Outbox 在同一数据库事务写入。Outbox Relay 发布 Kafka；消费者按 event_id 幂等。事件必须包含 event_id、tenant_id、aggregate_id、version、trace_id。失败进入 retry/DLQ，并提供查询、重放和审计。

禁止当前“先写 Redis 幂等标记，再发送 Kafka”的顺序。

### 6.3 Saga

跨服务长事务使用持久化 Saga choreography，明确成功、失败、补偿、超时和恢复事件。审批由 Flowable负责；数据 Pipeline调度由Airflow/Flink负责；不得使用进程内字典跟踪 Saga。

### 6.4 外部引擎 ACL

所有外部系统经 `mate-clients` 访问，统一实现 typed DTO、连接池、timeout、有限幂等重试、circuit breaker、bulkhead、trace、metrics、错误映射、健康状态和 close。

生产禁止自动切换 InMemory adapter：关键依赖启动失败导致 readiness失败，运行失败返回明确 503/降级语义。Fake adapter只允许显式 test/local profile，且不能进入生产装配。

### 6.5 CQRS边界

CQRS用于知识入库/索引、Agent Run、Ontology发布、Data Pipeline发布、Dashboard投影和审计查询。普通配置 CRUD 使用简单 Application Service，避免机械过度设计。

## 7. Kubernetes生产基线

生产交付包括 Helm、Argo CD、环境 values、namespace、ServiceAccount、最小RBAC、NetworkPolicy、TLS、External Secrets/OpenBao、资源限制、HPA、PDB、migration Job、startup/liveness/readiness、镜像签名、SBOM和蓝绿/Canary发布。

Staging必须支持一键部署、持久化、备份恢复、依赖故障 readiness、服务仅经网关访问和 Argo CD回滚。Compose只保留本地 profile。

## 8. 分阶段路线

### Phase 0：契约与架构基线

完成 PRD去重和Requirement ID、全部业务域 OpenAPI、聚合Swagger、Spectral/Redocly/oasdiff、Prism、breaking change报告和追踪矩阵。

### Phase 1：Kubernetes平台底座

部署Keycloak、PostgreSQL、Redis、Kafka、MinIO、Neo4j、Milvus、Flowable、Drools、Nacos、OTel、Prometheus、Loki、Tempo、Grafana及安全策略。

### Phase 2：安全与公共内核

完成 Keycloak唯一身份、RequestContext、多租户、错误、审计、幂等、Outbox、DLQ、配置、trace、客户端韧性、Alembic和architecture tests。

### Phase 3：技术服务生产化

按 MSG、OBS、MCP、LLMGW、ONT、RAG、Agent 顺序迁移。每个服务必须完成正式存储、无生产mock、Swagger、契约测试、Testcontainers、K8s、SLO和故障测试。

关键完成条件：

- MSG：Producer/Consumer/retry/DLQ/replay/Outbox。
- OBS：真实协议健康探测与 traces/metrics/logs闭环。
- MCP：JWKS强验签、工具权限、分布式限流和管理模型。
- LLMGW：真实stream/embedding并串联quota/cache/cost/PII/fallback。
- ONT：Neo4j instance/relation、真实SPARQL、版本/发布/双写状态机。
- RAG：KB/Document/Ingestion状态机、解析/索引/检索/补偿和一致性。
- Agent：共享状态、持久化HITL、真实Flowable、S1–S4、Run状态机。

### Phase 4：核心业务切片

依次完成 IAM/Admin、Dashboard、KB、Ontology Studio、Copilot、Digital Worker和Workflow。每个域按 PRD→Swagger→Use Case→Domain→Persistence/ACL→Event→SDK→UI→E2E→K8s→SLO交付。

### Phase 5：扩展业务域

完成 APPHUB、EA/ARCH、A2A、MCP Hub管理面、高级AIOps、应用市场与发布。

### Phase 6：Data Track

执行 D0–D8：Flink CDC、Paimon、Iceberg、Trino、StarRocks、Flink Operator、Airflow、Gravitino、OpenMetadata、OpenLineage/Marquez、Ranger/OpenBao，以及 mate-tech-data 的 Source、CDC、Pipeline、Job、Release、Data Product、Catalog、Lineage、Quality、Policy和Operation。

所有控制面接口进入 `contracts/openapi/services/data.yaml`。GA前必须通过回放、Schema Evolution、发布/暂停/恢复/回滚、血缘、质量门禁、权限同步、BI/AI消费、性能、混沌和RPO/RTO。

### Phase 7：全域质量收口

CI顺序：Ruff → Pyright Strict → Architecture Tests → OpenAPI校验 → oasdiff → Unit/Coverage → Pact → Testcontainers → K8s E2E → SAST/DAST/SBOM → Performance → Chaos/DR。

门禁：Ruff 0、Pyright 0、生产代码覆盖率≥80%、domain/application建议≥90%、契约零错误、无未批准breaking change、集成测试不默认跳过、P0/P1 E2E全绿、无Critical/High漏洞、SLO和RPO/RTO通过。

### Phase 8：破坏性切换和GA

冻结旧环境，重置旧数据，初始化Keycloak和正式存储，执行Alembic，初始化Data Track，部署、全量验收、蓝绿切换和观察。旧镜像只用于代码回滚，不提供旧数据或旧接口兼容。

## 9. 任务与交付治理

### 9.1 组织结构

Program → Phase → Workstream → Delivery Batch → Task/PR。

长期Workstream：Architecture/API Governance、Platform/Kubernetes、Security/IAM、Core Technology、Business Applications、Data Platform、Quality Engineering。

每个Delivery Batch应在2～5个工作日内独立验收，不跨多个无关Bounded Context。

### 9.2 ADR

先建立Keycloak单一身份、RequestContext、OpenAPI Contract First、Outbox、K8s生产基线、禁止生产fallback、Lakehouse边界、技术/业务服务边界等ADR。每份ADR包含Context、Decision、Alternatives、Consequences、Migration、Verification。

### 9.3 Definition of Ready

进入开发前必须有 Requirement ID、用户场景、状态转换、权限矩阵、OpenAPI、示例、错误码、幂等要求、事件定义和验收用例。

### 9.4 Definition of Done

完成必须具备 OpenAPI、实现、domain/application测试、contract、integration、跨租户安全、审计、日志/指标/trace、K8s、文档和回滚证据。

## 10. Git与环境策略

采用短生命周期 `codex/` 分支，一个分支对应一个Delivery Batch，不建立长期大重构分支。PR关联Requirement、operationId和ADR，标记breaking change并由领域Owner及架构/安全Owner审查。

提交顺序建议：docs/ADR → contract → failing tests → feature → infrastructure → deploy → acceptance evidence。

环境顺序：local → contract → integration → staging → pre-production → production。只有staging以上Kubernetes证据可以证明生产完成。

## 11. 验收责任

- 产品Owner验收PRD覆盖。
- API Owner验收Swagger和oasdiff。
- Domain Owner验收领域规则。
- Security Owner验收JWT、越权和跨租户。
- Data Owner验收migration和一致性。
- Integration Owner验收Pact和外部引擎。
- Platform Owner验收K8s、探针和回滚。
- SRE验收可观测、性能和DR。
- 产品与QA共同验收E2E。

实现者不能单独将自己的任务标记为Accepted。

## 12. 第一批启动范围

### API-GOV-01：OpenAPI/Swagger统一治理

交付唯一契约源、common schemas、全部领域契约文件、bundled.yaml、Swagger UI/Editor/Redoc/Prism、Spectral/Redocly/oasdiff、PRD追踪、breaking change报告和CI孤立路由门禁。

退出条件：所有目标业务域可在Swagger查看，聚合契约零错误，Prism可启动，runtime schema无未批准偏差，CI能阻断孤立路由。

### 后续首阶段批次

1. ARCH-CORE-01：mate-kernel、mate-platform、mate-clients、四层模板、architecture tests、严格Ruff/Pyright、删除重复源码。
2. PLATFORM-K8S-01：Helm、Argo CD、Keycloak、PG、Redis、Kafka、Secret、OTel与NetworkPolicy。
3. SEC-IAM-01：删除本地身份源，完成JWKS轮换、RequestContext、服务身份、tenant映射和安全契约。
4. SEC-TENANT-01：全栈租户隔离。
5. PLATFORM-EVENT-01：Outbox、事件、幂等消费者、retry和DLQ。

依赖顺序：API-GOV-01先行；ARCH-CORE-01与PLATFORM-K8S-01随后可并行；完成后进入SEC-IAM-01、SEC-TENANT-01、PLATFORM-EVENT-01；再开始技术服务与业务域迁移。

## 13. 不可绕过的硬规则

1. Swagger没有接口，不写route。
2. PRD没有Requirement ID，不进入开发。
3. 没有tenant上下文，不访问repository。
4. 外部系统没有ACL Client，业务代码不直连。
5. Production profile禁止fake、mock和memory fallback。
6. 静态检查失败不合并。
7. 契约或集成测试跳过不标记Accepted。
8. 没有K8s readiness和回滚不算生产完成。
9. 没有审计、指标和trace不算业务闭环。
10. 所有状态以验收证据为准，不以路由数量或主观百分比为准。
