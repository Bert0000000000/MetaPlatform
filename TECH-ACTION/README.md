# TECH-ACTION - Action Engine 服务

## 模块类型

TECH 模块

## 作用

动作执行引擎，负责 Ontology 定义的动作编排、调用、补偿、审计，连接数据与业务系统。

## 上游依赖

- `TECH-ONT`
- `TECH-WFE`
- `TECH-RULE`

## 下游消费

- `APP-LCD`
- `APP-COPILOT`
- `TECH-DATA`
- `TECH-MCP`
- `TECH-A2A`

## 目录结构

```
TECH-ACTION/
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
