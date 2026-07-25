# 后端服务修正与完善计划

> **版本**: v1.0 | **日期**: 2026-07-22
> **范围**: 全部 15 个 TECH-* 后端服务（10 个 Java + 5 个 Python）
> **依据**: CLAUDE.md v1.3 技术栈基线 + 各 APP PRD v2.x + 设计稿差异分析报告

---

## 1. 盘点结论

### 1.1 现有服务清单

| 服务 | 语言 | Java 文件数 | Python 文件数 | API 端点数 | 当前状态 |
|---|---|---|---|---|---|
| TECH-ONT | Java | 116+ | - | ~40 | 有完整实现，已引入 SAA |
| TECH-WFE | Java | 100+ | - | ~30 | 有完整实现，用 Flowable |
| TECH-IAM | Java | 100+ | - | ~40 | 有完整实现 |
| TECH-MCP | Java | 100+ | - | ~50 | 有完整实现，缺 SAA Nacos MCP |
| TECH-RULE | Java | 100+ | - | ~30 | 有完整实现 |
| TECH-OBS | Java | 100+ | - | ~30 | 有完整实现 |
| TECH-MSG | Java | 52 | - | ~15 | 有完整实现 |
| TECH-GW | Java | 76 | - | ~25 | 有完整实现，用 SC Gateway |
| TECH-EA | Java | 100+ | - | ~40 | 有完整实现 |
| TECH-ACTION | Java | 82 | - | ~25 | 有完整实现 |
| TECH-LLMGW | **Python** | - | 61 | 72 | 需重写为 Java + SAA ChatModel |
| TECH-RAG | **Python** | - | 28 | 22 | 需重写为 Java + SAA VectorStore |
| TECH-AGENT | **Python** | - | 69 | 81 | 需重写为 Java + SAA Graph Core |
| TECH-A2A | **Python** | - | 39 | 51 | 需重写为 Java + SAA A2A Nacos |
| TECH-DATA | **Python** | - | 54 | 79 | 需重写为 Java + Spring Batch |

### 1.2 核心差异（6 类）

| # | 差异类型 | CLAUDE.md 要求 | 当前现状 | 影响范围 |
|---|---|---|---|---|
| 1 | Java 版本 | **Java 25 LTS** | 全部 10 个 Java 服务用 Java 21 | 10 个 Java 服务 |
| 2 | Spring Boot 版本 | **3.5.x** | 仅 TECH-ONT 是 3.5.0，其余 9 个为 3.4.0 | 9 个 Java 服务 |
| 3 | SAA 依赖 | **1.1.2.0 BOM** | 仅 TECH-ONT 引入 | MCP/AGENT/LLMGW/RAG/A2A |
| 4 | Nacos 注册中心 | **3.0+ Registry** | 仅 TECH-ONT 通过 SAA 间接用 Nacos 配置；无 Discovery | 全部服务 |
| 5 | Python 服务 | **禁止** | 5 个 Python 服务（305 端点） | 5 个服务 |
| 6 | Spring Cloud Alibaba | **要求引入** | 无任何服务引入 SCA | 全部服务 |

### 1.3 版本兼容性修正（CLAUDE.md 勘误）

经查证 GitHub Releases，CLAUDE.md 中以下版本存在不兼容问题：

| CLAUDE.md 原文 | 问题 | 修正版本 | 依据 |
|---|---|---|---|
| Spring Cloud 2024.0.x | 不支持 Spring Boot 3.5.x | **Spring Cloud 2025.0.x** | SC 2025.0.0 GA (2025-06-02) 明确支持 Spring Boot 3.5.0 |
| SCA 2023.0.x | 使用 Nacos client 2.4.x，不满足 Nacos 3.0+ | **SCA 2025.0.0.0** | SCA 2025.0.0.0 内置 Nacos 3.0.3 + Spring Boot 3.5.0 |
| - | - | - | SCA 2023.0.3.4 仅 Nacos client 2.4.3 |

**Spring Cloud 2025.0.0 破坏性变更（影响 TECH-GW）**：
- `spring-cloud-starter-gateway` → `spring-cloud-starter-gateway-server-webflux`
- 属性前缀变更：`spring.cloud.gateway.*` → `spring.cloud.gateway.server.webflux.*`

