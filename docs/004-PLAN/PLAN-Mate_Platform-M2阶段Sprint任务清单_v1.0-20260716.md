# Mate Platform M2 阶段 Sprint 任务清单与工时估算

> 基于《版本路线图 v2.1》进度摘要，针对阶段一（M2-M4）剩余 Task，拆分为 6 个 Sprint。
>
> 版本：v1.1（已同步 v2.1 路线图实际进度）
>
> 日期：2026-07-16
>
> 工时单位：人天（1 人天 = 8 小时）
>
> 进度摘要：Sprint 1 已完成 10/12 Task，Sprint 2 已完成 2/14，Sprint 3 已完成 2/12，Sprint 5 已完成 1/8。剩余 47 个未完成 Task。

---

## 一、M2 阶段总览

### 1.1 范围

| 类别 | Task 数 | 说明 |
|---|---|---|
| Spike 遗留 | 10 | S-IAM-05、S-LLMGW-04/06、S-GW-01/02、S-MSG-02/03、S-OBS-01、S-DATA-01/02/03 |
| 阶段一 P1-ONT 剩余 | 8 | Neo4j 系列(03~06) + 批量创建(09) + 版本管理(10~12) |
| 阶段一 P1-RULE 全量 | 7 | 含 Spike 7 个 + P1 新增 6 个（实际路线图 Spike S-RULE + P1-RULE） |
| 阶段一 P1-WFE 全量 | 9 | 工作流引擎从零开始 |
| 阶段一 P1-RAG 全量 | 7 | RAG 引擎从零开始 |
| 阶段一 P1-ONTUI 全量 | 5 | APP-ONTSTUDIO 前端 |
| 阶段一 P1-APPHUB 全量 | 6 | APP-APPHUB 前端 |
| 阶段一 P1-OBS 剩余 | 2 | 日志全文搜索 + 指标管理 |
| 阶段一 P1-IAM 剩余 | 4 | 数据权限 + 权限检查 + API Key |
| 阶段一 P1-GW 全量 | 2 | 限流规则 |
| 阶段一 P1-MSG 全量 | 2 | DLQ 管理 |
| **合计** | **~62** | 含 Spike 遗留 + 阶段一剩余 |

### 1.2 工时估算原则

| 任务类型 | 估算基准 | 说明 |
|---|---|---|
| 项目脚手架 | 0.5-1 人天 | 含 pom.xml/pyproject.toml + 启动类 + 配置 + 健康检查 |
| 单表 CRUD（全栈） | 1.5-2 人天 | Entity + Repository + Service + Controller + DTO + Flyway + 单元测试 + Controller 测试 |
| 复杂业务逻辑 | 2-3 人天 | 集成、编排、补偿事务、规则引擎执行 |
| 前端页面 | 1-2 人天/页 | 含组件交互 + API 对接 + 基础样式 |
| 基础设施部署 | 0.5-1 人天 | Docker Compose 编排 + 配置文件 + 健康检查 |
| 集成验证 | 0.5-1 人天 | 端到端联调 + 验收标准检查 |

### 1.3 Sprint 总览

| Sprint | 周期 | 主题 | Task 数 | 预估工时 | 并行度 |
|---|---|---|---|---|---|
| Sprint 1 | 2 周 | 引擎启动：RULE + WFE + MSG Outbox | 12 | 26 人天 | 3 路 |
| Sprint 2 | 2 周 | ONT 进阶 + IAM 补全 + RAG 启动 | 14 | 28 人天 | 3 路 |
| Sprint 3 | 2 周 | 前端启动 + GW + OBS 补全 | 12 | 22 人天 | 3 路 |
| Sprint 4 | 2 周 | WFE 集成 + RULE 进阶 + RAG 检索 | 11 | 24 人天 | 3 路 |
| Sprint 5 | 2 周 | 跨模块集成 + DLQ + API Key | 8 | 18 人天 | 2 路 |
| Sprint 6 | 1 周 | 端到端验证 + 里程碑收尾 | 5 | 10 人天 | 全员 |
| **合计** | **11 周** | - | **62** | **128 人天** | - |

