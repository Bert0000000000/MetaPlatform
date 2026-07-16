# TECH-MCP - MCP 协议适配服务

## 模块类型

TECH 模块

## 作用

Model Context Protocol 适配层，让外部 AI 应用（Cursor/Copilot/Cloud Code）能够调用 Mate Platform 的能力。

## 上游依赖

- `TECH-ONT`
- `TECH-RAG`
- `TECH-ACTION`

## 下游消费

- `外部 MCP Client`

## 目录结构

```
TECH-MCP/
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
