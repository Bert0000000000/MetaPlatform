# MetaPlatform — AI 助手工作准则

> **本文件用途**：所有 AI 助手（Claude/Trae/其他）在 MetaPlatform 项目执行任何任务之前，**必须先读本文件**。
> **维护者**：项目架构组
> **关联规范**：[`docs/tech-architecture/05-tech-selection-matrix.md`](./docs/tech-architecture/05-tech-selection-matrix.md)（技术选型权威源）

---

## 0. 启动清单 (Start-of-Session Checklist)

每次接到新需求，先按顺序完成下面 4 步，再动手写代码：

1. **读本文件**（CLAUDE.md）→ 确认目标、范围、模块归属
2. **读技术选型矩阵** [`docs/tech-architecture/05-tech-selection-matrix.md`](./docs/tech-architecture/05-tech-selection-matrix.md) → 确认栈版本与备选方案
3. **读对应版本的 sprint plan** → `docs/v1.0.x/<version>/02-sprint-plan.md` → 确认本期任务边界
4. **读相关子模块文档**（user-stories / app-service-architecture / 任何最近的 *-formily.md / 迁移文档）

如果用户给的指令与上述任一文件冲突，**以本文档为准，先沟通再修改**。

---

## 1. 平台定位

| 项目 | 描述 |
|---|---|
| **名称** | MetaPlatform |
| **代号** | 企业级 AI 中台产品 — Schema 驱动的低代码平台 |
| **核心定位** | 用户用「拖拽 + 自然语言」即可构建企业级业务应用；表单/列表/流程/数据/AI 全部贯通 |
| **当前版本** | v1.0.2「Link+Export」（进行中）|
| **目标周期** | v1.0.x 系列 60-78 周 / v1.1+ 加入 AI 助手与 GraphRAG |

---

## 2. 核心架构 — 9 层模型（速览）

完整版见 [`docs/tech-architecture/01-nine-layer-architecture.md`](./docs/tech-architecture/01-nine-layer-architecture.md)。

```
┌──────────────────────────────────────────────────────────────┐
│ L1-1  User / AI 对话层       │ 自然语言 / 多模态 / 拖拽 / 协同 │
│ L1-2  应用 / 场景市场 (G4)    │ 行业模板 / 应用市场 (v0.2)      │
│ L1-3  页面 / 表单生成器 (G1)  │ Schema 驱动 UI / 拖拽 / NL 页面 │
│ L1-4  流程自动化 (G4)         │ BPMN / 触发器 / AI 节点 / SLA  │
│ L2-1  业务对象层 (G2)         │ 业务对象 / 字段 / 规则 / 视图   │
│ L2-2  本体引擎 + 知识图谱     │ 实体/属性/关系 + Neo4j + 推理    │
│ L2-3  数据/知识统一层         │ RAG + 非结构 + MDM + 湖 + 仓     │
│ L3-1  AI Substrate (基质)     │ LLM/Embedding/Vector/Agent     │
│ L3-2  能力库 (G3)             │ 邮件/短信/OCR/翻译/...          │
│ L3-3  平台底座                │ 多租户/权限/审计/Integration  │
│ L3-4  存储 / 基础设施         │ PG/Neo4j/Milvus/MinIO/Kafka   │
│ L3-5  部署 / 交付             │ K8s + Helm + 多云 + 信创       │
└──────────────────────────────────────────────────────────────┘
```

**关键判断**：AI Substrate 不是单独一层，而是「渗透」在 L1-1/1-3/1-4/2-1/2-2/2-3 的基质。

---

## 3. 技术选型（最终决策 — 与 `docs/tech-architecture/05-tech-selection-matrix.md` 完全对齐）

> 本节是 §5 技术选型矩阵的**精简快查表**。涉及技术决策时，**必须**回查原文确认备选方案、风险评估、退出成本。

### 3.1 后端 / 中间件

