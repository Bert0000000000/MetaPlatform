# APP-ONTSTUDIO - 本体论引擎

## 模块类型

APP 应用模块

## 作用

Mate Platform 的本体论引擎工作台，统一管理本体定义、数据中心与 Action 编排。提供：
- **本体论管理**：
  - Concept / Entity / Attribute / Relation / Rule / Action 的可视化建模
  - Ontology 版本管理与变更追踪
  - 推理引擎配置（HermiT / ELK）
  - 知识图谱可视化（基于 AntV X6）
- **数据中心**：
  - 数据源管理：外部数据库、API、文件数据源接入
  - 数据映射：将外部数据映射到 Ontology 实体
  - 数据质量监控：完整性、一致性、时效性
  - 数据血缘：数据流转路径可视化
- **服务/Action 编排**：
  - Action 定义：输入/输出/执行逻辑/补偿逻辑
  - 服务编排：将多个 Action 组合为复合服务
  - Action 触发规则：事件驱动、定时、手动
  - Action 执行监控与审计

## 上游依赖

- `TECH-ONT`：本体引擎核心服务
- `TECH-ACTION`：Action Engine 执行服务
- `TECH-DATA`：数据集成与 ETL
- `TECH-RAG`：知识库关联
- `TECH-RULE`：规则引擎

## 下游消费

- `APP-APPHUB`：应用通过 Ontology 绑定数据
- `APP-ARCH`：EA 架构引用 Ontology 概念
- `APP-SUPERAI`：AI 探索 Ontology 关系网
- `APP-DW`：数字员工基于 Ontology 执行任务
- `TECH-MCP`：MCP 暴露 Ontology 查询能力

## 目录结构

```
APP-ONTSTUDIO/
├── README.md
├── src/
│   ├── ontology-editor/   # 本体建模编辑器
│   ├── data-center/       # 数据中心
│   ├── action-orchestrator/ # Action 编排
│   └── graph-viewer/      # 知识图谱可视化
├── tests/
├── config/
└── docker/
```

## 相关文档

- [项目总览](../../README.md)
- [架构设计](../../docs/001-ARCH/)
- [OWL 调研报告](../../docs/005-RD/)
