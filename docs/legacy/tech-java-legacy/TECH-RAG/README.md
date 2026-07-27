# TECH-RAG - RAG 引擎服务

## 模块类型

TECH 模块

## 作用

企业级 RAG 引擎，支持向量 + 非向量混合检索、文档解析、分块、重排序、引用溯源。

## 上游依赖

- `TECH-DATA`
- `TECH-LLMGW`

## 下游消费

- `APP-DW`
- `APP-COPILOT`
- `TECH-AGENT`

## 目录结构

```
TECH-RAG/
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
