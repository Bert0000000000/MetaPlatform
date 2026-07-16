# 命名规范

## 1. 模块命名

### 1.1 应用模块（APP）

格式：`APP-` + 大写字母缩写

| 模块 | 全称 | 说明 |
|---|---|---|
| `APP-DASHBOARD` | Dashboard | 仪表盘 |
| `APP-SUPERAI` | Super AI | 超级 AI |
| `APP-DW` | Digital Worker | 数字员工 |
| `APP-APPHUB` | Application Hub | 应用中心（低代码 + 流程设计器） |
| `APP-ONTSTUDIO` | Ontology Studio | 本体论引擎（本体 + 数据中心 + Action 编排） |
| `APP-ARCH` | Architecture Center | 架构中心 |
| `APP-MCPHUB` | MCP Hub | MCP 服务中心 |

### 1.2 技术服务模块（TECH）

格式：`TECH-` + 大写字母缩写

| 模块 | 全称 | 说明 |
|---|---|---|
| `TECH-ONT` | Ontology Engine | 本体引擎服务 |
| `TECH-WFE` | Workflow Engine | 工作流引擎服务 |
| `TECH-RULE` | Rule Engine | 规则引擎服务 |
| `TECH-ACTION` | Action Engine | 动作引擎服务 |
| `TECH-RAG` | RAG Engine | RAG 引擎服务 |
| `TECH-AGENT` | Agent Framework | Agent 框架服务 |
| `TECH-LLMGW` | LLM Gateway | 大模型网关服务 |
| `TECH-MCP` | MCP Adapter | MCP 协议适配服务 |
| `TECH-A2A` | A2A Adapter | A2A 协议适配服务 |
| `TECH-EA` | Enterprise Architecture | EA 架构资产服务 |
| `TECH-DATA` | Data Integration | 数据集成与 ETL 服务 |
| `TECH-IAM` | Identity & Access Management | 身份认证与权限服务 |
| `TECH-GW` | API Gateway | API 网关服务 |
| `TECH-MSG` | Messaging | 消息队列服务 |
| `TECH-OBS` | Observability | 可观测性服务 |

## 2. 文档命名

### 2.1 文档目录结构

```
docs/
├── 000-GUIDE/       # 规范与指南
├── 001-ARCH/        # 架构设计
├── 002-TS/          # 技术选型
├── 003-SPEC/        # 规范与接口
├── 004-PLAN/        # 计划与路线图
├── 005-RD/          # 调研报告
└── 006-TMP/         # 临时脚本
```

### 2.2 文档文件命名

格式：`[类型]-[模块]-[主题]_v[版本]-[日期].md`

| 类型前缀 | 含义 | 示例 |
|---|---|---|
| `ARCH` | 架构设计 | `ARCH-Mate_Platform-应用架构_v1.0-20260716.md` |
| `TS` | 技术选型 | `TS-Mate_Platform-技术选型建议_v1.0-20260716.md` |
| `SPEC` | 规范文档 | `SPEC-Mate_Platform-API规范_v1.0-20260716.md` |
| `PLAN` | 计划路线 | `PLAN-Mate_Platform-实施路线图_v1.0-20260716.md` |
| `RD` | 调研报告 | `RD-Mate_Platform-Ontology_OWL调研报告_v1.0-20260716.md` |

### 2.3 临时脚本命名

格式：`tmp-[日期]-[用途].[ext]`

示例：`tmp-20260716-generate_diagrams.py`

## 3. 代码命名

### 3.1 Java

- 包名：`com.metaplatform.[模块小写].*`
  - 例：`com.metaplatform.ont.engine`
  - 例：`com.metaplatform.wfe.runtime`
- 类名：PascalCase，如 `OntologyEngineService`
- 方法名：camelCase，如 `createConcept()`

### 3.2 TypeScript / React

- 目录名：kebab-case，如 `ontology-editor/`
- 组件名：PascalCase，如 `OntologyEditor.tsx`
- 文件名：kebab-case，如 `ontology-api.ts`

### 3.3 API 路径

- 基础路径：`/api/v1/[模块]/[资源]`
  - 例：`/api/v1/ont/concepts`
  - 例：`/api/v1/wfe/process-instances`
  - 例：`/api/v1/rag/search`