| # | 组件 | 选型 | 退出成本 | 备注 |
|---|---|---|---|---|
| 1 | 后端主语言 | **Java 21** (业务) + **Go 1.22** (数据/网关) + **Python 3.12** (AI) | 中 | 多语言混用，按能力选 |
| 2 | Web 框架 | **Spring Boot 3** | 低 | Java 主框架 |
| 3 | 图数据库 | **Neo4j 5** (5 千万节点内免费) | 中 | 超过评估华为 GES |
| 4 | 关系数据库 | **PostgreSQL 16** | 中 | 主库 (Citus 扩展 + JSONB) |
| 5 | 向量数据库 | **Milvus 2.4** | 中 | 中文支持好 + 性能 |
| 6 | 数据湖 | **Apache Hudi** | 中 | Update/Delete 强 + Doris 集成 |
| 7 | 数据仓库 | **Apache Doris 2.0** + ClickHouse 24 适配器 (D13 双轨) | 高 | 实时数仓 + 外部数仓接入 |
| 8 | 对象存储 | **MinIO** | 低 | 私有化部署友好 |
| 9 | 消息队列 | **Apache Kafka 3.6** | 中 | 生态最成熟 |
| 10 | 缓存 | **Redis 7 Cluster** | 低 | |
| 11 | 搜索引擎 | **Elasticsearch 8** | 中 | |
| 12 | BPMN 引擎 | **Flowable 7** | 高 | 社区版完整 + Spring 集成好 |
| 13 | **低代码前端** | **Formily 2** | 中 | 性能 + 生态 (v1.0.2 全量切换) |
| 14 | 大模型框架 | **LangChain 0.3** | 低 | |
| 15 | Agent 框架 | **LangGraph 0.2** | 中 | 可控性最强 |
| 16 | LLM Gateway | **自研 (Go) + LiteLLM 兜底** | 高 | 国产化 + 成本控制 |
| 17 | Embedding | **BGE-M3** | 低 | 中文好 + 开源 |
| 18 | API 网关 | **Apache APISIX** | 中 | 性能 + 中文社区 |

### 3.2 平台 / 工程

| # | 组件 | 选型 |
|---|---|---|
| 19 | 认证 | **Keycloak** |
| 20 | 鉴权 | **Casbin** |
| 21 | 集成 | **Apache NiFi 2** |
| 22 | 容器化 | **Docker + K8s 1.29** |
| 23 | GitOps | **ArgoCD** |
| 24 | IaC | **Terraform** |
| 25 | 监控 | **Prometheus + Grafana** |
| 26 | 日志 | **Loki + Vector** |
| 27 | 追踪 | **Tempo + OpenTelemetry** |
| 28 | 镜像仓库 | **Harbor** |
| 29 | 规则引擎 | **Drools 8** + **Aviator 5** |
| 30 | 能力沙箱 | **Wasmtime** |

### 3.3 当前仓库实际技术栈 (v1.0.2 现状)

| 层 | 实际组件 | 端口 | 说明 |
|---|---|---|---|
| 前端 | **React 19 + TypeScript 5 + Vite 7 + Tailwind 4 + shadcn/ui + Formily 2** | **5173** | Formily 2 已全量切换 (v1.0.2) |
| 后端 API | **Node.js 22 + Express 4 + better-sqlite3** | **3001** | 27 路由模块 + 64 API 端点 + 54 表 |
| 应用服务 | **Java 21 + Spring Boot 3 + PostgreSQL 16** | **8092** | 动态表 + DDL + FilterParser + 关联字段 |
| 本体引擎 | Java + Spring Boot 3 + Neo4j 5 | 8090 | 25 字段类型 + 校验引擎 |
| 页面生成器 | Java + Spring Boot 3 | 8083 | TABLE/FORM/KANBAN |
| AI Substrate | Python (LangChain 0.3) | - | LLM/Embedding/Agent |
| Data Stack | Go 1.22 + Doris + ClickHouse | - | v0.2 骨架 |

### 3.4 ⚠️ v1.0.2 已完成的栈迁移

- **前端**：移除自研 `PublicForm.tsx`、`FormRenderer.tsx`、`FormEditor.tsx`，**全量切换到 Formily 2**
  - `FormItem` (decorator) + `TextField/NumberField/SelectField/...` (component) 通过 `connect + mapProps` 接入
  - `x-reactions` 用于字段联动 (lookup 选中后显隐其他字段)
  - 9 种 FilterOp UI (ListPageEditor)、LookupField (PublicForm)
  - 详见 `docs/v1.0.x/v1.0.2/formily-integration.md` / `formily-reactions.md` / `listpage-formily.md`

---

## 4. 仓库结构（关键目录）

