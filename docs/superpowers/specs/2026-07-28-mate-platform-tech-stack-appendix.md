## 附录 A：v3.1 Data-Ready Baseline（2026-07-28 同步）

> 本附录为 v3.0 技术栈的增量补丁，详细设计见 `docs/superpowers/specs/2026-07-28-mate-platform-big-data-etl-design.md`。
> 增量内容为 v3.0 主后端的扩展，不改写既有章节，不动 Python 主后端结构，不引入 Java 业务服务。

### A.1 新增大数据与湖仓技术栈

| 类别 | 选型 | 版本 | 备注 |
|---|---|---|---|
| 批流计算 | Apache Flink | 1.19 | Application Mode + Flink Kubernetes Operator |
| CDC | Flink CDC | 3.x | PostgreSQL / MySQL / Oracle / SQL Server |
| 调度 | Apache Airflow | 3.0 | KubernetesExecutor + CeleryExecutor 备选 |
| 消息总线 | Apache Kafka（KRaft） | 3.7 | 与 v3.0 共用，扩副本与清理策略 |
| Schema Registry | Apicurio Registry | 2.6 | Avro / Protobuf / JSON Schema |
| 实时湖表 | Apache Paimon | 0.9 | ODS/DWD 主键 + 实时变更 |
| 开放湖表 | Apache Iceberg | 1.5 | DWS/ADS 共享数据产品 |
| 即席查询 | Trino | 455 | 跨 Paimon/Iceberg/外部源 SQL |
| OLAP Serving | StarRocks | 3.3 | 指标、报表、物化视图、Data API |
| 运行时目录 | Apache Gravitino | 0.7 | 物理 Catalog 联邦 |
| 治理目录 | OpenMetadata | 1.4 | Owner、Glossary、血缘、质量 |
| 运行血缘 | OpenLineage + Marquez | 0.50 | 统一跨引擎血缘事件 |
| 批量质量 | Great Expectations | 0.18 | 质量规则 + 对账 |
| 访问策略 | Apache Ranger | 2.4 | 行列权限、动态脱敏、审计 |
| 密钥 | OpenBao | 1.15 | 连接器密钥 + 动态凭证 |
| Python SDK | apache-airflow-providers-apache-flink | 1.5 | Airflow 提交 Flink 作业 |
| Python 客户端 | pyflink | 1.19 | PyFlink 作业构建 |
| Python ACL | trino-python-client / paimon-python / starrocks-connector | latest | 控制面 Adapter |

### A.2 兼容性约束

- 与 Python 3.12 + httpx + Pydantic v2 兼容；所有新组件通过 ACL Adapter 接入。
- 旧 Java `docs/legacy/tech-java-legacy/TECH-DATA` 不恢复上线，仅作为 `/v1/data/*` 契约与领域模型的迁移参考。
- 浏览器不直连上述引擎，统一走 Traefik + BFF 暴露的 `/v1/data/*` 与 `/api/v1/data/*`。

### A.3 与既有组件的边界

| 既有组件 | 职责不变 | 增量能力 |
|---|---|---|
| Traefik | 边缘网关、路由、TLS、限流 | 追加 `/v1/data/*` 路由表 |
| Keycloak | IAM/SSO | 追加服务账号与 Ranger 同步 |
| Flowable 8 | BPMN、人工审批 | 承接 Pipeline 发布审批与数据访问审批 |
| Nacos | 服务发现 + 配置 | 注册 mate-tech-data 与 Engine Adapter |
| Kafka | 事件总线 | 扩展为数据接入总线与领域事件 |
| MinIO | 对象存储 | 兼顾 Landing 与湖表文件存储 |
| PostgreSQL | 主库 | 增加 mate-tech-data 与数据治理 schema |
| Redis | 缓存 + 分布式锁 | 增加 Query Gateway 限流与幂等键 |

### A.4 同步位置

| v3.0 章节 | 增量 |
|---|---|
| §2 后端技术栈 | 增加 A.1 大数据栈条目 |
| §8 已确认的外部引擎 | 追加 Flink、Airflow、Paimon、Iceberg、Trino、StarRocks |
| §9 开发与发布工作流 | 增加数据 Pipeline 编译/发布流程 |

详细正文重写交由实施计划阶段以保持改动可回滚。