---

## 二、Sprint 1：引擎启动（RULE + WFE + MSG Outbox）

> 周期：第 1-2 周
>
> 目标：TECH-RULE 和 TECH-WFE 脚手架就绪，核心 CRUD 可用；MSG Outbox 基础投递打通
>
> 关键路径：S-MSG-02 -> P1-RULE-03 / P1-WFE-09

### 2.1 任务清单

| # | Task ID | 任务 | 负责模块 | 依赖 | 预估工时 | 状态 | 交付物 |
|---|---|---|---|---|---|---|---|
| 1 | S-RULE-01 | TECH-RULE 项目脚手架（Spring Boot 3.4 + Java 21） | TECH-RULE | 无 | 0.5 | ✅ | pom.xml + 启动类 + application.yml + 健康检查 |
| 2 | S-RULE-02 | 规则集 + 规则定义表结构设计 | TECH-RULE | S-RULE-01 | 1 | ✅ | V1 Flyway 迁移：`rule_ruleset` / `rule_definition` 表 |
| 3 | S-RULE-03 | 规则集 CRUD API（`/api/v1/rule/rulesets`） | TECH-RULE | S-RULE-02 | 2 | ✅ | RulesetController + Service + DTO + 6 测试通过 |
| 4 | S-RULE-04 | 规则定义 CRUD API（`/api/v1/rule/rules`） | TECH-RULE | S-RULE-03 | 2 | ✅ | RuleController + Service + DTO + 5 测试通过 |
| 5 | S-RULE-05 | Ontology 属性引用与校验 | TECH-RULE | S-RULE-04, S-ONT-05 | 2 | ✅ | OntologyReferenceValidator WebClient + 4 测试通过 |
| 6 | S-RULE-06 | 规则集同步执行 API | TECH-RULE | S-RULE-05 | 3 | ✅ | SpEL 表达式引擎 + MapPropertyAccessor + 5 测试通过 |
| 7 | S-RULE-07 | Spike 联调验证：订单≥10万->VIP 规则 | TECH-RULE | S-RULE-06, S-ONT-07 | 1 | ✅ | 集成测试 3 用例通过 |
| 8 | S-MSG-02 | Outbox Relay 核心投递实现 | TECH-MSG | S-MSG-01 | 3 | ✅ | outbox_messages 表 + 定时轮询 + DLQ + 10 测试通过 |
| 9 | S-IAM-05 | IAM Kafka Outbox 基础版 | TECH-IAM | S-MSG-02 | 1.5 | ✅ | V4 迁移 + IamOutboxService + 注册/登录事件 + 2 测试通过 |
| 10 | P1-WFE-01 | TECH-WFE 项目脚手架（Spring Boot 3.4 + Java 21） | TECH-WFE | 无 | 0.5 | ⬜ | pom.xml + 启动类 + application.yml |
| 11 | P1-WFE-02 | 流程定义部署/列表/详情/状态管理 API | TECH-WFE | P1-WFE-01 | 3 | ⬜ | BPMN XML 部署 + Flowable/Camunda 集成 + DTO + 测试 |
| 12 | S-DATA-01 | TECH-DATA 项目脚手架（Python 3.13 + FastAPI） | TECH-DATA | 无 | 0.5 | ✅ | pyproject.toml + main.py + config |

### 2.2 Sprint 1 验收标准

- [x] TECH-RULE 7 个 API 全部可用，`mvn clean test` 通过（23 测试）
- [x] Outbox 消息从 IAM 写入到 Kafka 投递全链路验证通过（24 测试）
- [ ] TECH-WFE BPMN 部署成功，流程定义列表可查
- [x] TECH-DATA 项目可启动，健康检查通过（13 测试）

### 2.3 并行路径

```
路径 A: S-RULE-01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07  （1 人，11.5 天）
路径 B: S-MSG-02 -> S-IAM-05                              （1 人，4.5 天）
路径 C: P1-WFE-01 -> 02  +  S-DATA-01                     （1 人，4 天）
```

---

