# TECH-MSG - 消息队列服务

## 模块类型

TECH 模块

## 作用

消息中间件基座，基于 Kafka + RabbitMQ，支撑事件驱动、异步解耦、CDC 数据流。

## 上游依赖

- 无

## 下游消费

- `TECH-DATA`
- `TECH-WFE`
- `TECH-ACTION`
- `TECH-OBS`

## 目录结构

```
TECH-MSG/
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
