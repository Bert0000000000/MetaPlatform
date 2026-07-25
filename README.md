# Mate Platform 仓库结构

> 2026-07-24 v1.3 重构期 R1 落地说明。

## 顶层目录

```text
MetaPlatform/
├── README.md                          # 本文件
├── CLAUDE.md                          # Claude Code 项目上下文
├── agent.md                           # Agent 工作流约定
│
├── package.json                       # @metaplatform/ops-tools（运维/迁移/探查 Node 工具集）
├── pnpm-lock.yaml                     # 上述 ops-tools 锁定
├── docker-compose.yml                 # postgres + redis + nacos 3.0+（本地基础设施）
├── start-tech-services.ps1            # Windows 批量启动 TECH-* Java 服务
│
├── metaplatform-frontend/             # ⭐ 前端 pnpm monorepo（唯一前端入口）
│   ├── apps/                          # 8 个 app
│   │   ├── portal/                    # 后台管理 / 组件库 / FlowGram 流程画布
│   │   ├── apphub/                    # 应用中心（低代码 + 流程设计 + 表单 + 页面）
│   │   ├── arch/                      # 架构中心
│   │   ├── dashboard/                 # 工作台
│   │   ├── dw/                        # 数字员工
│   │   ├── mcphub/                    # MCP 服务中心
│   │   ├── ontstudio/                 # 本体引擎
│   │   └── superai/                   # 超级 AI（Copilot）
│   └── packages/
│       └── shared/                    # 共享组件库 + FlowGram.AI 封装
│
├── APP-*/  TECH-*/                    # ⭐ Java 25 + Spring Boot 3.5 + SAA 后端
│   ├── APP-COPILOT/  APP-DASHBOARD/  APP-DW/  APP-KB/
│   └── TECH-A2A/  ACTION/  AGENT/  DATA/  EA/  GW/  IAM/  LLMGW/
│       MCP/  MSG/  OBS/  ONT/  RAG/  RULE/  WFE/
│
├── docs/
│   ├── prd/                           # PRD 集合（按 APP 分子目录 + _top/ 顶层）
│   ├── NACOS-3.0-POC-CHECKLIST.md     # Nacos 3.0 升级 POC 清单
│   ├── flow-component-catalog.md
│   ├── flow-sidebar-group-accent.md
│   └── superpowers/
│
├── metaplatform-design-draft/         # 设计稿归档
├── .commit-catalog.md                 # 提交说明
├── .env  .env.example  .gitignore
├── .github/  .vscode/                 # CI / IDE 配置
└── tests/                             # 测试
```

## 关键约定

### 前端

- **入口唯一在 `metaplatform-frontend/`**，使用 pnpm workspaces
- 8 个 app 并行，按需 `pnpm --filter @mate/<app> dev`
- 共享组件、FlowGram.AI 封装在 `metaplatform-frontend/packages/shared/`
- 启动：`cd metaplatform-frontend && pnpm install && pnpm dev`

### 后端

- **18 个 Java 模块**目录（4 APP + 14 TECH），Java 25 + Spring Boot 3.5
- Spring AI Alibaba 1.1.2.2（BOM 统一管理）
- 端口分配见 [`start-tech-services.ps1`](start-tech-services.ps1)
- 启动：先 `docker compose up -d`（Nacos 3.0+），再 `mvn spring-boot:run`

### 根级 package.json

**不是前端 monorepo 入口**——是 `@metaplatform/ops-tools`，装的是 Node 端的运维/迁移/数据探查工具（ES / Milvus / Kafka / MinIO / Neo4j 客户端）。后续 ops 脚本入口放这里。

## R1 阶段落地

- [x] Nacos 3.0+ 升级（docker-compose.yml + [POC 清单](docs/NACOS-3.0-POC-CHECKLIST.md)）
- [x] TECH-AGENT README 重写为 SAA 实现
- [x] 根级遗留 src 清理（保留 ops-tools package.json）
- [~] FlowGram.AI 三场景 UI 接入（portal/dw/superai）

## 相关文档

| 文档 | 路径 |
|---|---|
| 项目总览（CLAUDE） | [CLAUDE.md](CLAUDE.md) |
| Agent 工作流 | [agent.md](agent.md) |
| PRD 集合 | [docs/prd/](docs/prd/) |
| Nacos 3.0 POC 清单 | [docs/NACOS-3.0-POC-CHECKLIST.md](docs/NACOS-3.0-POC-CHECKLIST.md) |
| 前端 monorepo | [metaplatform-frontend/](metaplatform-frontend/) |