## 三、Sprint 2：ONT 进阶 + IAM 补全 + RAG 启动

> 周期：第 3-4 周
>
> 目标：Neo4j 图查询就绪；IAM 权限检查 + API Key；RAG 脚手架 + 文档上传
>
> 关键路径：P1-ONT-03 -> 04 -> 05 -> 06

### 3.1 任务清单

| # | Task ID | 任务 | 负责模块 | 依赖 | 预估工时 | 交付物 |
|---|---|---|---|---|---|---|
| 1 | P1-ONT-03 | Neo4j 5.x 图模型设计与初始化 | TECH-ONT | P1-ONT-01 | 2 | docker-compose 新增 Neo4j；节点/边模型；Cypher 初始化脚本 |
| 2 | P1-ONT-04 | PG -> Neo4j 同步（Outbox 模式） | TECH-ONT | P1-ONT-03, S-MSG-02 | 3 | 关系实例写入 PG 后通过 Outbox 事件同步到 Neo4j |
| 3 | P1-ONT-05 | 知识图谱查询 API（`/api/v1/ont/graph/query`） | TECH-ONT | P1-ONT-04 | 2 | Cypher 查询返回节点和边，支持深度限制 |
| 4 | P1-ONT-06 | 图谱统计 API（`/api/v1/ont/graph/stats`） | TECH-ONT | P1-ONT-05 | 1 | 返回节点数/边数/关系类型分布 |
| 5 | P1-ONT-09 | 批量创建实体 API | TECH-ONT | S-ONT-04 | 1.5 | `POST /api/v1/ont/entities/batch`，JSON 数组批量导入 |
| 6 | P1-IAM-03 | 数据权限 API（行级/列级） | TECH-IAM | P1-IAM-01 | 3 | DataScope 枚举落地；行级过滤（SQL WHERE 注入）；列级脱敏 |
| 7 | P1-IAM-04 | 权限检查 API（`/api/v1/iam/permissions/check`） | TECH-IAM | P1-IAM-02 | 2 | `POST /permissions/check`，输入用户+资源+操作返回 allow/deny |
| 8 | P1-IAM-06 | API Key 管理 API（创建/列表/详情） | TECH-IAM | S-IAM-04 | 2 | `iam_api_keys` 表 + CRUD + Key 生成（HMAC-SHA256） |
| 9 | P1-RAG-01 | TECH-RAG 项目脚手架（Python 3.13 + FastAPI） | TECH-RAG | 无 | 0.5 | pyproject.toml + main.py + config |
| 10 | P1-RAG-02 | 知识库 CRUD API + 文档上传（MinIO 存储） | TECH-RAG | P1-RAG-01 | 3 | `knowledge_base` 表 + 文档上传到 MinIO + metadata 入库 |
| 11 | S-DATA-02 | 数据源管理 CRUD（MySQL/PostgreSQL 连接） | TECH-DATA | S-DATA-01 | 2 | ✅ | data_source 表 + CRUD + AES-256 + 连接测试 + 5 测试 |
| 12 | S-DATA-03 | Schema 发现 API（库/表/字段自动发现） | TECH-DATA | S-DATA-02 | 2 | ✅ | 3 级 API + information_schema + 8 测试 |
| 13 | S-LLMGW-04 | 流式对话 SSE API | TECH-LLMGW | S-LLMGW-03 | 2 | ⬜ | `POST /api/v1/llmgw/chat/stream`，SSE 流式输出 |
| 14 | S-LLMGW-06 | 与 TECH-IAM 鉴权集成（完整 JWT） | TECH-LLMGW | S-IAM-04 | 1.5 | ⬜ | 从 JWT Bearer Token 解析 tenantId/userId |

### 3.2 Sprint 2 验收标准

- [ ] Neo4j 容器启动，PG 写入关系后 Neo4j 同步可见
- [ ] 图谱查询 API 返回正确节点/边
- [ ] IAM 权限检查 API 可用，API Key 创建后可用于鉴权
- [ ] RAG 文档上传到 MinIO，metadata 入库
- [ ] TECH-DATA 可连接外部数据源并返回 Schema