```
MetaPlatform/
├── metaplatform-frontend/              # React 19 前端 (port 5173)
│   ├── src/components/formily/         # Formily 2 组件 + schemaAdapter + FilterRow + filterSerializer
│   ├── src/pages/PublicForm.tsx        # 已 Formily 化 (F1.4)
│   ├── src/pages/apps/editors/         # ListPageEditor / FormLowCodeEditor / ObjectFieldPanel
│   ├── src/lib/api.ts                  # API 客户端层
│   └── vite.config.ts                  # 含所有 /api/* → 3001 的 proxy 规则
│
├── metaplatform-app-service/           # Java Spring Boot (port 8092)
│   └── src/main/java/.../domain/
│       ├── app/                        # 应用、表单
│       ├── object/                     # 对象、字段
│       ├── form/                       # FormDataController (动态表数据 + filter/sort)
│       └── dynamic/                    # FilterParser / DynamicTableService / LookupDdlBuilder
│
├── metaplatform-api/                   # Node.js Express (port 3001)
│   ├── src/index.js                    # 入口
│   ├── src/routes/auth.js              # /api/auth/login (使用 email 字段)
│   └── src/routes/apps.js              # /api/apps/* (应用中心)
│
├── metaplatform-ontology-engine/       # Java 本体引擎 (port 8090)
├── metaplatform-page-generator/        # Java 页面生成器 (port 8083)
├── metaplatform-ai-substrate/          # Python AI 基质
├── metaplatform-data-stack/            # Go 数据栈
├── metaplatform-capability-library/    # Java 能力库
├── metaplatform-dialogue/              # Java 对话
│
├── docs/
│   ├── tech-architecture/              # §1~§6 技术架构 (权威源)
│   │   ├── 01-nine-layer-architecture.md
│   │   ├── 02-deployment-topology.md
│   │   ├── 03-data-flow.md
│   │   ├── 04-cross-cutting-concerns.md
│   │   ├── 05-tech-selection-matrix.md ← 选型权威源
│   │   └── 06-non-functional-requirements.md
│   ├── v1.0.x/v1.0.2/                  # 当前 sprint 文档
│   │   ├── 01-user-stories.md
│   │   ├── 02-sprint-plan.md           ← 当前任务总览
│   │   ├── formily-integration.md
│   │   ├── formily-reactions.md
│   │   ├── listpage-formily.md
│   │   ├── publicform-formily-fullcutover.md
│   │   └── sprint1-backend-summary.md
│   ├── brainstorm/                     # 早期设计 brainstorm
│   ├── spike/                          # 集成 spike 报告
│   ├── superpowers/plans/              # v0.1 ~ v0.2 各模块 plan
│   ├── artifacts/                      # 设计、验证 artifacts
│   └── *.md                            # 商业计划书 / Roadmap / 菜单设计
│
├── deploy/                             # K8s + Helm + ArgoCD
├── bruno/                              # API 端到端测试 (Bruno collection)
├── tools/                              # PowerShell e2e 脚本 (.ps1)
│
├── docker-compose.yml                  # dev compose
├── README.md                           # 顶层 README
└── CLAUDE.md                           ← 本文件
```

---

## 5. 核心模块与功能清单（12 个一级菜单）

| # | 模块 | 路径 | 主要功能 |
|---|---|---|---|
| 1 | 工作台 | `/dashboard` | 统计概览、最近活动、公告、推荐 |
| 2 | **应用中心** | `/apps` | 应用列表、创建、编辑、部署 — **当前 sprint 重点** |
| 3 | 超级 AI | `/superai` | AI 对话、智能体、任务管理、知识库 |
| 4 | 架构中心 | `/architecture` | 业务/应用/数据/技术架构、价值链编辑 |
| 5 | 流程中心 | `/process` | 流程定义、BPMN 设计器、流程实例 |
| 6 | 数据中心 | `/data` | 数据源、ETL、质量规则、NL2SQL |
| 7 | 本体引擎 | `/ontology` | 对象、属性、关系、动作、安全规则 |
| 8 | 知识库 | `/knowledge` | 文档、搜索、QA、图谱、处理任务 |
| 9 | 质量中心 | `/quality` | 测试用例、Bug、AI 修复、报告 |
| 10 | 云市场 | `/market` | 模板、开发者、Skill、工作流 |
| 11 | 数字员工 | `/agents` | 数字员工、技能广场、协作、监控 |
| 12 | 后台管理 | `/admin` | 用户、角色、部门、配置、LLM |

---

## 6. 当前任务定位 (v1.0.2 Sprint 2 进度)

**版本目标**：v1.0.2「Link+Export」— 关联字段 + 高级列表 + 导入导出

**Sprint 2 已完成**：
- F1.1 ObjectFieldPanel 关联字段类型 UI
- F1.3 FormLowCodeEditor lookup 字段拖入 → 目标对象选择器
- F1.4 PublicForm lookup 字段运行时下拉框渲染
- F1.4b/4c x-reactions 联动 + 完全 Formily 切换

**Sprint 2 进行中**：
- F1.5~F1.10 ListPageEditor 全量 Formily 化 — **9 操作符过滤器 + 排序 + URL 同步**

