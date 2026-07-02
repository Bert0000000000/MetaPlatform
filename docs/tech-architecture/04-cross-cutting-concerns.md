# §4 横切关注点

> **目标**：明确安全、可观测、性能、容灾等横切关注点的设计与实现。
> **对应 spec**：v1.2 §12 风险与挑战
> **状态**：v1.0 草稿

---

## §4.1 安全

### 4.1.1 零信任架构

**原则**：从不信任，始终验证。

**实现**：
- **网络**：mTLS (Istio / Linkerd)
- **身份**：Keycloak / Ory Hydra (OIDC 2.0)
- **API 鉴权**：APISIX + Casbin
- **数据访问**：每层独立鉴权（不依赖网络层）
- **服务间**：Service Account + 短期 Token

### 4.1.2 认证

| 方式 | 用途 | 实现 |
|---|---|---|
| **OIDC 2.0** | 用户登录 | Keycloak / 阿里云 IDaaS |
| **SAML 2.0** | 企业 SSO | Keycloak |
| **LDAP** | 老系统集成 | Keycloak Federation |
| **API Key** | 服务间调用 | Vault 短期 Token |
| **OAuth 2.0 Client Credentials** | 第三方集成 | Keycloak |
| **多因素认证 (MFA)** | 高权限用户 | TOTP / 短信 |

**Token 生命周期**：
- Access Token：15 min
- Refresh Token：7 days（可撤销）
- Service Token：1 hour

### 4.1.3 授权

**RBAC + ABAC 混合**：

```yaml
# Casbin RBAC 规则示例
- apiVersion: casbin.io/v1
  kind: ClusterRoleBinding
  metadata:
    name: data-scientist
  subjects:
    - kind: User
      name: alice
      tenant: default-tenant
  roleRef:
    kind: ClusterRole
    name: data-scientist
  rules:
    - apiGroups: ["ontology"]
      resources: ["entity-types", "entity-instances"]
      verbs: ["get", "list", "create", "update"]
    - apiGroups: ["data"]
      resources: ["datasets", "queries"]
      verbs: ["get", "query"]
    - apiGroups: ["ai"]
      resources: ["agents", "prompts"]
      verbs: ["get", "create"]
```

**ABAC 规则示例**：
```rego
# OPA Rego 规则示例
package metaplatform.authz

default allow = false

allow {
    input.user.tenant_id == input.resource.tenant_id
    input.user.roles[_] == "admin"
}

allow {
    input.user.tenant_id == input.resource.tenant_id
    input.user.roles[_] == "data-scientist"
    input.resource.kind == "dataset"
    data.dataset_tags[input.resource.id][_] == input.user.department
}
```

### 4.1.4 数据安全

| 维度 | 措施 | 实现 |
|---|---|---|
| **传输加密** | TLS 1.3 | 全链路 |
| **静态加密** | AES-256 | 备份 + 对象存储 |
| **字段加密** | 应用层 | 敏感字段 (PII) |
| **脱敏** | 动态脱敏 | L1-1 / L2-3 / L3-3 |
| **密钥管理** | Vault | HashiCorp Vault + ESO |
| **数据销毁** | 安全擦除 | GDPR 合规 |

### 4.1.5 应用安全

| 措施 | 工具 | 频率 |
|---|---|---|
| **SAST** | SonarQube + Checkmarx | 每次 PR |
| **DAST** | OWASP ZAP | 每周 |
| **SCA** | Snyk + Trivy | 每次构建 |
| **Secret 扫描** | TruffleHog + gitleaks | 每次 PR |
| **容器扫描** | Trivy | 每次构建 |
| **镜像签名** | cosign | 每次推送 |
| **SBOM** | Syft + Grype | 每次构建 |

### 4.1.6 LLM 安全

| 措施 | 实现 |
|---|---|
| **Prompt 注入防护** | 输入分类 + 提示边界 |
| **PII 脱敏** | 注入前自动检测 + 替换 |
| **输出过滤** | 敏感词 + PII 检测 |
| **Token 限流** | LLM Gateway 强制 |
| **成本预算** | LLM Gateway 强制 |
| **模型审计** | 全量 prompt/response 记录（合规）|

---

## §4.2 可观测性

### 4.2.1 三大支柱

```
┌────────────────────────────────────────────────┐
│  Metrics (Prometheus + Grafana)                │
│  - 业务指标 / 系统指标 / 应用指标               │
│  - 告警（Alertmanager）                         │
└────────────────────────────────────────────────┘
┌────────────────────────────────────────────────┐
│  Logs (Loki + Vector)                          │
│  - 结构化日志（JSON）                           │
│  - 多租户隔离（tenant_id 标签）                 │
│  - 全文检索（LogQL）                            │
└────────────────────────────────────────────────┘
┌────────────────────────────────────────────────┐
│  Traces (Tempo + OpenTelemetry)                │
│  - 端到端追踪                                   │
│  - 采样（10% 默认 / 100% 错误）                 │
│  - 服务依赖图（自动生成）                       │
└────────────────────────────────────────────────┘
```

