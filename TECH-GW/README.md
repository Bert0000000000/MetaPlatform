# TECH-GW - API 网关服务

## 模块类型

TECH 模块

## 作用

统一 API 网关，提供路由、限流、认证、协议转换、负载均衡，基于 Istio + Spring Cloud Gateway。

## 上游依赖

- `所有 TECH 服务`

## 下游消费

- `APP-PORTAL`
- `外部调用方`

## 目录结构

```
TECH-GW/
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
