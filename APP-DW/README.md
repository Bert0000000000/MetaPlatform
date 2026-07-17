# APP-DW - 数字员工

## 模块类型

APP 应用模块

## 作用

Mate Platform 的数字员工管理与应用模块，为企业提供 AI 驱动的自动化劳动力。当前阶段已实现：

- **数字员工管理**：
  - 员工列表页：卡片网格展示、按名称/角色搜索、状态与角色分类筛选
  - 创建向导：4 步向导（基本信息 → 能力配置 → 知识范围 → 确认创建）
  - 员工详情页：基本信息、能力配置、知识库展示、启用/停用开关
  - 启停管理：在线/已停用状态切换、删除
- **基础设施**：
  - React 19 + Vite 6 + TypeScript 5.7 脚手架
  - Ant Design 6.0 组件库与布局
  - TECH-IAM JWT 登录集成与 Token 持久化
  - axios 请求拦截器与统一错误处理
  - localStorage 数字员工 Mock API（后端就绪后自动切换为真实接口）

后续阶段将陆续实现任务管理、执行监控、对话记录、效果评估、多员工协作、知识提炼等能力。

## 上游依赖

- `TECH-AGENT`：Agent 框架、任务执行引擎（待接入）
- `TECH-RAG`：知识库检索（待接入）
- `TECH-ONT`：Ontology 抽取写入、概念查询（待接入）
- `TECH-LLMGW`：LLM 推理、对话生成（待接入）
- `TECH-A2A`：Agent 发现、跨 Agent 通信（待接入）
- `TECH-ACTION`：Action 注册、执行、权限校验（待接入）
- `TECH-MCP`：MCP 协议 Tools 注册和调用（待接入）
- `TECH-IAM`：认证服务（`/api/v1/iam/auth/login`）
- `TECH-OBS`：操作审计、分布式追踪（待接入）
- `TECH-RULE`：规则引擎（待接入）

## 下游消费方

- `APP-DASHBOARD`：数字员工运行状态指标、任务统计、质量评分
- `APP-SUPERAI`：数字员工对话能力复用
- `APP-APPHUB`：数字员工作为 Action 执行者
- 外部系统：通过 A2A 协议与平台数字员工协作

## 目录结构

```
APP-DW/
├── README.md
├── package.json
├── vite.config.ts
├── index.html
├── src/
│   ├── api/                    # API 客户端与业务接口封装
│   │   ├── auth.ts             # IAM 登录
│   │   ├── client.ts           # axios 实例、拦截器
│   │   └── employees.ts        # 数字员工 API（含 localStorage Mock）
│   ├── components/             # 可复用组件
│   │   └── AppLayout.tsx       # 侧边导航 + 顶部布局
│   ├── pages/                  # 页面组件
│   │   ├── LoginPage.tsx       # 登录页
│   │   ├── EmployeeListPage.tsx    # 数字员工列表
│   │   ├── EmployeeCreatePage.tsx  # 4 步创建向导
│   │   └── EmployeeDetailPage.tsx  # 数字员工详情
│   ├── types/                  # TypeScript 类型定义
│   │   └── index.ts
│   ├── utils/                  # 工具函数
│   │   └── auth.ts             # Token/用户本地存储
│   ├── App.tsx                 # 路由配置
│   ├── main.tsx                # 应用入口
│   └── App.css                 # 全局样式
└── docs/
    ├── PRD-APP-DW-数字员工_v1.0-20260716.md
    └── PRD_v1.0-20260716.md
```

## 本地开发

```bash
cd APP-DW
npm install
npm run dev        # 端口 9401，代理到 http://localhost:8000
npm run lint       # TypeScript 类型检查
npm run build      # 生产构建
```

## 路由说明

| 路径 | 说明 |
|---|---|
| `/login` | 登录页 |
| `/dw` | 数字员工列表 |
| `/dw/employees/create` | 创建数字员工向导 |
| `/dw/employees/:id` | 数字员工详情 |

## Mock API 说明

由于 `TECH-AGENT` 后端可能尚未就绪，数字员工相关接口优先调用 `/api/v1/dw/employees/*`；当接口报错时自动降级到 `localStorage` 本地存储，确保前端功能可独立验证。登录接口始终调用 `TECH-IAM` 的 `/api/v1/iam/auth/login`。

## 相关文档

- [PRD - 数字员工](./docs/PRD-APP-DW-数字员工_v1.0-20260716.md)
- [项目总览](../../README.md)
- [架构设计](../../docs/001-ARCH/)