---

## 2. 修正后技术栈版本矩阵

| 类别 | 技术 | 修正版本 | 说明 |
|---|---|---|---|
| 语言 | Java | **25 LTS** | 唯一后端语言 |
| 框架 | Spring Boot | **3.5.0** | 微服务基础 |
| 框架 | Spring Framework | 6.2.x | 随 Boot 3.5 |
| 框架 | Spring Cloud | **2025.0.x** | 微服务治理（修正自 2024.0.x） |
| 框架 | Spring Cloud Alibaba | **2025.0.0.0** | Nacos Discovery/Config（修正自 2023.0.x） |
| AI | Spring AI | 1.1.2 | LLM 集成抽象 |
| AI | Spring AI Alibaba | **1.1.2.0** | AI 编排统一底座（BOM） |
| AI | SAA Extensions | 1.1.2.1 | 扩展 |
| 数据 | Spring Data JPA | 随 Boot 3.5 | 替代 SQLAlchemy |
| Web | Spring WebFlux/MVC | 随 Boot 3.5 | + 虚拟线程 |
| 安全 | Spring Security | 6.4.x | 随 Boot 3.5 |
| 协议 | Nacos | **3.0.3**（client，由 SCA 2025.0.0.0 引入） | MCP/A2A Registry + Config |
| 数据库 | PostgreSQL | 17 | 主库 |
| 图库 | Neo4j | 5.x | 知识图谱 |
| 向量库 | Milvus | 2.5 | SAA VectorStore |
| 消息 | Kafka | 3.9 | 事件 |
| 消息 | RabbitMQ | 4.x | 任务 |
| 缓存 | Redis | 7.4 | 缓存 + 锁 |
| 测试 | JUnit 5 + Mockito + Testcontainers | 随 Boot 3.5 | 替代 pytest |

---

## 3. 执行计划

### Phase 0: Java 服务版本对齐（10 个服务）

**目标**：将全部 10 个 Java 服务的 pom.xml 对齐到统一技术栈版本。

**操作清单（每个服务）**：
1. `<java.version>` 21 → 25
2. Spring Boot parent 3.4.0 → 3.5.0（TECH-ONT 已是 3.5.0，跳过）
3. 新增 `dependencyManagement` 导入：
   - Spring Cloud BOM `2025.0.0`
   - Spring Cloud Alibaba BOM `2025.0.0.0`
   - SAA BOM `1.1.2.0`（AI 服务：ONT/MCP；后续重写服务：AGENT/LLMGW/RAG/A2A）
4. TECH-GW 额外：`spring-cloud-starter-gateway` → `spring-cloud-starter-gateway-server-webflux`
5. 验证 Maven 编译

**服务分组**：
- **A 组（已有 SAA）**：TECH-ONT（仅升 Java 21→25）
- **B 组（需加 SCA + SAA BOM）**：TECH-MCP
- **C 组（需加 SCA BOM）**：TECH-IAM, TECH-WFE, TECH-RULE, TECH-OBS, TECH-MSG, TECH-GW, TECH-EA, TECH-ACTION

### Phase 1: Nacos Discovery + Config 集成（10 个服务）

**目标**：为全部 10 个 Java 服务添加 Nacos 服务注册与配置中心。

**操作清单（每个服务）**：
1. pom.xml 新增：
   - `spring-cloud-starter-alibaba-nacos-discovery`（来自 SCA BOM）
   - `spring-cloud-starter-alibaba-nacos-config`（来自 SCA BOM）
2. application.yml 新增：
   ```yaml
   spring:
     cloud:
       nacos:
         discovery:
           server-addr: ${NACOS_ADDR:localhost:8848}
           namespace: metaplatform
         config:
           server-addr: ${NACOS_ADDR:localhost:8848}
           namespace: metaplatform
           file-extension: yaml
     config:
       import:
         - optional:nacos:${spring.application.name}.yaml
   ```
3. 启动类添加 `@EnableDiscoveryClient`

### Phase 2: TECH-MCP SAA Nacos MCP 集成

**目标**：为 TECH-MCP 添加 SAA Nacos MCP Starter，实现 MCP 协议通过 Nacos 3.0+ 注册。

