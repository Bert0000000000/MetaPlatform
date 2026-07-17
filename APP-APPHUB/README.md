# APP-APPHUB - 应用中心

## 模块类型

APP 应用模块

## 作用

Mate Platform 的应用管理中心，融合低代码设计器与流程设计器。当前阶段（P1）已实现：

- **应用管理**：
  - 应用列表：卡片网格展示、搜索、分组/状态筛选
  - 应用 CRUD：创建、编辑、删除、发布/下线
  - 应用详情：模块列表、基本信息 Tab
- **模块管理**：
  - 表单/流程/看板/页面四种模块类型创建
  - 模块编辑、删除、按名称搜索
- **表单设计器（基础版）**：
  - 组件面板：单行文本、多行文本、数字、单选、多选、下拉、日期、开关、附件、分隔线、分组容器
  - 画布操作：添加、删除、复制、上下移动、选中
  - 属性配置：标签、字段标识、占位提示、宽度、必填/只读/隐藏、长度校验、选项配置
  - 表单全局设置：名称、描述、提交按钮文案、提交后行为
  - 保存校验：至少一个组件、字段标识唯一
- **基础设施**：
  - React 19 + Vite 6 + TypeScript 5.7 脚手架
  - Ant Design 6.0 组件库与布局
  - TECH-IAM JWT 登录集成
  - 本地 localStorage 模拟应用/模块数据 API（后端就绪后可切换为真实 API）

后续阶段将陆续实现 FlowGram.AI 流程设计器、表单预览、应用市场、AI 辅助生成等能力。

## 上游依赖

- `TECH-IAM`：认证服务（`/api/v1/iam/auth/login`）
- `TECH-ONT`：本体引擎（概念/实体作为表单数据源，待接入）
- `TECH-WFE`：工作流引擎（流程模块运行时，待接入）
- `TECH-ACTION`：Action Engine（动作执行，待接入）
- `TECH-RULE`：规则引擎（条件判断，待接入）
- `APP-SUPERAI`：AI 辅助开发（待接入）

## 下游消费

- `APP-DASHBOARD`：应用入口展示
- 终端用户：使用已发布的应用

## 目录结构

```
APP-APPHUB/
├── README.md
├── package.json
├── vite.config.ts
├── index.html
├── src/
│   ├── api/                   # API 客户端与业务接口封装
│   │   ├── auth.ts            # IAM 登录
│   │   ├── client.ts          # axios 实例、拦截器
│   │   ├── apps.ts            # 应用 API（当前 localStorage 模拟）
│   │   └── modules.ts         # 模块 API（当前 localStorage 模拟）
│   ├── components/            # 可复用组件
│   │   ├── AppLayout.tsx      # 侧边导航 + 顶部布局
│   │   ├── AppForm.tsx        # 应用创建/编辑表单
│   │   ├── ModuleForm.tsx     # 模块创建/编辑表单
│   │   └── componentRegistry.ts # 图标与表单组件注册表
│   ├── pages/                 # 页面组件
│   │   ├── LoginPage.tsx
│   │   ├── AppListPage.tsx    # 应用列表
│   │   ├── AppDetailPage.tsx  # 应用详情 + 模块管理
│   │   └── FormDesignerPage.tsx # 表单设计器
│   ├── types/                 # TypeScript 类型定义
│   ├── utils/                 # 工具函数
│   ├── App.tsx                # 路由配置
│   ├── main.tsx               # 应用入口
│   └── App.css
└── docs/
    └── PRD-APP-APPHUB-应用中心_v1.0-20260716.md
```

## 本地开发

```bash
cd APP-APPHUB
npm install
npm run dev        # 端口 9201，代理到 http://localhost:8000
npm run lint       # TypeScript 类型检查
npm run build      # 生产构建
```

## 相关文档

- [PRD - 应用中心](./docs/PRD-APP-APPHUB-应用中心_v1.0-20260716.md)
- [项目总览](../../README.md)
- [架构设计](../../docs/001-ARCH/)
- [技术选型](../../docs/002-TS/)
