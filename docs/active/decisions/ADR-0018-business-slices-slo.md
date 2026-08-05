# ADR-0018：BUSINESS-SLICES AI 服务 SLO 与可观测性

> 状态：**Proposed**（PRR 联调诊断 v3.1 BUSINESS-SLICES 阶段产物）
> 日期：2026-08-05
> 关联批次：BUSINESS-SLICES（PROGRAM-BOARD.md v3.1 增量）
> 关联设计：docs/active/specs/2026-07-30-backend-production-readiness-design.md §13 hard rule 9
> 上游依赖：TECH-SERVICES (ADR-0014) ✅、GA-ACCEPTANCE (ADR-0015) ✅、PLATFORM-K8S-01 (ADR-0010) ✅、SEC-IAM-01 (ADR-0011) ✅、SEC-TENANT-01 (ADR-0012) ✅、PLATFORM-EVENT-01 (ADR-0013) ✅、DATA-D0-D8 (ADR-0016) ✅、AI 客户端 ACL（B1 已落地）
> 触发来源：v3.1 BUSINESS-SLICES 联调诊断报告（PRR + LLM AppSec），P0 Blocker B2 / B3。

---

## 1. Context

BUSINESS-SLICES 是 v3.0 GA 后第一个面向业务的 v3.1 增量批次，把 17 域按 P0/P1/P2
分批接入 `mate-platform` 提供的 auth + tenant + event 三层（ADR-0014）。

联调阶段（前端 metaplatform-frontend @ :9200 → gateway :8100 → AI 服务：
mate-app-copilot / mate-tech-llmgw / mate-tech-rag / mate-tech-agent / mate-tech-mcp /
mate-tech-deep-research）发现 4 项 P0 Blocker（B1-B4），其中：

- **B2：AI 服务无 SLO 基线** —— `mate-tech-llmgw/quota/bucket.py` 已实现
  50 req/min/tenant 限流，但**没有 SLO 表**；TTFT、工具调用成功率、cost 上限、越权告警
  均无基线和告警。
- **B3：Adversarial eval 缺失** —— prompt injection / 越权 / exfiltration / cost abuse
  / 系统 prompt 泄露零覆盖。

GA-ACCEPTANCE (ADR-0015) §13 hard rule 9 要求 "所有状态以审计、指标、trace 为准"，
但 §13 hard rule 9 在 v3.0 GA 时只覆盖了 OTel collector + tenant.id 注入；**业务级
SLO（用户旅程）**未落地。本 ADR 补完这块。

## 2. Decision

BUSINESS-SLICES AI 服务链路（copilot / llmgw / rag / agent / mcp / deep-research /
ont）落地 4 条**用户旅程级 SLO** + 1 条**成本 SLO** + 1 条**安全 SLO**：

### 2.1 SLO 表（必交付，5 步接入 checklist 第 6 步）

| Journey | SLO / Target | SLI 探针 | 告警阈值 | Owner | 数据来源 |
|---|---|---|---|---|---|
| **RAG 首 token 时延（TTFT）** | p95 ≤ 1.5s（本地）/ ≤ 4s（含 LLM 上游） | `rag.retrieve.latency_ms` + `llmgw.chat.ttft_ms` | p95 越线 ≥ 3min | RAG + LLMGW owner | OTel span `rag.retrieve` + `llmgw.chat` |
| **Agent / Copilot 任务完成率** | ≥ 99%（不计 LLM 上游已知故障） | `agent.run.outcome` + `copilot.chat.outcome` | 错误率 > 5% | Agent + Copilot owner | OTel outcome attribute |
| **MCP 工具调用授权失败率** | < 0.5%（hard rule 3/4 强约束） | `mcp.tool.deny_count` / `mcp.tool.total_count` | 单窗口 > 1 次 | MCP owner | `mate-platform.tenancy.guards` 抛出计数 |
| **LLM 网关成本上限（per tenant）** | 月度上限可配；超限 → 429 + Retry-After | `llmgw.quota.exceeded_count` | 任意租户超额 ≥ 1 次/小时 | LLMGW owner | `mate_tech_llmgw/quota/bucket.py` 计数 |
| **跨租户越权告警（hard rule 3）** | 必须为 0；> 0 即 P0 | `mate_platform.tenancy.cross_tenant_attempt` | 单次即触发 | Security owner | `mate-platform/tenancy/ads_audit.py` |