**后续 Sprint**：
- Sprint 3：导入导出 (CSV + 模板)
- Sprint 4：行级权限 + 多列布局
- Sprint 5：性能优化 + E2E

完整任务清单：[`docs/v1.0.x/v1.0.2/02-sprint-plan.md`](./docs/v1.0.x/v1.0.2/02-sprint-plan.md)

---

## 7. 关键约束与原则 (Hard Rules)

### 7.1 技术决策

- **任何引入新框架/库的 PR**，必须先在 §5 矩阵中确认；如选型矩阵没有该组件，则**默认拒绝**（除非明确论证）
- **优先级**：Java (业务) > Go (数据/网关) > Python (AI)
- **前端**：React 19 + Formily 2（已锁定）；**禁止**引入新的 UI 框架（am-ui / Element Plus / 自研）
- **数据库**：PostgreSQL 16 主库；动态表（应用数据）走 Hudi + Doris

### 7.2 编码

- **TypeScript strict mode** (前端) — 不允许 `any`
- **Java 21 + virtual threads** — 优先使用
- **OpenAPI 优先** — 接口先在 `metaplatform-api/src/openapi.js` 注册，再写路由
- **单测 ≥ 80% 覆盖**（核心模块），单测和实现同步提交

### 7.3 架构红线

- **禁止**前端绕过 vite proxy 直接访问 8090/8092/3001（必须走 5173 → vite proxy）
- **禁止**动态表使用 JSON 字段存关键业务数据（必须建列；DDL 由 LookupDdlBuilder 管理）
- **禁止**跨域跨服务调用 — 只能前端 → vite proxy → 对应后端
- **安全**：所有 user-facing SQL 走 FilterParser 白名单 `^[a-z][a-z0-9_]{0,62}$`
- **多租户**：每个查询必须带 `tenantId` (X-Tenant-Id header)

### 7.4 测试与文档

- **每个 sprint 任务必须产出**：(1) 代码 (2) 单测 (3) e2e 脚本 (PowerShell) (4) 文档更新
- **任何 sprint 完成必须更新**：`02-sprint-plan.md` ☑ 标记 + 一份 `*-formily.md` 或 `sprint{N}-backend-summary.md` 总结文档
- **架构变更**：必须更新 [`docs/tech-architecture/`](./docs/tech-architecture/) 对应章节

### 7.5 命名约定

- **目录**：kebab-case (`formily`, `object-field-panel`)
- **React 组件**：PascalCase (`ListPageEditor.tsx`)
- **测试文件**：`<name>.test.ts` 或 `<name>.test.tsx`
- **e2e 脚本**：`m{N}-e2e-<feature>.ps1` (例如 `m3-e2e-f15-listfilter.ps1`)
- **文档**：`kebab-case.md` (例如 `formily-integration.md`)

---

## 8. 常见错误 / 陷阱 (Lessons Learned)

