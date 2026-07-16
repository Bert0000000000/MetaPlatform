# §2 部署拓扑

> **目标**：明确 MetaPlatform 商用化部署的物理/逻辑拓扑 —— K8s + 多云 + 信创 + 灾备。
> **对应 spec**：v1.2 §13 路线图 + §14 子项目拆分
> **状态**：v1.0 草稿

---

## §2.1 部署模式

MetaPlatform 提供 **3 种部署模式**，覆盖从 PoC 到商用化的全场景：

| 模式 | 适用场景 | 技术栈 | 部署时间 | 客户数 |
|---|---|---|---|---|
| **PoC 单机** | 内部演示 / 客户 PoC | docker-compose，单机 8C16G | 30 min | 1 |
| **商用 SaaS** | 多租户 SaaS | K8s + 多云 + 完整 HA | 2 周 | 100+ |
| **专有云** | 大客户专有云 | K8s + 客户机房 + 信创 | 4 周 | 1（独占） |

---

## §2.2 商用 SaaS 部署拓扑

### 架构图

```
                           ┌─────────────────────────────┐
                           │     Cloudflare/阿里云 CDN    │
                           │     (静态资源 + WAF)         │
                           └──────────────┬──────────────┘
                                          │
                           ┌──────────────▼──────────────┐
                           │   API Gateway (APISIX)      │
                           │   - 路由 / 限流 / 鉴权        │
                           │   - 灰度 / 蓝绿               │
                           └──────────────┬──────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            │                             │                             │
   ┌────────▼─────────┐         ┌────────▼─────────┐         ┌────────▼─────────┐
   │  租户 A Region   │         │  租户 B Region   │         │  租户 N Region   │
   │  (主)            │         │  (主)            │         │  (主)            │
   │  us-west-1       │         │  eu-central-1    │         │  ap-east-1       │
   └────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
            │                             │                             │
   ┌────────▼─────────┐         ┌────────▼─────────┐         ┌────────▼─────────┐
   │  租户 A Region   │         │  租户 B Region   │         │  租户 N Region   │
   │  (备)            │         │  (备)            │         │  (备)            │
   │  us-west-2       │         │  eu-west-1       │         │  ap-south-1      │
   └──────────────────┘         └──────────────────┘         └──────────────────┘
                                          │
                           ┌──────────────▼──────────────┐
                           │   共享中间件层 (每个 Region)  │
                           │  PG / Neo4j / Milvus /       │
                           │  MinIO / Redis / Kafka /     │
                           │  Doris / Hudi / ClickHouse   │
                           └─────────────────────────────┘
```

### 资源规格（单租户 Region）

| 组件 | 副本数 | 资源 | 备注 |
|---|---|---|---|
| **L1-1 前端** | 2 (HPA 2-10) | 2C4G × N | 静态资源 CDN |
| **L1-2 市场** | 2 (HPA 2-5) | 1C2G × N | v0.2 起步 |
| **L1-3 页面** | 2 (HPA 2-10) | 2C4G × N | |
| **L1-4 流程** | 2 (HPA 2-8) | 2C4G × N | Flowable 集群 |
| **L2-1 业务对象** | 2 (HPA 2-8) | 2C4G × N | |
| **L2-2 本体引擎** | 2 (HPA 2-8) | 4C8G × N | Java GC 调优 |
| **L2-3 数据栈** | 2 (HPA 2-6) | 4C8G × N | Go |
| **L3-1 LLM Gateway** | 2 (HPA 2-10) | 2C4G × N | Go |
| **L3-1 Embedding** | 1 (HPA 1-3) | 4C8G × N | GPU 选配 |
| **L3-1 Agent** | 1 (HPA 1-3) | 4C8G × N | Python |
| **L3-3 API Gateway** | 3 (HPA 3-10) | 1C2G × N | APISIX |
| **L3-3 审计** | 2 (HPA 2-5) | 2C4G × N | |
| **L3-3 Integration Hub** | 1 (HPA 1-3) | 2C4G × N | NiFi |
| **PG (主)** | 1 + 1 standby | 8C32G × 2 | |
| **Neo4j (主)** | 3 集群 | 8C32G × 3 | Causal Cluster |
| **Milvus (主)** | 1 主 + 2 副 | 8C32G × 3 | |
| **MinIO (主)** | 4 节点 | 4C8G × 4 | 纠删码 |
| **Redis (主)** | 3 主 3 副 | 4C16G × 6 | Cluster |
| **Kafka (主)** | 3 broker | 4C16G × 3 | |
| **Doris (主)** | 3 FE + 3 BE | 8C32G × 6 | |
| **Hudi + MinIO** | 复用 MinIO | - | |
| **ClickHouse（适配）** | 0/1+ | 8C32G × N | 仅大客户 |
| **监控栈** | Prometheus + Grafana | 2C4G × 3 | |