### 3.3 并行路径

```
路径 A: P1-ONT-03 -> 04 -> 05 -> 06 -> 09                 （1 人，9.5 天）
路径 B: P1-IAM-03 -> 04 -> 06                              （1 人，7 天）
路径 C: P1-RAG-01 -> 02  +  S-DATA-02 -> 03  +  S-LLMGW-04/06 （1 人，11 天）
```

---

## 四、Sprint 3：前端启动 + GW + OBS 补全

> 周期：第 5-6 周
>
> 目标：APP-ONTSTUDIO + APP-APPHUB 前端脚手架就绪；网关限流；OBS 指标管理
>
> 并行度：前端 2 路 + 后端 1 路

### 4.1 任务清单

| # | Task ID | 任务 | 负责模块 | 依赖 | 预估工时 | 交付物 |
|---|---|---|---|---|---|---|
| 1 | P1-ONTUI-01 | 前端脚手架（React 19 + Vite 6 + Ant Design 6.0） | APP-ONTSTUDIO | 无 | 1 | 项目可运行，路由配置，API 拦截器带 JWT |
| 2 | P1-ONTUI-02 | 概念管理页面（列表/创建/编辑/删除） | APP-ONTSTUDIO | P1-ONTUI-01, S-ONT-03 | 2 | 概念 CRUD 页面 + 概念树展示 |
| 3 | P1-ONTUI-03 | 属性管理面板（概念下属性 CRUD） | APP-ONTSTUDIO | P1-ONTUI-02, S-ONT-05 | 1.5 | 属性列表 + 添加/编辑弹窗 |
| 4 | P1-ONTUI-04 | 实体管理页面 | APP-ONTSTUDIO | P1-ONTUI-02, S-ONT-04 | 2 | 选择概念 -> 创建实体 -> 填写属性值 |
| 5 | P1-ONTUI-05 | 基础搜索 | APP-ONTSTUDIO | P1-ONTUI-02 | 1 | 搜索框 + 结果高亮 |
| 6 | P1-APPHUB-01 | 前端脚手架（React 19 + Vite 6 + Ant Design 6.0） | APP-APPHUB | 无 | 1 | 项目可运行 |
| 7 | P1-APPHUB-02 | 应用管理 CRUD | APP-APPHUB | P1-APPHUB-01 | 1.5 | 应用 CRUD 页面 |
| 8 | P1-APPHUB-03 | 模块管理 | APP-APPHUB | P1-APPHUB-02 | 1.5 | 创建表单模块并关联应用 |
| 9 | P1-APPHUB-04 | 表单设计器基础组件 | APP-APPHUB | P1-APPHUB-03 | 3 | 拖拽 7 种组件到画布 + 属性配置 |
| 10 | S-GW-01 | Spring Cloud Gateway 脚手架 + 路由管理 CRUD | TECH-GW | S-IAM-04 | 2 | ✅ | 端口 8000 + 6 条静态路由 + 动态路由 + 7 测试通过 |
| 11 | S-GW-02 | JWT 认证集成 + 白名单 | TECH-GW | S-GW-01, S-IAM-04 | 1.5 | ✅ | GlobalFilter JWT + 头透传 + 白名单 + 6 测试通过 |
| 12 | P1-OBS-04 | 指标管理 API（Prometheus + Grafana 编排） | TECH-OBS | S-OBS-01 | 3 | ⬜ | docker-compose 新增 Prometheus + Grafana；PromQL 查询 |

### 4.2 Sprint 3 验收标准

- [ ] APP-ONTSTUDIO 5 个页面功能完整，API 对接正确
- [ ] APP-APPHUB 表单设计器可拖拽 7 种组件
- [x] 网关启动后所有服务通过网关访问，JWT 鉴权生效（13 测试通过）
- [ ] Prometheus 采集指标，Grafana 仪表板可访问

### 4.3 并行路径

```
路径 A: P1-ONTUI-01 -> 02 -> 03 -> 04 -> 05              （1 人，7.5 天）
路径 B: P1-APPHUB-01 -> 02 -> 03 -> 04                    （1 人，7 天）
路径 C: S-GW-01 -> 02  +  P1-OBS-04                        （1 人，6.5 天）
```

