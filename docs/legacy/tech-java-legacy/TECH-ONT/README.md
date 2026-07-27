# TECH-ONT - 本体引擎服务

## 模块类型

TECH 模块

## 作用

Mate Platform 的核心 Ontology 引擎，负责 Concept/Entity/Attribute/Relation/Rule/Action 的建模、存储、推理与版本管理。

## 上游依赖

- `TECH-DATA`
- `TECH-RAG`

## 下游消费

- `APP-LCD`
- `APP-WFE`
- `APP-DW`
- `TECH-WFE`
- `TECH-ACTION`
- `TECH-EA`

## v1.2 状态

- ✅ Spring Boot 3.5.x
- ✅ Spring AI Alibaba 1.1.2.0 (BOM)
- ✅ 全量 Java (无 Python 后端)
- ✅ OntologyDiscoveryController 替代原 Python FastAPI
- ✅ 19+ ServiceTest 全过 (含 4 个 DiscoveryTest, 1 @Disabled)
- ✅ versions 5 端点修复 (list/compare/PUT/DELETE)
- ✅ SAA ChatClient 集成

## Java 业务分层

- `Controller`：提供 Concept、Entity、Attribute、Relation、Ontology Version、Discovery 与 Graph 等 REST API。
- `Service`：承载本体建模、层级管理、图查询、版本管理、发现分析与同步等业务逻辑。
- `Entity` / `Repository`：基于 Spring Data JPA 持久化本体、关系、版本与发现任务数据。
- `Graph`：通过 Neo4j 节点、边与 Repository 支持知识图谱查询。

## 目录结构

```
TECH-ONT/
├── README.md                         # 本文件
├── pom.xml                           # Maven 构建与依赖配置
├── docs/                             # 模块内部文档
└── src/
    ├── main/
    │   ├── java/com/metaplatform/ont/
    │   │   ├── controller/           # REST API 控制器
    │   │   ├── service/              # 本体业务服务
    │   │   ├── entity/               # JPA 实体
    │   │   ├── repository/           # Spring Data JPA 仓储
    │   │   ├── graph/                # Neo4j 图节点、边与仓储
    │   │   ├── dto/                  # API 请求与响应对象
    │   │   ├── config/               # 服务配置
    │   │   ├── security/             # JWT 与 Spring Security
    │   │   └── common/               # 通用响应、上下文与错误码
    │   └── resources/                # 应用配置与 Flyway 迁移
    └── test/java/com/metaplatform/ont/service/
                                        # JUnit 5 Service 测试
```

## 快速开始

TODO: 补充模块的快速开始指南

## 跨模块依赖

详细阻塞项与已解决项见 `docs/006-TMP/2026-07-21-ont-migration-cross-module-deps.md`。

## 相关文档

- [项目总览](../../README.md)
- [架构设计](../../docs/001-ARCH/)
- [技术选型](../../docs/002-TS/)
- [规范文档](../../docs/003-SPEC/)