| 陷阱 | 解决方案 |
|---|---|
| vite proxy 报「非 JSON 500」 | 99% 是后端没启动（如 `/auth/login` → 3001 metaplatform-api 没运行） |
| vite proxy ECONNREFUSED (vite-frontend.err.log) | 3001 进程在后台被沙箱清理。**禁止**用 vite.config.ts 改 proxy fallback（违反 §7.3 架构红线，8092 schema 与 3001 不同）。**正确方式**：在系统 cmd 启动 3001 |
| node API (3001) 启动失败 | **Trae 沙箱拦所有**：`Start-Process cmd.exe /c ...` 不创建日志文件（vite 用同样方式能跑，但 metaplatform-api/node 不行，可能是沙箱路径白名单）。**正确方式**：用户必须**手动**在系统 PowerShell 启动 `cd D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform\metaplatform-api && node src/index.js`，或双击 `tools/start-node-api.bat` |
| docker 启动失败 | **Trae 沙箱白名单**：✓ `npm.cmd`, `npm run dev` (vite) 允许; ✗ `node`, `docker`, `java` 全部拦。`Start-Process cmd.exe /c '...docker...'` 沙箱内不创建 .log 文件（与 node 一样）。**正确方式**：用户**手动**双击 `tools/start-docker-stack.bat` |
| Pages.tsx 显示只有「未分类」组 | **根因**：vite proxy 把 `/api/apps/{id}/modules` 转发到**没有该 endpoint 的后端** → fetch 404 → catch 静默吞错 → customModules = `[]` → 内置顶级分类渲染代码被 P5 注释隐藏 → 只剩「未分类」。**禁止**在 Pages.tsx 加兜底渲染。**正确方式**：恢复 vite proxy 走 3001，**先**确保 3001 在跑 |
| FilterParser 400 非法过滤列 | URL 里 `=` 必须**裸**（拆 column/value），`(` `)` `,` 才编码；列名走白名单 |
| PowerShell `&` 当 background op | 字符串里 `&` 用 `+ '&' +` 拼接，不用单字符串 |
| PowerShell `()` 当 subexpression | URL 编码为 `%28` `%29`，字符串用单引号 |
| cmd `for in ( ... %ProgramFiles(x86)%\... ... )` | **`(x86)` 的圆括号会被 cmd 当作 for 列表边界** — 命令被截断成 `'flowable-rest' 不是内部或外部命令` 等乱码。**正确**：用 `if exist "%LOCALAPPDATA%..."` 逐个探测，不用 `for` 列表 |
| cmd 双击 .bat 闪退 | 默认窗口保持到 `pause`。**正确**：脚本末尾加 `pause >nul` + 所有 echo `>> "%LOG_FILE%" 2>&1` 写日志，错误时 `type "%LOG_FILE%"` 显示 |
| Formily 自研组件不响应 | 必须 `connect + mapProps`，不能直接 `<Input>` |
| x-reactions 不触发 | `dependencies` 必须列出引用的字段路径 |
| 动态表 IS NULL 字段 | 数量/价格 NOT NULL 字段无 NULL 行；empty 操作符 e2e 跳过 |
| tsx test 找不到模块 | 用 `.\node_modules\.bin\tsx.cmd --test`，不要用 `node --test` |
| Spring app-service 启动失败 | 检查 `application.yml` + Flyway 迁移 + Neo4j 是否运行 |
| vite 重复 `import connect` | 第 14 行已顶部 import，第 299 行删掉 |

---

## 9. 工作流（接到新需求时）

```
用户提出需求
   │
   ├─ 读 CLAUDE.md（本文件） ────────► 确认目标/范围/模块
   │
   ├─ 读 05-tech-selection-matrix.md ► 确认技术选型
   │
   ├─ 读 docs/v1.0.x/<v>/02-sprint-plan.md ► 确认本期任务
   │
   ├─ 读 docs/v1.0.x/<v>/01-user-stories.md ► 理解用户故事
   │
   ├─ 读相关已有文档（formily-*.md / sprint*-summary.md）
   │
   ├─ 与用户确认边界（如有歧义 → AskUserQuestion）
   │
   ├─ 实施：代码 + 单测 + e2e + 文档
   │
   ├─ 验证：tsc 0 errors / 单测全过 / e2e 全过 / build OK
   │
   └─ 交付：更新 sprint plan ☑ + 写总结文档
```

---

## 10. 关键文档索引 (Quick Reference)

| 文档 | 用途 |
|---|---|
| [`docs/tech-architecture/05-tech-selection-matrix.md`](./docs/tech-architecture/05-tech-selection-matrix.md) | **技术选型权威源** |
| [`docs/tech-architecture/01-nine-layer-architecture.md`](./docs/tech-architecture/01-nine-layer-architecture.md) | 9 层架构 |
| [`docs/v1.0.x/01-overview.md`](./docs/v1.0.x/01-overview.md) | v1.0.x 系列总览 |
| [`docs/v1.0.x/v1.0.2/02-sprint-plan.md`](./docs/v1.0.x/v1.0.2/02-sprint-plan.md) | 当前 sprint 计划 |
| [`docs/v1.0.x/v1.0.2/formily-integration.md`](./docs/v1.0.x/v1.0.2/formily-integration.md) | Formily 2 集成 |
| [`docs/v1.0.x/v1.0.2/listpage-formily.md`](./docs/v1.0.x/v1.0.2/listpage-formily.md) | ListPageEditor Formily 化 |
| [`README.md`](./README.md) | 顶层 README |
| [`docker-compose.yml`](./docker-compose.yml) | dev compose |
| [`deploy/kubernetes/`](./deploy/kubernetes/) | K8s manifests |

---

## 11. 维护

- 每次技术选型变更 → 更新 §5 矩阵 + 本文件 §3 + §7.1 红线
- 每次 sprint 完成 → 更新对应 sprint plan + 写 `*-formily.md` / `sprint*-summary.md`
- 每次新模块加入 → 更新 §5 仓库结构 + §6 核心模块

---

**生成时间**：2026-07-13
**适用版本**：MetaPlatform v1.0.2
**下次复核**：每次 sprint 开始前