---

## 五、Sprint 4：WFE 集成 + RULE 进阶 + RAG 检索

> 周期：第 7-8 周
>
> 目标：工作流审批链路可用；规则引擎版本管理；RAG 向量检索 + 混合检索
>
> 关键路径：P1-WFE-03 -> 04 -> 05 -> 06/07/08/09

### 5.1 任务清单

| # | Task ID | 任务 | 负责模块 | 依赖 | 预估工时 | 交付物 |
|---|---|---|---|---|---|---|
| 1 | P1-WFE-03 | 流程实例发起/列表/详情/终止 API | TECH-WFE | P1-WFE-02 | 2 | 发起实例 + 状态流转 + 查询 |
| 2 | P1-WFE-04 | 待办/已办任务查询 API | TECH-WFE | P1-WFE-03 | 1.5 | 按用户/角色查询待办 |
| 3 | P1-WFE-05 | 审批操作 API（同意/拒绝/转交/退回） | TECH-WFE | P1-WFE-04 | 3 | 4 种审批操作 + 任务流转 |
| 4 | P1-WFE-06 | TECH-IAM 集成（审批人解析） | TECH-WFE | P1-WFE-05, S-IAM-06 | 1.5 | 按角色/部门解析审批人 |
| 5 | P1-WFE-07 | TECH-RULE 集成（网关条件路由） | TECH-WFE | P1-WFE-05, P1-RULE-02 | 2 | 排他网关调用规则引擎决策 |
| 6 | P1-WFE-08 | TECH-ONT 集成（流程变量绑定业务对象） | TECH-WFE | P1-WFE-03, P1-ONT-02 | 1.5 | 流程变量引用 Ontology 实体 |
| 7 | P1-WFE-09 | Kafka 任务事件发布（Outbox） | TECH-WFE | P1-WFE-05, S-MSG-02 | 1.5 | TASK_CREATED/COMPLETED/REJECTED 事件 |
| 8 | P1-RULE-01 | 规则优先级与启用/禁用管理 | TECH-RULE | S-RULE-07 | 1 | 优先级排序 + 启停切换 |
| 9 | P1-RULE-02 | 规则集同步执行引擎（Drools 集成） | TECH-RULE | S-RULE-06 | 2 | Drools KieSession 集成 |
| 10 | P1-RAG-03 | 文档分块 + Embedding 生成 | TECH-RAG | P1-RAG-02, S-LLMGW-05 | 2 | 分块策略 + 调用 LLMGW 批量 Embedding |
| 11 | P1-RAG-04 | Milvus 2.5 向量检索 API | TECH-RAG | P1-RAG-03 | 2 | docker-compose 新增 Milvus；Top-K 检索 |

### 5.2 Sprint 4 验收标准

- [ ] 部署审批流程 -> 发起实例 -> 审批流转 -> 任务事件发布 全链路通过
- [ ] 规则集按优先级执行，支持启停
- [ ] 文档上传 -> 分块 -> Embedding -> Milvus 向量检索链路通

### 5.3 并行路径

```
路径 A: P1-WFE-03 -> 04 -> 05 -> 06 -> 07 -> 08 -> 09   （1 人，13 天）
路径 B: P1-RULE-01 -> 02                                   （1 人，3 天）
路径 C: P1-RAG-03 -> 04                                     （1 人，4 天）
```

---

## 六、Sprint 5：跨模块集成 + DLQ + API Key + RAG 混合检索

> 周期：第 9-10 周
>
> 目标：DLQ 管理；API Key 吊销；RAG 混合检索 + Rerank；规则版本管理
>
> 关键路径：P1-RAG-05 -> 06

### 6.1 任务清单

