# APP-SUPERAI - 超级 AI

## 模块类型

APP 应用模块

## 作用

Mate Platform 的 AI 助手入口，贯穿全平台。提供：
- 智能问答：基于 RAG 知识库的自然语言问答
- 数据分析：自然语言驱动数据查询与可视化
- Action 执行：通过自然语言触发 Ontology Action
- Ontology 探索：对话式探索企业数据链路关系网
- 代码生成：辅助低代码应用开发
- 任务编排：通过对话编排多步骤任务

## 上游依赖

- `TECH-LLMGW`：大模型调用
- `TECH-RAG`：知识库检索
- `TECH-ACTION`：动作执行
- `TECH-AGENT`：Agent 运行时
- `TECH-ONT`：本体查询
- `TECH-MCP`：MCP 协议（对接外部 AI 工具）

## 下游消费

- `APP-DASHBOARD`（嵌入式入口）
- `APP-APPHUB`（辅助开发）
- `APP-DW`（增强数字员工）

## 目录结构

```
APP-SUPERAI/
├── README.md
├── src/
├── tests/
├── config/
└── docker/
```

## 相关文档

- [项目总览](../../README.md)
- [架构设计](../../docs/001-ARCH/)
- [技术选型](../../docs/002-TS/)