### 2.2 4 条 journey health model（OTel span 必接）

每条 journey 必须落以下 OTel span，否则不算 SLO 闭环：

```
web.request
  → bff.route                          (前端 → gateway)
  → copilot.invoke                      (chat / completion)
    → agent.step                        (LangGraph node)
    → rag.retrieve                      (hybrid/graph/lightrag)
      → llmgw.embed                     (embedding)
    → llmgw.chat                        (chat completion，含 TTFT)
    → tool.execute                      (mcp / a2a)
```

每个 span 必须带 `tenant.id` + `user.id` + `trace.id`（hard rule 9）。

### 2.3 Per-app 第 6 步：SLO 接线

在 ADR-0014 5 步 checklist 之上加第 6 步：

```
6. SLO 接线：
   a. 为每个 app 在 main.py 入口注册 journey span（start_as_current_span）
   b. outcome attribute 写 success/error/timeout/cancel
   c. 接入 OTel collector → Prometheus → Grafana → Alertmanager
   d. 在 runbooks/{copilot,rag,agent,mcp,llmgw}.md 加 SLO 越线 runbook
```

未接 SLO 的 app 不标记 Accepted（与 GA-ACCEPTANCE §13 hard rule 10 evidence 一致）。

### 2.4 Cost ceiling（新增）

LLMGW `QuotaExceededError` 已实现 RPM/TPM 限流（§5 配套基础设施），但**月度成本
上限未实现**。本 ADR 新增：

| 维度 | 实现位置 | 行为 |
|---|---|---|
| per-tenant 月度 token 上限 | `mate_tech_llmgw.quota.bucket.MonthlyTokenBucket` | 超限 → 429 + Retry-After（持久到 PG `llmgw_tenant_quota`） |
| per-user 单日 cost 上限 | `mate_tech_llmgw.cost.recorder.UserDailyCap` | 超限 → 429 + 强制走 stub |
| denial-of-wallet 防御 | `mate_tech_llmgw.cost.recorder.CostRecorder` | 检测单用户单小时成本突增 ≥ 10x 中位数 → 临时封禁 + alert |

### 2.5 Adversarial eval 集（新增，B3）

新建 `tests/security/test_llm_adv_*.py`，覆盖 ≥ 20 case（见 LLM AppSec §3）。

## 3. Decision Drivers

| Driver | Priority | Evidence | Tradeoff |
|---|---|---|---|
| 用户体验稳定性 | P0 | 联调阶段所有 AI 服务无 SLO，fail 不可见 | 接受 SLO 越线时人工 oncall |
| Cost abuse 防御 | P0 | 无 monthly ceiling → denial-of-wallet 风险 | 接受少量 false-positive 拒服务 |
| 跨租户安全 | P0 | hard rule 3 + 4 是 §13 强约束 | 任何越权即 P0 阻断 |
| 可观测性投入 | P1 | 已 GA OTel，但 journey 视图缺失 | 接入 span 是低成本改造 |
| LLM 上游不可控 | P1 | OpenAI/Anthropic/Doubao 故障不可控 | 缓存 + 多模型 fallback（已实现） |

## 4. Options Considered

| Option | Benefits | Costs | Risks | Selected Because |
|---|---|---|---|---|
| A. 仅告警，不定义 SLO target | 启动快 | 告警风暴；不可判断是否"达标" | 失稳态无 baseline | ❌ |
| B. **本 ADR：journey-level SLO + cost ceiling + adversarial eval** | 与 hard rule 9 / 10 闭环；evidence 可验 | 需补 OTel span + cost bucket + eval | 工程量 ~2 周 | ✅ |
| C. 等价于 NFR SLA 文档（无 telemetry 改造）| 文档齐全 | 不可验、不可执行 | 重蹈 v3.0 早期"无 SLO 时代" | ❌ |

## 5. Status

**Proposed** → 待 BUSINESS-SLICES P0/P1 接入完成后晋升 **Accepted**。

升级条件：

1. 7 个 AI 服务包（copilot / llmgw / rag / agent / mcp / deep-research / ont）
   全部接入 SLO span。
2. `tests/security/test_llm_adv_*.py` ≥ 20 case pass。
3. LLMGW monthly + per-user daily quota 在 staging 跑过 1 周无 false-positive。
4. Grafana dashboard 链接到 runbook。

## 6. Bounded Context Map