| # | Task ID | 任务 | 负责模块 | 依赖 | 预估工时 | 交付物 |
|---|---|---|---|---|---|---|
| 1 | S-MSG-03 | 消费者组管理 + 消费确认 | TECH-MSG | S-MSG-01 | 2 | ✅ | msg_consumer_group 表 + CRUD + AdminClient lag + ack + 10 测试 |
| 2 | P1-MSG-01 | DLQ 管理 API（列表/详情/重发/批量重发） | TECH-MSG | S-MSG-03 | 2.5 | `GET /api/v1/msg/dlq` + 单条/批量重发 |
| 3 | P1-MSG-02 | DLQ 重试策略与清理 API | TECH-MSG | P1-MSG-01 | 1.5 | 重试次数/间隔配置 + 过期消息清理 |
| 4 | P1-IAM-07 | API Key 管理 API（吊销/权限配置） | TECH-IAM | P1-IAM-06 | 1.5 | 吊销 + 权限范围绑定 |
| 5 | P1-RULE-03 | 规则执行事件发布（Kafka Outbox） | TECH-RULE | P1-RULE-02, S-MSG-02 | 1.5 | RULE_EXECUTED 事件发布 |
| 6 | P1-RULE-04 | Ontology 关系引用支持 | TECH-RULE | P1-RULE-02, P1-ONT-02 | 2 | 条件引用关系路径 |
| 7 | P1-RAG-05 | 关键词检索（BM25）+ 混合检索（RRF 融合） | TECH-RAG | P1-RAG-04 | 3 | BM25 + 向量 RRF 融合排序 |
| 8 | P1-RAG-06 | 检索参数配置 + Rerank 模型集成 | TECH-RAG | P1-RAG-05 | 2 | Top-K/阈值可配 + Rerank 调用 |

### 6.2 Sprint 5 验收标准

- [ ] DLQ 消息可查看、重发、配置重试策略
- [ ] API Key 可吊销，权限范围可配置
- [ ] 规则执行事件发布到 Kafka，含 trace_id
- [ ] RAG 混合检索质量优于纯向量检索

### 6.3 并行路径

```
路径 A: S-MSG-03 -> P1-MSG-01 -> 02  +  P1-IAM-07         （1 人，7.5 天）
路径 B: P1-RULE-03 -> 04                                    （1 人，3.5 天）
路径 C: P1-RAG-05 -> 06                                     （1 人，5 天）
```

---

## 七、Sprint 6：版本管理 + 端到端验证

> 周期：第 11 周
>
> 目标：ONT 版本管理 + RULE 版本管理 + RAG 事件发布 + 全链路里程碑验证
>
> 全员集中验证

### 7.1 任务清单

| # | Task ID | 任务 | 负责模块 | 依赖 | 预估工时 | 交付物 |
|---|---|---|---|---|---|---|
| 1 | P1-ONT-10 | 本体版本管理 - 快照与列表 API | TECH-ONT | P1-ONT-06 | 2 | `POST /api/v1/ont/snapshots` + 列表 + 详情 |
| 2 | P1-ONT-11 | 本体版本管理 - 对比与回滚 API | TECH-ONT | P1-ONT-10 | 2 | 版本 diff + 回滚 |
| 3 | P1-ONT-12 | 本体版本管理 - 发布与当前版本 API | TECH-ONT | P1-ONT-10 | 1 | 发布 + 查询当前版本 |
| 4 | P1-RULE-05 | 规则集版本管理 API（创建/列表/详情） | TECH-RULE | P1-RULE-01 | 2 | `rule_ruleset_version` 表 + CRUD |
| 5 | P1-RAG-07 | Kafka 检索事件发布（Outbox） | TECH-RAG | P1-RAG-04, S-MSG-02 | 1.5 | RETRIEVAL_REQUESTED/COMPLETED 事件 |
| 6 | P1-OBS-03 | 日志全文搜索 | TECH-OBS | P1-OBS-02 | 1.5 | 关键词高亮 + 正则匹配 |
| 7 | P1-APPHUB-05 | 表单属性配置（标签/占位符/必填校验） | APP-APPHUB | P1-APPHUB-04 | 1 | 组件属性面板 |
| 8 | P1-APPHUB-06 | 表单预览与基础发布 | APP-APPHUB | P1-APPHUB-05 | 1 | 预览 -> 发布 -> 生成链接 |
| 9 | - | M1-VERIFY-01: Ontology 建模链路验证 | 全部 | P1-ONT-06, P1-ONTUI-05 | 1 | 端到端验证报告 |
| 10 | - | M1-VERIFY-02: 规则引擎链路验证 | 全部 | P1-RULE-04, P1-RULE-06 | 0.5 | 端到端验证报告 |
| 11 | - | M1-VERIFY-03: 工作流链路验证 | 全部 | P1-WFE-09 | 0.5 | 端到端验证报告 |
| 12 | - | M1-VERIFY-04: RAG 检索链路验证 | 全部 | P1-RAG-06 | 0.5 | 端到端验证报告 |
| 13 | - | M1-VERIFY-05: 权限体系验证 | 全部 | P1-IAM-04, P1-IAM-07 | 0.5 | 端到端验证报告 |
| 14 | - | M1-VERIFY-06: 基础设施验证 | 全部 | P1-GW-02, P1-MSG-02, P1-OBS-04 | 0.5 | 端到端验证报告 |

