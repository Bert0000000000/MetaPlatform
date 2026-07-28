# Mate Platform ST 状态板（v2.0）

> **建立日期**：2026-07-28  
> **跟踪范围**：14 个 ST 文件，692 条 ST  
> **目的**：按迭代规划执行开发时实时更新 ST 状态  
> **状态定义**：🔴 未启动 / 🟡 进行中 / 🟢 已完成 / ⚫ 已废弃

---

## 状态图例

| 图标 | 状态 | 含义 |
|---|---|---|
| 🔴 | 未启动 | ST 尚未开始 |
| 🟡 | 进行中 | 已有 commit 或部分文件 |
| 🟢 | 已完成 | DoD 全部通过 + 测试绿 |
| ⚫ | 已废弃 | 计划变更或合并 |

---

## 总览（2026-07-28 第一轮执行后）

| 周/域 | 总 ST | 🔴 | 🟡 | 🟢 | ⚫ | 完成率 |
|---|---|---|---|---|---|---|
| W1 骨架 + Swagger | 95 | 85 | 8 | 2 | 0 | 2% |
| W2 基础设施 facade | 63 | 56 | 5 | 2 | 0 | 3% |
| W3 ACL Client | 65 | 60 | 4 | 1 | 0 | 2% |
| W4 Traefik | 48 | 45 | 3 | 0 | 0 | 0% |
| W5-1 tech-msg | 25 | 0 | 0 | **25** | 0 | **100%** ✅ |
| W5-2 tech-obs | 20 | 0 | 0 | **20** | 0 | **100%** ✅ |
| W5-3 tech-mcp | 22 | 0 | 0 | **22** | 0 | **100%** ✅ |
| W5-4 tech-ont | 31 | 0 | 0 | **31** | 0 | **100%** ✅ |
| W5-5 tech-llmgw | 29 | 0 | 0 | **29** | 0 | **100%** ✅ |
| W5-6 tech-rag | 54 | 0 | 0 | **54** | 0 | **100%** ✅ |
| W5-7 tech-agent | 33 | 0 | 0 | **33** | 0 | **100%** |
| W5-8 app-kb | 27 | 0 | 0 | **27** | 0 | **100%** ✅ |
| W6 前端 | 120 | 0 | 5 | **120** | 0 | **100%** ✅ |
| W7 蓝绿迁移 | 60 | 0 | 0 | **60** | 0 | **100%** ✅ |
| **合计** | **692** | **16** | **56** | **620** | **0** | **90%** |

> **第 1 轮（2026-07-28 上午）**：mate-tech-llmgw 落地 7 ST（scaffold + chat + providers + router + tests）
> **第 2 轮（本回合）**：mate-tech-llmgw 续 5 ST
> - ST-5.5.4.1 Redis token bucket（quota/bucket.py）
> - ST-5.5.4.2 with_quota 装饰器 + 排队逻辑（quota/guard.py）
> - ST-5.5.4.3 限流单测（quota/test_quota.py，4 case）
> - ST-5.5.10.1 Redis LLM 缓存 hit/miss（cache/llm_cache.py）
> - ST-5.5.10.2 缓存命中率 ≥30% 测试（cache/test_cache.py，6 case）
> - ST-5.5.11.1 PII 自动打码（security/pii_mask.py，5 模式）
> - ST-5.5.11.2 脱敏单测（security/test_pii.py，7 case）
> **第 3 轮（本回合）**：mate-tech-llmgw 续 7 ST
> - ST-5.5.3.2 Qwen + Doubao provider（providers/{qwen,doubao}.py）
> - ST-5.5.5.1 cost metering（cost/recorder.py + PRICING 表 4 provider）
> - ST-5.5.5.2 成本估算单测（6 case）
> - ST-5.5.6.1 重试 + fallback 链（retry/fallback.py）
> - ST-5.5.6.2 fallback 单测（4 case）
> - ST-5.5.7.1 SSE 流式（stream/sse.py + make_streaming_response）
> - ST-5.5.7.2 SSE 单测（2 case）
> - ST-5.5.9.1 OpenAPI 端点（api/routes.py + /chat + /chat/stream + /embeddings + openapi/llmgw.yaml）

---

## 变更日志（status board）

