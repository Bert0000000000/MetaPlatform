# TECH-WFE - 工作流引擎服务

## 模块类型

TECH 模块

## 作用

BPMN 2.0 子集工作流引擎，支持审批流、会签、条件分支、委托、撤回、催办等运行时能力。

## 上游依赖

- `TECH-ONT`
- `TECH-RULE`

## 下游消费

- `APP-WFE`
- `TECH-ACTION`
- `TECH-DATA`

## 目录结构

```
TECH-WFE/
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