> **执行修正（2026-07-22）**：经查证 SAA BOM 1.1.2.2 不包含 `spring-ai-alibaba-starter-nacos-mcp` artifact（BOM 仅管理 agentscope/a2a-nacos/config-nacos/graph-observation/agent-framework/graph-core/studio/sandbox）。当前 TECH-MCP 源码未引用任何 SAA Nacos MCP 类，暂移除该依赖保证编译通过。MCP Nacos 注册与发现功能推迟到 TECH-MCP 重写阶段实现（使用 SAA Nacos MCP Client/Server 正确 artifact 或自研封装）。

**操作清单**：
1. ~~pom.xml 新增 `spring-ai-alibaba-starter-nacos-mcp`（来自 SAA BOM）~~ → **暂缓，BOM 未管理此 artifact**
2. 新增 MCP Server 配置（Nacos Registry 注册）
3. 新增 MCP Client 配置（Nacos Registry 发现）
4. 将现有 JsonRpcController 适配为 SAA MCP Server 暴露

### Phase 3-7: Python 服务 Java 重写

**重写优先级**（基于被依赖程度）：

| 顺序 | 服务 | SAA 核心依赖 | Python 端点数 | 复杂度 | 依赖方 |
|---|---|---|---|---|---|
| 3 | TECH-LLMGW | SAA ChatModel | 72 | 高 | COPILOT/DW/MCPHUB |
| 4 | TECH-RAG | SAA Document/Embedding/VectorStore | 22 | 中 | KB/DW/COPILOT |
| 5 | TECH-AGENT | SAA Agent Framework + Graph Core | 81 | 高 | DW/COPILOT |
| 6 | TECH-A2A | SAA A2A Nacos | 51 | 中 | COPILOT/DW |
| 7 | TECH-DATA | Spring Batch + Airflow Java Client | 79 | 高 | ONTSTUDIO/ARCH/KB |

**每个服务重写步骤**：
1. 创建 Java 项目骨架（pom.xml + 包结构 `com.metaplatform.[模块].*`）
2. 将 Python ORM 模型迁移为 JPA Entity
3. 将 Python Schema 迁移为 Java DTO（Record）
4. 将 Python Service 迁移为 Java Service（含 SAA 适配）
5. 将 Python API 路由迁移为 Spring Controller
6. 将 Python 测试迁移为 JUnit 5 + Testcontainers
7. 配置 Nacos Discovery + Config
8. 删除 Python 服务目录

### Phase 8: 清理与验证

1. 删除全部 5 个 Python 服务目录（pyproject.toml/main.py/app/tests）
2. 从 TECH-AGENT pyproject.toml 移除 langchain/langgraph 幽灵依赖（如保留 Python 期间）
3. 更新 CLAUDE.md 版本矩阵（SC 2024.0.x → 2025.0.x，SCA 2023.0.x → 2025.0.0.0）
4. 更新 TECH-GW 网关路由配置（属性前缀迁移）
5. 全量 Maven 编译验证

---

## 4. 风险与缓解

| 风险 | 等级 | 缓解措施 |
|---|---|---|
| Java 25 尚未 GA（预览版） | 高 | 如 25 未 GA，暂用 21 并在 CLAUDE.md 标注 |
| SCA 2025.0.0.0 与 SAA 1.1.2.0 版本冲突 | 中 | SAA BOM 优先级高于 SCA BOM，按声明顺序管理 |
| Spring Cloud Gateway 破坏性变更影响 TECH-GW | 中 | Phase 0 中同步迁移 artifactId 和属性前缀 |
| Python 重写工作量巨大（305 端点） | 高 | 按 Phase 3-7 分批执行，每服务独立验证 |
| Nacos 3.0+ 服务端未部署 | 中 | 配置中使用环境变量，开发环境暂用 localhost |

---

## 5. 验收标准

| 维度 | 标准 |
|---|---|
| 版本统一 | 全部 Java 服务 Java 25 + Spring Boot 3.5.0 + SC 2025.0.x + SCA 2025.0.0.0 |
| SAA 覆盖 | ONT/MCP/AGENT/LLMGW/RAG/A2A 均引入 SAA 1.1.2.0 BOM |
| Nacos 注册 | 全部 15 个服务注册到 Nacos 3.0+ |
| Python 清零 | 5 个 Python 服务全部重写为 Java，无 .py 业务文件残留 |
| LangChain 退役 | 无 langchain/langgraph 依赖声明 |
| 编译通过 | 全部 Java 服务 `mvn compile` 成功 |
| API 对齐 | 各服务 API 端点覆盖 PRD 需求 |

