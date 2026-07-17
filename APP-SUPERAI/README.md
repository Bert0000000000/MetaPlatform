# APP-SUPERAI - 超级 AI

## 模块类型

APP 应用模块

## 作用

Mate Platform 的统一 AI 交互入口，以自然语言对话为核心交互形态，贯穿全平台业务场景：

- **智能问答**：基于 RAG 知识库的可溯源问答
- **数据分析**：自然语言驱动数据查询与可视化（待后端就绪后启用）
- **Action 执行**：通过自然语言触发 Ontology Action（待启用）
- **Ontology 探索**：对话式探索企业数据关系网（待启用）
- **代码生成**：辅助低代码应用开发（待启用）
- **任务编排**：多步骤任务自动分解与执行（待启用）
- **数字员工调度**：多领域数字员工协作（待启用）

## 上游依赖

- `TECH-LLMGW`：大模型调用与流式输出
- `TECH-RAG`：知识库检索
- `TECH-ACTION`：动作执行
- `TECH-AGENT`：Agent 运行时
- `TECH-ONT`：本体查询
- `TECH-MCP`：MCP 协议（外部 AI 工具对接）
- `TECH-IAM`：身份认证

## 下游消费

- `APP-DASHBOARD`（嵌入式入口）
- `APP-APPHUB`（辅助开发）
- `APP-DW`（增强数字员工）

## 技术栈

- React 19 + TypeScript 5.7 + Vite 6
- React Router v7
- Ant Design 6.0 + Ant Design X 2.0
- Axios

## 目录结构

```
APP-SUPERAI/
├── README.md
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.css
    ├── api/
    │   ├── client.ts
    │   ├── auth.ts
    │   └── chat.ts
    ├── components/
    │   └── AppLayout.tsx
    ├── pages/
    │   ├── LoginPage.tsx
    │   └── ChatPage.tsx
    ├── types/
    │   └── index.ts
    └── utils/
        └── auth.ts
```

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（默认端口 9301）
npm run dev

# TypeScript 类型检查
npm run lint

# 生产构建
npm run build

# 预览生产构建
npm run preview
```

## 关键配置

- 开发服务器端口：`9301`
- API 代理：`/api` → `http://localhost:8000`
- 登录接口：`POST /api/v1/iam/auth/login`
- 流式对话接口：`POST /api/v1/llmgw/chat/completions/stream`
  - 若后端不可用，前端会自动降级为本地模拟流，方便独立验证界面与交互。

## 相关文档

- [项目总览](../../README.md)
- [PRD - 超级 AI](./docs/PRD-APP-SUPERAI-超级AI_v1.0-20260716.md)
- [架构设计](../../docs/001-ARCH/)
- [技术选型](../../docs/002-TS/)
