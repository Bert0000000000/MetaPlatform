# MP-V6-OBSERVABILITY-01 — 可观测层部署

> **Batch 状态**：Pending Acceptance
> **优先级**：🔴 P0（必做）
> **工作量**：2 周
> **团队**：SRE
> **前置依赖**：MP-V6-FOUNDATION-01

---

## 1. 目标

部署 OTel + Tempo + Prometheus + Loki + Grafana 可观测栈，所有应用统一接入。

## 2. 配套文档

- 技术架构 spec：[`docs/active/specs/2026-08-19-mp-v6-architecture.md`](../../specs/2026-08-19-mp-v6-architecture.md) §7.16 可观测层设计
- 应用架构 spec：[`docs/active/specs/2026-08-19-mp-v6-application-architecture.md`](../../specs/2026-08-19-mp-v6-application-architecture.md) §9 应用可观测性

---

## 3. 关键交付

### 3.1 OTel Collector

- [ ] 部署到 `mp-monitoring` namespace
- [ ] 配置接收 OTLP（gRPC + HTTP）
- [ ] 配置 exporters：Tempo + Prometheus + Loki
- [ ] 配置自动注入 tenant.id / service.name

### 3.2 存储

|组件 | 角色 |
|---|---|
| Tempo | trace 存储（distributed tracing）|
| Prometheus | metric 存储 +告警 |
| Loki | log 存储（聚合应用 stdout）|
| Grafana | 统一可视化面板 |

### 3.3 Grafana Dashboard（基础）

- [ ] 应用健康（QPS / 错误率 / 延迟）
- [ ] K8s 基础设施（CPU / 内存 / 网络）
- [ ] Supabase PG（连接数 / QPS / 慢查询）
- [ ] Temporal（workflow throughput / Activity失败率）

### 3.4 告警规则（基础）

|级别 | 触发 | 通知 |
|---|---|---|
| Critical | 错误率 > 5% 持续 5 分钟 | 邮件 + 钉钉 + PagerDuty |
| Warning | P99 延迟 > 3s 持续 10 分钟 | 邮件 |
| Info | 部署事件 | Slack |

---

## 4. 详细任务清单

### 第 1 周：OTel + 存储

- [ ] 部署 OTel Collector（Helm）
- [ ] 部署 Tempo
- [ ] 部署 Prometheus
- [ ] 部署 Loki
- [ ] 部署 Grafana
- [ ] 配置数据源

### 第 2 周：Dashboard + 告警

- [ ] 创建基础 Dashboard（应用 / K8s / Supabase / Temporal）
- [ ] 配置告警规则（Critical / Warning / Info）
- [ ] 配置通知渠道（邮件 / 钉钉 / Slack）
- [ ] 验证：从某个测试应用上报数据 → Grafana 显示
- [ ] evidence/MP-V6-OBSERVABILITY-01-ACCEPTANCE.md

---

## 5. 验收标准

- [ ] OTel Collector 运行 +接收数据
- [ ] Tempo / Prometheus / Loki / Grafana 全部运行
- [ ] 4 个基础 Dashboard 配置完成
- [ ] 告警规则配置 + 通知渠道验证
- [ ] evidence 文档完成
- [ ] 通知下游 Batch（所有应用）可接入可观测

## 6. 风险与缓解

|风险 | 缓解 |
|---|---|
| Grafana 配置复杂 | 4 个基础 Dashboard 起步，后续按需加 |
| OTel SDK 版本不一致 | 固定 SDK 版本 + CI 校验 |
| Prometheus 存储膨胀 | 设置保留周期（30 天）|