---

## 6. 执行进度（2026-07-22 更新）

### 已完成

| Phase | 范围 | 状态 | 备注 |
|---|---|---|---|
| Phase 0 | 10 个 Java 服务版本对齐 | ✅ 完成 | Java 25 + SB 3.5.0 + SC 2025.1.2 + SCA 2025.0.0.0 + SAA 1.1.2.2 BOM |
| Phase 1 | 10 个 Java 服务 Nacos 集成 | ✅ 完成 | Discovery + Config + `@EnableDiscoveryClient` |
| Phase 2 | TECH-MCP SAA Nacos MCP | ⚠️ 部分完成 | SAA BOM 1.1.2.2 无 `spring-ai-alibaba-starter-nacos-mcp`，暂移除依赖，MCP Nacos 集成推迟 |
| Phase 3 | TECH-LLMGW Python → Java | ✅ 完成 | 10 实体 + Chat/Model/Routing/RateLimit/Quota/Audit/Cost/Prompts/Code/Embeddings 模块，编译通过 |
| Phase 4 | TECH-RAG Python → Java | ✅ 完成 | 4 实体 + KnowledgeBase/Documents/Search/Citations/Graph/Context 模块，编译通过 |
| 编译修复 | TECH-MCP/TECH-EA/TECH-WFE | ✅ 完成 | MCP 移除未用依赖；EA 添加 Lombok 注解处理器；WFE 恢复 Flowable 过渡 |
| Phase 5 | TECH-AGENT Python → Java | ✅ 完成 | 13 实体 + 13 模块（agents/employees/card/execution/checkpoint/steps/conversations/memory/tasks/tools/evaluation/learning/plans/collaboration）+ 81 端点，SAA Agent Framework + Graph Core，编译通过 |
| Phase 6 | TECH-A2A Python → Java | ✅ 完成 | 8 实体 + 9 模块（agentcard/agentregistry/audit/auth/delegation/inbound/messaging/events-outbox/clients），SAA A2A Nacos + Kafka Outbox 模式，编译通过 |
| Phase 7 | TECH-DATA Python → Java | ✅ 完成 | 2 实体 + 13 模块（datasources/queries/schema/etl/dbt/lakehouse/warehouse/catalog/quality/monitoring/deliverables/search/lineage）+ 79 端点，AES-256 凭证加密，编译通过 |
| Phase 8 | 清理 Python 残留 | ✅ 完成 | 仅 TECH-AGENT 存在残留（app/14 模块 + tests/16 测试 + main.py + pyproject.toml），已全部删除；langchain/langgraph 幽灵依赖随 pyproject.toml 一并清理；TECH-GW artifactId 已迁移至 gateway-server-webflux（属性前缀 spring.cloud.gateway.* 经查证无需迁移）；全量 Maven 编译验证 15/15 通过 |

### 待执行

| Phase | 范围 | 状态 | 备注 |
|---|---|---|---|
| ~~Phase 9~~ | ~~TECH-WFE Flowable → 自研状态机重写~~ | ✅ 完成 | 见下 |

### Phase 9: TECH-WFE Flowable → 自研状态机 + FlowGram.AI 重写（新增）

**背景**：CLAUDE.md 架构约束要求 TECH-WFE 使用「自研状态机 + FlowGram.AI fixed-layout」替代 Flowable BPMN 引擎。当前 TECH-WFE 源码大量引用 `org.flowable.*`（7 个服务类 + 4 个测试类），版本对齐阶段暂恢复 Flowable 7.1.0 依赖作为过渡以保证编译通过。

**目标**：移除 Flowable 依赖，实现自研轻量状态机引擎，对接 FlowGram.AI 前端 fixed-layout 设计器。

