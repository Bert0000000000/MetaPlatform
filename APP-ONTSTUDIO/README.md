# APP-ONTSTUDIO - 本体论引擎

## 模块类型

APP 应用模块

## 作用

Mate Platform 的本体论引擎工作台，统一管理本体定义、数据中心与 Action 编排。当前阶段（P1）已实现：

- **本体论管理**：
  - Concept（概念）管理：列表、创建、编辑、删除、层级树筛选
  - Attribute（属性）管理：在概念详情页添加/编辑/删除属性
  - Entity（实体）管理：按概念筛选、创建、编辑、删除
  - 全局搜索：按名称/编码搜索概念和实体
- **基础设施**：
  - React 19 + Vite 6 + TypeScript 5.7 脚手架
  - Ant Design 6.0 组件库与布局
  - TECH-IAM JWT 登录集成与 Token 持久化
  - axios 请求拦截器与统一错误处理

后续阶段将陆续实现 Relation 管理、Action 编排、数据中心、知识图谱可视化等能力。

## 上游依赖

- `TECH-ONT`：本体引擎核心服务（`/api/v1/ont/*`）
- `TECH-IAM`：认证服务（`/api/v1/iam/auth/login`）
- `TECH-ACTION`：Action Engine 执行服务（待接入）
- `TECH-DATA`：数据集成与 ETL（待接入）
- `TECH-RAG`：知识库关联（待接入）
- `TECH-RULE`：规则引擎（待接入）

## 下游消费

- `APP-APPHUB`：应用通过 Ontology 绑定数据
- `APP-ARCH`：EA 架构引用 Ontology 概念
- `APP-SUPERAI`：AI 探索 Ontology 关系网
- `APP-DW`：数字员工基于 Ontology 执行任务
- `TECH-MCP`：MCP 暴露 Ontology 查询能力

## 目录结构

```
APP-ONTSTUDIO/
├── README.md
├── package.json
├── vite.config.ts
├── index.html
├── src/
│   ├── api/               # API 客户端与业务接口封装
│   │   ├── auth.ts        # IAM 登录
│   │   ├── client.ts      # axios 实例、拦截器
│   │   ├── concepts.ts    # 概念 API
│   │   ├── attributes.ts  # 属性 API
│   │   ├── entities.ts    # 实体 API
│   │   └── search.ts      # 全局搜索聚合
│   ├── components/        # 可复用组件
│   │   ├── AppLayout.tsx  # 侧边导航 + 顶部搜索布局
│   │   ├── ConceptTree.tsx
│   │   ├── ConceptForm.tsx
│   │   ├── AttributeForm.tsx
│   │   ├── EntityForm.tsx
│   │   └── GlobalSearch.tsx
│   ├── pages/             # 页面组件
│   │   ├── LoginPage.tsx
│   │   ├── ConceptPage.tsx
│   │   ├── ConceptDetailPage.tsx
│   │   └── EntityPage.tsx
│   ├── types/             # TypeScript 类型定义
│   ├── utils/             # 工具函数
│   ├── App.tsx            # 路由配置
│   ├── main.tsx           # 应用入口
│   └── App.css
└── docs/
    └── PRD-APP-ONTSTUDIO-本体论引擎_v1.0-20260716.md
```

## 本地开发

```bash
cd APP-ONTSTUDIO
npm install
npm run dev        # 端口 9101，代理到 http://localhost:8000
npm run lint       # TypeScript 类型检查
npm run build      # 生产构建
```

## 相关文档

- [PRD - 本体论引擎](./docs/PRD-APP-ONTSTUDIO-本体论引擎_v1.0-20260716.md)
- [项目总览](../../README.md)
- [架构设计](../../docs/001-ARCH/)
- [OWL 调研报告](../../docs/005-RD/)
