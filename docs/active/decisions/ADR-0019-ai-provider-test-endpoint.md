# ADR-0019：AI Provider 连接测试端点（解决 CORS 缺口）

> 状态：**Proposed**
> 日期：2026-08-05
> 关联批次：BUSINESS-SLICES（v3.1 增量）
> 关联设计：ADR-0018 §2.3（SLO 接线 - 测试连通性是 TTFT SLO baseline 的前提）
> 触发来源：AIProvidersPage 测试连接按钮 — 浏览器直连第三方 API 触发 CORS `net::ERR_FAILED` 且未带 Authorization 头。

---

## 1. Context

`apps/web/src/pages/dashboard/admin/AIProvidersPage.tsx` 提供 AI Provider 配置的
可视化与"连接测试"按钮。当前 `handleTest` 实现是浏览器直接 `fetch` 第三方平台
URL（OpenAI / Azure / Ollama / 自定义），这带来两个不可调和的问题：

1. **CORS 拦截**：第三方 LLM 平台为了安全不允许任何 localhost/任意 origin 跨域调用，
   浏览器在 preflight 阶段直接 `net::ERR_FAILED`，永远不会发出真实请求。
2. **API Key 泄漏**：API Key 存放在浏览器 localStorage / IndexedDB（`@mate/shared/auth`），
   即使能 CORS 通过也不应让浏览器持有 LLM 上游 AK（hard rule 12 违反）。

`handleTest` 现实现没有任何"成功"路径——`ok` 状态只能由 200/401/403 触发，但 CORS
失败时连 401/403 都不会到达，导致按钮永远显示"fail"。

## 2. Decision

引入后端**代理式**连接测试端点：

```
POST /api/v1/admin/ai-providers/test
```

由 mate-tech-llmgw 暴露，gateway 转发。请求体携带 Base URL 与 (可选) API Key，
server 端发起 HEAD/GET 请求并返回：

```json
{
  "ok": true,
  "status": 200,
  "latencyMs": 142,
  "provider": "openai",
  "message": "端点可达"
}
```

或失败：

```json
{
  "ok": false,
  "status": 0,
  "latencyMs": 10000,
  "provider": "openai",
  "error": "connect timeout",
  "hint": "检查 Base URL 与网络连通性"
}
```

### 2.1 端点契约

| 字段 | 必填 | 说明 |
|---|---|---|
| `provider` | ✓ | `openai` / `azure` / `ollama` / `custom` |
| `base_url` | ✓ | 完整 URL（含 scheme） |
| `api_key` | ✗ | 不发表示无鉴权；server 端立即清零，**不持久化** |
| `api_version` | ✗ | Azure 才用 |
| `timeout_sec` | ✗ | 默认 10，上限 30 |

### 2.2 server 端实现要点

- **LLMGW 复用 `mate_tech_llmgw.providers.routing`** 现有的多模型路由，HEAD `/models` 探活。
- **Outcome trace**：`llmgw.provider.test` span 包含 `provider` / `base_url_host`（不存路径，避免泄漏）/ `status` / `latency_ms`。
- **不持久化任何 AK**：请求体里的 `api_key` 即用即焚；server 端 audit log 只记"对 provider X 做过连通性测试" 这一事实。
- **per-tenant 限流**：单 tenant 60 次/小时（避免探测攻击 / 暴力扫描）。
- **不在日志/path 中暴露 AK**：survey log 截断为前 4 字符 + `***`。

### 2.3 前端切换

- 移除 `handleTest` 里的浏览器直连 fetch。
- 改为 `apiClient.post('/admin/ai-providers/test', ...)`，由 `@mate/shared/api/client` 注入
  Bearer + X-Tenant-Id。
- 成功/失败仍用 `App.useApp().message.success/error`（已修 antd v6 warning）。
- 章节 1 中提到的 antd v6 warning 同步修复（`App.useApp()` 替代静态 `message`）。

### 2.4 配套改动

| 项 | 范围 | 状态 |
|---|---|---|
| ADR-0018 §2.3 SLO 接线 | 扩成"测试连接延迟 < 500ms" 子 SLO | New |
| Mate-check 测试 | 第三方 API 不可用时 mock server 返回 200 | LLMGW tests |
| OpenAPI | `swagger/specs/admin/ai-providers.yaml` 新增 POST | OpenAPI CI |
| docs/active/runbooks/llmgw.md | "AI Provider 测试连接失败" 排查 | New |

## 3. Decision Drivers

| Driver | Priority | Evidence | Tradeoff |
|---|---|---|---|
| CORS 不可绕过 | P0 | 浏览器安全模型硬约束 | 必须 server-side 代理 |
| API Key 不进浏览器 | P0 | hard rule 12 强约束 | 必须 server-side 持有 |
| 测试连接应反映真实时延 | P1 | 浏览器 SDK 时延不可信 | server 与 LLM 上游直连 |
| 灰度风险 | P1 | 后端新代码 + 新 spec | feature flag / 默认走 mock |
| 全平台 4 个 provider | P1 | 兼容性覆盖 | 路由表与 LLMGW 复用 |