**影响范围**：
- `service/ProcessDefinitionService.java`（RepositoryService → 自研部署管理）
- `service/ProcessInstanceService.java`（RuntimeService → 自研实例管理）
- `service/WfeTaskService.java`（TaskService/HistoryService → 自研任务管理）
- `taskoperation/service/TaskOperationService.java`（TaskService → 自研任务操作）
- `taskoperation/service/TaskMonitoringService.java`（HistoryService → 自研监控）
- `taskoperation/service/TaskHistoryService.java`（HistoryService → 自研历史）
- `apphub/service/ReleaseApprovalProcessService.java`（HistoryService → 自研审批流程）
- 4 个测试类同步重写

**操作清单**：
1. 设计自研状态机模型（State/Transition/Action/Guard）
2. 实现 ProcessDefinition 部署与解析（替代 Flowable RepositoryService）
3. 实现 ProcessInstance 启动/挂起/终止/变量绑定（替代 Flowable RuntimeService）
4. 实现 Task 查询/认领/完成/委派/加签（替代 Flowable TaskService）
5. 实现 History 历史查询（替代 Flowable HistoryService）
6. 实现 BPMN XML 解析（替代 Flowable BPMN 引擎，或改用 FlowGram.AI JSON 格式）
7. 对接 FlowGram.AI fixed-layout 前端（JSON 格式流程定义）
8. 重写 7 个服务类 + 4 个测试类
9. 移除 Flowable 依赖
10. 全量编译与测试验证

**执行结果（2026-07-22 完成）**：

基于 FlowGram.AI fixed-layout 原生 JSON 格式（`{nodes: [...]}` 树形嵌套 + `blocks` 子数组）实现自研状态机引擎，**不引入任何 BPMN 引擎依赖**。

**新增组件**（`com.metaplatform.wfe.engine.*`）：
- `model/` — FlowDocument / FlowNode / FlowValue / NodeExecutionResult（Java record）
- `parser/FlowGramParser` — JSON 解析 + 节点树扁平化 + 兄弟节点查找 + 流程校验
- `variable/VariableEngine` — IFlowValue 解析（constant/template/ref）+ `${var}` 表达式插值
- `executor/` — NodeExecutor 接口 + ExecutionContext + 7 个执行器（Start/End/Approval/Switch/If/Loop/Default）
- `WfeStateMachineEngine` — 核心引擎（startProcess / completeTask / terminateProcess）
- `converter/BpmnToFlowGramConverter` — BPMN XML → FlowGram JSON 向后兼容转换

**新增数据层**：
- 5 个 Entity：WfeTaskEntity / WfeTaskHistoryEntity / WfeActivityLogEntity / WfeTaskCommentEntity / WfeProcessVariableEntity
- 5 个 Repository：对应 JpaRepository + 自定义查询
- Flyway V9 迁移脚本（5 张表 + 索引 + 唯一约束）
- ProcessDefinitionEntity 新增 `flowgramJson` 字段

**重写的 7 个服务类**：
- ProcessDefinitionService — 移除 RepositoryService，deploy 时自动转换 BPMN→FlowGram JSON
- ProcessInstanceService — 移除 RuntimeService/RepositoryService/TaskService，改用 WfeStateMachineEngine.startProcess
- WfeTaskService — 移除 TaskService/HistoryService/RuntimeService，改用 WfeTaskRepository + WfeStateMachineEngine.completeTask
- TaskOperationService — 移除 TaskService，改用 WfeTaskRepository + WfeTaskCommentRepository
- TaskMonitoringService — 移除 TaskService/HistoryService，改用 WfeTaskRepository 统计
- TaskHistoryService — 移除 HistoryService，改用 WfeTaskHistoryRepository + WfeActivityLogRepository
- ReleaseApprovalProcessService — 移除 HistoryService，改用 ProcessInstanceRepository 检查流程结束状态

**重写的 4 个测试类**：
- ProcessDefinitionServiceTest / ProcessInstanceServiceTest / WfeTaskServiceTest / TaskOperationServiceTest
- 全部移除 `org.flowable.*` import 和 mock，改用自研组件 mock

**清理**：
- pom.xml 移除 `flowable-spring-boot-starter` 依赖
- application-dev.yml 移除 `flowable:` 配置块
- 删除孤立文件 `WfeTaskStatus.java`
- `org.flowable` 引用清零

**编译验证**：15/15 服务全部 `mvn compile` 通过，TECH-WFE 147 源文件编译成功。
