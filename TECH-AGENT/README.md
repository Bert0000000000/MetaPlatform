# TECH-AGENT - Agent 框架服务

## 模块类型

TECH 模块

## 作用

数字员工与 Agent 运行时框架，支持 ReAct / Plan-and-Solve、记忆管理、工具调用、多 Agent 协作。

## 上游依赖

- `TECH-LLMGW`
- `TECH-RAG`
- `TECH-ACTION`

## 下游消费

- `APP-DW`
- `APP-COPILOT`
- `TECH-A2A`

## 目录结构

```
TECH-AGENT/
├── README.md              # 本文件
├── src/                   # 源码目录
├── tests/                 # 测试目录
├── docs/                  # 模块内部文档
├── config/                # 配置文件
├── scripts/               # 脚本文件
└── docker/                # 容器化配置
```

## 快速开始

TODO: 补充模块的快速开始指南

## 相关文档

- [项目总览](../../README.md)
- [架构设计](../../docs/001-ARCH/)
- [技术选型](../../docs/002-TS/)
- [规范文档](../../docs/003-SPEC/)