## 4. Options Considered

| Option | Benefits | Costs | Risks | Selected Because |
|---|---|---|---|---|
| A. **保留浏览器直连 + 关 CORS** | 改动最小 | 不可行（第三方不允许） | 必须 reject | ❌ |
| B. **保留浏览器直连 + `mode: 'no-cors'`** | 不报 ERR_FAILED | opaque response 拿不到 status，无法判断 OK/fail | 假阳性 | ❌ |
| C. **Server-side 代理 (本 ADR)** | 正确路径、与现有 LLMGW 复用 | 需后端 + spec + 前端切换 | 多 1-2 天 | ✅ |
| D. **第三方 oauth proxy 模式** | 一劳永逸 | 需每个 provider 单独 OAuth | 跨平台差异大 | rejected（成本>收益） |

## 5. Status

**Proposed** → 待以下条件晋升 **Accepted**：

1. LLMGW `POST /api/v1/llmgw/providers/test` 实现 + 4 tests。
2. admin api 转发 spec 落地 + OpenAPI CI 通过。
3. 前端 `handleTest` 切换完成 + Playwright e2e 通过。
4. runbook 更新。

## 6. Bounded Context Map

| Context | Responsibility | Owner | Upstream | Downstream |
|---|---|---|---|---|
| `AIProvidersPage` (web) | UI 表单 + 触发测试 | Frontend | admin BFF | 后端代理 |
| admin BFF | API 网关层转发 | Gateway | web | LLMGW |
| `llmgw/providers/test` | 服务端连通性探测 | LLMGW | admin BFF | upstream provider |
| `ProviderRegistry` | 路径生成（OpenAI/Azure/Ollama） | LLMGW | existing | test handler |

## 7. Runtime Dependency Adoption

| Dependency | Failure Mode | Timeout/Retry/Fallback | Adoption Criteria |
|---|---|---|---|
| outbound HTTPS | 网络/防火墙阻断 | 10s timeout；只 1 次重试 | 503 always |
| LLMGW MCP provider | 缺 adapter | 返回 501 + 该 provider 标记 unset | 不 5xx |
| AK holder | 缺失 | 返回 401（无须自己处理） | 现状 401/403 |

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| 触碰第三方 API 频率触发限流 | Medium | 用户体验降级 | per-tenant 60/hour | LLMGW |
| AK 泄漏到日志 | Low | 严重安全事故 | survey log 截断 | LLMGW |
| Provider 路径变化（OpenAI 改 endpoint）| Medium | 测试失真 | 路径表集中 + 监控 | LLMGW |
| 灰度引入回归 | Low | 联调失败 | feature flag + mock 默认 | Frontend |

## 9. Consequences

**正面**：

- 浏览器不再持有 LLM 上游 AK。
- 测试结果反映 server-to-LLM 真实时延。
- 与 ADR-0018 SLO 闭环（test 接入 timing 是 TTFT SLO baseline）。
- 后续可扩展为"全平台 联通性监测" 定时任务。

**负面**：

- 4 个 provider 的路径表需持续维护。
- LLMGW 多一处公开端点，需 acl 校验 admin role。

## 10. Evidence

- 复现：`http://localhost:5173/dashboard/admin/ai-providers` 点"测试连接" → `net::ERR_FAILED`。
- antd v6 message 文档：https://ant.design/components/message (App.useApp)
- 第三方 OK/fail 判别标准：HTTP 200/401/403 = 端点可达。

## 11. Revisit Triggers

- 全部 4 个 provider 测试可靠。
- 浏览器 ↔ 后端跨域策略放宽（unlikely）。
- 用户报"测试连接" 但实际 LLM 调用正常 → 检查端点契约。

---

## 配套 checklist（实施）

- [ ] `mate-tech-llmgw/api/routes.py` 加 `POST /api/v1/llmgw/providers/test`
- [ ] `mate_tech_llmgw/providers/test.py` 探测服务（4 个 provider 路径表）
- [ ] `swagger/specs/admin/ai-providers.yaml` 转发 spec
- [ ] `apps/web/src/api/admin/aiProviders.ts` 新增 client（已存在 `configs.ts` 同位置）
- [ ] `AIProvidersPage.tsx` `handleTest` 改用 `apiClient.post`
- [ ] `mate-tech-llmgw/tests/test_provider_test.py` 4 case（全 4 provider + 不可达）
- [ ] `docs/active/runbooks/llmgw.md` 加 "AI Provider 测试连接失败" 排查章
- [ ] ADR-0018 §2.3 增补 test latency 子 SLO