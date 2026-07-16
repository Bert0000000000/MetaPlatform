# APP-DW - 数字员工

## 模块类型

APP 应用模块

## 作用

数字员工（Digital Worker）的管理与工作台。提供：
- 数字员工创建与配置（角色、能力、知识范围）
- 制度/流程/访谈信息提炼：从企业文档中抽取 Ontology 概念与 Action
- 任务执行监控：实时跟踪数字员工的任务执行状态
- 数字员工调度：多数字员工协作与任务分配
- 对话记录与效果评估

## 上游依赖

- `TECH-AGENT`：Agent 运行时框架
- `TECH-RAG`：知识库与检索
- `TECH-ONT`：本体引擎（概念/关系/Action 定义）
- `TECH-LLMGW`：大模型调用
- `TECH-A2A`：与其他 Agent 系统协作

## 下游消费

- `APP-DASHBOARD`（状态汇报）
- `APP-SUPERAI`（能力增强）

## 目录结构

```
APP-DW/
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
