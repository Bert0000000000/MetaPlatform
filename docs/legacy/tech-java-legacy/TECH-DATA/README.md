# TECH-DATA - 数据集成与 ETL 服务

## 模块类型

TECH 模块

## 作用

数据集成平台，支持 CDC、ETL/ELT、数据湖（Hudi/Iceberg）、数据仓库（StarRocks）、数据质量管理。

## 上游依赖

- `外部数据源`
- `TECH-MSG`

## 下游消费

- `TECH-ONT`
- `TECH-RAG`
- `TECH-WFE`
- `TECH-ACTION`

## 目录结构

```
TECH-DATA/
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
