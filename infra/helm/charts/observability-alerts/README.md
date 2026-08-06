# Business-slices alerting (ADR-0018 §2.1).

ADR-0018 SLO alerting ships as the `observability-alerts` sub-chart.

The chart installs a single `PrometheusRule` CRD with five rules:

1. `RagTTFTLocalP95TooHigh` — RAG TTFT p95 (local) > 1.5s for 3m
2. `CopilotChatErrorRateTooHigh` — Copilot error rate > 5% for 5m
3. `MCPToolDenySpike` — any MCP tool deny in 5m
4. `LLMGWMonthlyQuotaExceeded` — any tenant hits monthly token cap
5. `CrossTenantAttemptP0` — any cross-tenant attempt (single-shot, P0)

Each alert annotation links to the runbook at
`docs/active/runbooks/{llmgw,mcp,secrets-tenancy}.md`.

| Rule | Severity | Owner | Runbook section |
|---|---|---|---|
| RagTTFTLocalP95TooHigh | warning | rag | llmgw.md#rag-ttft-越线 |
| CopilotChatErrorRateTooHigh | warning | copilot | llmgw.md#copilot-错误率越线 |
| MCPToolDenySpike | warning | mcp | mcp.md#tool-deny-spike |
| LLMGWMonthlyQuotaExceeded | info | llmgw | llmgw.md#monthly-quota |
| CrossTenantAttemptP0 | critical | security | secrets-tenancy.md#cross-tenant-p0 |

## Installing

```bash
helm upgrade --install obs-alerts ./charts/observability-alerts \
  -n observability --create-namespace
```

## Testing

```bash
helm template ./charts/observability-alerts | grep -c "alert:"
# → 5
```