**单租户基线**：~150 vCPU + 600 GB 内存（中等规模）。

### 多租户隔离

**两种策略**：

1. **K8s namespace 隔离**（推荐）
   - 每个租户独立 namespace
   - NetworkPolicy 强制隔离
   - ResourceQuota 限制资源
   - **适合**：SaaS 模式

2. **物理集群隔离**（高净值客户）
   - 独立 K8s 集群
   - 独立中间件
   - **适合**：金融 / 政企客户

**多租户数据隔离**：
- PG：Row-Level Security (RLS) + 业务层强制 tenant_id
- Neo4j：节点 label 加 `tenant_id` 属性
- Milvus：collection 名加 `tenant_id_` 前缀
- MinIO：bucket 名加 `tenant_id-` 前缀
- Kafka：topic 名加 `tenant_id.` 前缀
- Redis：key 加 `tenant_id:` 前缀

---

## §2.3 专有云部署（信创）

### 信创技术栈

| 组件 | 信创选型 | 备注 |
|---|---|---|
| CPU | 鲲鹏 920 / 海光 7285 | ARM64 / x86 |
| 操作系统 | 麒麟 V10 / UOS V20 | |
| 关系数据库 | 达梦 DM8 / 人大金仓 KingbaseES | 替代 PostgreSQL |
| 图数据库 | 华为 GES / 自研 | 替代 Neo4j |
| 对象存储 | 华为 OBS / 阿里云 OSS 信创版 | 替代 MinIO |
| 消息队列 | Apache Kafka 信创版 | |

### 兼容性矩阵

| 组件 | 信创替代 | 兼容度 | 工作量 |
|---|---|---|---|
| Java 21 | OpenJDK 21 (信创版) | 100% | 0 |
| Spring Boot 3 | Spring Boot 3 (信创版) | 100% | 0 |
| Neo4j 5 | 华为 GES | 70% | 3 月 |
| PostgreSQL 16 | 达梦 DM8 | 60% (SQL 差异) | 2 月 |
| Doris 2.0 | Doris 信创版 | 100% | 0 |
| Hudi 0.13 | Hudi 信创版 | 100% | 0 |
| Milvus 2.4 | Milvus 信创版 | 100% | 0 |
| MinIO | 华为 OBS | 80% (S3 兼容) | 1 月 |
| Kafka 3.6 | Kafka 信创版 | 100% | 0 |
| Redis 7 | Redis 信创版 | 100% | 0 |
| Docker | 华为云 CCE / 阿里云 ACK 信创版 | 100% | 0 |
| K8s 1.29 | K8s 信创版 | 100% | 0 |

**信创适配总工作量**：6-9 月（v0.3 起步）

---

## §2.4 灾备

### RPO / RTO 目标

| 模式 | RPO | RTO | 备注 |
|---|---|---|---|
| **PoC 单机** | 24h | 24h | 冷备份 |
| **商用 SaaS** | 1 min | 5 min | 热备 + 异地容灾 |
| **金融专有云** | 0 (同步) | 30s | 同城双活 + 异地灾备 |

### 灾备方案

**同城双活**：
- 主备 Region 同城部署（如上海 + 杭州）
- PG 同步复制（Patroni + etcd）
- Kafka MirrorMaker 2
- 流量自动切换

**异地容灾**：
- 异地 Region 异步复制
- 定时快照（PG basebackup + WAL）
- MinIO 跨 Region 复制
- 冷启动 RTO < 30 min

**备份策略**：
- PG：每 6h basebackup + 连续 WAL 归档
- Neo4j：每 6h 在线备份
- MinIO：每天全量 + 跨 Region 复制
- Kafka：依赖 MirrorMaker

---

## §2.5 CI/CD 流水线

```
Git Push
    ↓
GitLab CI / GitHub Actions
    ├─ Lint (Checkstyle / golangci-lint)
    ├─ Unit Test (JUnit 5 / Go test)
    ├─ Integration Test (Testcontainers)
    ├─ Build (Maven / Go build)
    ├─ Image Build (Docker + BuildKit)
    ├─ Image Push (Harbor)
    ├─ Security Scan (Trivy + Snyk)
    └─ Sign (cosign)
         ↓
ArgoCD (GitOps)
    ↓
K8s Apply
    ↓
Canary (5%) → Blue-Green
    ↓
100% Rollout
    ↓
Observability (Prometheus + Grafana)
```