### 7.2 Sprint 6 验收标准

- [ ] ONT 版本快照/对比/回滚/发布全部可用
- [ ] RULE 版本管理可用
- [ ] 6 个 M1 里程碑验证全部通过

---

## 八、工时汇总

### 8.1 按模块汇总

| 模块 | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 | Sprint 6 | 合计 |
|---|---|---|---|---|---|---|---|
| TECH-RULE | 11.5 | - | - | 3 | 3.5 | 2 | 20 |
| TECH-WFE | 3.5 | - | - | 13 | - | - | 16.5 |
| TECH-ONT | - | 9.5 | - | - | - | 5 | 14.5 |
| TECH-IAM | 1.5 | 7 | - | - | 1.5 | - | 10 |
| TECH-RAG | - | 3.5 | - | 4 | 5 | 1.5 | 14 |
| TECH-MSG | 3 | - | - | - | 6 | - | 9 |
| TECH-OBS | - | - | 3 | - | - | 1.5 | 4.5 |
| TECH-GW | - | - | 3.5 | - | - | - | 3.5 |
| TECH-LLMGW | - | 3.5 | - | - | - | - | 3.5 |
| TECH-DATA | 0.5 | 4 | - | - | - | - | 4.5 |
| APP-ONTSTUDIO | - | - | 7.5 | - | - | - | 7.5 |
| APP-APPHUB | - | - | 7 | - | - | 2 | 9 |
| 端到端验证 | - | - | - | - | - | 3.5 | 3.5 |
| **合计** | **20** | **27.5** | **21** | **20** | **16** | **15.5** | **120** |

### 8.2 按人员汇总（3 人团队）

| 人员 | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 | Sprint 5 | Sprint 6 | 合计 |
|---|---|---|---|---|---|---|---|
| 后端 A（RULE/ONT） | 11.5 | 9.5 | - | 3 | 3.5 | 7 | 34.5 |
| 后端 B（WFE/MSG/IAM） | 4.5 | 7 | 6.5 | 13 | 7.5 | - | 38.5 |
| 后端 C（RAG/DATA/LLMGW/OBS） | 4 | 11 | - | 4 | 5 | 1.5 | 25.5 |
| 前端 D（ONTSTUDIO） | - | - | 7.5 | - | - | - | 7.5 |
| 前端 E（APPHUB） | - | - | 7 | - | - | 2 | 9 |
| 验证（全员） | - | - | - | - | - | 3.5 | 3.5 |
| **合计** | **20** | **27.5** | **21** | **20** | **16** | **15.5** | **120** |

> 说明：前端 D/E 在 Sprint 1-2 可参与后端 Code Review 或前端预研，Sprint 4-5 可参与集成测试。3 人后端 + 2 人前端团队 11 周可完成全部 M2 阶段任务。

### 8.3 关键路径估算

