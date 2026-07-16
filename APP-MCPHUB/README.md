# APP-MCPHUB - MCP 服务中心

## 模块类型

APP 应用模块

## 作用

Mate Platform 的 MCP（Model Context Protocol）服务中心，管理平台对外的 AI 工具能力暴露。提供：
- **MCP Server 管理**：配置哪些平台能力通过 MCP 暴露（Tools/Resources/Prompts）
- **MCP Client 管理**：配置平台连接的第三方 MCP Server
- **工具注册中心**：统一管理平台所有 Tools 的注册、权限、调用统计
- **MCP 调试器**：在线测试 MCP 工具调用
- **调用审计**：MCP 调用记录、Token 消耗、错误追踪
- **权限控制**：哪些用户/应用可以调用哪些 MCP 工具
- **外部应用对接**：Cursor / Copilot / Cloud Code 等 AI IDE 的 MCP 配置指引

## 上游依赖

- `TECH-MCP`：MCP 协议适配服务
- `TECH-ONT`：Ontology 查询能力暴露
- `TECH-RAG`：知识库检索能力暴露
- `TECH-ACTION`：Action 执行能力暴露
- `TECH-IAM`：权限认证

## 下游消费

- 外部 MCP Client（Cursor / Copilot / Cloud Code / Claude Desktop 等）
- `APP-SUPERAI`（内部 MCP Client 调用）

## 目录结构

```
APP-MCPHUB/
├── README.md
├── src/
│   ├── server-manager/    # MCP Server 管理
│   ├── client-manager/    # MCP Client 管理
│   ├── tool-registry/     # 工具注册中心
│   ├── debugger/          # MCP 调试器
│   └── audit/             # 调用审计
├── tests/
├── config/
└── docker/
```

## 相关文档

- [项目总览](../../README.md)
- [架构设计](../../docs/001-ARCH/)
- [技术选型](../../docs/002-TS/)
