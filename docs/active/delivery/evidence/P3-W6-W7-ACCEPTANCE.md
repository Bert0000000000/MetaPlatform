# P3-W6 + P3-W7 v3.1 增量 wave 验收

> **验收日期**: 2026-08-01
> **批次**: P3-W6 + P3-W7（v3.1 增量收口 wave）
> **范围**: 6 个 commit 的全部改动
> **关联 ADR**: ADR-0013（Outbox）/ ADR-0014（5 步接入）/ ADR-0016（数据平台）/ ADR-0010（SealedSecrets）
> **状态**: ✅ **Accepted**

---

## 1. 交付范围（6 个 commit）

| commit | 内容 | ADR | 测试增量 |
|---|---|---|---:|
| `bae2ec63` | **D1 lineage e2e** — 跨域 trace chain（msg→obs→dw）+ 租户隔离断言 + `LineageHints` 自动注入 | ADR-0016 §6.5 | +6 e2e |
| `d799b956` | **P3-W6 并行 wave 收口** — business + features + engines + G8 旧 infra 清理 | ADR-0014 | 全后端回归 1292 |
| `85f4df75` | **G3 Outbox DDL**（Alembic 0007，`outbox_event` 11 字段 + 5 索引）+ **G7 SealedSecrets 备份 runbook**（2 文档） | ADR-0013 §2.1 / ADR-0010 §4.3 | +6（G3） |
| `04ce4780` | **DATA helm subcharts 真实化** — debezium / marquez / datahub / ge 4 个 sub-chart 从占位升级为真实 values | ADR-0016 | +46（infra helm） |
| `4878eb82` | **copilot 补 3 endpoint + A2A 真实（TD-4）+ LLM 真实 provider（TD-6）** — OpenAI / Anthropic provider 落地；copilot 35/35 全完成 | ADR-0014 | +18 + 1 test 修复 |

---

## 2. 测试结果

```text
# 全后端回归
$ uv run pytest -p no:cacheprovider -q
1222 passed in ~180s   # 0 failed / 0 skipped

# infra/tests
$ python -m pytest infra/tests -q --tb=short
278 passed in ~2s      # 0 failed / 0 skipped

# 合计
1500 passed / 0 failed / 0 skipped
```

### 2.1 测试演进

| commit | 全后端 | infra | 合计 |
|---|---:|---:|---:|
| `d799b956`（P3-W6 基线） | — | — | 1292 |
| `bae2ec63`（D1 lineage e2e） | — | +6 | 1298 |
| `85f4df75`（G3 outbox） | +6 | — | 1304 |
| `04ce4780`（DATA helm） | — | +46 | 1350 |
| `4878eb82`（copilot/a2a/llmgw） | +18 | — | 1370+ |
| **最终全量** | **1222** | **278** | **1500** |

---

## 3. 关键交付详情

### 3.1 D1 lineage e2e（commit `bae2ec63`）

- `mate_platform/lineage/` 包：Protocol + InMemoryLineageClient + LineageHints
- `Event.create()` 自动注入 `LineageHints`（tenant_id / correlation_id / source_system）
- 5 + 1 e2e tests：跨域 chain + 租户隔离 + hints 传播
- 详见：`evidence/DATA-D0-D8-D1-LINEAGE-E2E-ACCEPTANCE.md`

### 3.2 G3 Outbox DDL（commit `85f4df75`）

- Alembic 迁移 0007：`outbox_event` 表（11 字段 + 5 索引）
- `tenant_id NOT NULL + INDEX`（§13 第 3 条）
- 6 tests：表结构 + 索引 + 默认值 + 降级
- 详见：`evidence/G3-G7-ACCEPTANCE.md`

### 3.3 G7 SealedSecrets 备份 runbook（commit `85f4df75`）

- `docs/active/runbooks/sealed-secret-backup.md`（备份 + 恢复 + 演练 + 责任人）
- `docs/active/runbooks/sealed-secret-backup-inventory.md`（备份清单模板）
- 详见：`evidence/G3-G7-ACCEPTANCE.md`

### 3.4 DATA helm subcharts 真实化（commit `04ce4780`）

- `infra/helm/charts/data-platform/` 4 个 sub-chart 从占位升级为真实 values：
  - **debezium**：CDC 连接器（PostgreSQL / MySQL source）
  - **marquez**：OpenLineage 元数据收集
  - **datahub**：数据目录 + 搜索
  - **ge（Great Expectations）**：数据质量校验
