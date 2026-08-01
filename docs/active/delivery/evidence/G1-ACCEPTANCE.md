# G1-ACCEPTANCE — Kafka sub-chart 落地

> 状态：**Accepted** (G1 kafka sub-chart)
> 日期：2026-08-02
> 关联：`docs/active/decisions/ADR-0013-platform-event-outbox.md` · `2026-08-02-v3.2-parallel-prompts.md` W3
> PROGRAM-BOARD 项：G1 kafka sub-chart 落地

---

## 1. 选型决策：KRaft（无 ZooKeeper）

| 维度 | KRaft（选） | ZooKeeper（弃） |
|---|---|---|
| 架构复杂度 | combined controller+broker，无外部协调服务 | 需独立 ZK ensemble（3+ 节点）|
| 运维成本 | 单一组件、单镜像 | 双系统、双升级路径 |
| Kafka 版本 | 3.3+ GA，3.7 生产稳定 | legacy，Kafka 4.0 移除 |
| 本项目约束 | K8s StatefulSet 稳定 DNS 满足 KRaft quorum | 额外 ZK chart + 额外 PVC |

**结论**：KRaft 模式（`process.roles=controller,broker`），3 broker combined
ensemble。ZooKeeper 模式作为 fallback 保留（`kraft.enabled: false` 时渲染
`zookeeper.yaml`），但不是生产路径。

## 2. sub-chart 结构

```
infra/helm/charts/kafka/
├── Chart.yaml          apiVersion: v2, version: 0.1.0, appVersion: 3.7.1
├── values.yaml         G1 默认值（3 broker / 50Gi PVC / 2Gi·1CPU / tenantIsolation）
├── README.md           values 表 + 架构图 + 硬规则映射
└── templates/
    ├── _helpers.tpl        kafka.fullname / labels / selectorLabels / kraft.quorumVoters
    ├── statefulset.yaml    KRaft combined controller+broker（NODE_ID 从 pod ordinal 派生）
    ├── service.yaml        headless（stable DNS）+ ClusterIP（client access :9092）
    ├── configmap.yaml      broker 配置（partitions / retention / compression / tenant isolation）
    ├── networkpolicy.yaml  default-deny，ingress 限 namespace（hard rule 13）
    ├── zookeeper.yaml      fallback（kraft.enabled=false 时渲染）
    └── NOTES.txt           部署后提示（bootstrap / DNS / 验证命令）
```

## 3. G1 关键配置

| 配置 | 默认值 | 说明 |
|---|---|---|
| `replicaCount` | 3 | 3-broker KRaft ensemble（local override=1）|
| `kraft.enabled` | true | 无 ZooKeeper |
| `persistence.enabled` | true | 50Gi PVC（local override=emptyDir）|
| `persistence.size` | 50Gi | 生产持久化 |
| `resources.requests` | 1 CPU / 2Gi | 生产 override 2 CPU / 4Gi |
| `autoScaling.enabled` | true | 资源治理（requests/limits 声明）|
| `tenantIsolation.enabled` | true | 每个 tenant 独立 topic prefix |
| `tenantIsolation.topicPrefix` | "tenant" | topic = tenant.\<tid\>.\<domain\>.\<event\> |
| listener | plain:9092 / controller:9093 | KRaft controller quorum on 9093 |

## 4. umbrella 集成

- `infra/helm/Chart.yaml` dependencies 含 `kafka`（version 0.1.0, condition
  `kafka.enabled`）。
- `infra/helm/values.yaml`：`kafka.enabled: true` + G1 完整配置块。
- `values-local.yaml`：override 为 1 broker / emptyDir。
- `values-staging.yaml`：override 为 2 broker / 15Gi PVC。
- `values-production.yaml`：override 为 3 broker / 30Gi / 4Gi·2CPU。

## 5. 验收

### 静态测试（pytest）

```
infra/tests/test_g1_kafka_chart.py — 6 tests
```

- `test_kafka_chart_exists` — Chart.yaml 文件存在
- `test_kafka_chart_has_kraft` — statefulset 含 KRaft 配置（process.roles / controller）
- `test_kafka_chart_has_persistence` — values 有 persistence.enabled
- `test_kafka_chart_has_networkpolicy` — networkpolicy.yaml 存在
- `test_kafka_chart_has_tenant_isolation` — values 有 tenantIsolation.enabled
- `test_umbrella_includes_kafka` — umbrella Chart.yaml dependencies 包含 kafka

### helm lint / helm template（CI 覆盖）

`helm lint` + `helm template` + `kubeconform` 由 `platform-k8s-ci.yml` CI job 覆盖。

## 6. 硬规则映射

| 硬规则 | G1 闭环 |
|---|---|
| §13 #8（K8s readiness + 回滚）| StatefulSet liveness/readiness probe（tcpSocket :9092）+ PVC volumeClaimTemplates |
| §13 #12（Secret 不进 git）| KRaft clusterId 是 value override；SASL_SSL 走 SealedSecret |
| §13 #13（NetworkPolicy 缺失=prod 不通过）| default-deny Ingress+Egress，限 metaplatform/api-gateway namespace |
| §13 #3（tenant 上下文）| tenantIsolation.enabled + topic prefix 约定 |

## 7. 状态

**Accepted** — G1 kafka sub-chart 落地完成。