### 4.2.2 关键业务指标

| 指标 | 维度 | 告警阈值 |
|---|---|---|
| **活跃用户数** | tenant, time | < 预期 |
| **业务对象数量** | tenant, type | > 千万 |
| **实例创建速率** | tenant, type | < 预期 / > 异常 |
| **AI 调用次数** | tenant, model | > 预算 |
| **AI Token 消耗** | tenant, model | > 预算 80% |
| **数据写入量** | tenant, dataset | > 异常 |
| **RAG 检索次数** | tenant | < 预期 |
| **流程执行次数** | tenant, process | < 预期 |
| **异常率** | tenant, service | > 1% |
| **P99 延迟** | tenant, endpoint | > 1s |

### 4.2.3 关键系统指标

| 指标 | 来源 | 告警阈值 |
|---|---|---|
| CPU 使用率 | node-exporter | > 80% |
| 内存使用率 | node-exporter | > 85% |
| 磁盘使用率 | node-exporter | > 80% |
| 网络流量 | node-exporter | > 80% 带宽 |
| K8s Pod 重启 | kube-state-metrics | > 3 次/h |
| K8s Pod 不可用 | kube-state-metrics | > 1 min |

### 4.2.4 关键应用指标

| 指标 | 来源 | 告警阈值 |
|---|---|---|
| API 延迟 P50/P95/P99 | APISIX | P99 > 1s |
| API 错误率 | APISIX | > 1% |
| DB 连接数 | pg_exporter | > 80% |
| DB 慢查询 | pg_exporter | > 5s |
| Neo4j 查询 P99 | Neo4j JMX | > 1s |
| Kafka Lag | kafka_exporter | > 10 万 |
| Doris 查询 P99 | Doris | > 3s |
| Milvus 检索 P99 | Milvus | > 500ms |
| Redis 命中率 | redis_exporter | < 90% |
| LLM 延迟 P99 | 自研 | > 5s |
| LLM 成本/小时 | 自研 | > 预算 |

### 4.2.5 告警分级

| 级别 | 含义 | 响应时间 | 通知方式 |
|---|---|---|---|
| **P0 紧急** | 服务不可用 | 5 min | 电话 + 短信 + 钉钉 |
| **P1 高** | 功能受损 | 15 min | 短信 + 钉钉 |
| **P2 中** | 性能下降 | 1 hour | 钉钉 + 邮件 |
| **P3 低** | 提示 | 1 day | 邮件 |

### 4.2.6 SLO

| SLO | 目标 |
|---|---|
| **API 可用性** | 99.9% (SaaS) / 99.99% (金融云) |
| **API 延迟** | P99 < 1s (P75 < 500ms) |
| **数据写入延迟** | P99 < 5s |
| **RAG 检索延迟** | P99 < 1s |
| **LLM 响应** | P99 < 10s |
| **RPO / RTO** | 见 §2.4 |

---

## §4.3 性能

### 4.3.1 性能目标

| 场景 | 目标 | 测量方式 |
|---|---|---|
| **业务对象 CRUD** | < 500ms | P99 |
| **业务对象查询 (10 万)** | < 1s | P99 |
| **图查询 (10 万节点)** | < 1s | P99 |
| **页面渲染** | < 200ms | P75 |
| **拖拽响应** | < 16ms | P95 |
| **RAG 检索** | < 1s | P99 |
| **Doris 简单查询** | < 100ms | P95 |
| **Doris 复杂查询 (1 亿行)** | < 3s | P99 |
| **LLM 简单任务** | < 2s | P95 |
| **LLM 复杂任务** | < 10s | P95 |
| **API 网关** | < 20ms | P99 |

### 4.3.2 性能优化手段

| 维度 | 手段 |
|---|---|
| **前端** | SSR + 缓存 + 虚拟滚动 + 懒加载 |
| **API 网关** | 路由缓存 + 限流 + 熔断 |
| **应用层** | 异步 + 批处理 + 缓存 + 连接池 |
| **数据库** | 索引 + 读写分离 + 分库分表 + 物化视图 |
| **Neo4j** | 索引 + 关系属性 + 查询优化 + Causal Cluster |
| **Doris** | 物化视图 + Colocation + Rollup + 预聚合 |
| **Milvus** | IVF / HNSW 索引 + 分片 + 副本 |
| **Kafka** | 批写 + 压缩 + 分区 + 消费者组 |
| **LLM** | 缓存 + 小模型优先 + 流式 + 路由 |

### 4.3.3 容量规划