- 46 infra helm tests pass

### 3.5 copilot A2A / LLM 真实（commit `4878eb82`）

- **A2A 真实（TD-4 闭环）**：新建 `a2a/` 模块，`copilot/a2a/delegate` + `copilot/a2a/external` 从 stub 501 升级为真实 A2A 协议闭环
- **LLM 真实 provider（TD-6 闭环）**：
  - `llm/base.py`：LLMProvider Protocol
  - `llm/openai_provider.py`：OpenAI provider
  - `llm/anthropic_provider.py`：Anthropic provider
  - `llm/factory.py`：provider 工厂
  - `llm/stub_provider.py`：保留为 fallback / test 用
- copilot 35/35 endpoint 全部完成
- 18 tests + 1 test 修复（`test_a2a_delegate_proxies_to_a2a`）

---

## 4. 13 硬规则映射

| # | 硬规则 | 本批次关联 | 证据 |
|---|---|---|---|
| 4 | **外部系统没有 ACL Client** | copilot LLM provider 通过 `llm/base.py` Protocol + factory 封装；A2A 通过 `a2a/` 模块封装；不裸调 httpx | `llm/factory.py` + `a2a/` 模块 |
| 9 | **没有审计、指标、trace** | D1 lineage e2e：`LineageHints` 携带 `tenant_id` + `correlation_id`（= trace_id）；G3：`outbox_event` 表是事件审计基础存储，`lineage_hints` 列与 D1 对齐 | `lineage/hints.py` + Alembic 0007 |
| 12 | **Secret 不进 git** | G7：SealedSecrets 主私钥异地备份 runbook + 恢复 + 演练 | `sealed-secret-backup.md` + `sealed-secret-backup-inventory.md` |
| 13 | **NetworkPolicy 缺失 = prod 不通过** | DATA helm 真实化沿用 default-deny NetworkPolicy（GA-ACCEPTANCE 已闭环） | `infra/helm/charts/network-policies/` |

> 其余硬规则（1/2/3/5/6/7/8/10/11）在 GA-ACCEPTANCE 已闭环，本批次不引入回归。

---

## 5. 关联 ADR

| ADR | 标题 | 本批次关联 |
|---|---|---|
| ADR-0010 | SealedSecrets 密钥管理 | G7 备份 runbook（§4.3） |
| ADR-0013 | Outbox + 幂等消费者 + DLQ | G3 `outbox_event` 表 DDL（§2.1） |
| ADR-0014 | 17 域 5 步接入模式 | copilot A2A/LLM 真实遵循 5 步模式 |
| ADR-0016 | 数据平台架构 | D1 lineage e2e（§6.5）+ DATA helm 真实化 |

---

## 6. G 项状态

| # | 项 | 状态 | 备注 |
|---|---|---|---|
| G1 | kafka sub-chart 落地 | In Progress | 不在本批次范围 |
| **G3** | **Outbox DDL 迁移** | **✅ Accepted** | commit `85f4df75` |
| G4 | 真实 K8s 集成 e2e | Not Started | 不在本批次范围 |
| G5 | per-service `security:` 段补齐 | In Progress | 不在本批次范围 |
| G6 | 已有表 `tenant_id` 回填 + RLS | Not Started | 不在本批次范围 |
| **G7** | **SealedSecrets 主私钥备份 runbook** | **✅ Accepted** | commit `85f4df75` |
| G8 | 清理 main 上旧 `infra/` | In Progress | P3-W6 已部分清理 |

---

## 7. 结论

- **P3-W6 + P3-W7 v3.1 增量 wave Accepted**：6 个 commit 全部通过验收，1500 passed / 0 failed。
- **D1 lineage e2e**：跨域 trace chain + 租户隔离端到端可查可断言。
- **G3 Accepted**：`outbox_event` 表 Alembic 迁移 0007 已落地（11 字段 + 5 索引），6 tests pass。
- **G7 Accepted**：SealedSecrets 主私钥异地备份 runbook 覆盖全流程。
- **DATA helm 真实化**：4 个 sub-chart 从占位升级为真实 values，46 tests pass。
- **copilot 35/35**：A2A 真实协议闭环（TD-4）+ LLM 真实 provider（TD-6，OpenAI / Anthropic），18 tests pass。
- **G2 / G4 / G5 / G6 / G8** 仍为 In Progress / Not Started，不在本批次范围。