**关键策略**：
- **GitOps**：所有环境配置走 Git
- **蓝绿发布**：L1-1 / L1-3 等无状态服务
- **金丝雀**：L2-1 / L2-2 等有状态服务
- **回滚**：1 键回滚到上一版本

---

## §2.6 监控 / 日志 / 追踪

### 监控 (Prometheus + Grafana)

| 指标 | 来源 | 告警阈值 |
|---|---|---|
| API 延迟 P99 | APISIX | > 1s |
| API 错误率 | APISIX | > 1% |
| PG 连接数 | pg_exporter | > 80% |
| Neo4j 堆使用 | Neo4j JMX | > 80% |
| Kafka Lag | kafka_exporter | > 10 万 |
| Doris 查询 P99 | Doris | > 3s |
| Hudi 写入失败率 | 自研 exporter | > 1% |
| LLM Token 消耗 | 自研 | 预算 80% |
| 业务对象数量 | 自研 | > 千万 |

### 日志 (Loki + Vector)

**日志格式**（JSON）：
```json
{
  "timestamp": "2026-07-02T10:00:00.123Z",
  "level": "INFO",
  "service": "ontology-engine",
  "tenant_id": "default-tenant",
  "actor_id": "alice",
  "trace_id": "abc123",
  "span_id": "def456",
  "request_id": "req-789",
  "message": "EntityType created",
  "context": {
    "entity_type_id": "...",
    "name": "Customer"
  }
}
```

**日志保留**：
- 热存储（Loki）：7 天
- 冷存储（对象存储）：90 天
- 合规存储：1 年

### 追踪 (Tempo + OpenTelemetry)

**关键 trace**：
- 端到端用户请求（L1-1 → L1-3 → L2-1 → L2-2 → L2-3）
- Kafka 事件生命周期
- LLM 调用链
- 数据写入链（业务对象 → Neo4j → Doris → Hudi）

**采样率**：
- 默认：10%
- 错误：100%
- 慢请求：100%

---

## §2.7 网络拓扑

### 内部网络

```
┌──────────────────────────────────────────────────────────┐
│  K8s Cluster                                              │
│                                                            │
│  ┌────────────────┐    ┌────────────────┐                │
│  │ 应用 Pod        │    │ 应用 Pod        │                │
│  │ (L1-L3)        │◄──►│ (L1-L3)        │                │
│  └────────┬───────┘    └────────┬───────┘                │
│           │                     │                         │
│           └──────────┬──────────┘                         │
│                      │                                    │
│           ┌──────────▼──────────┐                         │
│           │  Service Mesh       │                         │
│           │  (Istio / Linkerd)  │                         │
│           │  mTLS + 流量管理     │                         │
│           └──────────┬──────────┘                         │
│                      │                                    │
│  ┌───────────────────▼──────────────────┐                 │
│  │  中间件 (StatefulSet)                │                 │
│  │  PG / Neo4j / Milvus / Doris / ...   │                 │
│  └──────────────────────────────────────┘                 │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

**关键技术**：
- **Service Mesh**（Istio / Linkerd）：mTLS + 流量管理
- **NetworkPolicy**：限制 Pod 间通信
- **External Secrets**：从 Vault 注入密钥
- **Cert Manager**：自动证书管理

### 外部网络

- **API 出口**：仅允许白名单目标（LLM 厂商 / 第三方 API）
- **API 入口**：仅 APISIX 暴露
- **SSH**：仅堡垒机 + MFA
- **数据库**：仅内网访问

---

## §2.8 v0.1 plan 与本节的关系

**v0.1 部署模式**：PoC 单机（docker-compose）
- 本体引擎：docker-compose 起 Neo4j/PG/Kafka
- 数据栈：docker-compose 起 Doris/ClickHouse/MinIO/PG/Kafka
- 集成 Spike：编排两套

**v0.1 → v0.2 升级路径**：
- docker-compose → K8s manifests
- 加 Service Mesh
- 加监控 / 日志 / 追踪
- 加 CI/CD

**v0.2 → v0.3 升级路径**：
- 多 Region 部署
- 灾备
- 信创适配

**结论**：v0.1 plan 不需要重写；但 v0.2 plan 需要补充 K8s manifests + 监控 + 日志 + 追踪 + CI/CD 模板。

---

**生成时间**：2026-07-02 14:40
**对应 spec 版本**：v1.2
**下一步**：阅读 [03-data-flow.md](./03-data-flow.md)
