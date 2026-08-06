# mate-app-copilot Runbook (BUSINESS-SLICES P2 W2 + ADR-0018 §2.1)

## 概述

Mate Platform Copilot 是面向业务的 AI 助手包，集成 SQL Copilot / 代码生成 / NLQ /
调度 / Action / 多模态 / A2A 委派。35/35 endpoint 已上线（P2-W2 → P3-W7）。

## 启动

```bash
cd packages/mate-app-copilot
uv run --package mate-app-copilot python -m mate_app_copilot.main
```

## SLO（ADR-0018 §2.1）

| Journey | SLO | 当前基线 |
|---|---|---|
| Copilot chat 任务完成率 | ≥ 99% | dev 暂未统计 |
| Tool execute 成功率 | ≥ 95% | 待 P3-W7 之后统计 |

## SLO 越线（ADR-0018 §2.1）

### Copilot 错误率越线

**触发**：`CopilotChatErrorRateTooHigh`（error rate > 5% 持续 5m）

1. Grafana `Copilot Outcome by Tenant` dashboard，按 `outcome=error` 切片。
2. Tempo trace `service.name=mate-app-copilot`，筛选 `copilot.invoke` span。
3. 子 span 异常定位：
   * `llmgw.chat` → 看 provider API key（[llmgw runbook](llmgw.md#copilot-错误率越线)）
   * `rag.retrieve` → 看 RAG TTFT 越线（[llmgw runbook](llmgw.md#rag-ttft-越线)）
   * `tool.execute` → 看 MCP tool deny（[mcp runbook](mcp.md#tool-deny-spike)）
4. 必要时切到 `MATE_COPILOT_LLM_MODE=stub` 进入降级（ADR-0018 §2.4）。
5. 升级路径：copilot oncall → platform oncall。

### NL2SQL 越权（DROP/INSERT 等写操作）

**触发**：`MatePlatformTenancyCrossTenantAttempt{reason="nl2sql"}` > 0

1. 看 `analysis/generate-sql` / `analysis/execute-sql` 端点 trace。
2. 在 `mate_app_copilot/api/app.py` 的 `analysis/execute-sql` 校验 SQL
   parser 是否拦截写操作（DROP/DELETE/INSERT/UPDATE）。
3. 若 SQL 已下发到 PG → 立即 ROLLBACK 审计 + 联系租户 admin。
4. 升级路径：copilot oncall → security oncall。

## 故障排查

| 现象 | 排查 |
|---|---|
| 401 | JWT iss/aud/tenant_id 校验 |
| 403 | tenant_id 与 ctx 不一致；NL2SQL 越权 |
| 5xx | llmgw 上游 + A2A federation |
| SSE 流截断 | 检查 `MATE_LLMGW_HOST/PORT` env |
| A2A 委派失败 | 看 federation registry 与 allowed_agents |