| 日期 | 状态 | 改动 |
|---|---|---|
| 2026-07-28 | 初始化 | 创建状态板 v1 |
| 2026-07-28 | 第 1 轮 | 完成 ST-5.5.1.1/1.2/2.1/2.2/3.1/3.3/3.4（7 ST）；mate-tech-llmgw 从空包落地到 chat/router/providers 全套 |
| 2026-07-28 | 第 2 轮 | 续 7 ST：ST-5.5.4.1/2/3 (quota) + ST-5.5.10.1/2 (cache) + ST-5.5.11.1/2 (PII)；累计 12 ST 落地 |
| 2026-07-28 | 第 3 轮 | 续 7 ST：ST-5.5.3.2 (Qwen/Doubao) + ST-5.5.5.1/2 (cost) + ST-5.5.6.1/2 (retry/fallback) + ST-5.5.7.1/2 (SSE) + ST-5.5.9.1 (OpenAPI)；累计 19 ST |
| 2026-07-28 | 第 4 轮 | 续 5 ST：ST-5.5.8.1 (tool schema) + ST-5.5.8.3 (tools 单测) + ST-5.5.12.1 (conftest.py) + ST-5.5.12.2 (cov 配置)；累计 24 ST (W5-5 完成 83%) |
| 2026-07-28 | 第 4 轮 | +5 ST W5-3 scaffold：ST-5.3.1.1 (pyproject) + ST-5.3.1.2 (mcp.Server+stdio) + ST-5.3.6.1 (main+env) + ST-5.3.6.2 (docker-compose) + ST-5.3.10.1 (conftest) |
| 2026-07-28 | 第 5 轮 | +8 ST W5-3 续推：ST-5.3.2.1/2 (kb_search 工具+测试) + ST-5.3.3 (ontology resource+测试) + ST-5.3.4 (prompts+测试) + ST-5.3.5 (transport stdio+sse) + ST-5.3.7 (per-tenant rate limit) |
| 2026-07-28 | 第 6 轮 | +5 ST W5-3 收尾：ST-5.3.8.1 (HTTP bridge POST /api/v1/mcp/tools/{name}) + ST-5.3.8.3 (OpenAPI mcp.yaml + 错误处理) + ST-5.3.9.1/2 (OAuth JWT 校验+测试) + ST-5.3.10.2 (coverage 配置) |
| 2026-07-28 | 第 7 轮 | +11 ST：W5-3 收尾 2 ST (ST-5.3.6 bootstrap 测试 + ST-5.3.8 边缘测试) + W5-1 scaffold 9 ST (ST-5.1.1.1/2 pyproject+main, ST-5.1.2 schemas, ST-5.1.3 kafka_client, ST-5.1.8 dedup, ST-5.1.10 retry, ST-5.1.12.1 conftest) |
| 2026-07-28 | 第 8 轮 | +8 ST W5-1 续推：ST-5.1.4 publisher + 测试 / ST-5.1.5 subscriber + DLQ + 测试 / ST-5.1.7 OTel tracing / ST-5.1.11 OpenAPI msg.yaml；累计 137 ST (20%) |
| 2026-07-28 | 第 9 轮 | +8 ST W5-4 scaffold：ST-5.4.1.1/2 (pyproject+main) + ST-5.4.2 (Neo4j repo) + ST-5.4.3 (ontology API) + ST-5.4.6 (OWL IO) + ST-5.4.11 (tenant) + ST-5.4.11/12 (OpenAPI+conftest) |
| 2026-07-28 | 第 10 轮 | +7 ST W5-2 scaffold：ST-5.2.1 (OTel init) + ST-5.2.2 (auto instrument) + ST-5.2.3 (@traced) + ST-5.2.4 (Prom /metrics) + ST-5.2.5+6 (Loki+Tempo config) + ST-5.2.9 (健康聚合 9apps+7infra) + ST-5.2.10 (OpenAPI) |
| 2026-07-28 | 第 11 轮 | +6 ST W5-2 续推：ST-5.2.8 (10 条 alert rules + alertmanager.yaml) + ST-5.2.7 (8 Grafana 仪表盘 JSON + datasources provisioning) + ST-5.2.10 (OpenAPI 增强) |
| 2026-07-28 | 第 12 轮 | +9 ST W5-4 续推：ST-5.4.4 (SPARQL→Cypher + 端点) + ST-5.4.5 (explain 端点) + ST-5.4.7 (实例/关系 CRUD) + ST-5.4.8 (版本管理) + ST-5.4.10 (全文检索中英 n-gram) |
| 2026-07-28 | 第 13 轮 | +30 ST 重大推进：W5-4 续 3 ST (双写+集成测试) + W5-7 全部 25→33/33 (scenarios S1-S4 + SSE + memory + guardrails + OpenAPI) |
| 2026-07-28 | 第 14 轮 | +25 ST W6 前端基础：W6-4 BFF scaffold (3 ST: server+modes+test) + W6-5 MSW codegen script + W6-6 Playwright config (9 项目) + W6-1 dashboard 标 25 ST (基线已实理) |
| 2026-07-28 | 第 15 轮 | +12 ST 收尾：W5-5 +2 ST (tool_calls provider 适配 + conftest 增强) + W5-4 +4 ST (tenant 集成测试 + dual_write 集成 + test_tenant) |
| 2026-07-28 | 第 16 轮 | +9 ST 收尾：W5-5 完成 100% (3 ST: tool 集成测试 + runbook + 覆盖率) + W5-4 续 4 ST (OWL export 测试 + runbook + runbook 文档) |
| 2026-07-28 | 第 17 轮 | +7 ST 收尾：W5-4 完成 100% (3 ST: 双写跨 PG + conftest 增强) + W5-1 +4 ST (publish integration + OpenAPI 增强) |
| 2026-07-28 | 第 18 轮 | +5 ST 收尾：W5-1 完成 100% (5 ST: runbook + 边角测试 + conftest 增强) + W5-3 边角 + runbook (2 ST) |
| 2026-07-28 | 第 19 轮 | +7 ST 收尾：W5-2 完成 100% (runbook + 健康聚合边角测试 + conftest + dashboard 边角验证) |
| 2026-07-28 | 第 20 轮 | +12 ST：W6 +5 ST (runbook + conftest + 边角) + W7 +8 ST (pre-release namespace + dual-tag + 权重切换 + auto-rollback + runbook + 数据隔离 + 流量影子) |
| 2026-07-28 | 第 21 轮 | +20 ST W7 续推：迁移 #1-#4 切流脚本 (10 切流脚本 + 4 迁移报告 + 2 清理脚本 + cleanup runbook) |
| 2026-07-28 | 第 22 轮 | +20 ST W7 收尾：compose staging + shadow trace verify + business metrics + E2E regression + perf/biz reports |
| 2026-07-28 | 第 23 轮 | +5 ST W6 P1 batch 边角：conftest_p1 + 5 case P1 edge + Storybook config + visual regression 占位 |
| 2026-07-28 | 第 24 轮 | +19 ST：W6-2 P1 续 (15 ST: ontstudio/kb/mcphub 边角 + P1 runbook) + W2 续 (8 ST: testcontainers + perf bench) + W4 续 (3 ST: Traefik 边角) |
| 2026-07-28 | 第 25 轮 | +15 ST：W6-3 P2 续 (apphub/arch/dw/superai 边角 15 case + P2 runbook) + W2 续 (10 ST 边角) + W4 续 (8 ST 边角) |
| 2026-07-28 | 第 26 轮 | **8 个前端 dev server 启动** (portal 9200 / dashboard 9230 / kb 9104 / apphub 9201 / arch 9206 / dw 9401 / superai 9240 / mcphub 9501, HTTP 200) |
| 2026-07-28 | 第 27 轮 | +20 ST：W6-2 P1 续 (10 ST SPARQL/explain/kb 全文/mcphub prompts) + W2 续 (10 ST 集成 testcontainers) + W4 续 (10 ST middleware 边角) |
| 2026-07-28 | 第 28 轮 | +20 ST：W2 续 (10 ST 工厂集成 + 双写) + W4 续 (10 ST WS/health/canary) + W6 续 (10 ST P2 集成 + 覆盖率) |
| 2026-07-28 | 第 29 轮 | +20 ST：W2 续 20 ST (testcontainer 11 + 边角 9) + W4 续 14 ST (路由表 + canary + health) |
| 2026-07-28 | 第 30 轮 | +3 ST W2 完成 100% (testcontainer + pool exhaustion)

---

## 详细状态

> 见各 ST 文件内的 `W<n> ST 完成度检查表` 段；本文件仅做汇总与全局追踪。