**单租户容量**（10 万用户，1 万并发）：
- API 网关：3 副本 × 1C2G = 3 vCPU
- 应用层：30 副本 × 2C4G = 60 vCPU + 120 GB
- PG：8C32G × 2 (主备) = 16 vCPU + 64 GB
- Neo4j：8C32G × 3 (集群) = 24 vCPU + 96 GB
- Doris：8C32G × 6 (3 FE + 3 BE) = 48 vCPU + 192 GB
- Kafka：4C16G × 3 = 12 vCPU + 48 GB
- MinIO：4C8G × 4 = 16 vCPU + 32 GB
- Redis：4C16G × 6 = 24 vCPU + 96 GB
- Milvus：8C32G × 3 = 24 vCPU + 96 GB
- LLM Gateway：2C4G × 3 = 6 vCPU + 12 GB

**总计**：~230 vCPU + 756 GB 内存 + 5 TB 存储

---

## §4.4 容灾

### 4.4.1 故障域

| 故障域 | 缓解措施 |
|---|---|
| **Pod 故障** | K8s 自动重启 + 健康检查 |
| **Node 故障** | K8s 自动迁移 |
| **AZ 故障** | 多 AZ 部署 + PDB |
| **Region 故障** | 异地容灾（§2.4）|
| **DB 故障** | 主备自动切换（Patroni / MHA）|
| **网络分区** | 熔断 + 降级 + 重试 |
| **LLM 服务故障** | 多模型路由 + 降级到本地小模型 |
| **Kafka 故障** | 多 broker + 副本 |

### 4.4.2 降级策略

| 场景 | 降级 |
|---|---|
| **LLM 不可用** | 用规则引擎兜底 |
| **RAG 不可用** | 用关键词检索 |
| **Doris 不可用** | 用 PG 临时查询 |
| **Neo4j 不可用** | 用 PG 关系表（性能差）|
| **Milvus 不可用** | 用 ES 全文检索 |
| **Kafka 不可用** | Outbox 暂存 + 后台重试 |

### 4.4.3 限流

| 层级 | 算法 | 阈值 |
|---|---|---|
| **API 网关** | 令牌桶 | 100 req/s/user |
| **应用** | 滑动窗口 | 50 req/s/user |
| **数据库** | 连接池 | 100 conns |
| **LLM** | 令牌桶 | 100 万 token/day/tenant |

### 4.4.4 熔断

| 服务 | 熔断条件 | 恢复时间 |
|---|---|---|
| **LLM Gateway** | 错误率 > 50% / 5s | 30s |
| **Doris** | 慢查询 > 10s | 60s |
| **Neo4j** | 慢查询 > 5s | 60s |
| **Milvus** | 检索失败 > 20% | 30s |
| **Kafka** | Lag > 100 万 | 自动恢复 |

---

## §4.5 合规

### 4.5.1 国内合规

| 标准 | 适用范围 | 状态 |
|---|---|---|
| **等保 2.0 三级** | 商用电 SaaS | 必过 |
| **等保 2.0 四级** | 金融专有云 | 必过 |
| **GDPR** | 欧盟客户 | 必过 |
| **个人信息保护法** | 国内 | 必过 |
| **数据安全法** | 国内 | 必过 |
| **网络安全法** | 国内 | 必过 |

### 4.5.2 信创合规

| 标准 | 适用范围 | 状态 |
|---|---|---|
| **信创目录** | 政企客户 | 必过 |
| **国密算法** | 金融 | 必过 |
| **数据本地化** | 国内 | 必过 |

### 4.5.3 行业合规

| 行业 | 标准 | 备注 |
|---|---|---|
| **金融** | PCI-DSS、银保监 | |
| **医疗** | HIPAA（美国）、卫健委 | |
| **教育** | 等保 + 教育行业规范 | |
| **制造** | 工业互联网安全 | |

---

## §4.6 v0.1 plan 与本节的关系

| 横切关注点 | v0.1 覆盖 | 备注 |
|---|---|---|
| **认证 / 鉴权** | ❌ 不覆盖 | v0.1 硬编码 X-Actor-Id |
| **多租户** | ❌ 不覆盖 | v0.1 硬编码 default-tenant |
| **可观测** | ❌ 不覆盖 | v0.1 用 stdout 日志 |
| **性能优化** | ❌ 不覆盖 | v0.1 只追求跑通 |
| **灾备** | ❌ 不覆盖 | v0.1 docker-compose |
| **合规** | ❌ 不覆盖 | v0.1 内部 Spike |

**结论**：v0.1 plan 不需要重写（本节关注点对 v0.1 来说是"v0.2+ 才需要"）。

**v0.2 plan 需要补充的横切能力**（按优先级）：
1. **认证 / 鉴权**（必须，商用前提）
2. **多租户 RLS**（必须，商用前提）
3. **可观测（Prometheus + Grafana + Loki）**（必须）
4. **链路追踪（OpenTelemetry + Tempo）**（强烈推荐）
5. **Outbox 模式**（强烈推荐）
6. **限流 / 熔断**（必须）

---

**生成时间**：2026-07-02 14:50
**对应 spec 版本**：v1.2
**下一步**：阅读 [05-tech-selection-matrix.md](./05-tech-selection-matrix.md)