```
S-MSG-02 (3天) -> P1-ONT-04 (3天) -> P1-ONT-05 (2天) -> P1-ONT-06 (1天) -> P1-ONT-10 (2天) -> P1-ONT-11 (2天) -> M1-VERIFY-01 (1天)
                                                                                                              = 14 天（关键路径）
S-RULE-01 -> ... -> S-RULE-07 (11.5天) -> P1-RULE-02 (2天) -> P1-RULE-04 (2天) -> M1-VERIFY-02 (0.5天)
                                                                                                              = 16 天
P1-WFE-01 -> ... -> P1-WFE-09 (13天, Sprint 4) -> M1-VERIFY-03 (0.5天)
                                                                                                              = 13.5 天
P1-RAG-01 -> ... -> P1-RAG-06 (10.5天) -> M1-VERIFY-04 (0.5天)
                                                                                                              = 11 天
```

---

## 九、风险与缓解

| 风险 | 影响 Sprint | 概率 | 缓解措施 |
|---|---|---|---|
| Neo4j + PG 双写一致性 | Sprint 2 | 中 | Outbox 模式 + 定期一致性校验脚本 |
| Drools 集成复杂度 | Sprint 1/4 | 中 | 可先用轻量表达式引擎（MVEL/SpEL）替代，Drools 延后 |
| Flowable/Camunda 选型 | Sprint 1 | 低 | Sprint 1 第 1 天确定选型，推荐 Flowable（社区活跃） |
| Milvus 2.5 大规模性能 | Sprint 4 | 低 | 先用 10 万向量验证，100 万压测延后到 M3 |
| 前端 2 人在 Sprint 1-2 空闲 | Sprint 1-2 | 高 | 安排前端预研 FlowGram.AI + AntV X6 |
| 工时估算偏差 ±20% | 全程 | 中 | 每个 Sprint 末做回顾，调整后续估算 |

---

## 十、Sprint 依赖关系图

```
Sprint 1 ──────────────────────────────────────────────────
  S-MSG-02 ──┬──> S-IAM-05
             ├──> P1-ONT-04 (Sprint 2)
             ├──> P1-RULE-03 (Sprint 5)
             ├──> P1-WFE-09 (Sprint 4)
             └──> P1-RAG-07 (Sprint 6)
  S-RULE-01..07 ──> P1-RULE-01/02 (Sprint 4)
                              └──> P1-RULE-03/04 (Sprint 5)
                                    └──> P1-RULE-05 (Sprint 6)
  P1-WFE-01/02 ──> P1-WFE-03..09 (Sprint 4)
  S-DATA-01 ──> S-DATA-02/03 (Sprint 2)

Sprint 2 ──────────────────────────────────────────────────
  P1-ONT-03 ──> 04 ──> 05 ──> 06 ──> P1-ONT-10/11/12 (Sprint 6)
  P1-IAM-03/04/06 ──> P1-IAM-07 (Sprint 5)
  P1-RAG-01/02 ──> P1-RAG-03/04 (Sprint 4) ──> P1-RAG-05/06 (Sprint 5)

Sprint 3 ──────────────────────────────────────────────────
  P1-ONTUI-01..05 ──> M1-VERIFY-01 (Sprint 6)
  P1-APPHUB-01..04 ──> P1-APPHUB-05/06 (Sprint 6)
  S-GW-01/02 ──> P1-GW-01/02 (可并行 Sprint 5)
  P1-OBS-04 ──> M1-VERIFY-06 (Sprint 6)

Sprint 4 ──────────────────────────────────────────────────
  P1-WFE-03..09 ──> M1-VERIFY-03 (Sprint 6)
  P1-RULE-01/02 ──> P1-RULE-03/04 (Sprint 5)
  P1-RAG-03/04 ──> P1-RAG-05/06 (Sprint 5)

Sprint 5 ──────────────────────────────────────────────────
  P1-MSG-01/02 ──> M1-VERIFY-06 (Sprint 6)
  P1-IAM-07 ──> M1-VERIFY-05 (Sprint 6)
  P1-RAG-05/06 ──> M1-VERIFY-04 (Sprint 6)

Sprint 6 ──────────────────────────────────────────────────
  全部里程碑验证
```