| Context | Responsibility | Owner | Upstream | Downstream |
|---|---|---|---|---|
| SLO registry | 4 journey SLO target + cost ceiling config | SRE | OTel collector | Grafana / Alertmanager |
| OTel collector | span aggregation | PLATFORM-K8S-01 (ADR-0010) | 各 app | Tempo / Prometheus |
| Adversarial eval | CI gate on prompt injection / 越权 / cost abuse | Security | LLMGW + RAG + MCP + Agent | CI |
| Quota bucket | per-tenant RPM/TPM/monthly + per-user daily | LLMGW owner | `mate_tech_llmgw.quota.bucket` | API gateway (429) |
| Cost recorder | usage tracking + alert on denial-of-wallet | LLMGW owner | LLMGW cache + provider | Grafana / oncall |

## 7. Runtime Dependency Adoption

| Dependency | Capability | Failure Mode | Timeout/Retry/Fallback | Adoption Criteria |
|---|---|---|---|---|
| OTel collector | 跨服务 trace 聚合 | collector down → span 丢失 | n/a（OTel SDK 本地 buffer）| span 覆盖率 ≥ 95% |
| Prometheus | 指标 scrape | scrape 失败 → alert 延迟 | retry 3 次 | 5xx 越线告警 ≤ 5min 触发 |
| Grafana | dashboard 渲染 | dashboard 不可用 → 不阻断业务 | n/a | dashboard 与 runbook 一一对应 |
| LLMGW quota (RPM/TPM) | 实时限流 | Redis down → 降级 no-op | 已有 try/except | 超限 100% 命中 |
| LLMGW quota (monthly) | 月度限流 | PG down → 降级允许请求 + alert | retry 3 次 + 临时放行 | 超限 100% 命中 |
| Cost recorder | token / cost 用量 | PG down → 降级 no-op | 已有 try/except | cost 数据 0 丢失 |

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| LLM 上游持续故障导致 SLO 不可达 | High | 用户体验降级 | 缓存 + 多模型 fallback（已实现） | LLMGW |
| Cost ceiling false-positive 拒绝合法用户 | Medium | 业务损失 | monthly cap 默认高水位，按需下调 | LLMGW |
| Adversarial eval 误报阻塞 CI | Medium | 联调效率下降 | eval case 与 prompt 升级同步演进 | Security |
| SLO target 漂移（上游变慢）| High | SLO 失真 | 月度 review SLO target | SRE |
| OTel collector 单点 | Medium | span 不可见 | K8s HA + Tempo backend（已有）| PLATFORM-K8S-01 |

## 9. Consequences

**正面**：
- 联调阶段即可观测每个 journey 的 p95 / 错误率 / 越权。
- LLM 成本有上限，杜绝 denial-of-wallet。
- Adversarial eval 闭环，避免 v3.0 早期"ad-hoc 联调" 模式。

**负面**：
- 7 个 AI 服务包均需补 OTel span（约 30-50 行/包）。
- 月度 quota 持久化增加 PG 写压力（预计 < 10 qps/tenant，可忽略）。
- Adversarial eval 需 LLM 真实调用（mock 不可信），CI 时间 +30s。

## 10. Evidence

- PRR + LLM AppSec 联调诊断报告（2026-08-05）。
- ADR-0014 TECH-SERVICES 5 步 checklist + 第 6 步 SLO 接线。
- `docs/active/runbooks/{copilot,rag,agent,mcp,llmgw}.md`（待更新）。

## 11. Revisit Triggers

触发重新审视：

- LLM 上游新增/移除（影响 TTFT target）。
- BUSINESS-SLICES 17 域全部接入完成。
- Production 上 SLO 越线 ≥ 3 次/月（target 偏低）。
- Production 上 SLO 长期 0 越线（target 偏高，可收紧）。

---

## 配套 checklist（per-app）

应用 owner 接入 SLO 时，需提交：

- [ ] `main.py` 入口注册 journey span（含 `tenant.id` + `outcome`）
- [ ] Prometheus alert rule（SLO 越线告警）
- [ ] Grafana dashboard 链接到 runbook
- [ ] runbook 加入"首次 SLO 越线排查"段
- [ ] `tests/security/test_<app>_adv.py` ≥ 5 case（应用特定 adversarial）
- [ ] Quota 配置（per-tenant RPM/TPM/月度）写入 `.env.example`
- [ ] evidence: 跑 24h 后在 dashboard 上看到 journey 视图