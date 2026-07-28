## 附录 A：Data Track（v3.1 GA 硬前置）

> 本附录是 v3.0 交付计划的增量补丁，将数据平台作为 v1.0 GA 硬前置。
> 详细设计见 `docs/superpowers/specs/2026-07-28-mate-platform-big-data-etl-design.md`。
> W1–W7 主线任务不变，本附录仅追加 D0–D8 Data Track。

### A.1 D0–D8 任务清单

| 阶段 | 工期 | 主要产出 | 依赖/门禁 |
|---|---:|---|---|
| D0 | 2 周 | Flink CDC → Paimon → Iceberg → Trino/StarRocks 兼容性 Spike、容量模型 | 关键链路可运行 |
| D1 | 4 周 | K8s 数据平面（Kafka、MinIO、Flink Operator、Airflow、Trino） | 基础设施健康与故障恢复 |
| D2 | 4 周 | Python mate-tech-data 骨架、领域模型、OpenAPI、Outbox、Engine ACL | 契约与类型检查通过 |
| D3 | 5 周 | CDC、事件、批量 Connector、Paimon ODS/DWD、Schema Evolution | 回放、Upsert/Delete、断点恢复 |
| D4 | 5 周 | Pipeline Spec、Canvas、Flink 编译、Airflow DAG Bundle、发布状态机 | SQL/Java/PyFlink 三类作业 |
| D5 | 4 周 | Iceberg 数据产品发布、Trino、StarRocks、SQL Gateway | BI/AI 可消费认证产品 |
| D6 | 4 周 | Gravitino、OpenMetadata、OpenLineage、质量、Ranger、OpenBao | 质量/权限/血缘门禁 |
| D7 | 5 周 | 现有 Ontology Data Center 原位增强、语义映射、E2E | 现有四大页签不回归 |
| D8 | 4 周 | 压测、混沌、RPO/RTO、回滚、文档、GA | 全部 GA 验收门禁通过 |

合计约 35 周（建议独立 Data Squad；单团队需评估与 W1–W7 的并行度）。

### A.2 与 W1–W7 关键依赖

| W 任务 | 增量依赖 | 说明 |
|---|---|---|
| W5-4 tech-ont | D3 完成 | Ontology 正式数据接入依赖 Paimon ODS |
| W5-6 tech-rag | D5 完成 | 受治理数据产品依赖 Iceberg ADS |
| W6-2 ontstudio | D7 完成 | 数据中心原位增强 |
| W7-3~7 蓝绿迁移 | D4/D6 完成 | Pipeline 编译、权限、状态机就绪 |

### A.3 GA 验收门禁（增量）

1. 数据库 CDC、Kafka 事件、文件/API 批量接入均可运行。
2. 可视化、Flink SQL、Java Flink/PyFlink 三类 Pipeline 均可发布和恢复。
3. 无静默丢数、重复、越权或质量失败后的错误发布。
4. 资产可映射到 Ontology，认证数据产品可被 BI/RAG/Agent 订阅。
5. 全部目标容量、性能、可用性、SLO 和灾备指标有可重复测试证据。
6. 旧 `/v1/data/*` 契约通过兼容测试；旧 Java 服务保持归档。

### A.4 关键路径

```
D0 → D1/D2 → D3 → D4 → D5 → D6 → D7 → D8
                              ↘ W5-6 / W5-7
```

D7 与 W6-2 ontstudio 同步推进；D8 与 W7 蓝绿迁移并行，最终由 D8 的 GA 验收作为 v1.0 GA 共同门槛。

### A.5 风险与缓解（增量）

| ID | 风险 | 缓解 |
|---|---|---|
| R9 | Paimon/Iceberg 兼容性 | D0 Spike，使用官方 Operator |
| R10 | 500 Pipeline 资源争用 | Namespace + ResourceQuota + 流批节点池 |
| R11 | 自定义作业越权 | 镜像扫描、签名、容器隔离、Airflow 不执行用户代码 |
| R12 | 双格式治理不统一 | 统一 Catalog、血缘、SLA 与发布门禁 |
| R13 | 工期被低估 | Data Squad 并行；D0–D8 纳入 GA 关键路径 |

### A.6 总工期与里程碑（修订）

| 里程碑 | 包含 | 目标日期 |
|---|---|---|
| M1+ | D0–D1 + W1–W2 | 2026-09-15 |
| M2+ | D2–D3 + W3–W4 | 2026-10-15 |
| M3+ | D4–D5 + W5 | 2026-12-15 |
| M4+ | D6 + W6 | 2027-01-31 |
| M5+ | D7–D8 + W7（GA 共同门槛） | 2027-03-15 |

注：以上日期为 Data Squad 并行假设；如只有单团队需重新评估。
